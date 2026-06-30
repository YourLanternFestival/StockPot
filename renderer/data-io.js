// ===== 共享：导入字段定义 =====
const IMPORT_FIELD_DEFS = {
  products: [
    { key: 'name', label: '材料名称', required: true, aliases: ['品名', '名称', '产品名', '产品名称', '货品名'] },
    { key: 'spec', label: '规格', required: false, aliases: ['规格型号', '型号'] },
    { key: 'unit', label: '单位', required: false, aliases: ['计量单位', '包装单位'] },
    { key: 'shelfMonths', label: '保质期(月)', required: false, aliases: ['保质期', '保质月份'] },
    { key: 'shelfDays', label: '保质期(日)', required: false, aliases: ['保质天数'] },
    { key: 'openingStock', label: '期初库存', required: false, aliases: ['初始库存', '上月结存', '当前库存', '库存'] },
  ],
  inbound: [
    { key: 'name', label: '材料名称', required: true, aliases: ['品名', '名称', '产品名'] },
    { key: 'date', label: '入库日期', required: false, aliases: ['日期', '入库时间', '时间'] },
    { key: 'quantity', label: '入库数量', required: false, aliases: ['数量', '入库量'] },
    { key: 'productionDate', label: '生产日期', required: false, aliases: ['生产时间'] },
    { key: 'expiryDate', label: '到期日', required: false, aliases: ['有效期至', '保质期至', '过期日'] },
    { key: 'remark', label: '入库备注', required: false, aliases: ['备注', '说明'] },
  ],
  outbound: [
    { key: 'name', label: '材料名称', required: true, aliases: ['品名', '名称', '产品名'] },
    { key: 'date', label: '出库日期', required: false, aliases: ['日期', '出库时间', '时间'] },
    { key: 'quantity', label: '出库数量', required: false, aliases: ['数量', '出库量'] },
    { key: 'recipient', label: '领取人', required: false, aliases: ['领用人', '领取部门', '领料人', '签收人'] },
  ],
};

// ===== 共享：智能列匹配 =====
function autoMatchColumns(headers, fields) {
  const mapping = {};
  for (const f of fields) {
    // 精确匹配
    let matched = headers.findIndex(h => h === f.label);
    // 别名匹配
    if (matched === -1 && f.aliases) {
      matched = headers.findIndex(h => f.aliases.some(a => h === a));
    }
    // 包含匹配（仅对 >= 2 字的标签）
    if (matched === -1 && f.label.length >= 2) {
      matched = headers.findIndex(h => h.includes(f.label));
    }
    mapping[f.key] = matched >= 0 ? matched : null;
  }
  return mapping;
}

function columnLabel(idx) {
  let label = '';
  let n = idx;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

// ===== 共享：导入弹窗 =====
// config: { type: 'products'|'inbound'|'outbound', groupLabel, onImport(records, mode) }
function showImportDialog(config) {
  const fields = IMPORT_FIELD_DEFS[config.type];
  if (!fields) return;

  // 文件选择 → 解析 → 映射
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.xlsx,.xls';
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length === 0) { showToast('文件为空', 'error'); return; }

      const headers = rows[0].map((h, i) => String(h || '').trim() || columnLabel(i) + '列');
      const dataRows = rows.slice(1).filter(r => r.some(c => c !== '' && c !== null && c !== undefined));
      const autoMapping = autoMatchColumns(headers, fields);

      renderImportMapping(config, fields, headers, dataRows, autoMapping, file.name, sheetName);
    } catch (err) {
      showToast('文件解析失败: ' + err.message, 'error');
    }
  };
  fileInput.click();
}

