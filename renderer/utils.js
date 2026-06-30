// ===== HTML Escape =====
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== Date Utilities =====
function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.substring(0, 10);
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d2 - d1) / 86400000);
}

// ===== Dropdown Toggle =====
function toggleDropdown(e) {
  e.stopPropagation();
  const wrap = e.currentTarget.closest('.dropdown-wrap');
  if (!wrap) return;
  const menu = wrap.querySelector('.dropdown-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  // 先关闭所有已打开的下拉
  document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

// 点击其他地方关闭下拉
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
});

// 本地日期格式化（避免 toISOString 的 UTC 时区偏移导致日期回退一天）
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return toLocalDateStr(new Date());
}

// 将日期字符串转为 "YYYY-MM" 格式，支持 "YYYY-MM-DD" 和 "M月D日" 两种格式
function dateToMonthStr(dateStr) {
  if (!dateStr) return null;
  // "YYYY-MM-DD" 格式
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  // "M月D日" 格式（DB 中存储的格式）
  const cnMatch = dateStr.match(/(\d+)月(\d+)日/);
  if (cnMatch) {
    const now = new Date();
    const year = now.getFullYear();
    const month = parseInt(cnMatch[1]);
    // 跨年推断：当前12月，日期是1-3月 → 下一年；当前1-3月，日期是10-12月 → 上一年
    const thisMonth = now.getMonth() + 1;
    const inferredYear = (thisMonth > 9 && month < 4) ? year + 1
      : (thisMonth < 4 && month > 9) ? year - 1
      : year;
    return `${inferredYear}-${String(month).padStart(2, '0')}`;
  }
  return null;
}

// 计算上一个月 "2026-07" → "2026-06", "2026-01" → "2025-12"
function getPreviousMonthStr(month) {
  if (!month) return null;
  const [year, mon] = month.split('-').map(Number);
  if (mon === 1) return `${year - 1}-12`;
  return `${year}-${String(mon - 1).padStart(2, '0')}`;
}

// Excel serial number to YYYY-MM-DD (UTC，与时区无关)
function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const epochUtc = Date.UTC(1899, 11, 30);
  const utcTime = epochUtc + serial * 86400000;
  return new Date(utcTime).toISOString().split('T')[0];
}

// ===== Autocomplete Infrastructure =====
let autocompleteIndex = -1;

/** 排序自动补全结果：完全匹配最前，其次开头匹配，其余靠后 */
function sortAutocompleteResults(results, keyword, nameField = 'name') {
  const kw = keyword.toLowerCase();
  return [...results].sort((a, b) => {
    const aName = String(a[nameField] || '').toLowerCase();
    const bName = String(b[nameField] || '').toLowerCase();
    const aExact = aName === kw ? 0 : aName.startsWith(kw) ? 1 : 2;
    const bExact = bName === kw ? 0 : bName.startsWith(kw) ? 1 : 2;
    return aExact - bExact;
  });
}

function updateAutocompleteHighlight(items) {
  items.forEach((item, idx) => {
    item.classList.toggle('active', idx === autocompleteIndex);
  });
  if (autocompleteIndex >= 0 && items[autocompleteIndex]) {
    items[autocompleteIndex].scrollIntoView({ block: 'nearest' });
  }
}

function hideAutocomplete() {
  document.querySelectorAll('.autocomplete-dropdown').forEach(d => {
    d.style.display = 'none';
  });
  autocompleteIndex = -1;
}

// 共享：定位自动补全下拉框（fixed 定位 + getBoundingClientRect）
function positionAutocompleteDropdown(input, dropdown) {
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
}

// 检查当前 input 附近的自动补全下拉是否打开
function isAutocompleteOpen(input) {
  const td = input.closest('td');
  if (!td) return false;
  const dropdown = td.querySelector('.autocomplete-dropdown');
  return dropdown && dropdown.style.display === 'block';
}

