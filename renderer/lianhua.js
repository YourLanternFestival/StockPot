// ===== Lianhua (联华) Module =====
let lianhuaItems = [];

// Show dialog to import lianhua items
function showImportLianhuaDialog() {
  openModal('导入联华商品', `
    <div class="form-group">
      <label>选择文件</label>
      <div class="import-dropzone" id="lianhua-dropzone" style="padding:20px;">
        <p>点击选择联华超市文件（.xlsx/.xls）</p>
        <input type="file" id="lianhua-file-input" accept=".xlsx,.xls" style="display:none;" onchange="handleLianhuaFileSelected(this)">
        <button class="btn btn-primary" onclick="document.getElementById('lianhua-file-input').click()">选择文件</button>
      </div>
      <div id="lianhua-file-name" style="margin-top:8px;color:var(--text-muted);font-size:13px;"></div>
    </div>
    <div id="lianhua-import-preview" style="display:none;">
      <h4 style="margin-bottom:8px;">预览导入数据</h4>
      <div id="lianhua-preview-stats"></div>
    </div>
    <div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:6px;font-size:13px;">
      <strong>提示：</strong>也可从询价表导入联华部分数据（单件价格）。
      <button class="btn btn-sm" onclick="importLianhuaFromInquiry()" style="margin-left:8px;">从询价表导入</button>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" id="btn-start-import-lianhua" onclick="startImportLianhua()" disabled>开始导入</button>
  `);
}

let pendingLianhuaData = null;

