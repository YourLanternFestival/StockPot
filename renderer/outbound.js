// ===== Export Outbound =====
async function exportOutbound() {
  try {
    const records = await window.api.getOutbound({});
    if (records.length === 0) { showToast('无出库数据可导出', 'error'); return; }
    const header = ['日期', '材料', '数量', '单位', '领取人'];
    const wsData = [header];
    records.forEach(r => wsData.push([formatDate(r.date), r.product_name, r.quantity, r.unit, r.recipient]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), '出库记录');
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const result = await window.api.exportXlsx(Array.from(new Uint8Array(wbout)), '出库记录.xlsx');
    if (!result.success) { if (result.error === '已取消') return; throw new Error(result.error); }
    showToast('导出成功！');
  } catch (err) { showToast('导出失败: ' + err.message, 'error'); }
}

// ===== Outbound Table =====
let outboundInitialized = false;

function initOutboundPage() {
  const tbody = document.getElementById('outbound-tbody');
  if (!outboundInitialized) {
    addOutboundRows(APP_SETTINGS.outbound_rows);
    bindCtrlDFill('outbound-tbody');
    outboundInitialized = true;
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
  loadRecentOutbound();
}

function addOutboundRows(count = 5) {
  const tbody = document.getElementById('outbound-tbody');
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
      <td><input type="text" class="cell-input" value="" data-field="stock" readonly tabindex="-1"></td>
      <td><input type="date" class="cell-input cell-editable" value="${today}" data-field="date" data-date-default="${today}"></td>
      <td>
        <select class="cell-input cell-editable" data-field="recipient">
          <option value="">选择...</option>
          ${RECIPIENTS.map(r => `<option value="${r.name}">${r.name}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="removeOutboundRow(this)">×</button></td>
    `;
    tbody.appendChild(tr);

    bindOutboundRowEvents(tr);
  }
}

function appendOutboundRow(tbody) {
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
    <td><input type="text" class="cell-input" value="" data-field="stock" readonly tabindex="-1"></td>
    <td><input type="date" class="cell-input cell-editable" value="${today}" data-field="date" data-date-default="${today}"></td>
    <td>
      <select class="cell-input cell-editable" data-field="recipient">
        <option value="">选择...</option>
        ${RECIPIENTS.map(r => `<option value="${r.name}">${r.name}</option>`).join('')}
      </select>
    </td>
    <td><button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="removeOutboundRow(this)">×</button></td>
  `;
  tbody.appendChild(tr);
  bindOutboundRowEvents(tr);
  return tr;
}

function removeOutboundRow(btn) {
  const tr = btn.closest('tr');
  tr.remove();
  renumberRows('outbound-tbody');
}

function bindOutboundRowEvents(tr) {
  const tbody = document.getElementById('outbound-tbody');
  bindTableRowEvents(tr, tbody, {
    onSelect: selectOutboundProduct,
    onAutocomplete: handleOutboundProductAutocomplete,
    onProductSelect: selectOutboundProduct,
    onProductBlur: handleStockProductBlur,
    onAppendRow: appendOutboundRow,
  });
}

async function handleOutboundProductAutocomplete(input) {
  const keyword = input.value.trim();
  if (keyword.length < 1) {
    hideAutocomplete();
    return;
  }

  const td = input.closest('td');
  const dropdown = td.querySelector('.autocomplete-dropdown');
  if (!dropdown) return;

  const inventory = await window.api.getInventory();
  let results = inventory.filter(p =>
    p.name.toLowerCase().includes(keyword.toLowerCase()) && p.stock > 0
  );

  results = sortAutocompleteResults(results, keyword);

  if (results.length === 0) {
    hideAutocomplete();
    return;
  }

  dropdown.innerHTML = results.map((item, idx) => `
    <div class="autocomplete-item" data-index="${idx}" data-id="${item.id}" data-name="${item.name}" data-spec="${item.spec || ''}" data-unit="${item.unit || ''}" data-stock="${item.stock}">
      <span class="item-name">${item.name}</span>
      <span class="item-spec">${item.spec || ''} | 库存: ${item.stock} ${item.unit || ''}</span>
    </div>
  `).join('');

  positionAutocompleteDropdown(input, dropdown);
  dropdown.style.display = 'block';
  autocompleteIndex = -1;

  dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectOutboundProduct(input, item);
    });
  });
}

function selectOutboundProduct(input, item) {
  const tr = input.closest('tr');
  tr.querySelector('[data-field="product_name"]').value = item.dataset.name;
  tr.querySelector('[data-field="spec"]').value = item.dataset.spec;
  tr.querySelector('[data-field="unit"]').value = item.dataset.unit;
  tr.querySelector('[data-field="stock"]').value = item.dataset.stock;
  tr.dataset.productId = item.dataset.id;
  hideAutocomplete();

  if (APP_SETTINGS.auto_focus_qty !== 'off') {
    const qtyInput = tr.querySelector('[data-field="quantity"]');
    if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
  }
}

async function submitOutboundBatch() {
  const tbody = document.getElementById('outbound-tbody');
  const rows = tbody.querySelectorAll('tr');
  const records = [];
  const skipped = [];
  const inventory = await window.api.getInventory();

  await ensureProducts();

  let rowIdx = 0;
  for (const tr of rows) {
    rowIdx++;
    const nameInput = tr.querySelector('[data-field="product_name"]');
    const qtyInput = tr.querySelector('[data-field="quantity"]');
    const dateInput = tr.querySelector('[data-field="date"]');
    const recipientSelect = tr.querySelector('[data-field="recipient"]');
    const name = nameInput ? nameInput.value.trim() : '';
    const qty = qtyInput ? parseFloat(qtyInput.value) : NaN;
    const date = dateInput ? dateInput.value : '';
    const recipient = recipientSelect ? recipientSelect.value : '';

    if (!name || isNaN(qty) || qty <= 0 || !date || !recipient) {
      if (name || !isNaN(qty) || date || recipient) {
        const missing = [];
        if (!name) missing.push('品名');
        if (isNaN(qty) || qty <= 0) missing.push('数量');
        if (!date) missing.push('日期');
        if (!recipient) missing.push('领取人');
        skipped.push(`第${rowIdx}行：缺少${missing.join('、')}`);
      }
      continue;
    }

    const product = PRODUCTS.find(p => p.name === name);
    if (!product) {
      skipped.push(`第${rowIdx}行："${name}" 不在产品库中，请先在产品管理中添加`);
      continue;
    }

    const inv = inventory.find(x => x.id === product.id);
    if (inv && qty > inv.stock) {
      skipped.push(`第${rowIdx}行：${name} 库存不足（当前: ${inv.stock}，需要: ${qty}）`);
      continue;
    }

    records.push({
      product_id: product.id,
      date,
      quantity: qty,
      recipient,
    });
  }

  if (records.length === 0) {
    const msg = skipped.length > 0
      ? `没有可提交的记录。\n${skipped.join('\n')}`
      : '没有有效的出库记录';
    showToast(msg, 'error');
    return;
  }

  if (skipped.length > 0) {
    const rowsPreview = records.map(r =>
      `<tr><td>${r.date}</td><td>${PRODUCTS.find(p=>p.id===r.product_id)?.name||r.product_id}</td><td>${r.quantity}</td><td>${r.recipient}</td></tr>`
    ).join('');
    openModal('确认提交', `
      <p>共 <strong>${records.length}</strong> 条有效记录将提交：</p>
      <table style="width:100%;font-size:13px;margin:8px 0;">
        <tr><th>日期</th><th>品名</th><th>数量</th><th>领取人</th></tr>
        ${rowsPreview}
      </table>
      ${skipped.length > 0 ? `<p style="color:var(--warning);margin-top:8px;">⚠ 跳过的行：<br>${skipped.map(s => `· ${s}`).join('<br>')}</p>` : ''}
    `, `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="confirm-outbound-submit">确认提交</button>
    `);
    document.getElementById('confirm-outbound-submit').addEventListener('click', async () => {
      closeModal();
      await doSubmitOutbound(records);
    });
    return;
  }

  await doSubmitOutbound(records);
}

async function doSubmitOutbound(records) {
  const tbody = document.getElementById('outbound-tbody');
  try {
    await window.api.batchAddOutbound(records);
  } catch (err) {
    showToast('出库保存失败: ' + err.message, 'error');
    return;
  }

  showToast(`成功出库 ${records.length} 条记录`);
  tbody.innerHTML = '';
  outboundInitialized = false;
  initOutboundPage();
}

async function loadRecentOutbound() {
  const container = document.getElementById('outbound-history-tree');
  const card = container?.closest('.card');
  if (APP_SETTINGS.outbound_history === 'off') {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';
  if (!container) return;
  try {
    const records = await window.api.getOutbound({});
    const tree = groupRecordsByDate(records);
    container.innerHTML = renderHistoryTree(tree, 'outbound');
  } catch (err) {
    console.error('Load recent outbound error:', err);
  }
}

function editOutbound(r) {
  const recipientOptions = RECIPIENTS.map(rc => `<option value="${rc.name}" ${rc.name === r.recipient ? 'selected' : ''}>${rc.name}</option>`).join('');
  openModal('编辑出库记录', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>材料</label><input type="text" class="form-control" value="${r.product_name}" readonly></div>
      <div class="form-group"><label>数量</label><input type="number" class="form-control" id="eo-qty" value="${r.quantity}"></div>
      <div class="form-group"><label>出库日期</label><input type="date" class="form-control" id="eo-date" value="${formatDate(r.date)}"></div>
      <div class="form-group"><label>领取人</label><select class="form-control" id="eo-recipient">${recipientOptions}</select></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doEditOutbound(${r.id})">保存</button>
  `);
}

async function doEditOutbound(id) {
  await window.api.updateOutbound(id, {
    date: document.getElementById('eo-date').value,
    quantity: parseFloat(document.getElementById('eo-qty').value),
    recipient: document.getElementById('eo-recipient').value.trim(),
  });
  closeModal();
  showToast('已更新');
  loadRecentOutbound();
}

async function deleteOutbound(id) {
  openModal('确认删除', '<p>确定要删除这条出库记录吗？</p>', `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doDeleteOutbound(${id})">确认删除</button>
  `);
}

async function doDeleteOutbound(id) {
  try {
    await window.api.deleteOutbound(id);
    // Verify deletion actually persisted to disk
    const stillExists = await window.api.recordExists('outbound_records', id);
    if (stillExists) {
      closeModal();
      showToast('删除异常：记录仍然存在于数据库！', 'error');
      return;
    }
    closeModal();
    showToast('已删除');
    loadRecentOutbound();
  } catch (err) {
    closeModal();
    showToast('删除失败: ' + err.message, 'error');
  }
}

async function addRecipient() {
  openModal('新增领取人', `
    <div class="form-group"><label>领取人名称</label><input type="text" class="form-control" id="new-recipient-name" placeholder="请输入名称"></div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddRecipient()">添加</button>
  `);
}

async function doAddRecipient() {
  const name = document.getElementById('new-recipient-name').value.trim();
  if (!name) return;
  await window.api.addRecipient(name);
  await refreshRecipientSelects();
  closeModal();
  showToast(`已添加: ${name}`);
}

async function refreshRecipientSelects() {
  RECIPIENTS = await window.api.getRecipients();
  // Refresh all recipient selects in outbound table
  document.querySelectorAll('#outbound-tbody select[data-field="recipient"]').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = '<option value="">选择...</option>' +
      RECIPIENTS.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    sel.value = val;
  });
}

