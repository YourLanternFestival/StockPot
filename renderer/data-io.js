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
    const inventory = await window.api.getInventory();
    const wsData = [['序号', '材料名称', '规格', '单位', '当前库存', '累计入库', '累计出库']];
    inventory.forEach((p, i) => {
      wsData.push([i + 1, p.name, p.spec, p.unit, p.stock, p.total_in, p.total_out]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '库存数据');
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const result = await window.api.exportXlsx(Array.from(new Uint8Array(wbout)), '库存数据.xlsx');
    if (!result.success) {
      if (result.error === '已取消') return;
      throw new Error(result.error);
    }
    showToast('导出成功！');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

async function exportAll() {
  try {
    // 只导出有效产品（active=1），已停用的不导出，避免重新导入时复活
    const products = await window.api.getProducts();
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

    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const result = await window.api.exportXlsx(Array.from(new Uint8Array(wbout)), '全部数据导出.xlsx');
    if (!result.success) {
      if (result.error === '已取消') return;
      throw new Error(result.error);
    }
    showToast('导出成功！');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

// ===== 列映射导入 =====
const MAP_FIELD_DEFS = [
  { key: 'name', label: '材料名称', required: true, group: '产品' },
  { key: 'spec', label: '规格', required: false, group: '产品' },
  { key: 'unit', label: '单位', required: false, group: '产品' },
  { key: 'shelfMonths', label: '保质期(月)', required: false, group: '产品' },
  { key: 'shelfDays', label: '保质期(日)', required: false, group: '产品' },
  { key: 'openingStock', label: '期初库存', required: false, group: '产品' },
  { key: 'inDate', label: '入库日期', required: false, group: '入库' },
  { key: 'inQty', label: '入库数量', required: false, group: '入库' },
  { key: 'inProdDate', label: '生产日期', required: false, group: '入库' },
  { key: 'inExpiry', label: '到期日', required: false, group: '入库' },
  { key: 'inRemark', label: '入库备注', required: false, group: '入库' },
  { key: 'outDate', label: '出库日期', required: false, group: '出库' },
  { key: 'outQty', label: '出库数量', required: false, group: '出库' },
  { key: 'recipient', label: '领取人', required: false, group: '出库' },
];

let mapFileHeaders = [];
let mapFileData = null;
let mapFileSheetName = '';

async function handleMapFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('map-file-name').textContent = file.name;

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
    const sheetName = wb.SheetNames[0];
    mapFileSheetName = sheetName;
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length === 0) { showToast('文件为空', 'error'); return; }

    // 取第一行作为表头
    mapFileHeaders = rows[0].map((h, i) => ({
      index: i,
      label: String(h || '').trim() || columnLabel(i),
    }));
    mapFileData = rows.slice(1).filter(r => r.some(c => c !== '' && c !== null && c !== undefined));

    renderMapConfig();
  } catch (err) {
    showToast('文件解析失败: ' + err.message, 'error');
  }
}

function columnLabel(idx) {
  let label = '';
  let n = idx;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label + '列';
}

function renderMapConfig() {
  const area = document.getElementById('map-config-area');
  area.style.display = 'block';

  const groups = {};
  MAP_FIELD_DEFS.forEach(d => {
    if (!groups[d.group]) groups[d.group] = [];
    groups[d.group].push(d);
  });

  let html = '<div style="display:flex;gap:16px;flex-wrap:wrap;">';
  for (const [group, fields] of Object.entries(groups)) {
    html += `<div style="flex:1;min-width:200px;"><h5 style="margin:0 0 8px;color:var(--primary);">${group}</h5>`;
    html += '<table style="width:100%;font-size:13px;">';
    fields.forEach(f => {
      const options = mapFileHeaders.map(h =>
        `<option value="${h.index}">${h.label}</option>`
      ).join('');
      html += `
        <tr>
          <td style="padding:3px 8px 3px 0;white-space:nowrap;">${f.label}${f.required ? ' <span style="color:var(--danger);">*</span>' : ''}</td>
          <td style="padding:3px 0;">
            <select class="form-control" id="map-${f.key}" style="width:100%;font-size:12px;padding:4px;">
              <option value="">-- 不映射 --</option>
              ${options}
            </select>
          </td>
        </tr>`;
    });
    html += '</table></div>';
  }
  html += '</div>';

  html += `
    <div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="executeMapImport()">执行映射导入</button>
      <button class="btn btn-sm" onclick="previewMapImport()">预览前5行</button>
      <span class="text-muted" style="font-size:12px;">共 ${mapFileData.length} 行数据 | 表: ${mapFileSheetName}</span>
    </div>
    <div id="map-preview-area" style="margin-top:12px;display:none;"></div>
  `;

  area.innerHTML = html;
}

function getMapFieldValues(row) {
  const result = {};
  for (const f of MAP_FIELD_DEFS) {
    const sel = document.getElementById(`map-${f.key}`);
    if (!sel || sel.value === '') { result[f.key] = null; continue; }
    result[f.key] = String(row[parseInt(sel.value)] || '').trim();
  }
  return result;
}

function previewMapImport() {
  const preview = document.getElementById('map-preview-area');
  preview.style.display = 'block';

  const rows = mapFileData.slice(0, 5);
  let html = '<table class="table" style="font-size:11px;"><thead><tr><th>行</th>';
  const mappedFields = [];
  for (const f of MAP_FIELD_DEFS) {
    const sel = document.getElementById(`map-${f.key}`);
    if (sel && sel.value !== '') {
      html += `<th>→${f.label}</th>`;
      mappedFields.push(f);
    }
  }
  html += '</tr></thead><tbody>';

  rows.forEach((row, ri) => {
    html += `<tr><td>${ri + 1}</td>`;
    mappedFields.forEach(f => {
      const sel = document.getElementById(`map-${f.key}`);
      const colIdx = parseInt(sel.value);
      html += `<td>${escHtml(String(row[colIdx] || ''))}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  preview.innerHTML = html;
}

async function executeMapImport() {
  const mapped = getMapFieldValues(mapFileData[0]);
  if (!mapped.name) {
    showToast('请至少映射"材料名称"列', 'error');
    return;
  }

  const productNames = new Set();
  const products = [];
  const inbounds = [];
  const outbounds = [];
  const openingStockMap = {};

  for (const row of mapFileData) {
    const vals = getMapFieldValues(row);
    if (!vals.name) continue;

    if (!productNames.has(vals.name)) {
      productNames.add(vals.name);
      products.push({
        name: vals.name,
        spec: vals.spec || '',
        unit: vals.unit || '',
        shelfMonths: parseInt(vals.shelfMonths) || 0,
        shelfDays: parseInt(vals.shelfDays) || 0,
      });
      if (vals.openingStock) {
        openingStockMap[vals.name] = parseFloat(vals.openingStock) || 0;
      }
    }

    if (vals.inDate || vals.inQty) {
      inbounds.push({
        name: vals.name,
        date: vals.inDate || todayStr(),
        quantity: parseFloat(vals.inQty) || 0,
        remark: vals.inRemark || '',
        productionDate: vals.inProdDate || null,
        expiryDate: vals.inExpiry || null,
      });
    }

    if (vals.outDate || vals.outQty) {
      outbounds.push({
        name: vals.name,
        date: vals.outDate || todayStr(),
        quantity: parseFloat(vals.outQty) || 0,
        recipient: vals.recipient || '',
      });
    }
  }

  if (products.length === 0) {
    showToast('未识别到有效数据，请检查列映射', 'error');
    return;
  }

  openModal('确认列映射导入', `
    <p>即将导入以下数据（<strong>追加模式</strong>，不会清空现有数据）：</p>
    <div style="margin-top:8px;display:flex;gap:12px;">
      <span class="tag tag-success">产品: ${products.length}条</span>
      ${inbounds.length > 0 ? `<span class="tag tag-info">入库: ${inbounds.length}条</span>` : ''}
      ${outbounds.length > 0 ? `<span class="tag tag-info">出库: ${outbounds.length}条</span>` : ''}
      ${Object.keys(openingStockMap).length > 0 ? `<span class="tag">期初库存: ${Object.keys(openingStockMap).length}条</span>` : ''}
    </div>
    <p style="margin-top:8px;color:var(--text-muted);font-size:13px;">已存在的产品会跳过，入库/出库记录会追加导入</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doExecuteMapImport()">确认导入</button>
  `);

  window._mapImportData = { products, inbounds, outbounds, openingStockMap };
}

async function doExecuteMapImport() {
  const data = window._mapImportData;
  if (!data) return;
  closeModal();
  showToast('正在导入...', 'info');

  try {
    const pResult = await window.api.importProducts(data.products);
    let msg = `产品: ${pResult.imported}条 (跳过${pResult.skipped}条)`;

    if (Object.keys(data.openingStockMap).length > 0) {
      await window.api.importOpeningStock(data.openingStockMap);
      msg += ` | 期初库存: ${Object.keys(data.openingStockMap).length}条`;
    }

    if (data.inbounds.length > 0) {
      const iResult = await window.api.importInbound(data.inbounds);
      msg += ` | 入库: ${iResult.imported}条 (跳过${iResult.skipped}条)`;
    }

    if (data.outbounds.length > 0) {
      const oResult = await window.api.importOutbound(data.outbounds);
      msg += ` | 出库: ${oResult.imported}条 (跳过${oResult.skipped}条)`;
    }

    showToast('导入完成！' + msg);
    window._mapImportData = null;

    await refreshProductSelects();
    await loadRecentInbound();
    await loadRecentOutbound();
  } catch (err) {
    showToast('导入失败: ' + err.message, 'error');
  }
}
