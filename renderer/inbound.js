// ===== Export Inbound =====
async function exportInbound() {
  try {
    const records = await window.api.getInbound({});
    if (records.length === 0) { showToast('无入库数据可导出', 'error'); return; }
    const header = ['日期', '材料', '数量', '单位', '生产日期', '到期日', '备注'];
    const wsData = [header];
    records.forEach(r => wsData.push([formatDate(r.date), r.product_name, r.quantity, r.unit, formatDate(r.production_date), formatDate(r.expiry_date), r.remark || '']));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), '入库记录');
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const result = await window.api.exportXlsx(Array.from(new Uint8Array(wbout)), '入库记录.xlsx');
    if (!result.success) { if (result.error === '已取消') return; throw new Error(result.error); }
    showToast('导出成功！');
  } catch (err) { showToast('导出失败: ' + err.message, 'error'); }
}

// ===== Inbound Table =====
let inboundInitialized = false;

function initInboundPage() {
  const tbody = document.getElementById('inbound-tbody');
  if (!inboundInitialized) {
    addInboundRows(APP_SETTINGS.inbound_rows);
    bindCtrlDFill('inbound-tbody');
    inboundInitialized = true;
  } else {
    // 页面复用时：未手动修改的日期自动刷新为今天
    const today = todayStr();
    tbody.querySelectorAll('[data-field="date"]').forEach(input => {
      if (input.value === input.dataset.dateDefault) {
        input.value = today;
        input.dataset.dateDefault = today;
      }
    });
  }
  loadRecentInbound();
}

function addInboundRows(count = 5) {
  const tbody = document.getElementById('inbound-tbody');
  const existingRows = tbody.querySelectorAll('tr').length;
  const today = todayStr();

  for (let i = 0; i < count; i++) {
    const rowNum = existingRows + i + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="row-num">${rowNum}</td>
      <td style="position:relative;">
        <input type="text" class="cell-input cell-editable" value="" data-field="product_name" autocomplete="off" placeholder="输入品名...">
        <div class="autocomplete-dropdown" style="display:none;"></div>
      </td>
      <td><input type="text" class="cell-input" value="" data-field="spec" readonly tabindex="-1"></td>
      <td><input type="number" class="cell-input cell-editable" value="" data-field="quantity" placeholder="0"></td>
      <td><input type="text" class="cell-input" value="" data-field="unit" readonly tabindex="-1"></td>
      <td><input type="date" class="cell-input cell-editable" value="${today}" data-field="date" data-date-default="${today}"></td>
      <td><input type="date" class="cell-input cell-editable" value="" data-field="production_date"></td>
      <td><input type="date" class="cell-input" value="" data-field="expiry_date" readonly tabindex="-1"></td>
      <td><input type="text" class="cell-input cell-editable" value="" data-field="remark" placeholder="可选"></td>
      <td><button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="removeInboundRow(this)">×</button></td>
    `;
    tbody.appendChild(tr);

    // Bind events
    bindInboundRowEvents(tr);
  }
}

function appendInboundRow(tbody) {
  const existingRows = tbody.querySelectorAll('tr').length;
  const today = todayStr();
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num">${existingRows + 1}</td>
    <td style="position:relative;">
      <input type="text" class="cell-input cell-editable" value="" data-field="product_name" autocomplete="off" placeholder="输入品名...">
      <div class="autocomplete-dropdown" style="display:none;"></div>
    </td>
    <td><input type="text" class="cell-input" value="" data-field="spec" readonly tabindex="-1"></td>
    <td><input type="number" class="cell-input cell-editable" value="" data-field="quantity" placeholder="0"></td>
    <td><input type="text" class="cell-input" value="" data-field="unit" readonly tabindex="-1"></td>
    <td><input type="date" class="cell-input cell-editable" value="${today}" data-field="date" data-date-default="${today}"></td>
    <td><input type="date" class="cell-input cell-editable" value="" data-field="production_date"></td>
    <td><input type="date" class="cell-input" value="" data-field="expiry_date" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-editable" value="" data-field="remark" placeholder="可选"></td>
    <td><button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="removeInboundRow(this)">×</button></td>
  `;
  tbody.appendChild(tr);
  bindInboundRowEvents(tr);
  return tr;
}

function removeInboundRow(btn) {
  const tr = btn.closest('tr');
  tr.remove();
  renumberRows('inbound-tbody');
}

function bindInboundRowEvents(tr) {
  const tbody = document.getElementById('inbound-tbody');
  bindTableRowEvents(tr, tbody, {
    onSelect: selectInboundProduct,
    onAutocomplete: handleInboundProductAutocomplete,
    onProductSelect: selectInboundProduct,
    onProductBlur: handleStockProductBlur,
    onAppendRow: appendInboundRow,
  });
  // production_date change 触发到期日计算
  const prodInput = tr.querySelector('[data-field="production_date"]');
  if (prodInput) prodInput.addEventListener('change', () => calcRowExpiry(tr));
}

async function handleInboundProductAutocomplete(input) {
  const keyword = input.value.trim();
  if (keyword.length < 1) {
    hideAutocomplete();
    return;
  }

  await ensureProducts();

  const td = input.closest('td');
  const dropdown = td.querySelector('.autocomplete-dropdown');
  if (!dropdown) return;

  let results = PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(keyword.toLowerCase())
  );

  results = sortAutocompleteResults(results, keyword);

  if (results.length === 0) {
    hideAutocomplete();
    return;
  }

  dropdown.innerHTML = results.map((item, idx) => `
    <div class="autocomplete-item" data-index="${idx}" data-id="${item.id}" data-name="${item.name}" data-spec="${item.spec || ''}" data-unit="${item.unit || ''}" data-shelf-months="${item.shelf_months || 0}" data-shelf-days="${item.shelf_days || 0}">
      <span class="item-name">${item.name}</span>
      <span class="item-spec">${item.spec || ''} | ${item.unit || ''}</span>
    </div>
  `).join('');

  positionAutocompleteDropdown(input, dropdown);
  dropdown.style.display = 'block';
  autocompleteIndex = -1;

  dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectInboundProduct(input, item);
    });
  });
}