// ===== 公共：自动补全键盘导航 =====
// 处理下拉菜单内的 ↑↓/Enter/Escape，返回 true 表示已处理
function handleAutocompleteKeydown(e, input, selectFn) {
  const td = input.closest('td');
  const dropdown = td?.querySelector('.autocomplete-dropdown');
  if (!dropdown || dropdown.style.display !== 'block') return false;

  const items = dropdown.querySelectorAll('.autocomplete-item');
  if (items.length === 0) return false;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    autocompleteIndex = Math.min(autocompleteIndex + 1, items.length - 1);
    updateAutocompleteHighlight(items);
    return true;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    autocompleteIndex = Math.max(autocompleteIndex - 1, 0);
    updateAutocompleteHighlight(items);
    return true;
  } else if (e.key === 'Enter') {
    // 下拉有结果时自动选中第一项（不需要先用方向键高亮）
    if (autocompleteIndex < 0 && items.length > 0) autocompleteIndex = 0;
    if (autocompleteIndex >= 0) {
      e.preventDefault();
      selectFn(input, items[autocompleteIndex]);
      return true;
    }
  } else if (e.key === 'Escape') {
    hideAutocomplete();
    return true;
  }
  return false;
}

// 入出库共用：品名失焦时自动匹配 PRODUCTS 填充规格/单位/库存
async function handleStockProductBlur(input) {
  if (!input.isConnected) return;
  const tr = input.closest('tr');
  const keyword = input.value.trim();
  if (!keyword) return;
  const existingSpec = tr && tr.querySelector('[data-field="spec"]')?.value;
  if (existingSpec) return;

  await ensureProducts();
  const product = PRODUCTS.find(p => p.name === keyword);
  if (product) {
    if (tr.querySelector('[data-field="spec"]')) tr.querySelector('[data-field="spec"]').value = product.spec || '';
    if (tr.querySelector('[data-field="unit"]')) tr.querySelector('[data-field="unit"]').value = product.unit || '';
    tr.dataset.productId = product.id;
    // 出库特有：回填当前库存，让用户一眼看到是否够出
    const stockInput = tr.querySelector('[data-field="stock"]');
    if (stockInput) {
      try {
        const inventory = await window.api.getInventory();
        const inv = inventory.find(x => x.id === product.id);
        stockInput.value = inv ? inv.stock : 0;
      } catch (e) { /* ignore */ }
    }
  }
}

// 绑定自动补全的 input/focus/blur 事件
function bindAutocompleteEvents(input, searchFn, selectFn, onBlur, shouldShowOnFocus) {
  input._autocompleteSelectFn = selectFn;
  input.addEventListener('input', () => searchFn(input));
  input.addEventListener('focus', () => {
    if (shouldShowOnFocus && !shouldShowOnFocus(input)) return;
    searchFn(input);
  });
  input.addEventListener('blur', () => setTimeout(() => {
    hideAutocomplete();
    if (onBlur) onBlur(input);
  }, 200));
}

