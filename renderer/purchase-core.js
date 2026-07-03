// ===== Purchase Core: shared utilities for all canteen modes =====
// Loaded before mode files and lianhua.js.
// Defines: HTML builders, row ops, autocomplete, inquiry search, recall, export helpers.

// ===== Shared HTML Builders =====

function buildDateGroupHTML(date, summaryText, labelSuffix) {
  const suffix = labelSuffix || '收货';
  return `
    <div class="date-header expanded" onclick="toggleDateGroup(this)">
      <span class="date-toggle">▶</span>
      <span class="date-label">${escHtml(date)} ${suffix}</span>
      <span class="date-summary">${escHtml(summaryText)}</span>
      <div class="date-actions">
        <button class="btn btn-sm" onclick="event.stopPropagation(); addPurchaseRows(this)">+ 添加${APP_SETTINGS.purchase_rows}行</button>
        <button class="btn-delete-date" onclick="event.stopPropagation(); deleteDateGroup(this)">🗑</button>
      </div>
    </div>
    <div class="date-content expanded">
      <div class="purchase-table-wrapper">
        <table class="table table-purchase">
          <thead>
            <tr>
              <th style="width:40px;">序号</th>
              <th style="width:200px;">品名 <button class="btn-copy-col" onclick="copyColumnToClipboard(this)" title="复制整列">📋</button></th>
              <th style="width:120px;">规格</th>
              <th style="width:80px;">单价</th>
              <th style="width:80px;">数量 <button class="btn-copy-col" onclick="copyColumnToClipboard(this)" title="复制整列">📋</button></th>
              <th style="width:60px;">单位</th>
              <th style="width:80px;">金额</th>
              <th style="width:150px;">备注 <button class="btn-copy-col" onclick="copyColumnToClipboard(this)" title="复制整列">📋</button></th>
              <th style="width:50px;">操作</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;
}

function buildPurchaseRowHTML(idx, values, amountText, opts) {
  opts = opts || {};
  const v = values || {};
  const amt = amountText || '';
  const showCopy = opts.showCopyBtn !== false;
  const delFn = opts.deleteHandler || 'deletePurchaseRow';
  return `
    <td>${idx + 1}</td>
    <td style="position:relative;">
      <input type="text" class="cell-input cell-editable" value="${escHtml(v.product_name || '')}" data-field="product_name" autocomplete="off" placeholder="输入品名...">
      <div class="autocomplete-dropdown" style="display:none;"></div>
    </td>
    <td><input type="text" class="cell-input cell-readonly" value="${escHtml(v.spec || '')}" data-field="spec" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-readonly" value="${escHtml(v.unit_price || '')}" data-field="unit_price" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-editable" value="${escHtml(v.quantity || '')}" data-field="quantity" placeholder="数量"></td>
    <td><input type="text" class="cell-input cell-readonly" value="${escHtml(v.unit || '')}" data-field="unit" readonly tabindex="-1"></td>
    <td class="amount-cell cell-readonly">${escHtml(amt)}</td>
    <td><input type="text" class="cell-input cell-editable" value="${escHtml(v.remark || '')}" data-field="remark" placeholder="备注"></td>
    <td style="white-space:nowrap;">${showCopy ? '<button class="btn btn-sm" onclick="copyPurchaseRow(this)" title="复制行">📋</button> ' : ''}<button class="btn-delete-row" onclick="${delFn}(this)">✕</button></td></tr>
  `;
}

// ===== Date helpers =====

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

function getDateFromGroup(dateGroup) {
  const label = dateGroup.querySelector('.date-label').textContent;
  return label.replace(' 收货', '').replace(' 发货', '').trim();
}

function buildDateLabel(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1])}月${parseInt(parts[2])}日 收货`;
  }
  return dateStr;
}

// ===== Row data helpers =====

function getRowData(tr) {
  const getData = function(field) { return tr.querySelector('[data-field="' + field + '"]')?.value || ''; };
  const amountText = tr.querySelector('.amount-cell')?.textContent || '0';
  const productName = getData('product_name').trim();
  if (!productName) return null;
  return {
    product_name: productName,
    spec: getData('spec'),
    unit_price: parseFloat(getData('unit_price')) || 0,
    quantity: getData('quantity'),
    unit: getData('unit'),
    amount: parseFloat(amountText.replace('¥', '')) || 0,
    remark: getData('remark'),
  };
}

