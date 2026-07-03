// ===== Purchase Mode: Small Canteen (matrix only) =====
// Killed: groups style, switchSmallDisplayStyle, saveAllSmallGroupsData, switchSmallCanteenPage, getSmallCanteenPages

function getSmallCanteens() {
  return APP_SETTINGS.small_canteens || ['寿昌', '梅城', '大同', '大洋', '洋溪', '三都', '乾潭'];
}

// ===== Init =====

function initSmallCanteenMode() {
  const canteens = getSmallCanteens();

  // 联华加购下拉
  const dropdown = document.getElementById('lianhua-dropdown');
  if (dropdown) {
    dropdown.innerHTML = canteens.map(function(c) {
      return '<div class="dropdown-menu-item" onclick="showAddLianhuaDate(' + JSON.stringify(c + '-联华') + '); document.querySelectorAll(\'.dropdown-menu.open\').forEach(function(m) { m.classList.remove(\'open\'); });">' + escHtml(c) + '</div>';
    }).join('');
  }

  initSmallMatrixMode();
}

// ===== Matrix init & render =====

function initSmallMatrixMode() {
  const canteens = getSmallCanteens();
  const area = document.getElementById('small-matrix-area');
  loadAllSmallMatrixData(canteens, area);
}

async function loadAllSmallMatrixData(canteens, area) {
  const allData = {};

  if (window._purchaseShouldLoadData) {
    for (let i = 0; i < canteens.length; i++) {
      const source = canteens[i] + '-厨房';
      const orders = await window.api.getPurchaseOrders(source);
      const today = todayStr();
      for (let oi = 0; oi < orders.length; oi++) {
        const order = orders[oi];
        if (!order.created_at || !order.created_at.startsWith(today)) continue;
        const name = order.product_name;
        if (!name) continue;
        const key = name + (order.spec ? '|||' + order.spec : '');
        if (!allData[key]) {
          allData[key] = { name: name, spec: order.spec || '', unit: order.unit || '', remark: order.remark || '', quantities: {} };
        }
        allData[key].quantities[canteens[i]] = order.quantity || '';
      }
    }
  }

  renderSmallMatrix(area, canteens, Object.keys(allData), allData);
}

function renderSmallMatrix(area, canteens, keys, allData) {
  const hasRemarks = APP_SETTINGS.show_matrix_remarks !== 'off';
  const tbody = document.createElement('tbody');
  tbody.id = 'matrix-tbody';

  keys.forEach(function(key, idx) {
    const d = allData[key];
    const tr = document.createElement('tr');
    let html = '<td>' + (idx + 1) + '</td>'
      + '<td style="position:relative;"><input type="text" class="cell-input cell-editable" value="' + escHtml(d.name) + '" data-field="product_name" autocomplete="off" placeholder="输入品名..."><div class="autocomplete-dropdown" style="display:none;"></div></td>'
      + '<td><input type="text" class="cell-input cell-readonly" value="' + escHtml(d.spec) + '" data-field="spec" readonly tabindex="-1"></td>'
      + '<td><input type="text" class="cell-input cell-readonly" value="' + escHtml(d.unit) + '" data-field="unit" readonly tabindex="-1"></td>';
    for (let ci = 0; ci < canteens.length; ci++) {
      const val = d.quantities[canteens[ci]] || '';
      html += '<td><input type="text" class="cell-input cell-editable matrix-cell-qty' + (val ? ' has-value' : '') + '" value="' + escHtml(val) + '" data-canteen="' + escHtml(canteens[ci]) + '" placeholder="0"></td>';
    }
    if (hasRemarks) {
      html += '<td><input type="text" class="cell-input cell-editable" value="' + escHtml(d.remark) + '" data-field="remark" placeholder="备注"></td>';
    }
    html += '<td style="white-space:nowrap;"><button class="btn-delete-row" onclick="deleteMatrixRow(this)">✕</button></td>';
    tr.innerHTML = html;
    tbody.appendChild(tr);
    bindMatrixRowEvents(tr, tbody);
  });

  if (keys.length === 0) {
    appendMatrixRow(tbody, 0);
  }

  area.innerHTML = '<div class="matrix-date-bar"><label>到货日期：</label><input type="date" class="form-control" id="matrix-date" value="' + getTomorrowStr() + '" style="width:160px;"></div>'
    + '<div class="matrix-container"><table class="matrix-table"><thead><tr><th>序号</th><th class="matrix-name-col">品名 <button class="btn-copy-col" onclick="copyColumnToClipboard(this)" title="复制整列">📋</button></th><th>规格</th><th>单位</th>'
    + canteens.map(function(c) { return '<th class="matrix-qty-col">' + escHtml(c) + ' <button class="btn-copy-col" onclick="copyColumnToClipboard(this)" title="复制整列">📋</button></th>'; }).join('')
    + (hasRemarks ? '<th>备注 <button class="btn-copy-col" onclick="copyColumnToClipboard(this)" title="复制整列">📋</button></th>' : '')
    + '<th>操作</th></tr></thead></table></div>'
    + '<div style="margin-top:8px;"><button class="btn btn-sm" onclick="addMatrixEmptyRow()">+ 添加空白行</button></div>';

  area.querySelector('.matrix-table').appendChild(tbody);
}