function selectInboundProduct(input, item) {
  const tr = input.closest('tr');
  tr.querySelector('[data-field="product_name"]').value = item.dataset.name;
  tr.querySelector('[data-field="spec"]').value = item.dataset.spec;
  tr.querySelector('[data-field="unit"]').value = item.dataset.unit;
  tr.dataset.productId = item.dataset.id;
  tr.dataset.shelfMonths = item.dataset.shelfMonths;
  tr.dataset.shelfDays = item.dataset.shelfDays;
  hideAutocomplete();
  calcRowExpiry(tr);

  // Move focus to quantity (configurable)
  if (APP_SETTINGS.auto_focus_qty !== 'off') {
    const qtyInput = tr.querySelector('[data-field="quantity"]');
    if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
  }
}

// 安全解析 YYYY-MM-DD 为本地日期（避免 new Date(str) 按 UTC 解析的时区偏移问题）
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function calcRowExpiry(tr) {
  const prodDate = tr.querySelector('[data-field="production_date"]').value;
  const shelfMonths = parseInt(tr.dataset.shelfMonths) || 0;
  const shelfDays = parseInt(tr.dataset.shelfDays) || 0;
  const totalDays = shelfMonths * 30 + shelfDays;
  const expiryInput = tr.querySelector('[data-field="expiry_date"]');
  if (prodDate && totalDays > 0) {
    const d = parseLocalDate(prodDate);
    if (d) {
      d.setDate(d.getDate() + totalDays);
      expiryInput.value = toLocalDateStr(d);
    }
  } else {
    expiryInput.value = '';
  }
}