function collectRows(source) {
  const group = document.querySelector('.purchase-group[data-source="' + source + '"]');
  if (!group) return [];
  const rows = [];
  group.querySelectorAll('.date-group').forEach(function(dateGroup) {
    const date = getDateFromGroup(dateGroup);
    dateGroup.querySelectorAll('tbody tr').forEach(function(tr) {
      const data = getRowData(tr);
      if (data) rows.push({ date: date, product_name: data.product_name, spec: data.spec, unit_price: data.unit_price, quantity: data.quantity, unit: data.unit, amount: data.amount, remark: data.remark });
    });
  });
  return rows;
}

function collectLianhuaRows(dateGroup) {
  const rows = [];
  dateGroup.querySelectorAll('tbody tr').forEach(function(tr) {
    const data = getRowData(tr);
    if (!data) return;
    const item = lianhuaItems.find(function(i) { return i.name === data.product_name || data.product_name.includes(i.name); });
    rows.push({
      product_name: data.product_name, spec: data.spec || (item ? item.spec : ''),
      unit_price: data.unit_price || (item ? item.price : 0),
      quantity: data.quantity, unit: data.unit || (item ? item.unit : '件'),
      amount: data.amount, remark: data.remark,
      code: item ? item.code : '',
      split_qty: item ? item.split_qty : 1,
    });
  });
  return rows;
}

function getLianhuaDateGroups(source) {
  const group = document.querySelector('.purchase-group[data-source="' + source + '"]');
  return group ? group.querySelectorAll('.date-group') : [];
}

// ===== Toggle group expand/collapse =====

function toggleGroup(header) {
  const content = header.nextElementSibling;
  const isExpanded = header.classList.contains('expanded');
  if (isExpanded) {
    header.classList.remove('expanded');
    content.style.display = 'none';
  } else {
    header.classList.add('expanded');
    content.style.display = 'block';
  }
}

function toggleDateGroup(header) {
  const content = header.nextElementSibling;
  const isExpanded = header.classList.contains('expanded');
  if (isExpanded) {
    header.classList.remove('expanded');
    content.classList.remove('expanded');
  } else {
    header.classList.add('expanded');
    content.classList.add('expanded');
  }
}

// ===== Data loading =====

async function loadPurchaseGroupData(source) {
  try {
    const groupContent = document.querySelector('.purchase-group[data-source="' + source + '"] .group-content');
    if (!groupContent) return;
    groupContent.innerHTML = '';

    if (!window._purchaseShouldLoadData) return;

    const orders = await window.api.getPurchaseOrders(source);
    const today = todayStr();
    const byDate = {};
    orders.filter(function(o) { return o.created_at && o.created_at.startsWith(today); }).forEach(function(o) {
      if (!byDate[o.receive_date]) byDate[o.receive_date] = [];
      byDate[o.receive_date].push(o);
    });

    const dates = Object.keys(byDate);
    for (let i = 0; i < dates.length; i++) {
      addDateGroupToPage(source, dates[i], byDate[dates[i]]);
    }
  } catch (err) {
    console.error('Load purchase group error:', err);
  }
}

function addDateGroupToPage(source, date, items) {
  const groupContent = document.querySelector('.purchase-group[data-source="' + source + '"] .group-content');
  if (!groupContent) return;

  const dateId = source.includes('联华')
    ? ('lianhua-date-' + source + '-' + date).replace(/[\s-]/g, '_')
    : ('date-' + source + '-' + date).replace(/[\s-]/g, '_');
  if (document.getElementById(dateId)) return;

  const dateGroup = document.createElement('div');
  dateGroup.className = 'date-group';
  dateGroup.id = dateId;

  const labelSuffix = source.includes('联华') ? '发货' : '收货';
  dateGroup.innerHTML = buildDateGroupHTML(date, items.length + ' 项', labelSuffix);

  groupContent.appendChild(dateGroup);

  // ponytail: batch all rows as one innerHTML instead of per-row appendChild (avoids N reflows)
  const tbody = dateGroup.querySelector('tbody');
  const isLianhua = source.includes('联华');
  const dec = Math.max(0, APP_SETTINGS.price_decimals || 2);
  const rowsHtml = items.map(function(item, idx) {
    const price = item.unit_price != null ? parseFloat(item.unit_price) || 0 : 0;
    const qtyStr = String(item.quantity ?? '').trim();
    const qtyNum = parseFloat(qtyStr) || 0;
    const isPureNumber = qtyStr !== '' && !isNaN(Number(qtyStr));
    const amount = isPureNumber ? price * qtyNum : (parseFloat(item.amount) || 0);
    const amountText = amount > 0 ? '¥' + amount.toFixed(dec) : '';
    return '<tr' + (item.id ? ' data-id="' + item.id + '"' : '') + '>' +
      buildPurchaseRowHTML(idx, {
        product_name: item.product_name || '',
        spec: item.spec || '',
        unit_price: price || '',
        quantity: item.quantity || '',
        unit: item.unit || '',
        remark: item.remark || '',
      }, amountText) + '</tr>';
  }).join('');
  tbody.innerHTML = rowsHtml;

  tbody.querySelectorAll('tr').forEach(function(tr) {
    if (isLianhua) {
      attachLianhuaCellEvents(tr, tbody);
    } else {
      attachCellEvents(tr, tbody);
    }
  });
}

