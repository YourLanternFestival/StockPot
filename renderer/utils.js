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

// 绑定自动补全的 input/focus/blur 事件
function bindAutocompleteEvents(input, searchFn, selectFn, onBlur) {
  input.addEventListener('input', () => searchFn(input));
  input.addEventListener('focus', () => searchFn(input));
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
  const { onSelect, onAutocomplete, onProductSelect, onProductBlur, onQtyChange, onFieldChange, onAppendRow } = options;
  tr.querySelectorAll('.cell-editable').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (input.dataset.field === 'product_name' && handleAutocompleteKeydown(e, input, onSelect)) return;
      handleCellKeydown(e, input, tbody, onAppendRow);
    });

    // Excel 列粘贴：多行文本按列向下填充
    input.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.length > 0);
      if (lines.length <= 1) return; // 单行粘贴走默认行为

      e.preventDefault();
      input.value = lines[0];
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const currentTr = input.closest('tr');
      const currentTbody = currentTr.closest('tbody');
      const rows = Array.from(currentTbody.querySelectorAll('tr'));
      const startRowIdx = rows.indexOf(currentTr);
      const colIdx = Array.from(currentTr.querySelectorAll('.cell-editable')).indexOf(input);

      // 填充后续行
      for (let i = 1; i < lines.length; i++) {
        let targetRow = rows[startRowIdx + i];
        if (!targetRow) {
          // 自动追加行
          const appendFn = currentTbody._appendRowFn || onAppendRow || appendPurchaseRow;
          appendFn(currentTbody, rows.length + i - 1);
          const newRows = Array.from(currentTbody.querySelectorAll('tr'));
          targetRow = newRows[newRows.length - 1];
        }
        const targetInputs = targetRow.querySelectorAll('.cell-editable');
        if (targetInputs[colIdx]) {
          targetInputs[colIdx].value = lines[i];
          targetInputs[colIdx].dispatchEvent(new Event('input', { bubbles: true }));
          targetInputs[colIdx].dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }
    });

    if (input.dataset.field === 'product_name' && onAutocomplete && onProductSelect) {
      bindAutocompleteEvents(input, onAutocomplete, onProductSelect, onProductBlur);
    }

    if (onFieldChange) input.addEventListener('change', () => onFieldChange(tr));
    if (input.dataset.field === 'quantity' && onQtyChange) input.addEventListener('input', () => onQtyChange(tr));
  });
}

function renumberRows(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  tbody.querySelectorAll('tr').forEach((tr, idx) => {
    tr.querySelector('.row-num').textContent = idx + 1;
  });
}
