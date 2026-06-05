// ===== Purchase Orders =====
let autocompleteDropdown = null;

// Initialize purchase page
async function initPurchasePage() {
  await loadLianhuaItems();
  applyCanteenMode();
}

// ===== Canteen Mode =====
function getKitchenSource() {
  const canteen = APP_SETTINGS.current_canteen || '洋安';
  return `${canteen}食堂厨房`;
}

function getPastrySource() {
  const canteen = APP_SETTINGS.current_canteen || '洋安';
  return `${canteen}面点房`;
}

function applyCanteenMode() {
  const mode = APP_SETTINGS.xiaosuo_mode;
  const tabsEl = document.getElementById('multi-canteen-tabs');
  const switchEl = document.getElementById('canteen-switch');
  const multiArea = document.getElementById('multi-canteen-area');
  const smallTabsEl = document.getElementById('small-canteen-tabs');
  const smallActionsEl = document.getElementById('small-canteen-actions');
  const smallAreaEl = document.getElementById('small-canteen-area');
  const lianhuaEl = document.getElementById('purchase-lianhua');
  const kitchenEl = document.getElementById('purchase-kitchen');
  const pastryEl = document.getElementById('purchase-pastry');

  // 隐藏所有
  [tabsEl, switchEl, multiArea, smallTabsEl, smallActionsEl, smallAreaEl, lianhuaEl, kitchenEl, pastryEl].forEach(el => { if (el) el.style.display = 'none'; });

  if (mode === 'on') {
    // 多食堂模式
    tabsEl.style.display = 'flex';
    multiArea.style.display = 'block';
    initMultiCanteenMode();
  } else if (mode === 'small') {
    // 小所食堂模式
    smallTabsEl.style.display = 'flex';
    smallActionsEl.style.display = 'block';
    smallAreaEl.style.display = 'block';
    initSmallCanteenMode();
  } else {
    // 默认模式
    lianhuaEl.style.display = 'block';
    kitchenEl.style.display = 'block';
    switchEl.style.display = 'flex';
    initNormalCanteenMode();
  }
}

async function switchCanteen(canteen) {
  APP_SETTINGS.current_canteen = canteen;
  await window.api.setSetting('current_canteen', canteen);
  await window.api.setSetting('canteen_mode', canteen);
  initNormalCanteenMode();
}

function initNormalCanteenMode() {
  const canteen = APP_SETTINGS.current_canteen || '洋安';
  const kitchenGroup = document.getElementById('purchase-kitchen');
  const kitchenTitle = document.getElementById('kitchen-title');
  const kitchenSource = getKitchenSource();
  kitchenGroup.dataset.source = kitchenSource;
  kitchenTitle.textContent = kitchenSource;

  const pastryGroup = document.getElementById('purchase-pastry');
  const pastryTitle = document.getElementById('pastry-title');
  const pastrySource = getPastrySource();
  pastryGroup.dataset.source = pastrySource;
  pastryTitle.textContent = pastrySource;
  pastryGroup.style.display = APP_SETTINGS.show_pastry !== 'off' ? 'block' : 'none';

  loadPurchaseGroupData(kitchenSource);
  loadPurchaseGroupData('联华');
  if (APP_SETTINGS.show_pastry !== 'off') loadPurchaseGroupData(pastrySource);

  // 同步食堂切换按钮高亮
  document.querySelectorAll('#canteen-switch .canteen-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.canteen === canteen)
  );
}

// ===== 下涯/制杆厂/白南山 模式 =====
const MULTI_CANTEENS = ['下涯', '制杆厂', '白南山'];
let currentMultiCanteen = '下涯';
let multiModeInitialized = false;