async function submitInboundBatch() {
  const tbody = document.getElementById('inbound-tbody');
  const rows = tbody.querySelectorAll('tr');
  const records = [];
  const skipped = [];

  await ensureProducts();

  let rowIdx = 0;
  for (const tr of rows) {
    rowIdx++;
    const nameInput = tr.querySelector('[data-field="product_name"]');
    const qtyInput = tr.querySelector('[data-field="quantity"]');
    const dateInput = tr.querySelector('[data-field="date"]');
    const name = nameInput ? nameInput.value.trim() : '';
    const qty = qtyInput ? parseFloat(qtyInput.value) : NaN;
    const date = dateInput ? dateInput.value : '';

    if (!name || isNaN(qty) || qty <= 0 || !date) {
      if (name || !isNaN(qty) || date) {
        // 部分填写但缺关键字段 → 记录跳过原因
        const missing = [];
        if (!name) missing.push('品名');
        if (isNaN(qty) || qty <= 0) missing.push('数量');
        if (!date) missing.push('日期');
        skipped.push(`第${rowIdx}行：缺少${missing.join('、')}`);
      }
      continue;
    }

    const product = PRODUCTS.find(p => p.name === name);
    if (!product) {
      skipped.push(`第${rowIdx}行："${name}" 不在产品库中，请先在产品管理中添加`);
      continue;
    }

    records.push({
      product_id: product.id,
      date,
      quantity: qty,
      remark: (tr.querySelector('[data-field="remark"]')?.value || '').trim(),
      production_date: (tr.querySelector('[data-field="production_date"]')?.value) || null,
      expiry_date: (tr.querySelector('[data-field="expiry_date"]')?.value) || null,
    });
  }

  if (records.length === 0) {
    const msg = skipped.length > 0
      ? `没有可提交的记录。\n${skipped.join('\n')}`
      : '没有有效的入库记录';
    showToast(msg, 'error');
    return;
  }

  // 有跳过的行时弹确认框，让用户看到哪些行被提交、哪些被跳过
  if (skipped.length > 0) {
    const rowsPreview = records.map(r => {
      const name = escHtml(PRODUCTS.find(p=>p.id===r.product_id)?.name || String(r.product_id));
      return `<tr><td>${escHtml(r.date)}</td><td>${name}</td><td>${escHtml(r.quantity)}</td></tr>`;
    }).join('');
    openModal('确认提交', `
      <p>共 <strong>${records.length}</strong> 条有效记录将提交：</p>
      <table style="width:100%;font-size:13px;margin:8px 0;">
        <tr><th>日期</th><th>品名</th><th>数量</th></tr>
        ${rowsPreview}
      </table>
      ${skipped.length > 0 ? `<p style="color:var(--warning);margin-top:8px;">⚠ 跳过的行：<br>${skipped.map(s => `· ${escHtml(s)}`).join('<br>')}</p>` : ''}
    `, `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="confirm-inbound-submit">确认提交</button>
    `);
    document.getElementById('confirm-inbound-submit').addEventListener('click', async () => {
      closeModal();
      await doSubmitInbound(records);
    });
    return;
  }

  await doSubmitInbound(records);
}

async function doSubmitInbound(records) {
  const tbody = document.getElementById('inbound-tbody');
  try {
    await window.api.batchAddInbound(records);
  } catch (err) {
    showToast('入库保存失败: ' + err.message, 'error');
    return;
  }

  showToast(`成功入库 ${records.length} 条记录`);
  inventoryDetailDirty = true;
  inboundHistoryDirty = true;
  tbody.innerHTML = '';
  inboundInitialized = false;
  initInboundPage();
}

let inboundHistoryDirty = true;