function appendPurchaseRowWithData(tbody, item, idx) {
  const tr = document.createElement('tr');
  if (item.id) tr.dataset.id = item.id;

  const price = item.unit_price != null ? parseFloat(item.unit_price) || 0 : 0;
  const qtyStr = String(item.quantity ?? '').trim();
  const qtyNum = parseFloat(qtyStr) || 0;
  const isPureNumber = qtyStr !== '' && !isNaN(Number(qtyStr));
  const amount = isPureNumber ? price * qtyNum : (parseFloat(item.amount) || 0);
  const dec = Math.max(0, APP_SETTINGS.price_decimals || 2);
  const amountText = amount > 0 ? '¥' + amount.toFixed(dec) : '';

  tr.innerHTML = buildPurchaseRowHTML(idx, {
    product_name: item.product_name || '',
    spec: item.spec || '',
    unit_price: price || '',
    quantity: item.quantity || '',
    unit: item.unit || '',
    remark: item.remark || '',
  }, amountText);

  tbody.appendChild(tr);
  const parentGroup = tbody.closest('.purchase-group');
  const src = parentGroup ? parentGroup.dataset.source : '';
  if (src.includes('联华')) {
    attachLianhuaCellEvents(tr, tbody);
  } else {
    attachCellEvents(tr, tbody);
  }
  return tr;
}

// ===== Row operations =====

function appendPurchaseRow(tbody, idx) {
  const tr = document.createElement('tr');
  tr.innerHTML = buildPurchaseRowHTML(idx, {}, '');
  tbody.appendChild(tr);
  attachCellEvents(tr, tbody);
  markPurchaseDirty();
}

function copyPurchaseRow(btn) {
  const tr = btn.closest('tr');
  const tbody = tr.closest('tbody');
  const getData = function(field) { return tr.querySelector('[data-field="' + field + '"]')?.value || ''; };

  const newTr = document.createElement('tr');
  newTr.innerHTML = buildPurchaseRowHTML(0, {
    product_name: getData('product_name'),
    spec: getData('spec'),
    unit_price: getData('unit_price'),
    quantity: getData('quantity'),
    unit: getData('unit'),
    remark: getData('remark'),
  }, tr.querySelector('.amount-cell')?.textContent || '');
  tr.after(newTr);

  const parentGroup = tbody.closest('.purchase-group');
  const src = parentGroup ? parentGroup.dataset.source : '';
  if (src.includes('联华')) {
    attachLianhuaCellEvents(newTr, tbody);
  } else {
    attachCellEvents(newTr, tbody);
  }
  reindexPurchaseRows(tbody);
  markPurchaseDirty();
}

async function deletePurchaseRow(btn) {
  const tr = btn.closest('tr');
  const tbody = tr.closest('tbody');
  const id = tr.dataset.id;
  if (id) {
    try {
      await window.api.deletePurchaseOrder(parseInt(id));
    } catch (err) {
      console.error('删除采购记录失败:', err);
      showToast('删除失败: ' + err.message, 'error');
      return;
    }
  }
  tr.remove();
  reindexPurchaseRows(tbody);
  markPurchaseDirty();
}

function reindexPurchaseRows(tbody) {
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(function(tr, idx) {
    tr.querySelector('td:first-child').textContent = idx + 1;
  });
  const dateGroup = tbody.closest('.date-group');
  if (dateGroup) {
    const summary = dateGroup.querySelector('.date-summary');
    summary.textContent = rows.length + ' 项';
  }
}

function addPurchaseRows(btn) {
  const dateGroup = btn.closest('.date-group');
  const tbody = dateGroup.querySelector('tbody');
  const currentCount = tbody.querySelectorAll('tr').length;
  const purchaseGroup = dateGroup.closest('.purchase-group');
  const source = purchaseGroup ? purchaseGroup.dataset.source : '';

  for (let i = 0; i < APP_SETTINGS.purchase_rows; i++) {
    if (source.includes('联华')) {
      appendLianhuaRow(tbody, currentCount + i);
    } else {
      appendPurchaseRow(tbody, currentCount + i);
    }
  }
  markPurchaseDirty();
}