function handleLianhuaFileSelected(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  document.getElementById('lianhua-file-name').textContent = `已选择: ${file.name}`;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      // Find 询价 sheet
      const sheetName = wb.SheetNames.find(name => name.includes('询价'));
      if (!sheetName) {
        showToast('未找到"询价"工作表', 'error');
        return;
      }

      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      const items = [];
      // Data starts at row 2 (index 2), columns: 序号, 类别, 匹配名称, 名称(编码), 评估价格, 盛销折扣后价格, 优宏折扣后价格, 单位, 规格, 备注
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        const category = String(row[1] || '').trim();
        if (category !== '联华') continue; // Only import 联华 items

        const name = String(row[2] || '').trim();
        if (!name) continue;

        items.push({
          code: String(row[3] || '').trim(),
          name: name,
          unit: String(row[7] || '包').trim(),
          spec: String(row[8] || '').trim(),
          price: parseFloat(row[5]) || 0, // 盛销折扣后价格
          split_qty: parseInt(row[10]) || 1, // 拆分单件
          remark: String(row[9] || '').trim()
        });
      }

      pendingLianhuaData = items;
      document.getElementById('lianhua-import-preview').style.display = 'block';
      document.getElementById('lianhua-preview-stats').innerHTML =
        `<span class="tag tag-success">共 ${items.length} 个联华商品</span>`;
      document.getElementById('btn-start-import-lianhua').disabled = false;
    } catch (err) {
      showToast('文件解析失败: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function startImportLianhua() {
  if (!pendingLianhuaData) return;

  try {
    const result = await window.api.importLianhuaItems(pendingLianhuaData);
    showToast(`导入成功！共 ${result.imported} 个商品`);
    closeModal();
    pendingLianhuaData = null;
    await loadLianhuaItems();
  } catch (err) {
    showToast('导入失败: ' + err.message, 'error');
  }
}

// Import lianhua items from inquiry database
async function importLianhuaFromInquiry() {
  try {
    // Get inquiry items with category "联华" from latest month
    const months = await window.api.getInquiryMonths();
    if (months.length === 0) {
      showToast('请先导入询价数据', 'error');
      return;
    }

    const latestMonth = months[0].month;
    const items = await window.api.getInquiryItems(latestMonth, null);
    const lianhuaInquiry = items.filter(item => item.category === '联华');

    if (lianhuaInquiry.length === 0) {
      showToast('未找到联华询价数据', 'error');
      return;
    }

    const importData = lianhuaInquiry.map(item => ({
      code: '',
      name: item.name,
      unit: item.unit || '包',
      spec: item.spec || '',
      price: item.price || 0,
      split_qty: 1,
      remark: ''
    }));

    const result = await window.api.importLianhuaItems(importData);
    showToast(`从询价表导入 ${result.imported} 个联华商品`);
    closeModal();
    await loadLianhuaItems();
  } catch (err) {
    showToast('导入失败: ' + err.message, 'error');
  }
}

// Load lianhua items
async function loadLianhuaItems() {
  try {
    lianhuaItems = await window.api.getLianhuaItems();
  } catch (err) {
    console.error('Load lianhua items error:', err);
  }
}

// Show manage lianhua items dialog
function showManageLianhuaItems() {
  const itemsHtml = lianhuaItems.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.code || ''}</td>
      <td>${item.name}</td>
      <td>${item.unit}</td>
      <td>${item.spec}</td>
      <td>¥${item.price}</td>
      <td>${item.split_qty}</td>
      <td>
        <button class="btn btn-sm" onclick="editLianhuaItem(${item.id})">编辑</button>
        <button class="btn btn-sm" style="color:var(--danger);" onclick="deleteLianhuaItem(${item.id})">删除</button>
      </td>
    </tr>
  `).join('');

  openModal('管理联华商品', `
    <div style="margin-bottom:12px;">
      <button class="btn btn-primary" onclick="showAddLianhuaItem()">+ 新增商品</button>
    </div>
    <div style="max-height:400px;overflow:auto;">
      <table class="table" style="font-size:13px;">
        <thead>
          <tr>
            <th>序号</th><th>编码</th><th>品名</th><th>单位</th><th>规格</th><th>单价</th><th>拆分</th><th>操作</th>
          </tr>
        </thead>
        <tbody>${itemsHtml || '<tr><td colspan="8" style="text-align:center;padding:20px;">暂无数据</td></tr>'}</tbody>
      </table>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">关闭</button>
  `);
}

function showAddLianhuaItem() {
  openModal('新增联华商品', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>编码</label><input type="text" class="form-control" id="new-lianhua-code"></div>
      <div class="form-group"><label>品名 <span class="required">*</span></label><input type="text" class="form-control" id="new-lianhua-name"></div>
      <div class="form-group"><label>单位</label><input type="text" class="form-control" id="new-lianhua-unit" value="件"></div>
      <div class="form-group"><label>规格</label><input type="text" class="form-control" id="new-lianhua-spec"></div>
      <div class="form-group"><label>整件单价</label><input type="number" class="form-control" id="new-lianhua-price" step="0.1"></div>
      <div class="form-group"><label>拆分单件数</label><input type="number" class="form-control" id="new-lianhua-split" value="1" min="1"></div>
      <div class="form-group" style="grid-column:1/-1;"><label>备注</label><input type="text" class="form-control" id="new-lianhua-remark"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddLianhuaItem()">保存</button>
  `);
}

async function doAddLianhuaItem() {
  const name = document.getElementById('new-lianhua-name').value.trim();
  if (!name) { showToast('请输入品名', 'error'); return; }

  await window.api.addLianhuaItem({
    code: document.getElementById('new-lianhua-code').value.trim(),
    name: name,
    unit: document.getElementById('new-lianhua-unit').value.trim(),
    spec: document.getElementById('new-lianhua-spec').value.trim(),
    price: parseFloat(document.getElementById('new-lianhua-price').value) || 0,
    split_qty: parseInt(document.getElementById('new-lianhua-split').value) || 1,
    remark: document.getElementById('new-lianhua-remark').value.trim()
  });

  showToast('已添加');
  await loadLianhuaItems();
  closeModal();
  showManageLianhuaItems();
}