function initMultiCanteenMode() {
  const area = document.getElementById('multi-canteen-area');

  if (!multiModeInitialized) {
    for (const canteen of MULTI_CANTEENS) {
      // 联华分组 (per canteen)
      const lianhuaSrc = `${canteen}-联华`;
      const lianhuaGroup = document.createElement('div');
      lianhuaGroup.className = 'purchase-group';
      lianhuaGroup.dataset.source = lianhuaSrc;
      lianhuaGroup.dataset.canteen = canteen;
      lianhuaGroup.style.display = 'none';
      lianhuaGroup.innerHTML = `
        <div class="group-header" onclick="toggleGroup(this)">
          <span class="group-toggle">▶</span>
          <h3>联华超市 - ${canteen}</h3>
          <div class="group-actions">
            <button class="btn btn-sm" onclick="event.stopPropagation(); showAddLianhuaDate('${lianhuaSrc}')">+ 添加日期</button>
            <button class="btn btn-sm" onclick="event.stopPropagation(); showManageLianhuaItems()">管理商品</button>
          </div>
        </div>
        <div class="group-content" style="display:none;"></div>
      `;
      area.appendChild(lianhuaGroup);
      loadPurchaseGroupData(lianhuaSrc);

      // 厨房分组 (per canteen)
      const kitchenSrc = `${canteen}-厨房`;
      const kitchenGroup = document.createElement('div');
      kitchenGroup.className = 'purchase-group';
      kitchenGroup.dataset.source = kitchenSrc;
      kitchenGroup.dataset.canteen = canteen;
      kitchenGroup.style.display = 'none';
      kitchenGroup.innerHTML = `
        <div class="group-header" onclick="toggleGroup(this)">
          <span class="group-toggle">▶</span>
          <h3>${canteen}厨房</h3>
          <div class="group-actions">
            <button class="btn btn-sm" onclick="event.stopPropagation(); showAddDateDialog('${kitchenSrc}')">+ 添加日期</button>
          </div>
        </div>
        <div class="group-content" style="display:none;"></div>
      `;
      area.appendChild(kitchenGroup);
      loadPurchaseGroupData(kitchenSrc);
    }
    multiModeInitialized = true;
  }

  switchMultiCanteenTab(currentMultiCanteen);
}

function switchMultiCanteenTab(canteen) {
  currentMultiCanteen = canteen;
  document.querySelectorAll('#multi-canteen-tabs .tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.canteen === canteen)
  );
  document.querySelectorAll('#multi-canteen-area .purchase-group[data-canteen]').forEach(g => {
    g.style.display = g.dataset.canteen === canteen ? 'block' : 'none';
  });
}

// ===== 小所食堂模式 =====
let smallModeInitialized = false;

function getSmallCanteens() {
  return APP_SETTINGS.small_canteens || ['寿昌', '梅城', '大同', '大洋', '洋溪', '三都', '乾潭'];
}

// 将小所按两个一组分页：12, 34, 56, 7
function getSmallCanteenPages() {
  const canteens = getSmallCanteens();
  const pages = [];
  for (let i = 0; i < canteens.length; i += 2) {
    pages.push(canteens.slice(i, i + 2));
  }
  return pages;
}

function initSmallCanteenMode() {
  const canteens = getSmallCanteens();
  const tabsEl = document.getElementById('small-canteen-tabs');
  const areaEl = document.getElementById('small-canteen-area');

  // 渲染分组 tab（12, 34, 56, 7）
  const pages = getSmallCanteenPages();
  tabsEl.innerHTML = pages.map((page, idx) => {
    const label = page.join(' / ');
    return `<button class="tab-btn${idx === 0 ? ' active' : ''}" data-page="${idx}" onclick="switchSmallCanteenPage(${idx})">${label}</button>`;
  }).join('');

  if (!smallModeInitialized) {
    // 为每个小所创建 purchase-group（厨房+联华）
    for (const canteen of canteens) {
      // 厨房
      const kitchenSrc = `${canteen}-厨房`;
      const kitchenGroup = document.createElement('div');
      kitchenGroup.className = 'purchase-group';
      kitchenGroup.dataset.source = kitchenSrc;
      kitchenGroup.dataset.canteen = canteen;
      kitchenGroup.style.display = 'none';
      kitchenGroup.innerHTML = `
        <div class="group-header" onclick="toggleGroup(this)">
          <span class="group-toggle">▶</span>
          <h3>${canteen}厨房</h3>
          <div class="group-actions">
            <button class="btn btn-sm" onclick="event.stopPropagation(); showAddDateDialog('${kitchenSrc}')">+ 添加日期</button>
          </div>
        </div>
        <div class="group-content" style="display:none;"></div>
      `;
      areaEl.appendChild(kitchenGroup);
      loadPurchaseGroupData(kitchenSrc);

      // 联华
      const lianhuaSrc = `${canteen}-联华`;
      const lianhuaGroup = document.createElement('div');
      lianhuaGroup.className = 'purchase-group';
      lianhuaGroup.dataset.source = lianhuaSrc;
      lianhuaGroup.dataset.canteen = canteen;
      lianhuaGroup.style.display = 'none';
      lianhuaGroup.innerHTML = `
        <div class="group-header" onclick="toggleGroup(this)">
          <span class="group-toggle">▶</span>
          <h3>${canteen}联华</h3>
          <div class="group-actions">
            <button class="btn btn-sm" onclick="event.stopPropagation(); showAddLianhuaDate('${lianhuaSrc}')">+ 添加日期</button>
            <button class="btn btn-sm" onclick="event.stopPropagation(); showManageLianhuaItems()">管理商品</button>
          </div>
        </div>
        <div class="group-content" style="display:none;"></div>
      `;
      areaEl.appendChild(lianhuaGroup);
      loadPurchaseGroupData(lianhuaSrc);
    }
    smallModeInitialized = true;
  }

  // 默认显示第一组
  switchSmallCanteenPage(0);
}