// ===== Date group operations =====

function showAddDateDialog(source) {
  const groupContent = document.querySelector('.purchase-group[data-source="' + source + '"] .group-content');
  if (!groupContent) return;

  const tomorrow = getTomorrowStr();

  openModal('选择到货日期', `
    <div class="form-group">
      <label>到货日期</label>
      <input type="date" class="form-control" id="new-date-input" value="${tomorrow}">
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddDateGroup(${JSON.stringify(source)})">确定</button>
  `);
}

function doAddDateGroup(source) {
  const dateInput = document.getElementById('new-date-input');
  const date = dateInput.value;

  if (!date) {
    showToast('请选择日期', 'error');
    return;
  }

  closeModal();
  addDateGroup(source, date);
}

function addDateGroup(source, date) {
  const groupContent = document.querySelector('.purchase-group[data-source="' + source + '"] .group-content');
  if (!groupContent) return;

  const dateId = source.includes('联华')
    ? ('lianhua-date-' + source + '-' + date).replace(/[\s-]/g, '_')
    : ('date-' + source + '-' + date).replace(/[\s-]/g, '_');

  if (document.getElementById(dateId)) {
    showToast('该日期已存在', 'error');
    return;
  }

  const dateGroup = document.createElement('div');
  dateGroup.className = 'date-group';
  dateGroup.id = dateId;

  const labelSuffix = source.includes('联华') ? '发货' : '收货';
  dateGroup.innerHTML = buildDateGroupHTML(date, '0 项', labelSuffix);

  groupContent.appendChild(dateGroup);

  const groupHeader = groupContent.previousElementSibling;
  if (!groupHeader.classList.contains('expanded')) {
    toggleGroup(groupHeader);
  }

  const tbody = dateGroup.querySelector('tbody');
  for (let i = 0; i < APP_SETTINGS.purchase_rows; i++) {
    if (source.includes('联华')) {
      appendLianhuaRow(tbody, i);
    } else {
      appendPurchaseRow(tbody, i);
    }
  }
}

async function deleteDateGroup(btn) {
  const dateGroup = btn.closest('.date-group');
  if (!confirm('确定删除此日期分组？')) return;

  const purchaseGroup = dateGroup.closest('.purchase-group');
  const source = purchaseGroup ? purchaseGroup.dataset.source : null;

  const rows = dateGroup.querySelectorAll('tbody tr');
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].dataset.id) {
      try {
        await window.api.deletePurchaseOrder(parseInt(rows[i].dataset.id));
      } catch (err) {
        console.error('删除采购记录失败:', err);
      }
    }
  }

  dateGroup.remove();
  markPurchaseDirty();

  if (source && purchaseGroup && purchaseGroup.querySelectorAll('.date-group').length === 0) {
    const dateLabel = dateGroup.querySelector('.date-label');
    const dateText = dateLabel ? dateLabel.textContent : '';
    const date = dateText.replace(' 收货', '').replace(' 发货', '').trim();
    if (date) {
      try {
        await window.api.deletePurchaseOrdersByDate(source, date);
      } catch (err) {
        console.error('清理采购记录失败:', err);
      }
    }
  }
}

// ===== Cell events & autocomplete =====

function attachCellEvents(tr, tbody) {
  bindTableRowEvents(tr, tbody, {
    onSelect: selectAutocompleteItem,
    onAutocomplete: handleProductAutocomplete,
    onProductSelect: selectAutocompleteItem,
    onProductBlur: handleProductBlur,
    onQtyChange: function(row) { recalcRowAmount(row); },
    onFieldChange: function(row) { recalcRowAmount(row); },
    onAppendRow: function(tbody, idx) { appendPurchaseRow(tbody, idx); },
  });
}

function recalcRowAmount(tr) {
  const priceInput = tr.querySelector('[data-field="unit_price"]');
  const qtyInput = tr.querySelector('[data-field="quantity"]');
  const amountCell = tr.querySelector('.amount-cell');

  const price = parseFloat(priceInput.value) || 0;
  const qtyStr = qtyInput.value.trim();
  const qtyNum = parseFloat(qtyStr);
  const dec = Math.max(0, APP_SETTINGS.price_decimals || 2);

  if (qtyStr && !isNaN(qtyNum) && !isNaN(Number(qtyStr))) {
    const factor = Math.pow(10, dec);
    const amount = Math.round(price * qtyNum * factor) / factor;
    amountCell.textContent = amount.toFixed(dec);
  } else {
    amountCell.textContent = (0).toFixed(dec);
  }
}