function renderImportMapping(config, fields, headers, dataRows, autoMapping, fileName, sheetName) {
  // 构建映射表
  let mappingRows = '';
  fields.forEach(f => {
    const matched = autoMapping[f.key];
    const isMatched = matched !== null && matched !== undefined;
    const options = headers.map((h, i) =>
      `<option value="${i}" ${i === matched ? 'selected' : ''}>${escHtml(h)}</option>`
    ).join('');
    mappingRows += `
      <tr>
        <td style="padding:4px 8px;white-space:nowrap;">${f.label}${f.required ? ' <span style="color:var(--danger);">*</span>' : ''}</td>
        <td style="padding:4px 0;">
          <select class="form-control import-map-select" data-key="${f.key}" style="width:100%;font-size:12px;padding:4px;">
            <option value="">-- 不映射 --</option>
            ${options}
          </select>
        </td>
        <td style="padding:4px 8px;font-size:12px;color:${isMatched ? 'var(--success)' : 'var(--danger)'};white-space:nowrap;">
          ${isMatched ? '✓ ' + escHtml(headers[matched]) : '✗ 未匹配'}
        </td>
      </tr>`;
  });

  const modeRadios = config.type === 'products'
    ? `<label style="margin-right:16px;"><input type="radio" name="import-mode" value="append" checked> 追加（跳过已有产品）</label>
       <label><input type="radio" name="import-mode" value="overwrite"> 覆盖（先清空产品再导入）</label>`
    : `<label style="margin-right:16px;"><input type="radio" name="import-mode" value="append" checked> 追加导入</label>
       <label><input type="radio" name="import-mode" value="overwrite"> 覆盖导入（先清空再导入）</label>`;

  openModal(`导入${config.groupLabel} — ${fileName}`, `
    <div style="margin-bottom:8px;color:var(--text-muted);font-size:13px;">表: ${sheetName} | ${dataRows.length} 行数据</div>
    <table style="width:100%;font-size:13px;margin-bottom:12px;">
      <thead><tr><th style="text-align:left;">字段</th><th style="text-align:left;">映射到列</th><th></th></tr></thead>
      <tbody>${mappingRows}</tbody>
    </table>
    <div style="margin-bottom:12px;font-size:13px;">${modeRadios}</div>
    <div id="import-preview-area" style="display:none;margin-top:8px;"></div>
  `, `
    <button class="btn btn-sm" onclick="previewImportMapping(${dataRows.length})" style="margin-right:auto;">预览前5行</button>
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="executeImportMapping('${config.type}', ${dataRows.length})">执行导入</button>
  `);

  // 暂存数据供后续步骤使用
  window._importCtx = { config, fields, headers, dataRows, autoMapping };
}

function getCurrentMapping() {
  const mapping = {};
  document.querySelectorAll('.import-map-select').forEach(sel => {
    if (sel.value !== '') mapping[sel.dataset.key] = parseInt(sel.value);
  });
  return mapping;
}