// ===== Public Table Keyboard Navigation =====
function handleCellKeydown(e, input, tbody, onAppendRow) {
  const tr = input.closest('tr');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const editableCols = Array.from(tr.querySelectorAll('.cell-editable'));
  const colIdx = editableCols.indexOf(input);
  const rowIdx = rows.indexOf(tr);

  switch (e.key) {
    case 'Enter':
      e.preventDefault();
      if (ENTER_MODE === 'next-cell') {
        // 跳到下一行首格
        if (rowIdx < rows.length - 1) {
          const nextRow = rows[rowIdx + 1];
          const nextInput = nextRow.querySelector('.cell-editable');
          if (nextInput) { nextInput.focus(); nextInput.select(); }
        } else {
          (onAppendRow || appendPurchaseRow)(tbody, rows.length);
          setTimeout(() => {
            const newRows = Array.from(tbody.querySelectorAll('tr'));
            const nextInput = newRows[newRows.length - 1].querySelector('.cell-editable');
            if (nextInput) { nextInput.focus(); nextInput.select(); }
          }, 50);
        }
      } else {
        // 跳到下一行同列
        if (rowIdx < rows.length - 1) {
          const nextRow = rows[rowIdx + 1];
          const nextEditableCols = nextRow.querySelectorAll('.cell-editable');
          const nextInput = nextEditableCols[colIdx];
          if (nextInput) { nextInput.focus(); nextInput.select(); }
        } else {
          (onAppendRow || appendPurchaseRow)(tbody, rows.length);
          setTimeout(() => {
            const newRows = Array.from(tbody.querySelectorAll('tr'));
            const nextRow = newRows[newRows.length - 1];
            const nextEditableCols = nextRow.querySelectorAll('.cell-editable');
            const nextInput = nextEditableCols[colIdx];
            if (nextInput) { nextInput.focus(); nextInput.select(); }
          }, 50);
        }
      }
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (rowIdx < rows.length - 1) {
        const nextRow = rows[rowIdx + 1];
        const nextEditableCols = nextRow.querySelectorAll('.cell-editable');
        const nextInput = nextEditableCols[colIdx];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (rowIdx > 0) {
        const prevRow = rows[rowIdx - 1];
        const prevEditableCols = prevRow.querySelectorAll('.cell-editable');
        const prevInput = prevEditableCols[colIdx];
        if (prevInput) {
          prevInput.focus();
          prevInput.select();
        }
      }
      break;

    case 'ArrowLeft':
      // 自动补全下拉打开时不触发列导航
      if (isAutocompleteOpen(input)) break;
      // 光标在文本开头时跳到前一列
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        if (colIdx > 0) {
          e.preventDefault();
          const prevInput = editableCols[colIdx - 1];
          prevInput.focus();
          // 光标移到末尾
          if (prevInput.setSelectionRange) {
            const len = prevInput.value.length;
            prevInput.setSelectionRange(len, len);
          }
        }
      }
      break;

    case 'ArrowRight':
      // 自动补全下拉打开时不触发列导航
      if (isAutocompleteOpen(input)) break;
      // 光标在文本末尾时跳到后一列
      if (input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
        if (colIdx < editableCols.length - 1) {
          e.preventDefault();
          const nextInput = editableCols[colIdx + 1];
          nextInput.focus();
          if (nextInput.setSelectionRange) {
            nextInput.setSelectionRange(0, 0);
          }
        }
      }
      break;

    case 'Tab':
      // Navigate between editable cells only
      if (!e.shiftKey && colIdx === editableCols.length - 1 && rowIdx < rows.length - 1) {
        e.preventDefault();
        const nextRow = rows[rowIdx + 1];
        const nextInput = nextRow.querySelector('.cell-editable');
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
      break;

    case 'Escape':
      input.blur();
      break;
  }
}

function bindTableRowEvents(tr, tbody, options = {}) {
  const { onSelect, onAutocomplete, onProductSelect, onProductBlur, onQtyChange, onFieldChange, onAppendRow, shouldShowAutocompleteOnFocus } = options;
  tr.querySelectorAll('.cell-editable').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (input.dataset.field === 'product_name' && handleAutocompleteKeydown(e, input, onSelect)) {
        // Enter 键在下拉选中时被消费，不会触发 handleCellKeydown 增行。
        // 若当前是最后一行，自动追加新行，避免用户误以为已在下一行而漏填数据。
        if (e.key === 'Enter' && onAppendRow) {
          const rows = Array.from(tbody.querySelectorAll('tr'));
          const rowIdx = rows.indexOf(input.closest('tr'));
          if (rowIdx === rows.length - 1) {
            onAppendRow(tbody, rows.length);
          }
        }
        return;
      }
      handleCellKeydown(e, input, tbody, onAppendRow);
    });

    // 粘贴：支持单列和多列（TSV）粘贴
    input.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.length > 0);
      if (lines.length === 0) return;
      const isTSV = lines[0].includes('\t');
      if (!isTSV && lines.length <= 1) return; // 单行纯文本走默认行为

      e.preventDefault();
      const currentTr = input.closest('tr');
      const currentTbody = currentTr.closest('tbody');
      const allRows = Array.from(currentTbody.querySelectorAll('tr'));
      const startRowIdx = allRows.indexOf(currentTr);
      const startColIdx = Array.from(currentTr.querySelectorAll('.cell-editable')).indexOf(input);
      const totalCols = currentTr.querySelectorAll('.cell-editable').length;

      let appended = false;
      for (let i = 0; i < lines.length; i++) {
        // 获取或追加目标行
        let targetRow = allRows[startRowIdx + i];
        if (!targetRow) {
          const appendFn = onAppendRow || appendPurchaseRow;
          appendFn(currentTbody, allRows.length + i);
          allRows.length = 0;
          allRows.push(...currentTbody.querySelectorAll('tr'));
          targetRow = allRows[allRows.length - 1];
          appended = true;
        }
        const editableInputs = targetRow.querySelectorAll('.cell-editable');

        if (isTSV) {
          // 多列粘贴：从当前列开始填充，超出列数时截断
          const cells = lines[i].split('\t');
          for (let j = 0; j < cells.length; j++) {
            const targetIdx = startColIdx + j;
            if (targetIdx >= totalCols) break; // 截断，避免溢出到下一列
            if (editableInputs[targetIdx]) {
              editableInputs[targetIdx].value = cells[j];
              editableInputs[targetIdx].dispatchEvent(new Event('input', { bubbles: true }));
              editableInputs[targetIdx].dispatchEvent(new Event('blur', { bubbles: true }));
            }
          }
        } else {
          // 单列粘贴：按当前列向下填充
          if (editableInputs[startColIdx]) {
            editableInputs[startColIdx].value = lines[i];
            editableInputs[startColIdx].dispatchEvent(new Event('input', { bubbles: true }));
            editableInputs[startColIdx].dispatchEvent(new Event('blur', { bubbles: true }));
          }
        }
      }
      // 粘贴新增行后重新编号序号（仅采购单页面有此函数）
      if (appended && typeof reindexPurchaseRows === 'function') {
        reindexPurchaseRows(currentTbody);
      }
    });

    if (input.dataset.field === 'product_name' && onAutocomplete && onProductSelect) {
      bindAutocompleteEvents(input, onAutocomplete, onProductSelect, onProductBlur, shouldShowAutocompleteOnFocus);
    }

    if (onFieldChange) input.addEventListener('change', () => onFieldChange(tr));
    if (input.dataset.field === 'quantity' && onQtyChange) input.addEventListener('input', () => onQtyChange(tr));

    // 备注记忆：聚焦显示候选，失焦采集备注
    if (input.dataset.field === 'remark') {
      input.addEventListener('focus', () => showRemarkDropdown(input));
      input.addEventListener('blur', () => saveRemarkOnBlur(input));
    }
  });
}