// ===== Product Autocomplete =====

async function handleProductAutocomplete(input) {
  const keyword = input.value.trim();
  if (keyword.length < 1) {
    hideAutocomplete();
    return;
  }

  const td = input.closest('td');
  const dropdown = td.querySelector('.autocomplete-dropdown');
  if (!dropdown) return;

  const purchaseGroup = input.closest('.purchase-group');
  const isLianhua = purchaseGroup && purchaseGroup.dataset.source.includes('联华');

  try {
    let results = [];

    if (isLianhua) {
      results = lianhuaItems.filter(function(item) {
        return item.name.toLowerCase().includes(keyword.toLowerCase());
      }).map(function(item) {
        return { name: item.name, spec: item.spec, price: item.price, unit: item.unit };
      });
    } else {
      const targetMonth = getInquiryMonthForInput(input);
      results = await resolveInquirySearch(keyword, targetMonth);
    }

    results = sortAutocompleteResults(results, keyword);

    if (results.length === 0) {
      hideAutocomplete();
      return;
    }

    dropdown.innerHTML = results.map(function(item, idx) {
      return '<div class="autocomplete-item" data-index="' + idx + '" data-name="' + escHtml(item.name) + '" data-spec="' + escHtml(item.spec || '') + '" data-price="' + (item.price || 0) + '" data-unit="' + escHtml(item.unit || '') + '">'
        + '<span class="item-name">' + escHtml(item.name) + '</span>'
        + '<span class="item-spec">' + escHtml(item.spec || '') + ' | ¥' + (item.price || 0) + '</span>'
        + '</div>';
    }).join('');

    const rect = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    dropdown.style.minWidth = rect.width + 'px';
    if (spaceBelow < 220) {
      dropdown.style.bottom = (window.innerHeight - rect.top) + 'px';
      dropdown.style.top = 'auto';
    } else {
      dropdown.style.top = rect.bottom + 'px';
      dropdown.style.bottom = 'auto';
    }
    dropdown.style.left = rect.left + 'px';
    dropdown.style.display = 'block';
    autocompleteIndex = -1;

    const selectFn = input._autocompleteSelectFn || selectAutocompleteItem;
    dropdown.querySelectorAll('.autocomplete-item').forEach(function(item) {
      item.addEventListener('mousedown', function(e) {
        e.preventDefault();
        selectFn(input, item);
      });
    });
  } catch (err) {
    console.error('Autocomplete error:', err);
  }
}

function selectAutocompleteItem(input, item) {
  const tr = input.closest('tr');
  const name = item.dataset.name;
  const spec = item.dataset.spec;
  const rawPrice = parseFloat(item.dataset.price) || 0;
  const unit = item.dataset.unit;

  const discountRate = parseFloat(APP_SETTINGS.discount1_rate) || 1;
  const dec = APP_SETTINGS.price_decimals || 2;
  const factor = Math.pow(10, dec);
  const discountedPrice = Math.round(rawPrice * discountRate * factor) / factor;

  input.value = name;
  tr.querySelector('[data-field="spec"]').value = spec;
  tr.querySelector('[data-field="unit_price"]').value = discountedPrice;
  tr.querySelector('[data-field="unit"]').value = unit;
  hideAutocomplete();

  if (APP_SETTINGS.auto_focus_qty !== 'off') {
    const qtyInput = tr.querySelector('[data-field="quantity"]');
    if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
  }
}

async function handleProductBlur(input) {
  if (!input.isConnected) return;
  const tr = input.closest('tr');
  const keyword = input.value.trim();
  if (!keyword) return;

  const existingSpec = tr.querySelector('[data-field="spec"]')?.value;
  const existingPrice = tr.querySelector('[data-field="unit_price"]')?.value;
  if (existingSpec || existingPrice) return;

  const purchaseGroup = tr.closest('.purchase-group');
  const isLianhua = purchaseGroup && purchaseGroup.dataset.source.includes('联华');

  try {
    let match = null;

    if (isLianhua) {
      match = lianhuaItems.find(function(i) { return i.name.toLowerCase() === keyword.toLowerCase(); });
    } else {
      const targetMonth = getInquiryMonthForInput(input);
      const results = await resolveInquirySearch(keyword, targetMonth);
      match = results.find(function(r) { return r.name.toLowerCase() === keyword.toLowerCase(); }) || results[0];
    }

    if (match) {
      tr.querySelector('[data-field="spec"]').value = match.spec || '';
      const rawPrice = match.price || 0;
      const discountRate = parseFloat(APP_SETTINGS.discount1_rate) || 1;
      const dec = APP_SETTINGS.price_decimals || 2;
      const factor = Math.pow(10, dec);
      const discountedPrice = Math.round(rawPrice * discountRate * factor) / factor;
      tr.querySelector('[data-field="unit_price"]').value = discountedPrice;
      tr.querySelector('[data-field="unit"]').value = match.unit || '';
      recalcRowAmount(tr);
    }
  } catch (err) {
    console.error('Product blur match error:', err);
  }
}