async function loadRecentInbound() {
  const container = document.getElementById('inbound-history-tree');
  const card = container?.closest('.card');
  if (APP_SETTINGS.inbound_history === 'off') {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';
  if (!container) return;
  if (!inboundHistoryDirty) return;
  showLoading();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    const records = await window.api.getInbound({});
    const tree = groupRecordsByDate(records);
    container.innerHTML = renderHistoryTree(tree, 'inbound');
    inboundHistoryDirty = false;
  } catch (err) {
    console.error('Load recent inbound error:', err);
  } finally {
    hideLoading();
  }
}

function markInboundHistoryDirty() { inboundHistoryDirty = true; }

function editInbound(r) {
  // 查找产品的保质期数据，用于编辑时自动重算到期日
  const product = PRODUCTS.find(p => p.id === r.product_id);
  const shelfMonths = product ? (product.shelf_months || 0) : 0;
  const shelfDays = product ? (product.shelf_days || 0) : 0;

  openModal('编辑入库记录', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>材料</label><input type="text" class="form-control" value="${r.product_name}" readonly></div>
      <div class="form-group"><label>数量</label><input type="number" class="form-control" id="ei-qty" value="${r.quantity}"></div>
      <div class="form-group"><label>入库日期</label><input type="date" class="form-control" id="ei-date" value="${formatDate(r.date)}"></div>
      <div class="form-group"><label>生产日期</label><input type="date" class="form-control" id="ei-prod" value="${formatDate(r.production_date)}" onchange="recalcEditExpiry(${shelfMonths}, ${shelfDays})"></div>
      <div class="form-group"><label>到期日</label><input type="date" class="form-control" id="ei-expiry" value="${formatDate(r.expiry_date)}"></div>
      <div class="form-group"><label>备注</label><input type="text" class="form-control" id="ei-remark" value="${r.remark || ''}"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doEditInbound(${r.id})">保存</button>
  `);
}

// 编辑入库弹窗中生产日期变更时重算到期日
function recalcEditExpiry(shelfMonths, shelfDays) {
  const prodDate = document.getElementById('ei-prod')?.value;
  const expiryInput = document.getElementById('ei-expiry');
  if (!prodDate || !expiryInput) return;
  const totalDays = (shelfMonths || 0) * 30 + (shelfDays || 0);
  if (totalDays > 0) {
    const d = parseLocalDate(prodDate);
    if (d) {
      d.setDate(d.getDate() + totalDays);
      expiryInput.value = toLocalDateStr(d);
    }
  }
}

async function doEditInbound(id) {
  await window.api.updateInbound(id, {
    date: document.getElementById('ei-date').value,
    quantity: parseFloat(document.getElementById('ei-qty').value),
    remark: document.getElementById('ei-remark').value.trim(),
    production_date: document.getElementById('ei-prod').value || null,
    expiry_date: document.getElementById('ei-expiry').value || null,
  });
  closeModal();
  showToast('已更新');
  inventoryDetailDirty = true;
  inboundHistoryDirty = true;
  loadRecentInbound();
}

async function deleteInbound(id) {
  openModal('确认删除', '<p>确定要删除这条入库记录吗？</p>', `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doDeleteInbound(${id})">确认删除</button>
  `);
}

async function doDeleteInbound(id) {
  try {
    await window.api.deleteInbound(id);
    // Verify deletion actually persisted to disk
    const stillExists = await window.api.recordExists('inbound_records', id);
    if (stillExists) {
      closeModal();
      showToast('删除异常：记录仍然存在于数据库！', 'error');
      return;
    }
    closeModal();
    showToast('已删除');
    inventoryDetailDirty = true;
    // 局部删除 DOM 行，避免 innerHTML 全量重建导致输入卡顿
    const removed = removeHistoryRowFromDOM(id, 'inbound');
    if (!removed) {
      // DOM 中找不到该行（可能历史树未展开），退回全量刷新
      inboundHistoryDirty = true;
      loadRecentInbound();
    }
  } catch (err) {
    closeModal();
    showToast('删除失败: ' + err.message, 'error');
  }
}