function renumberRows(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  tbody.querySelectorAll('tr').forEach((tr, idx) => {
    tr.querySelector('.row-num').textContent = idx + 1;
  });
}

// 备注记忆：根据品名查询历史备注，显示最多 3 个候选槽位
async function showRemarkDropdown(input) {
  const tr = input.closest('tr');
  const productName = tr.querySelector('[data-field="product_name"]')?.value?.trim();
  if (!productName) return;

  try {
    const remarks = await window.api.getRemarksByName(productName);
    if (!remarks || remarks.length === 0) return;

    hideRemarkDropdown();

    const dropdown = document.createElement('div');
    dropdown.className = 'remark-dropdown';
    // 最多 3 个槽位，以小按钮形式排列
    const slots = remarks.slice(0, 3);
    dropdown.innerHTML = slots.map(r =>
      `<button class="remark-slot" data-remark="${(r.remark || '').replace(/"/g, '&quot;')}">${r.remark}</button>`
    ).join('');

    const rect = input.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 2) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.minWidth = rect.width + 'px';
    dropdown.style.zIndex = '9999';
    document.body.appendChild(dropdown);

    dropdown.querySelectorAll('.remark-slot').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = btn.dataset.remark;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        hideRemarkDropdown();
      });
    });

    input.addEventListener('blur', () => setTimeout(hideRemarkDropdown, 150), { once: true });
  } catch (e) { /* ignore */ }
}