// ===== 管理领取人弹窗 =====
function showManageRecipients() {
  const recipientsHtml = RECIPIENTS.map((r, idx) => `
    <div class="recipient-item" data-id="${r.id}" data-name="${r.name}" draggable="true">
      <div class="recipient-drag-handle">⠿</div>
      <span class="recipient-name">${r.name}</span>
      <div class="recipient-actions">
        <button class="btn btn-sm" onclick="editRecipient(${r.id}, '${r.name.replace(/'/g, "\\'")}')" title="编辑">✏️</button>
        <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteRecipient(${r.id}, '${r.name.replace(/'/g, "\\'")}')" title="删除">×</button>
      </div>
    </div>
  `).join('');

  openModal('管理领取人', `
    <div class="recipient-manager">
      <div class="recipient-add-row">
        <input type="text" class="form-control" id="new-recipient-input" placeholder="输入新领取人名称..." onkeydown="if(event.key==='Enter')addNewRecipient()">
        <button class="btn btn-primary" onclick="addNewRecipient()">添加</button>
      </div>
      <div class="recipient-list" id="recipient-list">
        ${recipientsHtml}
      </div>
      <div class="recipient-hint">
        <small class="text-muted">💡 拖拽可调整顺序，修改后自动保存</small>
      </div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">关闭</button>
  `);

  // 初始化拖拽排序
  initRecipientDragSort();
}

