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