function hideRemarkDropdown() {
  document.querySelectorAll('.remark-dropdown').forEach(el => el.remove());
}

// 备注记忆采集：备注输入失焦时，非空则保存到 remark_memory
function saveRemarkOnBlur(input) {
  const tr = input.closest('tr');
  const productName = tr.querySelector('[data-field="product_name"]')?.value?.trim();
  const remark = input.value.trim();
  if (!productName || !remark) return;
  try { window.api.addRemarkMemory(productName, remark); } catch (e) { /* ignore */ }
}

// 列复制：点击表头 📋 按钮，将整列数据写入剪贴板
function copyColumnToClipboard(btn) {
  const th = btn.closest('th');
  const thead = th.closest('thead');
  const table = thead.closest('table');
  const colIdx = Array.from(thead.querySelector('tr').children).indexOf(th);
  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const values = [];
  tbody.querySelectorAll('tr').forEach(tr => {
    const td = tr.children[colIdx];
    if (!td) return;
    const input = td.querySelector('.cell-editable');
    const val = input ? input.value.trim() : td.textContent.trim();
    if (val) values.push(val);
  });

  if (values.length === 0) {
    btn.textContent = '⊘';
    setTimeout(() => { btn.textContent = '📋'; }, 1000);
    return;
  }

  navigator.clipboard.writeText(values.join('\n')).then(() => {
    btn.textContent = '✅';
    btn.title = `已复制 ${values.length} 行`;
    setTimeout(() => { btn.textContent = '📋'; btn.title = '复制整列'; }, 1500);
  });
}

// 共享 Ctrl+D 向下填充：从当前行向下填充到末尾（覆盖已有值，行为对齐 Excel）
function fillDownColumn(input, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const allRows = Array.from(tbody.querySelectorAll('tr'));
  const currentTr = input.closest('tr');
  if (!currentTr) return;
  const startIdx = allRows.indexOf(currentTr);
  if (startIdx < 0) return;
  const field = input.dataset.field;
  if (!field) return;
  const value = input.value;
  if (!value) return;  // 当前值为空时不填充
  let filled = 0;

  for (let i = startIdx + 1; i < allRows.length; i++) {
    const targetInput = allRows[i].querySelector(`[data-field="${field}"]`);
    if (targetInput) {
      targetInput.value = value;
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      targetInput.dispatchEvent(new Event('blur', { bubbles: true }));
      filled++;
    }
  }
  if (filled > 0) {
    showToast(`已向下填充 ${filled} 行`);
  }
}

// ===== History Tree =====
// 将记录按日期分组为 年→月→日 三级嵌套 Map
function groupRecordsByDate(records) {
  const tree = new Map(); // year -> Map(month -> Map(day -> records[]))
  for (const r of records) {
    const d = parseLocalDate(r.date);
    if (!d) continue;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (!tree.has(year)) tree.set(year, new Map());
    const yearMap = tree.get(year);
    if (!yearMap.has(month)) yearMap.set(month, new Map());
    const monthMap = yearMap.get(month);
    if (!monthMap.has(day)) monthMap.set(day, []);
    monthMap.get(day).push(r);
  }
  return tree;
}

// 统计树节点内记录总数
function countTreeRecords(node) {
  let count = 0;
  for (const val of node.values()) {
    if (Array.isArray(val)) { count += val.length; }
    else { count += countTreeRecords(val); }
  }
  return count;
}

// 渲染单条记录行（inbound 列）
function renderInboundRecordRow(r) {
  return `<tr>
    <td class="tree-cb-cell"><input type="checkbox" class="tree-row-cb" data-id="${r.id}" data-type="inbound" data-date="${formatDate(r.date)}" data-qty="${r.quantity}" data-remark="${(r.remark || '').replace(/"/g, '&quot;')}" data-prod="${formatDate(r.production_date)}" data-expiry="${formatDate(r.expiry_date)}"></td>
    <td>${r.product_name}</td>
    <td>${r.quantity}</td><td>${r.unit}</td>
    <td>${formatDate(r.production_date)}</td><td>${formatDate(r.expiry_date)}</td>
    <td>${r.remark || ''}</td>
    <td>
      <button class="btn btn-sm" onclick='editInbound(${JSON.stringify(r).replace(/'/g, "&#39;")})'>编辑</button>
      <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteInbound(${r.id})">删除</button>
    </td>
  </tr>`;
}