// ===== Matrix row operations =====

function appendMatrixRow(tbody, idx) {
  const canteens = getSmallCanteens();
  const hasRemarks = APP_SETTINGS.show_matrix_remarks !== 'off';
  if (idx === undefined) idx = tbody.querySelectorAll('tr').length;

  const tr = document.createElement('tr');
  let html = '<td>' + (idx + 1) + '</td>'
    + '<td style="position:relative;"><input type="text" class="cell-input cell-editable" value="" data-field="product_name" autocomplete="off" placeholder="输入品名..."><div class="autocomplete-dropdown" style="display:none;"></div></td>'
    + '<td><input type="text" class="cell-input cell-readonly" value="" data-field="spec" readonly tabindex="-1"></td>'
    + '<td><input type="text" class="cell-input cell-readonly" value="" data-field="unit" readonly tabindex="-1"></td>';
  for (let ci = 0; ci < canteens.length; ci++) {
    html += '<td><input type="text" class="cell-input cell-editable matrix-cell-qty" value="" data-canteen="' + escHtml(canteens[ci]) + '" placeholder="0"></td>';
  }
  if (hasRemarks) {
    html += '<td><input type="text" class="cell-input cell-editable" value="" data-field="remark" placeholder="备注"></td>';
  }
  html += '<td style="white-space:nowrap;"><button class="btn-delete-row" onclick="deleteMatrixRow(this)">✕</button></td>';
  tr.innerHTML = html;
  tbody.appendChild(tr);
  bindMatrixRowEvents(tr, tbody);
  return tr;
}

function deleteMatrixRow(btn) {
  btn.closest('tr').remove();
  renumberMatrixRows();
  markPurchaseDirty();
}

function renumberMatrixRows() {
  document.querySelectorAll('#matrix-tbody tr').forEach(function(row, idx) {
    row.querySelector('td:first-child').textContent = idx + 1;
  });
}

function addMatrixEmptyRow() {
  const tbody = document.getElementById('matrix-tbody');
  appendMatrixRow(tbody);
  renumberMatrixRows();
}

async function toggleMatrixRemarks() {
  await saveMatrixData();
  APP_SETTINGS.show_matrix_remarks = APP_SETTINGS.show_matrix_remarks !== 'off' ? 'off' : 'on';
  await window.api.setSetting('show_matrix_remarks', APP_SETTINGS.show_matrix_remarks);
  initSmallMatrixMode();
}

// ===== Matrix autocomplete =====

function selectMatrixAutocompleteItem(input, item) {
  const tr = input.closest('tr');
  input.value = item.dataset.name;
  const specInput = tr.querySelector('[data-field="spec"]');
  const unitInput = tr.querySelector('[data-field="unit"]');
  if (specInput) specInput.value = item.dataset.spec || '';
  if (unitInput) unitInput.value = item.dataset.unit || '';
  tr.dataset.matrixSelected = '1';
  hideAutocomplete();
  if (APP_SETTINGS.auto_focus_qty !== 'off') {
    const firstQty = tr.querySelector('.matrix-cell-qty');
    if (firstQty) { firstQty.focus(); firstQty.select(); }
  }
}

async function handleMatrixProductBlur(input) {
  if (!input.isConnected) return;
  const tr = input.closest('tr');
  const keyword = input.value.trim();
  if (!keyword) return;
  if (tr.dataset.matrixSelected === '1') return;
  try {
    const targetMonth = getInquiryMonthForInput(input);
    const results = await resolveInquirySearch(keyword, targetMonth);
    const match = results.find(function(r) { return r.name.toLowerCase() === keyword.toLowerCase(); }) || results[0];
    if (match) {
      const specInput = tr.querySelector('[data-field="spec"]');
      const unitInput = tr.querySelector('[data-field="unit"]');
      if (specInput) specInput.value = match.spec || '';
      if (unitInput) unitInput.value = match.unit || '';
    }
  } catch (err) {
    console.error('Matrix product blur match error:', err);
  }
}