function previewImportMapping(totalRows) {
  const ctx = window._importCtx;
  if (!ctx) return;
  const mapping = getCurrentMapping();
  const preview = document.getElementById('import-preview-area');
  preview.style.display = 'block';

  const mappedFields = ctx.fields.filter(f => mapping[f.key] !== undefined);
  const rows = ctx.dataRows.slice(0, 5);

  let html = '<table class="table" style="font-size:11px;"><thead><tr><th>#</th>';
  mappedFields.forEach(f => { html += `<th>${f.label}</th>`; });
  html += '</tr></thead><tbody>';

  rows.forEach((row, ri) => {
    html += `<tr><td>${ri + 1}</td>`;
    mappedFields.forEach(f => {
      const colIdx = mapping[f.key];
      html += `<td>${escHtml(String(row[colIdx] || ''))}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  if (totalRows > 5) html += `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">... 共 ${totalRows} 行</div>`;
  preview.innerHTML = html;
}

async function executeImportMapping(type, totalRows) {
  const ctx = window._importCtx;
  if (!ctx) return;
  const mapping = getCurrentMapping();

  // 验证必填字段
  const nameField = ctx.fields.find(f => f.key === 'name');
  if (nameField && mapping[nameField.key] === undefined) {
    showToast('请映射"材料名称"列', 'error');
    return;
  }

  const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'append';
  closeModal();

  // 按映射提取数据
  const records = [];
  for (const row of ctx.dataRows) {
    const rec = {};
    for (const f of ctx.fields) {
      const colIdx = mapping[f.key];
      rec[f.key] = colIdx !== undefined ? String(row[colIdx] || '').trim() : '';
    }
    if (!rec.name) continue;
    records.push(rec);
  }

  if (records.length === 0) {
    showToast('未识别到有效数据', 'error');
    return;
  }

  // 覆盖模式确认
  if (mode === 'overwrite') {
    const typeLabel = ctx.config.groupLabel;
    openModal('确认覆盖导入', `
      <p>将<strong>清空所有${typeLabel}数据</strong>后重新导入，此操作不可撤销。</p>
      <p style="margin-top:8px;color:var(--text-secondary);">${typeLabel}: ${records.length}条</p>
    `, `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="closeModal();doImportExecute('${type}', 'overwrite')">确认覆盖</button>
    `);
    window._importPending = { type, records, mode: 'overwrite' };
    return;
  }

  await doImportExecute(type, 'append', records);
}

async function doImportExecute(type, mode, records) {
  // records may come from _importPending for overwrite mode
  if (!records) {
    const pending = window._importPending;
    if (!pending) return;
    records = pending.records;
    mode = pending.mode;
    window._importPending = null;
  }

  showToast('正在导入...', 'info');

  try {
    if (type === 'products') {
      if (mode === 'overwrite') await window.api.clearProducts();
      const result = await window.api.importProducts(records.map(r => ({
        name: r.name,
        spec: r.spec || '',
        unit: r.unit || '',
        shelfMonths: parseInt(r.shelfMonths) || 0,
        shelfDays: parseInt(r.shelfDays) || 0,
      })));
      // 期初库存
      const stocks = {};
      records.forEach(r => { if (r.openingStock) stocks[r.name] = parseFloat(r.openingStock) || 0; });
      if (Object.keys(stocks).length > 0) await window.api.importOpeningStock(stocks);
      showToast(`产品导入完成: ${result.imported}条 (跳过${result.skipped}条)`);
      if (typeof renderProductTable === 'function') renderProductTable();
    } else if (type === 'inbound') {
      if (mode === 'overwrite') await window.api.clearInbound();
      const result = await window.api.importInbound(records.map(r => ({
        name: r.name,
        date: r.date || todayStr(),
        quantity: parseFloat(r.quantity) || 0,
        remark: r.remark || '',
        productionDate: r.productionDate || null,
        expiryDate: r.expiryDate || null,
      })));
      showToast(`入库导入完成: ${result.imported}条`);
      if (typeof loadRecentInbound === 'function') loadRecentInbound();
    } else if (type === 'outbound') {
      if (mode === 'overwrite') await window.api.clearOutbound();
      const result = await window.api.importOutbound(records.map(r => ({
        name: r.name,
        date: r.date || todayStr(),
        quantity: parseFloat(r.quantity) || 0,
        recipient: r.recipient || '',
      })));
      showToast(`出库导入完成: ${result.imported}条`);
      if (typeof loadRecentOutbound === 'function') loadRecentOutbound();
    }
  } catch (err) {
    showToast('导入失败: ' + err.message, 'error');
  }

  window._importCtx = null;
  window._importPending = null;
}

// ===== 各页面导入入口 =====
function importProducts() {
  showImportDialog({ type: 'products', groupLabel: '产品' });
}
function importInboundRecords() {
  showImportDialog({ type: 'inbound', groupLabel: '入库' });
}
function importOutboundRecords() {
  showImportDialog({ type: 'outbound', groupLabel: '出库' });
}

// ===== 多选导出弹窗 =====
function showExportDialog() {
  openModal('导出数据', `
    <p style="margin-bottom:12px;">勾选要导出的数据类别，将生成同一工作簿分 sheet 的 Excel 文件。</p>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <label class="checkbox-label"><input type="checkbox" id="export-ck-products" checked> 产品列表</label>
      <label class="checkbox-label"><input type="checkbox" id="export-ck-inbound" checked> 入库流水账</label>
      <label class="checkbox-label"><input type="checkbox" id="export-ck-outbound" checked> 出库流水账</label>
      <label class="checkbox-label"><input type="checkbox" id="export-ck-ledger"> 月度台账（当前选中的年月）</label>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doExportSelected()">导出</button>
  `);
}

async function doExportSelected() {
  const sel = {
    products: document.getElementById('export-ck-products')?.checked,
    inbound: document.getElementById('export-ck-inbound')?.checked,
    outbound: document.getElementById('export-ck-outbound')?.checked,
    ledger: document.getElementById('export-ck-ledger')?.checked,
  };
  closeModal();

  if (!sel.products && !sel.inbound && !sel.outbound && !sel.ledger) {
    showToast('请至少勾选一项', 'error');
    return;
  }

  try {
    const wb = XLSX.utils.book_new();

    if (sel.products) {
      const products = await window.api.getProducts();
      const pData = [['序号', '材料名称', '规格', '单位', '保质期(月)', '保质期(日)']];
      products.forEach((p, i) => pData.push([i + 1, p.name, p.spec, p.unit, p.shelf_months, p.shelf_days]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pData), '产品数据');
    }

    if (sel.inbound) {
      const inbound = await window.api.getInbound({});
      const iData = [['序号', '入库时间', '材料名称', '规格', '数量', '单位', '备注', '生产日期', '到期日']];
      inbound.forEach((r, i) => iData.push([i + 1, r.date, r.product_name, r.spec, r.quantity, r.unit, r.remark, r.production_date, r.expiry_date]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(iData), '入库流水账');
    }

    if (sel.outbound) {
      const outbound = await window.api.getOutbound({});
      const oData = [['序号', '出库时间', '名称', '规格', '数量', '单位', '领取人']];
      outbound.forEach((r, i) => oData.push([i + 1, r.date, r.product_name, r.spec, r.quantity, r.unit, r.recipient]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(oData), '出库流水账');
    }

    if (sel.ledger) {
      const year = parseInt(document.getElementById('ledger-year')?.value) || new Date().getFullYear();
      const month = parseInt(document.getElementById('ledger-month')?.value) || (new Date().getMonth() + 1);
      const data = await window.api.getInventoryByMonth(year, month);
      const daysInMonth = new Date(year, month, 0).getDate();
      const active = data.filter(p => p.hasActivity);
      const header = ['序号', '品名', '单位', '上月结存', '本月入库', '本月出库', '当前库存'];
      for (let d = 1; d <= daysInMonth; d++) header.push(`${d}日入库`, `${d}日出库`);
      const rows = active.map((p, i) => {
        const row = [i + 1, p.name, p.unit, p.prevStock, p.monthIn, p.monthOut, p.currentStock];
        for (let d = 1; d <= daysInMonth; d++) {
          const dayData = p.daily[d] || { in: 0, out: 0 };
          row.push(dayData.in || '', dayData.out || '');
        }
        return row;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), `${year}年${month}月台账`);
    }

    const dateStr = todayStr();
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const result = await window.api.exportXlsx(Array.from(new Uint8Array(wbout)), `数据导出_${dateStr}.xlsx`);
    if (!result.success) {
      if (result.error === '已取消') return;
      throw new Error(result.error);
    }
    showToast('导出成功！');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

// ===== 清空所有数据 =====
function clearAllDataPrompt() {
  openModal('⚠️ 清空所有数据', `
    <p style="color:var(--danger);font-weight:600;">此操作将清空所有产品、入库、出库及相关数据！</p>
    <p style="margin-top:8px;">清空后可通过各页面的"导入"功能重新导入。此操作不可撤销。</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doClearAllData()">确认清空</button>
  `);
}

async function doClearAllData() {
  await window.api.clearAllData();
  closeModal();
  showToast('数据已清空');
  if (typeof refreshProductSelects === 'function') await refreshProductSelects();
  if (typeof loadRecentInbound === 'function') loadRecentInbound();
  if (typeof loadRecentOutbound === 'function') loadRecentOutbound();
}

// ===== 导出库存（保留） =====
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