// 渲染单条记录行（outbound 列）
function renderOutboundRecordRow(r) {
  return `<tr>
    <td class="tree-cb-cell"><input type="checkbox" class="tree-row-cb" data-id="${r.id}" data-type="outbound" data-date="${formatDate(r.date)}" data-qty="${r.quantity}" data-recipient="${(r.recipient || '').replace(/"/g, '&quot;')}"></td>
    <td>${r.product_name}</td>
    <td>${r.quantity}</td><td>${r.unit}</td>
    <td>${r.recipient}</td>
    <td>
      <button class="btn btn-sm" onclick='editOutbound(${JSON.stringify(r).replace(/'/g, "&#39;")})'>编辑</button>
      <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteOutbound(${r.id})">删除</button>
    </td>
  </tr>`;
}

// 渲染折叠历史树 HTML（type: 'inbound' | 'outbound'）
function renderHistoryTree(tree, type) {
  if (tree.size === 0) return '<div class="tree-empty">暂无历史记录</div>';

  const years = [...tree.keys()].sort((a, b) => b - a);
  const rowFn = type === 'inbound' ? renderInboundRecordRow : renderOutboundRecordRow;
  const tableHeaders = type === 'inbound'
    ? '<tr><th class="tree-cb-cell"><input type="checkbox" class="tree-day-cb" onclick="toggleDayCheckboxes(this)" title="全选当日"></th><th>材料</th><th>数量</th><th>单位</th><th>生产日期</th><th>到期日</th><th>备注</th><th>操作</th></tr>'
    : '<tr><th class="tree-cb-cell"><input type="checkbox" class="tree-day-cb" onclick="toggleDayCheckboxes(this)" title="全选当日"></th><th>材料</th><th>数量</th><th>单位</th><th>领取人</th><th>操作</th></tr>';

  return years.map(year => {
    const yearMap = tree.get(year);
    const months = [...yearMap.keys()].sort((a, b) => b - a);
    const yearCount = countTreeRecords(yearMap);
    return `<div class="tree-year">
      <div class="tree-year-header" onclick="toggleTreeNode(this)">
        <span class="tree-caret">▼</span><span class="tree-label">${year}年</span><span class="tree-count">${yearCount}条</span>
      </div>
      <div class="tree-year-body">${months.map(month => {
        const dayMap = yearMap.get(month);
        const days = [...dayMap.keys()].sort((a, b) => b - a);
        const monthCount = countTreeRecords(dayMap);
        return `<div class="tree-month">
          <div class="tree-month-header" onclick="toggleTreeNode(this)">
            <span class="tree-caret">▼</span><span class="tree-label">${String(month).padStart(2, '0')}月</span><span class="tree-count">${monthCount}条</span>
          </div>
          <div class="tree-month-body">${days.map(day => {
            const records = dayMap.get(day);
            return `<div class="tree-day">
              <div class="tree-day-header" onclick="toggleTreeNode(this)">
                <span class="tree-caret">▶</span><span class="tree-label">${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}</span><span class="tree-count">${records.length}条</span>
              </div>
              <div class="tree-day-body" style="display:none;">
                <table class="table tree-table"><thead>${tableHeaders}</thead><tbody>${records.map(rowFn).join('')}</tbody></table>
              </div>
            </div>`;
          }).join('')}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
  }).join('');
}

// 切换单个树节点折叠/展开
function toggleTreeNode(header) {
  const body = header.nextElementSibling;
  const caret = header.querySelector('.tree-caret');
  if (!body || !caret) return;
  const isOpen = body.style.display !== 'none';
  if (isOpen) {
    body.style.display = 'none';
    caret.textContent = '▶';
  } else {
    body.style.display = '';
    caret.textContent = '▼';
  }
}