function editLianhuaItem(id) {
  const item = lianhuaItems.find(i => i.id === id);
  if (!item) return;

  openModal('编辑联华商品', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>编码</label><input type="text" class="form-control" id="edit-lianhua-code" value="${item.code || ''}"></div>
      <div class="form-group"><label>品名 <span class="required">*</span></label><input type="text" class="form-control" id="edit-lianhua-name" value="${item.name}"></div>
      <div class="form-group"><label>单位</label><input type="text" class="form-control" id="edit-lianhua-unit" value="${item.unit}"></div>
      <div class="form-group"><label>规格</label><input type="text" class="form-control" id="edit-lianhua-spec" value="${item.spec}"></div>
      <div class="form-group"><label>整件单价</label><input type="number" class="form-control" id="edit-lianhua-price" value="${item.price}" step="0.1"></div>
      <div class="form-group"><label>拆分单件数</label><input type="number" class="form-control" id="edit-lianhua-split" value="${item.split_qty}" min="1"></div>
      <div class="form-group" style="grid-column:1/-1;"><label>备注</label><input type="text" class="form-control" id="edit-lianhua-remark" value="${item.remark || ''}"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doEditLianhuaItem(${id})">保存</button>
  `);
}

async function doEditLianhuaItem(id) {
  const name = document.getElementById('edit-lianhua-name').value.trim();
  if (!name) { showToast('请输入品名', 'error'); return; }

  await window.api.updateLianhuaItem(id, {
    code: document.getElementById('edit-lianhua-code').value.trim(),
    name: name,
    unit: document.getElementById('edit-lianhua-unit').value.trim(),
    spec: document.getElementById('edit-lianhua-spec').value.trim(),
    price: parseFloat(document.getElementById('edit-lianhua-price').value) || 0,
    split_qty: parseInt(document.getElementById('edit-lianhua-split').value) || 1,
    remark: document.getElementById('edit-lianhua-remark').value.trim()
  });

  showToast('已更新');
  await loadLianhuaItems();
  closeModal();
  showManageLianhuaItems();
}

async function deleteLianhuaItem(id) {
  if (!confirm('确定删除？')) return;
  await window.api.deleteLianhuaItem(id);
  await loadLianhuaItems();
  showManageLianhuaItems();
}

// Show add lianhua date dialog — 弹窗内直接填写
function showAddLianhuaDate(source) {
  source = source || '联华';
  const matrixDate = document.getElementById('matrix-date');
  const defaultDate = (matrixDate && matrixDate.value) ? matrixDate.value : getTomorrowStr();
  const canteenName = source.replace('-联华', '');

  openModal(`${canteenName} 联华加购`, `
    <div class="form-group" style="margin-bottom:12px;">
      <label>发货日期</label>
      <input type="date" class="form-control" id="modal-lianhua-date" value="${defaultDate}" style="width:160px;">
    </div>
    <div class="purchase-table-wrapper">
      <table class="table table-purchase" id="modal-lianhua-table">
        <thead>
          <tr>
            <th style="width:40px;">序号</th>
            <th style="width:200px;">品名</th>
            <th style="width:100px;">规格</th>
            <th style="width:70px;">单价</th>
            <th style="width:70px;">数量</th>
            <th style="width:50px;">单位</th>
            <th style="width:70px;">金额</th>
            <th style="width:120px;">备注</th>
            <th style="width:40px;">操作</th>
          </tr>
        </thead>
        <tbody id="modal-lianhua-tbody"></tbody>
      </table>
    </div>
    <button class="btn btn-sm" style="margin-top:8px;" onclick="modalLianhuaAddRows()">+ 添加行</button>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doSaveLianhuaFromModal('${source}')">保存</button>
  `);

  // 添加 5 行空行
  const tbody = document.getElementById('modal-lianhua-tbody');
  for (let i = 0; i < 5; i++) {
    appendLianhuaRow(tbody, i);
  }
}

function modalLianhuaAddRows() {
  const tbody = document.getElementById('modal-lianhua-tbody');
  const current = tbody.querySelectorAll('tr').length;
  for (let i = 0; i < 5; i++) {
    appendLianhuaRow(tbody, current + i);
  }
}

function doSaveLianhuaFromModal(source) {
  const date = document.getElementById('modal-lianhua-date').value;
  if (!date) { showToast('请选择日期', 'error'); return; }

  const groupContent = document.querySelector(`.purchase-group[data-source="${source}"] .group-content`);
  if (!groupContent) { showToast('未找到联华分组', 'error'); return; }

  const dateId = `lianhua-date-${source}-${date}`.replace(/[\s-]/g, '_');
  let dateGroup = document.getElementById(dateId);

  // 如果该日期分组不存在，创建一个
  if (!dateGroup) {
    addLianhuaDateGroup(date, source);
    dateGroup = document.getElementById(dateId);
  }
  if (!dateGroup) { showToast('创建日期分组失败', 'error'); return; }

  // 将弹窗中的数据追加到日期分组的 tbody
  const targetTbody = dateGroup.querySelector('tbody');
  const modalRows = document.querySelectorAll('#modal-lianhua-tbody tr');
  let addedCount = 0;

  modalRows.forEach(tr => {
    const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
    const productName = getData('product_name').trim();
    if (!productName) return;

    const newTr = document.createElement('tr');
    newTr.innerHTML = `
      <td>0</td>
      <td style="position:relative;">
        <input type="text" class="cell-input cell-editable" value="${productName}" data-field="product_name" autocomplete="off" placeholder="输入品名...">
        <div class="autocomplete-dropdown" style="display:none;"></div>
      </td>
      <td><input type="text" class="cell-input cell-readonly" value="${getData('spec')}" data-field="spec" readonly tabindex="-1"></td>
      <td><input type="text" class="cell-input cell-readonly" value="${getData('unit_price')}" data-field="unit_price" readonly tabindex="-1"></td>
      <td><input type="text" class="cell-input cell-editable" value="${getData('quantity')}" data-field="quantity" placeholder="数量"></td>
      <td><input type="text" class="cell-input cell-readonly" value="${getData('unit')}" data-field="unit" readonly tabindex="-1"></td>
      <td class="amount-cell cell-readonly">${tr.querySelector('.amount-cell')?.textContent || ''}</td>
      <td><input type="text" class="cell-input cell-editable" value="${getData('remark')}" data-field="remark" placeholder="备注"></td>
      <td style="white-space:nowrap;"><button class="btn btn-sm" onclick="copyPurchaseRow(this)" data-tooltip="复制当前行数据到新行">📋</button> <button class="btn-delete-row" onclick="deletePurchaseRow(this)">✕</button></td>
    `;
    targetTbody.appendChild(newTr);
    attachLianhuaCellEvents(newTr, targetTbody);
    addedCount++;
  });

  // 重新编号
  targetTbody.querySelectorAll('tr').forEach((row, idx) => {
    row.querySelector('td:first-child').textContent = idx + 1;
  });

  // 更新 summary
  const summary = dateGroup.querySelector('.date-summary');
  if (summary) {
    const total = targetTbody.querySelectorAll('tr').length;
    summary.textContent = `${total} 项`;
  }

  // 展开父分组
  const groupHeader = groupContent.previousElementSibling;
  if (groupHeader && !groupHeader.classList.contains('expanded')) {
    toggleGroup(groupHeader);
  }

  closeModal();
  if (addedCount > 0) {
    showToast(`已添加 ${addedCount} 条联华订单`);
  }
}

// Add lianhua date group - supports custom source for multi-canteen mode
function addLianhuaDateGroup(date, source) {
  source = source || '联华';
  const groupContent = document.querySelector(`.purchase-group[data-source="${source}"] .group-content`);
  if (!groupContent) return;

  const dateId = `lianhua-date-${source}-${date}`.replace(/[\s-]/g, '_');
  if (document.getElementById(dateId)) {
    showToast('该日期已存在', 'error');
    return;
  }

  const dateGroup = document.createElement('div');
  dateGroup.className = 'date-group';
  dateGroup.id = dateId;
  dateGroup.dataset.date = date;
  dateGroup.dataset.source = source;

  dateGroup.innerHTML = `
    <div class="date-header expanded" onclick="toggleDateGroup(this)">
      <span class="date-toggle">▶</span>
      <span class="date-label">${date} 发货</span>
      <span class="date-summary">0 项 | 合计 ¥0</span>
      <div class="date-actions">
        <button class="btn btn-sm" onclick="event.stopPropagation(); addPurchaseRows(this)">+ 添加行</button>
        <button class="btn btn-sm" onclick="event.stopPropagation(); exportLianhuaOrderByDate('${date}')">📤 导出</button>
        <button class="btn-delete-date" onclick="event.stopPropagation(); deleteLianhuaDateGroup(this)">🗑</button>
      </div>
    </div>
    <div class="date-content expanded">
      <div class="purchase-table-wrapper">
        <table class="table table-purchase">
          <thead>
            <tr>
              <th style="width:40px;">序号</th>
              <th style="width:200px;">品名</th>
              <th style="width:120px;">规格</th>
              <th style="width:80px;">单价</th>
              <th style="width:80px;">数量</th>
              <th style="width:60px;">单位</th>
              <th style="width:80px;">金额</th>
              <th style="width:150px;">备注</th>
              <th style="width:50px;">操作</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  groupContent.appendChild(dateGroup);

  // Expand parent group
  const groupHeader = groupContent.previousElementSibling;
  if (!groupHeader.classList.contains('expanded')) {
    toggleGroup(groupHeader);
  }

  // Add 5 empty rows with lianhua autocomplete
  const tbody = dateGroup.querySelector('tbody');
  for (let i = 0; i < 5; i++) {
    appendLianhuaRow(tbody, i);
  }
}

// 联华专用行：自动补全从 lianhuaItems 搜索
function appendLianhuaRow(tbody, idx) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${idx + 1}</td>
    <td style="position:relative;">
      <input type="text" class="cell-input cell-editable" value="" data-field="product_name" autocomplete="off" placeholder="输入品名...">
      <div class="autocomplete-dropdown" style="display:none;"></div>
    </td>
    <td><input type="text" class="cell-input cell-readonly" value="" data-field="spec" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-readonly" value="" data-field="unit_price" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-editable" value="" data-field="quantity" placeholder="数量"></td>
    <td><input type="text" class="cell-input cell-readonly" value="" data-field="unit" readonly tabindex="-1"></td>
    <td class="amount-cell cell-readonly"></td>
    <td><input type="text" class="cell-input cell-editable" value="" data-field="remark" placeholder="备注"></td>
    <td style="white-space:nowrap;"><button class="btn btn-sm" onclick="copyPurchaseRow(this)" data-tooltip="复制当前行数据到新行">📋</button> <button class="btn-delete-row" onclick="deletePurchaseRow(this)">✕</button></td>
  `;
  tbody.appendChild(tr);
  attachLianhuaCellEvents(tr, tbody);
}

function attachLianhuaCellEvents(tr, tbody) {
  bindTableRowEvents(tr, tbody, {
    onSelect: selectLianhuaAutocompleteItem,
    onAutocomplete: handleLianhuaAutocomplete,
    onProductSelect: selectLianhuaAutocompleteItem,
    onProductBlur: handleLianhuaBlur,
    onQtyChange: (row) => recalcRowAmount(row),
    onFieldChange: () => {},
    onAppendRow: () => {
      const currentCount = tbody.querySelectorAll('tr').length;
      appendLianhuaRow(tbody, currentCount);
    }
  });
}

// 失焦时自动匹配：键入全名后点别处，自动拉取规格、单位、单价
function handleLianhuaBlur(input) {
  if (!input.isConnected) return;
  const tr = input.closest('tr');
  const keyword = input.value.trim();
  if (!keyword) return;

  const existingSpec = tr.querySelector('[data-field="spec"]')?.value;
  const existingPrice = tr.querySelector('[data-field="unit_price"]')?.value;
  if (existingSpec || existingPrice) return;

  const match = lianhuaItems.find(i => i.name.toLowerCase() === keyword.toLowerCase());
  if (match) {
    tr.querySelector('[data-field="spec"]').value = match.spec || '';
    tr.querySelector('[data-field="unit_price"]').value = match.price || 0;
    tr.querySelector('[data-field="unit"]').value = match.unit || '件';
    recalcRowAmount(tr);
  }
}

function handleLianhuaAutocomplete(input) {
  const keyword = input.value.trim();
  if (keyword.length < 1) { hideAutocomplete(); return; }
  const td = input.closest('td');
  const dropdown = td.querySelector('.autocomplete-dropdown');
  if (!dropdown) return;
  const results = lianhuaItems.filter(i => i.name.toLowerCase().includes(keyword.toLowerCase()));
  if (results.length === 0) { hideAutocomplete(); return; }
  dropdown.innerHTML = results.map((item, idx) => `
    <div class="autocomplete-item" data-index="${idx}" data-name="${item.name}" data-spec="${item.spec || ''}" data-price="${item.price || 0}" data-unit="${item.unit || '件'}">
      <span class="item-name">${item.name}</span>
      <span class="item-spec">${item.spec || ''} | ¥${item.price || 0}</span>
    </div>
  `).join('');
  // 定位下拉菜单（fixed 定位，不会被滚动容器裁切）
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
  dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', (e) => { e.preventDefault(); selectLianhuaAutocompleteItem(input, item); });
  });
}

function selectLianhuaAutocompleteItem(input, item) {
  const tr = input.closest('tr');
  tr.querySelector('[data-field="product_name"]').value = item.dataset.name;
  tr.querySelector('[data-field="spec"]').value = item.dataset.spec || '';
  tr.querySelector('[data-field="unit_price"]').value = item.dataset.price || '';
  tr.querySelector('[data-field="unit"]').value = item.dataset.unit || '件';
  hideAutocomplete();
  recalcRowAmount(tr);
  const qtyInput = tr.querySelector('[data-field="quantity"]');
  if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
}

function deleteLianhuaDateGroup(btn) {
  const dateGroup = btn.closest('.date-group');
  if (confirm('确定删除此日期分组？')) {
    dateGroup.remove();
  }
}

// Export lianhua order by date - sheet name is the date (kept for single date export)
async function exportLianhuaOrderByDate(date) {
  try {
    const dateGroup = document.getElementById(`lianhua-date-${date}`);
    if (!dateGroup) {
      showToast('未找到日期分组', 'error');
      return;
    }

    const rows = dateGroup.querySelectorAll('tbody tr');
    const orders = [];

    rows.forEach((tr, idx) => {
      const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
      const amountText = tr.querySelector('.amount-cell')?.textContent || '0';
      const amount = parseFloat(amountText.replace('¥', '')) || 0;

      const productName = getData('product_name').trim();
      if (!productName) return;

      const item = lianhuaItems.find(i => i.name === productName || productName.includes(i.name));

      orders.push({
        index: orders.length + 1,
        code: item ? item.code : '',
        name: productName,
        unit: getData('unit') || (item ? item.unit : '件'),
        spec: getData('spec') || (item ? item.spec : ''),
        price: parseFloat(getData('unit_price')) || (item ? item.price : 0),
        quantity: parseFloat(getData('quantity')) || 0,
        amount: amount,
        split_qty: item ? item.split_qty : 1,
        remark: getData('remark')
      });
    });

    if (orders.length === 0) {
      showToast('没有订单数据', 'error');
      return;
    }

    // Look up images
    const photoFolder = APP_SETTINGS.photo_folder;
    const imagePromises = orders.map(order =>
      photoFolder ? window.api.findImage(order.name, order.spec, photoFolder).catch(() => null) : Promise.resolve(null)
    );
    const images = await Promise.all(imagePromises);

    const sheets = [{
      name: date,
      title: `联华超市 ${date}`,
      headers: ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注', '实物图'],
      rows: orders.map((order, idx) => ({
        data: [order.index, '洋安', date.replace(/-/g, '.'), order.code, order.name, order.unit, order.spec, order.price, order.quantity, order.amount, order.split_qty, order.remark, ''],
        imagePath: images[idx]
      }))
    }];

    const result = await window.api.exportPurchaseOrder(sheets, `联华超市${date.replace(/-/g, '')}.xlsx`);
    if (result.success) {
      showToast('导出成功！');
    } else if (result.error !== '已取消') {
      showToast('导出失败: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}