function bindMatrixRowEvents(tr, tbody) {
  bindTableRowEvents(tr, tbody, {
    onSelect: selectMatrixAutocompleteItem,
    onAutocomplete: handleProductAutocomplete,
    onProductSelect: selectMatrixAutocompleteItem,
    onProductBlur: handleMatrixProductBlur,
    onQtyChange: null,
    onFieldChange: null,
    onAppendRow: appendMatrixRow,
  });
  tr.querySelectorAll('.matrix-cell-qty').forEach(function(input) {
    input.addEventListener('input', function() {
      input.classList.toggle('has-value', !!input.value.trim());
    });
  });
}

// ===== Matrix save =====

async function saveMatrixData(silent) {
  const canteens = getSmallCanteens();
  const tbody = document.getElementById('matrix-tbody');
  if (!tbody) return;

  const dateInput = document.getElementById('matrix-date');
  const date = dateInput ? dateInput.value : getTomorrowStr();

  const sourceDates = canteens.map(function(c) { return { source: c + '-厨房', date: date }; });
  const orders = [];
  const rows = tbody.querySelectorAll('tr');
  let savedCount = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    const tr = rows[ri];
    const productName = tr.querySelector('[data-field="product_name"]')?.value?.trim();
    if (!productName) continue;

    const spec = tr.querySelector('[data-field="spec"]')?.value?.trim() || '';
    const unit = tr.querySelector('[data-field="unit"]')?.value?.trim() || '';
    const remark = tr.querySelector('[data-field="remark"]')?.value?.trim() || '';

    for (let ci = 0; ci < canteens.length; ci++) {
      const qtyInput = tr.querySelector('[data-canteen="' + canteens[ci] + '"]');
      const quantity = qtyInput ? qtyInput.value.trim() : '';
      if (!quantity) continue;

      orders.push({
        source: canteens[ci] + '-厨房',
        receive_date: date,
        product_name: productName,
        spec: spec,
        unit_price: 0,
        quantity: quantity,
        unit: unit,
        amount: 0,
        remark: remark,
        sort_order: savedCount,
      });
      savedCount++;
    }
  }

  if (silent && orders.length === 0) return;

  const result = await window.api.savePurchaseOrdersBatch(sourceDates, orders);
  if (!result.success) {
    if (!silent) showToast('保存失败: ' + result.error, 'error');
    return;
  }

  const today = todayStr();
  await window.api.setSetting('last_purchase_date', today);
  APP_SETTINGS.last_purchase_date = today;

  if (!silent) {
    showToast('矩阵数据已保存 ' + savedCount + ' 条');
    for (let ci = 0; ci < canteens.length; ci++) {
      await loadPurchaseGroupData(canteens[ci] + '-厨房');
    }
  }
}

// 保存联华 DOM 数据（矩阵模式，联华数据在 DOM date-groups 中）
async function saveLianhuaDomData(silent) {
  const canteens = getSmallCanteens();
  const allOrders = [];
  const sourceDates = [];
  const seenDates = new Set();

  for (let ci = 0; ci < canteens.length; ci++) {
    const source = canteens[ci] + '-联华';
    const group = document.querySelector('.purchase-group[data-source="' + source + '"]');
    if (!group) continue;

    const dateGroupEls = group.querySelectorAll('.date-group');
    if (dateGroupEls.length === 0) continue;

    dateGroupEls.forEach(function(dateGroup) {
      const date = getDateFromGroup(dateGroup);
      const trs = [...dateGroup.querySelectorAll('tbody tr')];
      let hasValidRow = false;
      trs.forEach(function(tr, idx) {
        const data = getRowData(tr);
        if (!data) return;
        hasValidRow = true;
        allOrders.push({
          source: source,
          receive_date: date,
          product_name: data.product_name,
          spec: data.spec,
          unit_price: data.unit_price,
          quantity: data.quantity,
          unit: data.unit,
          amount: data.amount,
          remark: data.remark,
          sort_order: idx,
        });
      });
      if (hasValidRow) {
        const key = source + '|||' + date;
        if (!seenDates.has(key)) {
          seenDates.add(key);
          sourceDates.push({ source: source, date: date });
        }
      }
    });
  }

  if (sourceDates.length === 0) return;

  const result = await window.api.savePurchaseOrdersBatch(sourceDates, allOrders);
  if (!result.success && !silent) {
    showToast('联华保存失败: ' + result.error, 'error');
  }
}