// 全部展开/折叠树节点
// @param {HTMLElement} btn - 触发按钮，向上找到 .card 或 .tree-container 作为作用域
// @param {boolean} expand - true 展开，false 折叠
function setAllTreeNodes(btn, expand) {
  const container = btn.closest('.card') || btn.closest('.history-tree')?.parentElement;
  if (!container) return;
  const bodies = container.querySelectorAll('.tree-year-body, .tree-month-body, .tree-day-body');
  const carets = container.querySelectorAll('.tree-year-header .tree-caret, .tree-month-header .tree-caret, .tree-day-header .tree-caret');
  bodies.forEach(b => { b.style.display = expand ? '' : 'none'; });
  carets.forEach(c => { c.textContent = expand ? '▼' : '▶'; });
}

function expandAllTree(btn) { setAllTreeNodes(btn, true); }
function collapseAllTree(btn) { setAllTreeNodes(btn, false); }

// 切换选择模式：显示/隐藏复选框和批量操作按钮
function toggleSelectionMode(btn) {
  const card = btn.closest('.card');
  if (!card) return;
  const active = card.classList.toggle('selection-mode');
  btn.textContent = active ? '取消' : '选择';
  if (!active) {
    // 退出选择模式时清空所有勾选
    card.querySelectorAll('.tree-row-cb').forEach(cb => { cb.checked = false; });
    card.querySelectorAll('.tree-day-cb').forEach(cb => { cb.checked = false; });
  }
}

// 日级全选：点击表头复选框切换当日所有行
function toggleDayCheckboxes(cb) {
  const table = cb.closest('table');
  if (!table) return;
  const checked = cb.checked;
  table.querySelectorAll('tbody .tree-row-cb').forEach(rowCb => { rowCb.checked = checked; });
}

// 收集容器内所有勾选的记录 {ids, type}
function getCheckedHistoryIds(container) {
  const cbs = container.querySelectorAll('.tree-row-cb:checked');
  const ids = [];
  let type = null;
  cbs.forEach(cb => {
    ids.push(parseInt(cb.dataset.id));
    if (!type) type = cb.dataset.type;
  });
  return { ids, type };
}

// 批量删除勾选记录
async function deleteCheckedHistory(container) {
  const { ids, type } = getCheckedHistoryIds(container);
  if (ids.length === 0) { showToast('请先勾选要删除的记录', 'error'); return; }
  if (!confirm(`确定删除选中的 ${ids.length} 条记录？此操作不可撤销。`)) return;
  try {
    for (const id of ids) {
      if (type === 'inbound') await window.api.deleteInbound(id);
      else await window.api.deleteOutbound(id);
    }
    showToast(`已删除 ${ids.length} 条`);
    // 刷新对应历史
    if (type === 'inbound') loadRecentInbound();
    else loadRecentOutbound();
  } catch (err) {
    showToast('批量删除失败: ' + err.message, 'error');
  }
}

// 批量移动勾选记录到指定日期
async function moveCheckedHistoryDate(container) {
  const { ids, type } = getCheckedHistoryIds(container);
  if (ids.length === 0) { showToast('请先勾选要移动的记录', 'error'); return; }

  openModal('移至日期', `
    <div class="form-group">
      <label>将 ${ids.length} 条记录移至</label>
      <input type="date" class="form-control" id="move-target-date" value="${todayStr()}">
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doMoveCheckedHistoryDate()">确认移动</button>
  `);

  // 暂存到 window 供弹窗回调使用
  window._moveCheckedData = { ids, type };
}