// 添加新领取人
async function addNewRecipient() {
  const input = document.getElementById('new-recipient-input');
  const name = input.value.trim();
  if (!name) return;

  // 检查是否已存在
  if (RECIPIENTS.some(r => r.name === name)) {
    showToast('该领取人已存在', 'error');
    return;
  }

  await window.api.addRecipient(name);
  await refreshRecipientSelects();
  input.value = '';
  showToast(`已添加: ${name}`);

  // 刷新弹窗内容
  showManageRecipients();
}

// 编辑领取人
function editRecipient(id, oldName) {
  openModal('编辑领取人', `
    <div class="form-group">
      <label>领取人名称</label>
      <input type="text" class="form-control" id="edit-recipient-name" value="${oldName}">
    </div>
  `, `
    <button class="btn" onclick="showManageRecipients()">取消</button>
    <button class="btn btn-primary" onclick="doEditRecipient(${id})">保存</button>
  `);
}

async function doEditRecipient(id) {
  const newName = document.getElementById('edit-recipient-name').value.trim();
  if (!newName) return;

  await window.api.updateRecipient(id, newName);
  await refreshRecipientSelects();
  showToast('已更新');
  showManageRecipients();
}

// 删除领取人
function deleteRecipient(id, name) {
  openModal('确认删除', `<p>确定要删除领取人 "<strong>${name}</strong>" 吗？</p>`, `
    <button class="btn" onclick="showManageRecipients()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doDeleteRecipient(${id})">确认删除</button>
  `);
}

async function doDeleteRecipient(id) {
  await window.api.deleteRecipient(id);
  await refreshRecipientSelects();
  showToast('已删除');
  showManageRecipients();
}

// 拖拽排序
function initRecipientDragSort() {
  const list = document.getElementById('recipient-list');
  if (!list) return;

  let dragItem = null;

  list.querySelectorAll('.recipient-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      dragItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      if (dragItem) dragItem.classList.remove('dragging');
      dragItem = null;
      // 保存新顺序
      saveRecipientOrder();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const afterElement = getDragAfterElement(list, e.clientY);
      if (afterElement == null) {
        list.appendChild(dragItem);
      } else {
        list.insertBefore(dragItem, afterElement);
      }
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.recipient-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function saveRecipientOrder() {
  const list = document.getElementById('recipient-list');
  const items = list.querySelectorAll('.recipient-item');
  const order = Array.from(items).map(item => item.dataset.name);

  await window.api.updateRecipientOrder(order);
  await refreshRecipientSelects();
  showToast('顺序已保存');
}