// ===== Inquiry search =====

function getInquiryMonthForInput(input) {
  const dateGroup = input.closest('.date-group');
  if (!dateGroup) return null;
  if (dateGroup.dataset.date) return dateToMonthStr(dateGroup.dataset.date);
  return dateToMonthStr(getDateFromGroup(dateGroup));
}

function getFallbackCache() {
  const today = todayStr();
  try {
    const raw = localStorage.getItem('inquiryFallbackCache');
    if (raw) {
      const cache = JSON.parse(raw);
      if (cache._date === today) return cache;
    }
  } catch (e) { /* corrupt data, reset */ }
  return { _date: today };
}

function saveFallbackCache(cache) {
  try { localStorage.setItem('inquiryFallbackCache', JSON.stringify(cache)); } catch (e) {}
}

function showInquiryFallbackDialog(targetMonth, fallbackMonth) {
  const targetLabel = targetMonth.replace('-', '年') + '月';
  const fallbackLabel = fallbackMonth ? fallbackMonth.replace('-', '年') + '月' : '上月';
  return confirm(targetLabel + '询价尚未导入，是否沿用' + fallbackLabel + '询价？\n\n请尽快导入' + targetLabel + '询价。');
}

async function resolveInquirySearch(keyword, targetMonth, opts) {
  opts = opts || {};
  const silent = opts.silent || false;

  if (!window._availableInquiryMonths) {
    try {
      const months = await window.api.getInquiryMonths();
      window._availableInquiryMonths = months.map(function(m) { return m.month; });
    } catch (e) {
      window._availableInquiryMonths = [];
    }
  }
  const avail = window._availableInquiryMonths;

  let searchMonth = targetMonth;

  if (targetMonth && !avail.includes(targetMonth)) {
    try {
      const fresh = await window.api.getInquiryMonths();
      const freshMonths = fresh.map(function(m) { return m.month; });
      if (freshMonths.includes(targetMonth)) {
        window._availableInquiryMonths = freshMonths;
        return await window.api.searchInquiryItems(keyword, targetMonth);
      }
      window._availableInquiryMonths = freshMonths;
    } catch (e) {}

    const fallbackCache = getFallbackCache();
    const cached = fallbackCache[targetMonth];
    if (cached !== undefined) {
      searchMonth = cached;
    } else if (!silent) {
      const fallbackMonth = getPreviousMonthStr(targetMonth);
      const fbAvail = window._availableInquiryMonths;
      if (fallbackMonth && fbAvail.includes(fallbackMonth)) {
        const useFallback = showInquiryFallbackDialog(targetMonth, fallbackMonth);
        fallbackCache[targetMonth] = useFallback ? fallbackMonth : null;
        saveFallbackCache(fallbackCache);
        searchMonth = useFallback ? fallbackMonth : null;
      } else {
        fallbackCache[targetMonth] = null;
        saveFallbackCache(fallbackCache);
        searchMonth = null;
      }
    } else {
      const fallbackMonth = getPreviousMonthStr(targetMonth);
      searchMonth = (fallbackMonth && window._availableInquiryMonths.includes(fallbackMonth)) ? fallbackMonth
        : (window._availableInquiryMonths.length > 0 ? window._availableInquiryMonths[0] : null);
    }
  }

  if (!searchMonth && window._availableInquiryMonths.length > 0) {
    searchMonth = window._availableInquiryMonths[0];
  }

  if (!searchMonth) return [];
  return await window.api.searchInquiryItems(keyword, searchMonth);
}

// ===== Export helpers =====

async function resolveImages(rows) {
  const photoFolder = APP_SETTINGS.photo_folder;
  if (!photoFolder) return rows.map(function() { return null; });
  return Promise.all(rows.map(function(r) { return window.api.findImage(r.product_name, r.spec, photoFolder).catch(function() { return null; }); }));
}