// ===== Copy / Sync (matrix-aware) =====

function showCopyCanteenDialog() {
  const canteens = getSmallCanteens();
  openModal('复用单个小所数据', '<p style="margin-bottom:12px;">将源小所的<strong>厨房</strong>数据复制到目标小所（仅厨房，不含联华）</p>'
    + '<div class="form-group"><label>从哪个小所复制</label><select class="form-control" id="copy-source-canteen">' + canteens.map(function(c) { return '<option value="' + escHtml(c) + '">' + escHtml(c) + '</option>'; }).join('') + '</select></div>'
    + '<div class="form-group"><label>复制到</label><select class="form-control" id="copy-target-canteen">' + canteens.map(function(c, i) { return '<option value="' + escHtml(c) + '"' + (i === 1 ? ' selected' : '') + '>' + escHtml(c) + '</option>'; }).join('') + '</select></div>',
    '<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="doCopyCanteen()">确认复制</button>');
}

async function doCopyCanteen() {
  const fromCanteen = document.getElementById('copy-source-canteen').value;
  const toCanteen = document.getElementById('copy-target-canteen').value;
  if (fromCanteen === toCanteen) { showToast('不能复制到自身', 'error'); return; }
  copyMatrixCanteenData(fromCanteen, toCanteen);
  closeModal();
  await silentSavePurchaseOrders();
  showToast('已将 ' + fromCanteen + ' 厨房数据复制到 ' + toCanteen + '，已自动保存');
}

function showSyncAllDialog() {
  const canteens = getSmallCanteens();
  openModal('一键同步到所有小所', '<p style="margin-bottom:12px;">将选中小所的<strong>厨房</strong>数据同步到其他所有小所（仅厨房，不含联华）</p>'
    + '<div class="form-group"><label>源小所</label><select class="form-control" id="sync-source-canteen">' + canteens.map(function(c, i) { return '<option value="' + escHtml(c) + '"' + (i === 0 ? ' selected' : '') + '>' + escHtml(c) + '</option>'; }).join('') + '</select></div>'
    + '<p style="color:var(--text-muted);font-size:13px;margin-top:8px;">将覆盖其他 ' + (canteens.length - 1) + ' 个小所的厨房数据</p>',
    '<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="doSyncAll()">确认同步</button>');
}

async function doSyncAll() {
  const source = document.getElementById('sync-source-canteen').value;
  const canteens = getSmallCanteens();
  for (let i = 0; i < canteens.length; i++) {
    if (canteens[i] !== source) copyMatrixCanteenData(source, canteens[i]);
  }
  closeModal();
  await silentSavePurchaseOrders();
  showToast('已将 ' + source + ' 厨房数据同步到 ' + (canteens.length - 1) + ' 个小所，已自动保存');
}

// 从 matrix DOM 复制数量（替代旧 groups 模式的 copyKitchenData）
function copyMatrixCanteenData(fromCanteen, toCanteen) {
  const tbody = document.getElementById('matrix-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(function(tr) {
    const fromInput = tr.querySelector('[data-canteen="' + fromCanteen + '"]');
    const toInput = tr.querySelector('[data-canteen="' + toCanteen + '"]');
    if (fromInput && toInput) {
      toInput.value = fromInput.value;
      toInput.classList.toggle('has-value', !!toInput.value.trim());
    }
  });
  markPurchaseDirty();
}

// ===== Export =====

async function getSmallExportSheets(sheets) {
  const canteens = getSmallCanteens();
  const style = APP_SETTINGS.small_export_style || 'matrix';

  let exportDate = '';
  const matrixDate = document.getElementById('matrix-date');
  if (matrixDate && matrixDate.value) {
    exportDate = matrixDate.value;
  } else {
    for (let ci = 0; ci < canteens.length; ci++) {
      const groups = getLianhuaDateGroups(canteens[ci] + '-厨房');
      if (groups.length > 0) { exportDate = getDateFromGroup(groups[0]); break; }
    }
    if (!exportDate) exportDate = getTomorrowStr();
  }

  // Kitchen sheet
  if (style === 'matrix') {
    buildMatrixKitchenSheet(sheets, canteens, exportDate);
  } else {
    buildPairedKitchenSheets(sheets, canteens, exportDate);
  }

  // Merged lianhua
  const allLianhuaRows = [];
  for (let ci = 0; ci < canteens.length; ci++) {
    const groups = getLianhuaDateGroups(canteens[ci] + '-联华');
    for (let gi = 0; gi < groups.length; gi++) {
      let date = getDateFromGroup(groups[gi]);
      if (!date) date = exportDate;
      const rows = collectLianhuaRows(groups[gi]);
      for (let ri = 0; ri < rows.length; ri++) {
        allLianhuaRows.push({ canteen: canteens[ci], date: date, product_name: rows[ri].product_name, spec: rows[ri].spec, unit_price: rows[ri].unit_price, quantity: rows[ri].quantity, unit: rows[ri].unit, amount: rows[ri].amount, remark: rows[ri].remark, code: rows[ri].code, split_qty: rows[ri].split_qty });
      }
    }
  }
  if (allLianhuaRows.length > 0) {
    sheets.push(buildMergedLianhuaSheet(canteens, exportDate, allLianhuaRows));
  }
}