async function doMoveCheckedHistoryDate() {
  const { ids, type } = window._moveCheckedData || {};
  const newDate = document.getElementById('move-target-date')?.value;
  if (!ids || !newDate) { closeModal(); return; }
  try {
    // 从勾选的复选框读取原字段，移动时保留
    const container = document.querySelector('.selection-mode .history-tree');
    for (const id of ids) {
      const cb = container?.querySelector(`.tree-row-cb[data-id="${id}"]`);
      if (type === 'inbound') {
        await window.api.updateInbound(id, {
          date: newDate,
          quantity: parseFloat(cb?.dataset.qty) || 0,
          remark: cb?.dataset.remark || '',
          production_date: cb?.dataset.prod || null,
          expiry_date: cb?.dataset.expiry || null,
        });
      } else {
        await window.api.updateOutbound(id, {
          date: newDate,
          quantity: parseFloat(cb?.dataset.qty) || 0,
          recipient: cb?.dataset.recipient || '',
        });
      }
    }
    closeModal();
    showToast(`已移动 ${ids.length} 条`);
    if (type === 'inbound') loadRecentInbound();
    else loadRecentOutbound();
  } catch (err) {
    closeModal();
    showToast('移动失败: ' + err.message, 'error');
  } finally {
    delete window._moveCheckedData;
  }
}

// 批量修改勾选记录
async function editCheckedHistory(container) {
  const { ids, type } = getCheckedHistoryIds(container);
  if (ids.length === 0) { showToast('请先勾选要修改的记录', 'error'); return; }

  const fieldsHtml = type === 'inbound'
    ? `<div class="form-group"><label>日期（留空不修改）</label><input type="date" class="form-control" id="be-date"></div>
       <div class="form-group"><label>备注（留空不修改）</label><input type="text" class="form-control" id="be-remark" placeholder="留空则保持原值"></div>`
    : `<div class="form-group"><label>日期（留空不修改）</label><input type="date" class="form-control" id="be-date"></div>
       <div class="form-group"><label>领取人（留空不修改）</label><select class="form-control" id="be-recipient"><option value="">-- 不修改 --</option>${RECIPIENTS.map(r => `<option value="${r.name}">${r.name}</option>`).join('')}</select></div>`;

  openModal(`批量修改 ${ids.length} 条记录`, `
    <p style="color:var(--text-muted);margin-bottom:12px;">只更新已填写的字段，留空的字段保持原值不变。</p>
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">${fieldsHtml}</div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doEditCheckedHistory()">确认修改</button>
  `);

  window._editCheckedData = { ids, type };
}

async function doEditCheckedHistory() {
  const { ids, type } = window._editCheckedData || {};
  if (!ids) { closeModal(); return; }
  const newDate = document.getElementById('be-date')?.value;
  const container = document.querySelector('.selection-mode .history-tree');
  try {
    for (const id of ids) {
      const cb = container?.querySelector(`.tree-row-cb[data-id="${id}"]`);
      if (type === 'inbound') {
        const remark = document.getElementById('be-remark')?.value;
        await window.api.updateInbound(id, {
          date: newDate || (cb?.dataset.date || ''),
          quantity: parseFloat(cb?.dataset.qty) || 0,
          remark: remark !== undefined && remark !== '' ? remark : (cb?.dataset.remark || ''),
          production_date: cb?.dataset.prod || null,
          expiry_date: cb?.dataset.expiry || null,
        });
      } else {
        const recipient = document.getElementById('be-recipient')?.value;
        await window.api.updateOutbound(id, {
          date: newDate || (cb?.dataset.date || ''),
          quantity: parseFloat(cb?.dataset.qty) || 0,
          recipient: recipient || cb?.dataset.recipient || '',
        });
      }
    }
    closeModal();
    showToast(`已修改 ${ids.length} 条`);
    if (type === 'inbound') loadRecentInbound();
    else loadRecentOutbound();
  } catch (err) {
    closeModal();
    showToast('修改失败: ' + err.message, 'error');
  } finally {
    delete window._editCheckedData;
  }
}

// 绑定 Ctrl+D 事件委托到 tbody（一次性绑定，自动覆盖动态新增的行）
function bindCtrlDFill(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody || tbody._ctrlDBound) return;
  tbody._ctrlDBound = true;

  tbody.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || e.key.toLowerCase() !== 'd') return;
    // 只在 .cell-editable 元素上触发
    const input = e.target.closest('.cell-editable');
    if (!input) return;
    e.preventDefault();
    e.stopPropagation();
    fillDownColumn(input, tbodyId);
  });
}