function buildKitchenSheet(title, rows, images) {
  const outRows = [];
  let currentDate = null;
  let seq = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.date !== currentDate) {
      currentDate = row.date;
      seq = 0;
      const label = buildDateLabel(currentDate);
      outRows.push({ isHeader: true, data: [label], mergeRange: 'A:J', height: 15, bold: false, fontSize: 12 });
      outRows.push({ isSubHeader: true, data: ['序号', '收货日期', '品名', '规格', '单价', '数量', '单位', '金额', '备注要求', '实物图'] });
    }
    seq++;
    outRows.push({
      data: [seq, row.date, row.product_name, row.spec, row.unit_price, row.quantity, row.unit, row.amount, row.remark, ''],
      imagePath: images[i]
    });
  }

  return {
    name: title, title: title,
    headers: [],
    colWidths: [8, 15, 30, 25, 10, 10, 10, 10, 30, 15],
    rows: outRows,
  };
}

function buildMultiCanteenKitchenSheet(canteenData) {
  const rows = [];
  for (let ci = 0; ci < canteenData.length; ci++) {
    const cData = canteenData[ci];
    rows.push({ isHeader: true, data: [cData.canteen], mergeRange: 'A:J' });

    let currentDate = null;
    let seq = 0;

    for (let i = 0; i < cData.rows.length; i++) {
      const row = cData.rows[i];
      if (row.date !== currentDate) {
        currentDate = row.date;
        seq = 0;
        const label = buildDateLabel(currentDate);
        rows.push({ isHeader: true, data: [label], mergeRange: 'A:J', height: 15, bold: false, fontSize: 12 });
        rows.push({ isSubHeader: true, data: ['序号', '收货日期', '品名', '规格', '单价', '数量', '单位', '金额', '备注要求', '实物图'] });
      }
      seq++;
      rows.push({
        data: [seq, row.date, row.product_name, row.spec, row.unit_price, row.quantity, row.unit, row.amount, row.remark, ''],
        imagePath: cData.images[i]
      });
    }
  }
  return {
    name: '厨房申购单', title: '厨房申购单',
    headers: [],
    colWidths: [8, 15, 30, 25, 10, 10, 10, 10, 30, 15],
    rows: rows,
  };
}

function buildLianhuaSheet(title, canteen, date, rows, images) {
  return {
    name: title,
    title: canteen + '联华超市 ' + date,
    headers: ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注', '实物图'],
    rows: rows.map(function(row, idx) {
      return {
        data: [idx + 1, canteen, date.replace(/-/g, '.'), row.code, row.product_name, row.unit, row.spec, row.unit_price, row.quantity, row.amount, (row.quantity || 0) * (row.split_qty || 1), row.remark, ''],
        imagePath: images[idx]
      };
    })
  };
}

function buildMergedLianhuaSheet(canteens, exportDate, allRows) {
  const dateStr = exportDate ? exportDate.replace(/-/g, '.') : '';
  const displayDate = exportDate ? exportDate.replace(/-/g, '年').replace(/年(\d+)$/, '月$1日') : '小所';
  const rows = allRows.map(function(row, idx) {
    return {
      data: [
        idx + 1,
        row.canteen,
        row.date ? row.date.replace(/-/g, '.') : dateStr,
        row.code,
        row.product_name,
        row.unit,
        row.spec,
        row.unit_price,
        row.quantity,
        row.amount,
        (row.quantity || 0) * (row.split_qty || 1),
        row.remark,
        '',
      ]
    };
  });

  return {
    name: '联华超市',
    title: displayDate + '联华超市',
    headers: ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注', '实物图'],
    colWidths: [8, 14, 20, 12, 24, 10, 8, 12, 18, 14, 14, 14, 14],
    rows: rows,
  };
}

// ===== Recall =====

function clearPurchasePageDOM() {
  const container = document.getElementById('purchase-container');
  if (container) {
    container.querySelectorAll('.date-group').forEach(function(dg) { dg.remove(); });
  }
  const matrixTbody = document.getElementById('matrix-tbody');
  if (matrixTbody) matrixTbody.innerHTML = '';
}

async function showRecallPurchaseModal() {
  const today = todayStr();
  let toDate = today;
  try {
    const maxDate = await window.api.getLatestReceiveDate();
    if (maxDate && maxDate > today) toDate = maxDate;
  } catch (e) { /* fallback to today */ }

  openModal('调取采购历史', `
    <div class="form-group">
      <label>起始日期</label>
      <input type="date" class="form-control" id="recall-date-from" value="${today}">
    </div>
    <div class="form-group">
      <label>结束日期</label>
      <input type="date" class="form-control" id="recall-date-to" value="${toDate}">
    </div>
    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">
      从数据库加载指定日期范围的采购数据，渲染到当前页面。加载后可编辑和再导出。
    </p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doRecallPurchases()">加载到页面</button>
  `);
}