function buildMatrixKitchenSheet(sheets, canteens, exportDate) {
  const allData = {};
  const quantities = {};
  for (let ci = 0; ci < canteens.length; ci++) {
    quantities[canteens[ci]] = {};
    const rows = collectRows(canteens[ci] + '-厨房');
    for (let ri = 0; ri < rows.length; ri++) {
      const key = rows[ri].product_name;
      if (!allData[key]) allData[key] = { spec: rows[ri].spec, unit: rows[ri].unit, remark: rows[ri].remark };
      quantities[canteens[ci]][key] = (quantities[canteens[ci]][key] || 0) + (parseFloat(rows[ri].quantity) || 0);
    }
  }
  const names = Object.keys(allData);
  if (names.length === 0) return;
  const dateStr = exportDate ? exportDate.replace(/-/g, '年').replace(/年(\d+)$/, '月$1日') : '小所';
  sheets.push({
    name: '小所厨房',
    title: dateStr + '厨房申购单',
    headers: ['序号', '品名', '规格', '单位'].concat(canteens).concat(['备注']),
    rows: names.map(function(name, idx) {
      const row = [idx + 1, name, allData[name].spec, allData[name].unit];
      for (let ci = 0; ci < canteens.length; ci++) row.push(quantities[canteens[ci]][name] || 0);
      row.push(allData[name].remark || '');
      return { data: row };
    }),
  });
}

function buildPairedKitchenSheets(sheets, canteens, exportDate) {
  const allRows = [];
  const sub = ['序号', '品名', '规格', '单位', '数量', '备注'];
  for (let i = 0; i < canteens.length; i += 2) {
    const pair = canteens.slice(i, i + 2);
    const left = pair[0], right = pair[1];
    const leftRows = collectRows(left + '-厨房');
    const rightRows = right ? collectRows(right + '-厨房') : [];
    const mergeRanges = [{ range: 'A:F', text: left }];
    if (right) mergeRanges.push({ range: 'H:M', text: right });
    allRows.push({ data: [left, '', '', '', '', '', '', right || '', '', '', '', '', ''], isHeader: true, mergeRanges: mergeRanges });
    allRows.push({ data: sub.concat(['']).concat(sub), isSubHeader: true });
    const maxLen = Math.max(leftRows.length, rightRows.length);
    for (let idx = 0; idx < maxLen; idx++) {
      const l = leftRows[idx], r = rightRows[idx];
      allRows.push({ data: [
        l ? idx + 1 : '', l ? l.product_name : '', l ? l.spec : '', l ? l.unit : '', l ? l.quantity : '', l ? (l.remark || '') : '',
        '',
        r ? idx + 1 : '', r ? r.product_name : '', r ? r.spec : '', r ? r.unit : '', r ? r.quantity : '', r ? (r.remark || '') : '',
      ]});
    }
    if (i + 2 < canteens.length) allRows.push({ data: ['', '', '', '', '', '', '', '', '', '', '', '', ''] });
  }
  if (allRows.length > 0) {
    const dateStr = exportDate ? exportDate.replace(/-/g, '年').replace(/年(\d+)$/, '月$1日') : '小所';
    sheets.push({ name: '小所厨房', title: dateStr + '厨房申购单', headers: ['', '', '', '', '', '', '', '', '', '', '', '', ''], rows: allRows, colWidths: [8, 30, 20, 8, 8, 12, 2, 8, 30, 20, 8, 8, 12], headerHeight: 40, rowHeight: 30, titleFontSize: 36 });
  }
}

function getSmallSources() {
  const canteens = getSmallCanteens();
  const sources = [];
  for (let i = 0; i < canteens.length; i++) {
    sources.push(canteens[i] + '-厨房');
    sources.push(canteens[i] + '-联华');
  }
  return sources;
}