function switchSmallCanteenPage(pageIdx) {
  const pages = getSmallCanteenPages();
  const page = pages[pageIdx] || [];

  // 高亮当前 tab
  document.querySelectorAll('#small-canteen-tabs .tab-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.page) === pageIdx)
  );

  const areaEl = document.getElementById('small-canteen-area');
  areaEl.className = 'small-parallel';

  // 隐藏所有
  areaEl.querySelectorAll('.purchase-group').forEach(g => { g.style.display = 'none'; });

  // 显示当前组的小所
  for (const canteen of page) {
    areaEl.querySelectorAll(`.purchase-group[data-canteen="${canteen}"]`).forEach(g => {
      g.style.display = 'block';
    });
  }
}

// 复用：单对单
function showCopyCanteenDialog() {
  const canteens = getSmallCanteens();

  openModal('复用单个小所数据', `
    <p style="margin-bottom:12px;">将源小所的<strong>厨房</strong>数据复制到目标小所（仅厨房，不含联华）</p>
    <div class="form-group">
      <label>从哪个小所复制</label>
      <select class="form-control" id="copy-source-canteen">
        ${canteens.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>复制到</label>
      <select class="form-control" id="copy-target-canteen">
        ${canteens.map((c, i) => `<option value="${c}" ${i === 1 ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doCopyCanteen()">确认复制</button>
  `);
}

async function doCopyCanteen() {
  const fromCanteen = document.getElementById('copy-source-canteen').value;
  const toCanteen = document.getElementById('copy-target-canteen').value;

  if (fromCanteen === toCanteen) {
    showToast('不能复制到自身', 'error');
    return;
  }

  copyKitchenData(fromCanteen, toCanteen);
  closeModal();
  showToast(`已将 ${fromCanteen} 厨房数据复制到 ${toCanteen}`);
}

// 复用：单对多（一键同步到所有小所）
function showSyncAllDialog() {
  const canteens = getSmallCanteens();

  openModal('一键同步到所有小所', `
    <p style="margin-bottom:12px;">将选中小所的<strong>厨房</strong>数据同步到其他所有小所（仅厨房，不含联华）</p>
    <div class="form-group">
      <label>源小所</label>
      <select class="form-control" id="sync-source-canteen">
        ${canteens.map((c, i) => `<option value="${c}" ${i === 0 ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>
    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">将覆盖其他 ${canteens.length - 1} 个小所的厨房数据</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doSyncAll()">确认同步</button>
  `);
}

async function doSyncAll() {
  const source = document.getElementById('sync-source-canteen').value;
  const canteens = getSmallCanteens();
  const targets = canteens.filter(c => c !== source);

  for (const target of targets) {
    copyKitchenData(source, target);
  }

  closeModal();
  showToast(`已将 ${source} 厨房数据同步到 ${targets.length} 个小所`);
}

// 核心：复制厨房数据（从源到目标）
function copyKitchenData(fromCanteen, toCanteen) {
  const fromSource = `${fromCanteen}-厨房`;
  const toSource = `${toCanteen}-厨房`;

  const fromGroup = document.querySelector(`.purchase-group[data-source="${fromSource}"]`);
  const toGroup = document.querySelector(`.purchase-group[data-source="${toSource}"]`);
  if (!fromGroup || !toGroup) return;

  const toContent = toGroup.querySelector('.group-content');
  toContent.innerHTML = '';

  const fromDateGroups = fromGroup.querySelectorAll('.date-group');
  for (const fromDateGroup of fromDateGroups) {
    const date = getDateFromGroup(fromDateGroup);
    const dateId = `date-${toSource}-${date}`.replace(/[\s:]/g, '-');

    const newDateGroup = document.createElement('div');
    newDateGroup.className = 'date-group';
    newDateGroup.id = dateId;
    newDateGroup.innerHTML = `
      <div class="date-header expanded" onclick="toggleDateGroup(this)">
        <span class="date-toggle">▶</span>
        <span class="date-label">${date} 收货</span>
        <span class="date-summary">0 项</span>
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
    toContent.appendChild(newDateGroup);

    const toTbody = newDateGroup.querySelector('tbody');
    fromDateGroup.querySelectorAll('tbody tr').forEach((tr, idx) => {
      const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
      const productName = getData('product_name').trim();
      if (!productName) return;
      appendPurchaseRowWithData(toTbody, {
        product_name: productName,
        spec: getData('spec'),
        unit_price: getData('unit_price'),
        quantity: getData('quantity'),
        unit: getData('unit'),
        remark: getData('remark'),
      }, idx);
    });

    newDateGroup.querySelector('.date-summary').textContent = `${toTbody.querySelectorAll('tr').length} 项`;
  }

  // 展开目标分组
  const groupHeader = toContent.previousElementSibling;
  if (groupHeader && !groupHeader.classList.contains('expanded')) {
    toggleGroup(groupHeader);
  }
}

async function loadPurchaseGroupData(source) {
  try {
    const groupContent = document.querySelector(`.purchase-group[data-source="${source}"] .group-content`);
    if (!groupContent) return;
    groupContent.innerHTML = '';

    const orders = await window.api.getPurchaseOrders(source);
    const byDate = {};
    orders.forEach(o => {
      if (!byDate[o.order_date]) byDate[o.order_date] = [];
      byDate[o.order_date].push(o);
    });

    for (const [date, items] of Object.entries(byDate)) {
      addDateGroupToPage(source, date, items);
    }
  } catch (err) {
    console.error('Load purchase group error:', err);
  }
}

function addDateGroupToPage(source, date, items) {
  const groupContent = document.querySelector(`.purchase-group[data-source="${source}"] .group-content`);
  if (!groupContent) return;

  const dateId = `date-${source}-${date}`.replace(/[\s:]/g, '-');
  if (document.getElementById(dateId)) return;

  const dateGroup = document.createElement('div');
  dateGroup.className = 'date-group';
  dateGroup.id = dateId;

  dateGroup.innerHTML = `
    <div class="date-header expanded" onclick="toggleDateGroup(this)">
      <span class="date-toggle">▶</span>
      <span class="date-label">${date} 收货</span>
      <span class="date-summary">${items.length} 项</span>
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

  const tbody = dateGroup.querySelector('tbody');
  items.forEach((item, idx) => {
    const tr = appendPurchaseRowWithData(tbody, item, idx);
  });
}

function appendPurchaseRowWithData(tbody, item, idx) {
  const tr = document.createElement('tr');
  if (item.id) tr.dataset.id = item.id;

  const amount = (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);

  tr.innerHTML = `
    <td>${idx + 1}</td>
    <td style="position:relative;">
      <input type="text" class="cell-input cell-editable" value="${item.product_name || ''}" data-field="product_name" autocomplete="off" placeholder="输入品名...">
      <div class="autocomplete-dropdown" style="display:none;"></div>
    </td>
    <td><input type="text" class="cell-input cell-readonly" value="${item.spec || ''}" data-field="spec" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-readonly" value="${item.unit_price || ''}" data-field="unit_price" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-editable" value="${item.quantity || ''}" data-field="quantity" placeholder="数量"></td>
    <td><input type="text" class="cell-input cell-readonly" value="${item.unit || ''}" data-field="unit" readonly tabindex="-1"></td>
    <td class="amount-cell cell-readonly">${amount > 0 ? '¥' + amount.toFixed(1) : ''}</td>
    <td><input type="text" class="cell-input cell-editable" value="${item.remark || ''}" data-field="remark" placeholder="备注"></td>
    <td style="white-space:nowrap;"><button class="btn btn-sm" onclick="copyPurchaseRow(this)" title="复制行">📋</button> <button class="btn-delete-row" onclick="deletePurchaseRow(this)">✕</button></td>
  `;

  tbody.appendChild(tr);
  // Use lianhua autocomplete for lianhua sources
  const parentGroup = tbody.closest('.purchase-group');
  const src = parentGroup ? parentGroup.dataset.source : '';
  if (src.includes('联华')) {
    attachLianhuaCellEvents(tr, tbody);
  } else {
    attachCellEvents(tr, tbody);
  }
  return tr;
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

// Toggle group expand/collapse
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

// Toggle date group expand/collapse
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

// Show dialog to add date group
function showAddDateDialog(source) {
  const groupContent = document.querySelector(`.purchase-group[data-source="${source}"] .group-content`);
  if (!groupContent) return;

  // Check max 3 dates
  const existingDates = groupContent.querySelectorAll('.date-group');
  if (existingDates.length >= 3) {
    showToast('最多支持3个日期', 'error');
    return;
  }

  const tomorrow = getTomorrowStr();

  openModal('选择到货日期', `
    <div class="form-group">
      <label>到货日期</label>
      <input type="date" class="form-control" id="new-date-input" value="${tomorrow}">
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddDateGroup('${source}')">确定</button>
  `);
}

// Actually add date group
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

// Add a date group under a source
function addDateGroup(source, date) {
  const groupContent = document.querySelector(`.purchase-group[data-source="${source}"] .group-content`);
  if (!groupContent) return;

  const dateId = `date-${source}-${date}`.replace(/[\s:]/g, '-');

  // Check if date already exists
  if (document.getElementById(dateId)) {
    showToast('该日期已存在', 'error');
    return;
  }

  const dateGroup = document.createElement('div');
  dateGroup.className = 'date-group';
  dateGroup.id = dateId;

  dateGroup.innerHTML = `
    <div class="date-header expanded" onclick="toggleDateGroup(this)">
      <span class="date-toggle">▶</span>
      <span class="date-label">${date} 收货</span>
      <span class="date-summary">0 项</span>
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

  // Expand parent group if not expanded
  const groupHeader = groupContent.previousElementSibling;
  if (!groupHeader.classList.contains('expanded')) {
    toggleGroup(groupHeader);
  }

  // Add empty rows
  const tbody = dateGroup.querySelector('tbody');
  for (let i = 0; i < APP_SETTINGS.purchase_rows; i++) {
    appendPurchaseRow(tbody, i);
  }
}

function deleteDateGroup(btn) {
  const dateGroup = btn.closest('.date-group');
  if (confirm('确定删除此日期分组？')) {
    dateGroup.remove();
  }
}

// Add rows to a specific date group
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
}

function appendPurchaseRow(tbody, idx) {
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
    <td style="white-space:nowrap;"><button class="btn btn-sm" onclick="copyPurchaseRow(this)" title="复制行">📋</button> <button class="btn-delete-row" onclick="deletePurchaseRow(this)">✕</button></td>
  `;

  tbody.appendChild(tr);
  attachCellEvents(tr, tbody);
}

function copyPurchaseRow(btn) {
  const tr = btn.closest('tr');
  const tbody = tr.closest('tbody');
  const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';

  // 在当前行之后插入新行
  const newTr = document.createElement('tr');
  newTr.innerHTML = `
    <td>0</td>
    <td style="position:relative;">
      <input type="text" class="cell-input cell-editable" value="${getData('product_name')}" data-field="product_name" autocomplete="off" placeholder="输入品名...">
      <div class="autocomplete-dropdown" style="display:none;"></div>
    </td>
    <td><input type="text" class="cell-input cell-readonly" value="${getData('spec')}" data-field="spec" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-readonly" value="${getData('unit_price')}" data-field="unit_price" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-editable" value="${getData('quantity')}" data-field="quantity" placeholder="数量"></td>
    <td><input type="text" class="cell-input cell-readonly" value="${getData('unit')}" data-field="unit" readonly tabindex="-1"></td>
    <td class="amount-cell cell-readonly">${tr.querySelector('.amount-cell')?.textContent || ''}</td>
    <td><input type="text" class="cell-input cell-editable" value="${getData('remark')}" data-field="remark" placeholder="备注"></td>
    <td style="white-space:nowrap;"><button class="btn btn-sm" onclick="copyPurchaseRow(this)" title="复制行">📋</button> <button class="btn-delete-row" onclick="deletePurchaseRow(this)">✕</button></td>
  `;
  tr.after(newTr);

  // 绑定事件
  const parentGroup = tbody.closest('.purchase-group');
  const src = parentGroup ? parentGroup.dataset.source : '';
  if (src.includes('联华')) {
    attachLianhuaCellEvents(newTr, tbody);
  } else {
    attachCellEvents(newTr, tbody);
  }
  reindexPurchaseRows(tbody);
}

function deletePurchaseRow(btn) {
  const tr = btn.closest('tr');
  const tbody = tr.closest('tbody');
  const id = tr.dataset.id;
  if (id) {
    window.api.deletePurchaseOrder(parseInt(id));
  }
  tr.remove();
  reindexPurchaseRows(tbody);
}

function reindexPurchaseRows(tbody) {
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((tr, idx) => {
    tr.querySelector('td:first-child').textContent = idx + 1;
  });
  // Update summary
  const dateGroup = tbody.closest('.date-group');
  if (dateGroup) {
    const summary = dateGroup.querySelector('.date-summary');
    summary.textContent = `${rows.length} 项`;
  }
}

function attachCellEvents(tr, tbody) {
  bindTableRowEvents(tr, tbody, {
    onSelect: selectAutocompleteItem,
    onAutocomplete: handleProductAutocomplete,
    onProductSelect: selectAutocompleteItem,
    onQtyChange: (row) => recalcRowAmount(row),
    onFieldChange: (row) => recalcRowAmount(row),
  });
}

function recalcRowAmount(tr) {
  const priceInput = tr.querySelector('[data-field="unit_price"]');
  const qtyInput = tr.querySelector('[data-field="quantity"]');
  const amountCell = tr.querySelector('.amount-cell');

  const price = parseFloat(priceInput.value) || 0;
  const qtyStr = qtyInput.value.trim();

  // Check if quantity is a number
  const qtyNum = parseFloat(qtyStr);

  if (qtyStr && !isNaN(qtyNum) && String(qtyNum) === qtyStr) {
    // Pure number - calculate amount
    const amount = Math.round(price * qtyNum * 10) / 10; // Round to 1 decimal
    amountCell.textContent = amount.toFixed(1);
  } else {
    // Contains text (like "60片") - amount is 0
    amountCell.textContent = '0.0';
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

  // Check if this is in 联华 group
  const dateGroup = input.closest('.date-group');
  const purchaseGroup = input.closest('.purchase-group');
  const isLianhua = purchaseGroup && purchaseGroup.dataset.source === '联华';

  try {
    let results = [];

    if (isLianhua) {
      // Search from lianhua items
      results = lianhuaItems.filter(item =>
        item.name.toLowerCase().includes(keyword.toLowerCase())
      ).map(item => ({
        name: item.name,
        spec: item.spec,
        price: item.price,
        unit: item.unit
      }));
    } else {
      // Search from inquiry items
      let currentMonth = document.getElementById('inquiry-month')?.value;
      if (!currentMonth) {
        const months = await window.api.getInquiryMonths();
        currentMonth = months.length > 0 ? months[0].month : null;
      }
      results = await window.api.searchInquiryItems(keyword, currentMonth);
    }

    if (results.length === 0) {
      hideAutocomplete();
      return;
    }

    dropdown.innerHTML = results.map((item, idx) => `
      <div class="autocomplete-item" data-index="${idx}" data-name="${item.name}" data-spec="${item.spec || ''}" data-price="${item.price || 0}" data-unit="${item.unit || ''}">
        <span class="item-name">${item.name}</span>
        <span class="item-spec">${item.spec || ''} | ¥${item.price || 0}</span>
      </div>
    `).join('');

    dropdown.style.display = 'block';
    autocompleteIndex = -1;

    // Click to select
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectAutocompleteItem(input, item);
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
  const price = item.dataset.price;
  const unit = item.dataset.unit;

  input.value = name;
  tr.querySelector('[data-field="spec"]').value = spec;
  tr.querySelector('[data-field="unit_price"]').value = price;
  tr.querySelector('[data-field="unit"]').value = unit;
  hideAutocomplete();

  // Focus on quantity input
  const qtyInput = tr.querySelector('[data-field="quantity"]');
  if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
}

// Save all purchase orders (including 联华)
async function saveAllPurchaseOrders() {
  const allOrders = [];
  const container = document.getElementById('purchase-container');
  // Only process visible date groups
  const dateGroups = [...container.querySelectorAll('.date-group')].filter(dg => dg.offsetParent !== null);

  dateGroups.forEach(dateGroup => {
    const purchaseGroup = dateGroup.closest('.purchase-group');
    const source = purchaseGroup.dataset.source;
    const dateLabel = dateGroup.querySelector('.date-label').textContent;
    // Handle both "收货" and "发货" suffix
    const receiveDate = dateLabel.replace(' 收货', '').replace(' 发货', '').trim();
    const rows = dateGroup.querySelectorAll('tbody tr');

    rows.forEach((tr, idx) => {
      const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
      const amountText = tr.querySelector('.amount-cell')?.textContent || '0';
      const amount = parseFloat(amountText.replace('¥', '')) || 0;

      const productName = getData('product_name').trim();
      if (!productName) return; // Skip empty rows

      allOrders.push({
        source: source,
        receive_date: receiveDate,
        product_name: productName,
        spec: getData('spec'),
        unit_price: parseFloat(getData('unit_price')) || 0,
        quantity: getData('quantity'),
        unit: getData('unit'),
        amount: amount,
        remark: getData('remark'),
        sort_order: idx
      });
    });
  });

  try {
    // Only clear orders for visible groups
    const currentSources = [...document.querySelectorAll('#purchase-container .purchase-group[data-source]')]
      .filter(g => g.offsetParent !== null || g.dataset.source === '联华')
      .map(g => g.dataset.source)
      .filter(s => s);
    for (const source of currentSources) {
      await window.api.clearPurchaseOrders(source);
    }
    for (const order of allOrders) {
      await window.api.addPurchaseOrder(order);
    }
    showToast(`已保存 ${allOrders.length} 条采购记录`);
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

// Export all purchase orders — helper functions
function getDateFromGroup(dateGroup) {
  const label = dateGroup.querySelector('.date-label').textContent;
  return label.replace(' 收货', '').replace(' 发货', '').trim();
}

function getRowData(tr) {
  const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
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
  const group = document.querySelector(`.purchase-group[data-source="${source}"]`);
  if (!group) return [];
  const rows = [];
  group.querySelectorAll('.date-group').forEach(dateGroup => {
    const date = getDateFromGroup(dateGroup);
    dateGroup.querySelectorAll('tbody tr').forEach(tr => {
      const data = getRowData(tr);
      if (data) rows.push({ date, ...data });
    });
  });
  return rows;
}

function collectLianhuaRows(dateGroup) {
  const rows = [];
  dateGroup.querySelectorAll('tbody tr').forEach(tr => {
    const data = getRowData(tr);
    if (!data) return;
    const item = lianhuaItems.find(i => i.name === data.product_name || data.product_name.includes(i.name));
    rows.push({
      ...data,
      code: item ? item.code : '',
      unit: data.unit || (item ? item.unit : '件'),
      spec: data.spec || (item ? item.spec : ''),
      unit_price: data.unit_price || (item ? item.price : 0),
      split_qty: item ? item.split_qty : 1,
    });
  });
  return rows;
}

async function resolveImages(rows) {
  const photoFolder = APP_SETTINGS.photo_folder;
  if (!photoFolder) return rows.map(() => null);
  return Promise.all(rows.map(r => window.api.findImage(r.product_name, r.spec, photoFolder).catch(() => null)));
}

function buildKitchenSheet(title, rows, images) {
  return {
    name: title, title,
    headers: ['序号', '收货日期', '品名', '规格', '单价', '数量', '单位', '金额', '备注要求', '实物图'],
    rows: rows.map((row, idx) => ({
      data: [idx + 1, row.date, row.product_name, row.spec, row.unit_price, row.quantity, row.unit, row.amount, row.remark, ''],
      imagePath: images[idx]
    }))
  };
}

function buildLianhuaSheet(title, canteen, date, rows, images) {
  return {
    name: title,
    title: `${canteen}联华超市 ${date}`,
    headers: ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注', '实物图'],
    rows: rows.map((row, idx) => ({
      data: [idx + 1, canteen, date.replace(/-/g, '.'), row.code, row.product_name, row.unit, row.spec, row.unit_price, row.quantity, row.amount, row.split_qty, row.remark, ''],
      imagePath: images[idx]
    }))
  };
}

function getLianhuaDateGroups(source) {
  const group = document.querySelector(`.purchase-group[data-source="${source}"]`);
  return group ? group.querySelectorAll('.date-group') : [];
}

// Export all purchase orders (main entry)
async function exportAllPurchaseOrders() {
  try {
    if (lianhuaItems.length === 0) {
      try { await loadLianhuaItems(); } catch (e) { /* ignore */ }
    }

    const sheets = [];
    const mode = APP_SETTINGS.xiaosuo_mode;

    if (mode === 'small') {
      // 小所食堂模式：厨房并列，联华按日期
      await exportSmallCanteenOrders(sheets);
    } else {
      // 普通模式或多食堂模式
      const isMulti = mode === 'on';
      const canteens = isMulti ? MULTI_CANTEENS : [APP_SETTINGS.current_canteen || '洋安'];

      for (const canteen of canteens) {
        const kitchenSource = isMulti ? `${canteen}-厨房` : getKitchenSource();
        const kitchenRows = collectRows(kitchenSource);
        if (kitchenRows.length > 0) {
          sheets.push(buildKitchenSheet(`${canteen}厨房申购单`, kitchenRows, await resolveImages(kitchenRows)));
        }
        if (!isMulti && APP_SETTINGS.show_pastry !== 'off') {
          const pastryRows = collectRows(getPastrySource());
          if (pastryRows.length > 0) {
            sheets.push(buildKitchenSheet(`${getPastrySource()}申购单`, pastryRows, await resolveImages(pastryRows)));
          }
        }
        const lianhuaSource = isMulti ? `${canteen}-联华` : '联华';
        for (const dateGroup of getLianhuaDateGroups(lianhuaSource)) {
          const date = getDateFromGroup(dateGroup);
          const rows = collectLianhuaRows(dateGroup);
          if (rows.length === 0) continue;
          const title = isMulti ? `${canteen}-${date}` : date;
          sheets.push(buildLianhuaSheet(title, canteen, date, rows, await resolveImages(rows)));
        }
      }
    }

    if (sheets.length === 0) {
      showToast('没有订单数据', 'error');
      return;
    }

    const now = new Date();
    const month = `${now.getMonth() + 1}月`;
    const modeLabel = mode === 'small' ? '小所食堂' : (mode === 'on' ? '下涯、制杆厂、白南山' : (APP_SETTINGS.canteen_mode || '洋安'));
    const result = await window.api.exportPurchaseOrder(sheets, `${month}${modeLabel}采购单.xlsx`);
    if (result.success) {
      showToast('导出成功！');
    } else if (result.error !== '已取消') {
      showToast('导出失败: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

// 小所食堂导出：厨房并列，联华按日期
async function exportSmallCanteenOrders(sheets) {
  const canteens = getSmallCanteens();
  const style = APP_SETTINGS.small_export_style || 'matrix';

  // 1. 厨房 sheet
  if (style === 'matrix') {
    // 样式1：矩阵式（品名×小所）
    buildMatrixKitchenSheet(sheets, canteens);
  } else {
    // 样式2：两两并列（每组完整列）
    buildPairedKitchenSheets(sheets, canteens);
  }

  // 2. 联华按日期（和多食堂模式类似，不并列）
  for (const canteen of canteens) {
    for (const dateGroup of getLianhuaDateGroups(`${canteen}-联华`)) {
      const date = getDateFromGroup(dateGroup);
      const rows = collectLianhuaRows(dateGroup);
      if (rows.length === 0) continue;
      sheets.push(buildLianhuaSheet(`${canteen}-${date}`, canteen, date, rows, await resolveImages(rows)));
    }
  }
}

// 样式1：矩阵式（品名×小所）
function buildMatrixKitchenSheet(sheets, canteens) {
  const allData = {};
  const quantities = {};

  for (const canteen of canteens) {
    quantities[canteen] = {};
    for (const row of collectRows(`${canteen}-厨房`)) {
      const key = row.product_name;
      if (!allData[key]) allData[key] = { spec: row.spec, unit: row.unit, remark: row.remark };
      quantities[canteen][key] = (quantities[canteen][key] || 0) + (parseFloat(row.quantity) || 0);
    }
  }

  const names = Object.keys(allData);
  if (names.length === 0) return;

  sheets.push({
    name: '小所厨房',
    title: '小所厨房申购单',
    headers: ['序号', '品名', '规格', '单位', ...canteens, '备注'],
    rows: names.map((name, idx) => ({
      data: [idx + 1, name, allData[name].spec, allData[name].unit, ...canteens.map(c => quantities[c][name] || 0), allData[name].remark || '']
    })),
  });
}

// 样式2：两两左右并列（同一个sheet内，垂直排列多组）
function buildPairedKitchenSheets(sheets, canteens) {
  const allRows = [];
  const sub = ['序号', '品名', '规格', '单位', '数量', '备注'];

  for (let i = 0; i < canteens.length; i += 2) {
    const pair = canteens.slice(i, i + 2);
    const [left, right] = pair;
    const leftRows = collectRows(`${left}-厨房`);
    const rightRows = collectRows(`${right}-厨房`);

    // 小所名称行：左边跨A-F，右边跨H-M
    allRows.push({
      data: [left, '', '', '', '', '', '', right, '', '', '', '', ''],
      isHeader: true,
      mergeRanges: [
        { range: 'A:F', text: left },
        { range: 'H:M', text: right },
      ],
    });

    // 表头行
    allRows.push({ data: [...sub, '', ...sub] });

    // 数据行
    const maxLen = Math.max(leftRows.length, rightRows.length);
    for (let idx = 0; idx < maxLen; idx++) {
      const l = leftRows[idx];
      const r = rightRows[idx];
      allRows.push({
        data: [
          l ? idx + 1 : '', l ? l.product_name : '', l ? l.spec : '', l ? l.unit : '', l ? l.quantity : '', l ? (l.remark || '') : '',
          '',
          r ? idx + 1 : '', r ? r.product_name : '', r ? r.spec : '', r ? r.unit : '', r ? r.quantity : '', r ? (r.remark || '') : '',
        ]
      });
    }

    // 空行分隔
    allRows.push({ data: ['', '', '', '', '', '', '', '', '', '', '', '', ''] });
  }

  if (allRows.length > 0) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    sheets.push({
      name: '小所厨房',
      title: `${dateStr}小所厨房申购单`,
      headers: ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      rows: allRows,
    });
  }
}