async function doRecallPurchases() {
  const fromDate = document.getElementById('recall-date-from')?.value;
  const toDate = document.getElementById('recall-date-to')?.value;
  if (!fromDate || !toDate) { showToast('请选择日期范围', 'error'); return; }
  if (fromDate > toDate) { showToast('起始日期不能晚于结束日期', 'error'); return; }

  closeModal();
  try {
    const sources = getCurrentModeSources();
    let totalLoaded = 0;
    for (let si = 0; si < sources.length; si++) {
      const source = sources[si];
      const dateGroups = new Map();
      const allOrders = await window.api.getPurchaseOrders(source);
      const filtered = allOrders.filter(function(o) { return o.receive_date >= fromDate && o.receive_date <= toDate; });

      for (let oi = 0; oi < filtered.length; oi++) {
        const o = filtered[oi];
        const key = o.receive_date;
        if (!dateGroups.has(key)) dateGroups.set(key, []);
        dateGroups.get(key).push(o);
      }

      const dates = [...dateGroups.keys()];
      for (let di = 0; di < dates.length; di++) {
        const date = dates[di];
        await ensureDateGroup(source, date, dateGroups.get(date));
        totalLoaded += dateGroups.get(date).length;
      }
    }
    resetPurchaseDirty();
    showToast('已加载 ' + totalLoaded + ' 条记录');
  } catch (err) {
    showToast('调取失败: ' + err.message, 'error');
  }
}

async function ensureDateGroup(source, date, orders) {
  const group = document.querySelector('.purchase-group[data-source="' + source + '"]');
  if (!group) return;

  const groupContent = group.querySelector('.group-content');
  if (!groupContent) return;

  const groupHeader = groupContent.previousElementSibling;
  if (groupHeader && !groupHeader.classList.contains('expanded')) {
    toggleGroup(groupHeader);
  }

  const dateId = source.includes('联华')
    ? ('lianhua-date-' + source + '-' + date).replace(/[\s-]/g, '_')
    : ('date-' + source + '-' + date).replace(/[\s-]/g, '_');

  let dateGroup = document.getElementById(dateId);
  if (!dateGroup) {
    if (source.includes('联华')) {
      addLianhuaDateGroup(date, source);
      dateGroup = document.getElementById(dateId);
    } else {
      dateGroup = document.createElement('div');
      dateGroup.className = 'date-group';
      dateGroup.id = dateId;
      dateGroup.dataset.date = date;
      dateGroup.dataset.source = source;
      dateGroup.innerHTML = `
        <div class="date-header expanded" onclick="toggleDateGroup(this)">
          <span class="date-toggle">▶</span>
          <span class="date-label">${escHtml(date)} 收货</span>
          <span class="date-summary">${orders.length} 项</span>
          <div class="date-actions">
            <button class="btn btn-sm" onclick="event.stopPropagation(); addPurchaseRows(this)">+ 添加行</button>
            <button class="btn-delete-date" onclick="event.stopPropagation(); deleteDateGroup(this)">🗑</button>
          </div>
        </div>
        <div class="date-content expanded">
          <div class="purchase-table-wrapper">
            <table class="table table-purchase">
              <thead>
                <tr>
                  <th style="width:40px;">序号</th>
                  <th>品名</th><th>规格</th><th>单价</th><th>数量</th><th>单位</th><th>金额</th><th>备注</th>
                  <th style="width:50px;">操作</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>`;
      groupContent.appendChild(dateGroup);
    }
  }

  if (!dateGroup) return;
  const tbody = dateGroup.querySelector('tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  orders.forEach(function(o, idx) {
    const tr = document.createElement('tr');
    if (o.id) tr.dataset.id = o.id;
    const amount = (parseFloat(o.unit_price) || 0) * (parseFloat(o.quantity) || 0);
    const amountText = amount > 0 ? '¥' + amount.toFixed(2) : '';
    tr.innerHTML = buildPurchaseRowHTML(idx, {
      product_name: o.product_name || '',
      spec: o.spec || '',
      unit_price: o.unit_price || '',
      quantity: o.quantity || '',
      unit: o.unit || '',
      remark: o.remark || '',
    }, amountText);
    tbody.appendChild(tr);
    const attachFn = source.includes('联华') ? attachLianhuaCellEvents : attachCellEvents;
    attachFn(tr, tbody);
  });

  const summary = dateGroup.querySelector('.date-summary');
  if (summary) summary.textContent = orders.length + ' 项';
}
