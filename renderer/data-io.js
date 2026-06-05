// ===== Import Panel =====
function toggleImportPanel() {
  const panel = document.getElementById('import-panel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ===== Import =====
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelected(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFileSelected(fileInput.files[0]);
});

let pendingImportData = null;

function handleFileSelected(file) {
  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      pendingImportData = { products: [], inbound: [], outbound: [], openingStock: {} };

      // Parse 产品数据
      if (wb.SheetNames.includes('产品数据')) {
        const ws = wb.Sheets['产品数据'];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[1]) continue; // skip empty
          pendingImportData.products.push({
            name: String(row[1] || '').trim(),
            spec: String(row[2] || '').trim(),
            unit: String(row[3] || '').trim(),
            shelfMonths: parseInt(row[4]) || 0,
            shelfDays: parseInt(row[5]) || 0,
          });
        }
      }

      // Parse 台账表 → 提取「上月结存」作为初始库存
      // 台账表格式: 序号, 品名, 单位, 上月结存, 入库, 出库, 当前库存, 1日入, 1日出, ...
      for (const sheetName of wb.SheetNames) {
        if (sheetName.includes('台账')) {
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          // Data starts at row 5 (index 4), columns: 0=序号, 1=品名, 2=单位, 3=上月结存
          for (let i = 4; i < rows.length; i++) {
            const row = rows[i];
            const name = String(row[1] || '').trim();
            const openingStock = parseFloat(row[3]) || 0;
            if (name && openingStock > 0) {
              // Only set if not already set (first ledger found wins)
              if (!pendingImportData.openingStock[name]) {
                pendingImportData.openingStock[name] = openingStock;
              }
            }
          }
          break; // Use first ledger sheet found
        }
      }

      // Parse 入库流水账
      if (wb.SheetNames.includes('入库流水账') && document.getElementById('import-inbound').checked) {
        const ws = wb.Sheets['入库流水账'];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[2]) continue;
          pendingImportData.inbound.push({
            name: String(row[2] || '').trim(),
            date: excelSerialToDate(row[1]),
            quantity: parseFloat(row[4]) || 0,
            remark: String(row[6] || '').trim(),
            productionDate: excelSerialToDate(row[7]),
            expiryDate: excelSerialToDate(row[8]),
          });
        }
      }

      // Parse 出库流水账
      if (wb.SheetNames.includes('出库流水账') && document.getElementById('import-outbound').checked) {
        const ws = wb.Sheets['出库流水账'];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[2]) continue;
          pendingImportData.outbound.push({
            name: String(row[2] || '').trim(),
            date: excelSerialToDate(row[1]),
            quantity: parseFloat(row[4]) || 0,
            recipient: String(row[6] || '').trim(),
          });
        }
      }

      // Show preview
      const openingCount = Object.keys(pendingImportData.openingStock).length;
      document.getElementById('import-preview').style.display = 'block';
      document.getElementById('import-preview-stats').innerHTML =
        `<span class="tag">产品: ${pendingImportData.products.length}条</span>` +
        `<span class="tag">入库: ${pendingImportData.inbound.length}条</span>` +
        `<span class="tag">出库: ${pendingImportData.outbound.length}条</span>` +
        (openingCount > 0 ? `<span class="tag tag-success">初始库存: ${openingCount}条</span>` : '');
      showToast(`文件已识别: ${file.name}`, 'info');
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    showToast('文件解析失败: ' + err.message, 'error');
  }
}

async function startImport() {
  if (!pendingImportData) return;

  // Default overwrite: clear existing data before importing
  openModal('确认导入', `
    <p>导入将<strong>清空现有数据</strong>后重新导入，此操作不可撤销。</p>
    <p style="margin-top:8px;color:var(--text-secondary);">产品: ${pendingImportData.products.length}条 | 入库: ${pendingImportData.inbound.length}条 | 出库: ${pendingImportData.outbound.length}条</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doStartImport()">确认导入</button>
  `);
}

async function doStartImport() {
  if (!pendingImportData) return;
  closeModal();
  showToast('正在清空并重新导入...', 'info');

  try {
    await window.api.clearAllData();

    const pResult = await window.api.importProducts(pendingImportData.products);
    let msg = `产品: ${pResult.imported}条`;

    if (Object.keys(pendingImportData.openingStock).length > 0) {
      await window.api.importOpeningStock(pendingImportData.openingStock);
      msg += ` | 初始库存: 已设置`;
    }

    if (pendingImportData.inbound.length > 0) {
      const iResult = await window.api.importInbound(pendingImportData.inbound);
      msg += ` | 入库: ${iResult.imported}条`;
    }

    if (pendingImportData.outbound.length > 0) {
      const oResult = await window.api.importOutbound(pendingImportData.outbound);
      msg += ` | 出库: ${oResult.imported}条`;
    }

    showToast('导入完成！' + msg);
    pendingImportData = null;
    document.getElementById('import-preview').style.display = 'none';

    await refreshProductSelects();
    await loadRecentInbound();
    await loadRecentOutbound();
  } catch (err) {
    showToast('导入失败: ' + err.message, 'error');
  }
}

async function clearAndReimport() {
  openModal('确认清空', `
    <p style="color:var(--danger);font-weight:600;">⚠️ 此操作将清空所有产品、入库、出库数据！</p>
    <p style="margin-top:8px;">清空后可重新导入 xlsx 数据。此操作不可撤销。</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doClearAll()">确认清空</button>
  `);
}

async function doClearAll() {
  await window.api.clearAllData();
  closeModal();
  showToast('数据已清空，请重新导入');
  await refreshProductSelects();
}

// ===== Export =====
async function exportInventory() {
  try {
    const filePath = await window.api.saveFile('库存数据.xlsx');
    if (!filePath) return;

    const inventory = await window.api.getInventory();
    const wsData = [['序号', '材料名称', '规格', '单位', '当前库存', '累计入库', '累计出库']];
    inventory.forEach((p, i) => {
      wsData.push([i + 1, p.name, p.spec, p.unit, p.stock, p.total_in, p.total_out]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '库存数据');
    XLSX.writeFile(wb, filePath);
    showToast('导出成功！');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

async function exportAll() {
  try {
    const filePath = await window.api.saveFile('全部数据导出.xlsx');
    if (!filePath) return;

    const products = await window.api.getAllProducts();
    const inbound = await window.api.getInbound({});
    const outbound = await window.api.getOutbound({});

    const wb = XLSX.utils.book_new();

    // Products sheet
    const pData = [['序号', '材料名称', '规格', '单位', '保质期(月)', '保质期(日)']];
    products.forEach((p, i) => pData.push([i + 1, p.name, p.spec, p.unit, p.shelf_months, p.shelf_days]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pData), '产品数据');

    // Inbound sheet
    const iData = [['序号', '入库时间', '材料名称', '规格', '数量', '单位', '备注', '生产日期', '到期日']];
    inbound.forEach((r, i) => iData.push([i + 1, r.date, r.product_name, r.spec, r.quantity, r.unit, r.remark, r.production_date, r.expiry_date]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(iData), '入库流水账');

    // Outbound sheet
    const oData = [['序号', '出库时间', '名称', '规格', '数量', '单位', '领取人']];
    outbound.forEach((r, i) => oData.push([i + 1, r.date, r.product_name, r.spec, r.quantity, r.unit, r.recipient]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(oData), '出库流水账');

    XLSX.writeFile(wb, filePath);
    showToast('导出成功！');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}
