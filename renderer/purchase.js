// ===== Purchase Orders =====

// Initialize purchase page
async function initPurchasePage() {
  await loadLianhuaItems();

  // 重置询价月份缓存，确保新导入的询价月能被识别
  window._availableInquiryMonths = null;

  // Check if we should load data or start fresh
  const today = todayStr();
  const lastDate = APP_SETTINGS.last_purchase_date || '';
  const shouldLoadData = (lastDate === today);

  // Store the flag for use in applyCanteenMode
  window._purchaseShouldLoadData = shouldLoadData;

  applyCanteenMode();

  // 重置 dirty flag（页面初始化 = 数据来自 DB 或空白新天）
  resetPurchaseDirty();

  // 事件委托：采购页内任何可编辑 input 变更 → 标记 dirty
  const purchasePage = document.getElementById('page-purchase');
  if (purchasePage && !purchasePage._dirtyListenerAttached) {
    purchasePage.addEventListener('input', (e) => {
      const el = e.target;
      if (el.closest && (el.closest('.table-purchase') || el.closest('#matrix-tbody') || el.closest('#modal-lianhua-table'))) {
        markPurchaseDirty();
      }
    });
    purchasePage._dirtyListenerAttached = true;
  }
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

function buildPurchaseRowHTML(idx, values, amountText, opts = {}) {
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
    <td style="white-space:nowrap;">${showCopy ? '<button class="btn btn-sm" onclick="copyPurchaseRow(this)" title="复制行">📋</button> ' : ''}<button class="btn-delete-row" onclick="${delFn}(this)">✕</button></td>
  `;
}

async function applyCanteenMode() {
  const mode = APP_SETTINGS.xiaosuo_mode;
  const tabsEl = document.getElementById('multi-canteen-tabs');
  const switchEl = document.getElementById('canteen-switch');
  const multiArea = document.getElementById('multi-canteen-area');
  const smallTabsEl = document.getElementById('small-canteen-tabs');
  const smallActionsEl = document.getElementById('small-canteen-actions');
  const smallAreaEl = document.getElementById('small-canteen-area');
  const smallMatrixEl = document.getElementById('small-matrix-area');
  const lianhuaEl = document.getElementById('purchase-lianhua');
  const kitchenEl = document.getElementById('purchase-kitchen');
  const pastryEl = document.getElementById('purchase-pastry');

  // 隐藏所有
  [tabsEl, switchEl, multiArea, smallTabsEl, smallActionsEl, smallAreaEl, smallMatrixEl, lianhuaEl, kitchenEl, pastryEl].forEach(el => { if (el) el.style.display = 'none'; });

  // 清空非活动模式的 group-content，防止 saveAllPurchaseOrders 跨模式收集残留数据
  const clearGroupContents = (area) => {
    if (area) area.querySelectorAll('.group-content').forEach(gc => gc.innerHTML = '');
  };
  if (mode !== 'small') { clearGroupContents(smallAreaEl); clearGroupContents(smallMatrixEl); }
  if (mode !== 'on') clearGroupContents(multiArea);
  if (mode === 'on' || mode === 'small') { clearGroupContents(lianhuaEl); clearGroupContents(kitchenEl); clearGroupContents(pastryEl); }

  if (mode === 'on') {
    // 多食堂模式
    tabsEl.style.display = 'flex';
    multiArea.style.display = 'block';
    initMultiCanteenMode();
  } else if (mode === 'small') {
    // 小所食堂模式
    smallActionsEl.style.display = 'block';
    initSmallCanteenMode();
    // 应用保存的填写样式
    const savedStyle = APP_SETTINGS.small_display_style || 'groups';
    await switchSmallDisplayStyle(savedStyle);
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
      // 联华分组 (per canteen) — 基础输入模板，数据源为 lianhua_items
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
            <button class="btn btn-sm" onclick="event.stopPropagation(); showAddDateDialog('${lianhuaSrc}')">+ 添加日期</button>
          </div>
        </div>
        <div class="group-content" style="display:none;"></div>
      `;
      area.appendChild(lianhuaGroup);

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
    }
    multiModeInitialized = true;
  }

  // 每次进入采购页都刷新数据（DB → DOM），不依赖首次创建时的单次加载
  for (const canteen of MULTI_CANTEENS) {
    loadPurchaseGroupData(`${canteen}-联华`);
    loadPurchaseGroupData(`${canteen}-厨房`);
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
    // 填充联华加购下拉菜单
    const dropdown = document.getElementById('lianhua-dropdown');
    if (dropdown) {
      dropdown.innerHTML = canteens.map(c =>
        `<div class="dropdown-menu-item" onclick="showAddLianhuaDate('${c}-联华'); document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));">${c}</div>`
      ).join('');
    }

    // 先创建所有厨房 group，再创建所有联华 group
    // 这样 .small-parallel 的 grid 两列会把同类型（厨房/厨房）并排显示
    for (const canteen of canteens) {
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
    }
    for (const canteen of canteens) {
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
    }
    smallModeInitialized = true;
  }

  // 每次进入采购页都刷新数据（DB → DOM），不依赖首次创建时的单次加载
  for (const canteen of canteens) {
    loadPurchaseGroupData(`${canteen}-厨房`);
  }
  for (const canteen of canteens) {
    loadPurchaseGroupData(`${canteen}-联华`);
  }

  // 样式1（逐所输入）时默认显示第一组
  // 样式切换由 applyCanteenMode 调用 switchSmallDisplayStyle 处理
  if ((APP_SETTINGS.small_display_style || 'groups') === 'groups') {
    switchSmallCanteenPage(0);
  }
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

// 切换小所食堂的填写样式：groups（逐所输入）/ matrix（矩阵输入）
let _switchingStyle = false;

async function switchSmallDisplayStyle(style) {
  if (_switchingStyle) return;
  _switchingStyle = true;

  try {
    const groupsArea = document.getElementById('small-canteen-area');
    const matrixArea = document.getElementById('small-matrix-area');
    const tabsEl = document.getElementById('small-canteen-tabs');
    const btnCopy = document.getElementById('btn-copy-canteen');
    const btnSync = document.getElementById('btn-sync-all');
    const btnRemarks = document.getElementById('btn-toggle-remarks');

    // 切换前先保存当前样式的数据到 DB
    const currentStyle = APP_SETTINGS.small_display_style || 'groups';
    if (currentStyle === 'matrix' && document.getElementById('matrix-tbody')) {
      await saveMatrixData();
    } else if (currentStyle === 'groups') {
      // onlySourcesWithData: 避免矩阵模式下空的联华 group 误删已有联华数据
      await saveAllSmallGroupsData({ onlySourcesWithData: true });
    }

    if (style === 'matrix') {
      groupsArea.style.display = 'none';
      matrixArea.style.display = 'block';
      tabsEl.style.display = 'none';
      if (btnCopy) btnCopy.style.display = 'none';
      if (btnSync) btnSync.style.display = 'none';
      if (btnRemarks) btnRemarks.style.display = '';
      initSmallMatrixMode();
    } else {
      groupsArea.style.display = '';
      matrixArea.style.display = 'none';
      tabsEl.style.display = 'flex';
      if (btnCopy) btnCopy.style.display = '';
      if (btnSync) btnSync.style.display = '';
      if (btnRemarks) btnRemarks.style.display = 'none';
      // 从 DB 重载所有小所数据，确保显示最新
      const canteens = getSmallCanteens();
      for (const canteen of canteens) {
        await loadPurchaseGroupData(`${canteen}-厨房`);
        await loadPurchaseGroupData(`${canteen}-联华`);
      }
      switchSmallCanteenPage(0);
    }
  } finally {
    _switchingStyle = false;
  }
}

// ===== 矩阵输入模式 =====

// 矩阵专用：自动补全选中（不设 unit_price/amount）
function selectMatrixAutocompleteItem(input, item) {
  const tr = input.closest('tr');
  input.value = item.dataset.name;
  const specInput = tr.querySelector('[data-field="spec"]');
  const unitInput = tr.querySelector('[data-field="unit"]');
  if (specInput) specInput.value = item.dataset.spec || '';
  if (unitInput) unitInput.value = item.dataset.unit || '';
  // 标记已通过下拉选中，防止 blur handler 用库里的第一条覆盖（spec 为空时尤其重要）
  tr.dataset.matrixSelected = '1';
  hideAutocomplete();
  if (APP_SETTINGS.auto_focus_qty !== 'off') {
    const firstQty = tr.querySelector('.matrix-cell-qty');
    if (firstQty) { firstQty.focus(); firstQty.select(); }
  }
}

// 矩阵专用：失焦自动匹配（不设 price）
async function handleMatrixProductBlur(input) {
  if (!input.isConnected) return;
  const tr = input.closest('tr');
  const keyword = input.value.trim();
  if (!keyword) return;
  // 已通过下拉选中过 → 不覆盖，即使 spec 为空也是用户主动选的
  if (tr.dataset.matrixSelected === '1') return;
  try {
    // 按 date-group 的 receive_date 月份查询询价
    const targetMonth = getInquiryMonthForInput(input);
    const results = await resolveInquirySearch(keyword, targetMonth);
    const match = results.find(r => r.name.toLowerCase() === keyword.toLowerCase()) || results[0];
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

// 矩阵专用：绑定行事件（复用 bindTableRowEvents）
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
  tr.querySelectorAll('.matrix-cell-qty').forEach(input => {
    input.addEventListener('input', () => {
      input.classList.toggle('has-value', !!input.value.trim());
    });
  });
}

// 矩阵专用：追加空行（复用 cell-editable 结构）
function appendMatrixRow(tbody, idx) {
  const canteens = getSmallCanteens();
  const hasRemarks = APP_SETTINGS.show_matrix_remarks !== 'off';
  if (idx === undefined) idx = tbody.querySelectorAll('tr').length;

  const tr = document.createElement('tr');
  let html = `
    <td>${idx + 1}</td>
    <td style="position:relative;">
      <input type="text" class="cell-input cell-editable" value="" data-field="product_name" autocomplete="off" placeholder="输入品名...">
      <div class="autocomplete-dropdown" style="display:none;"></div>
    </td>
    <td><input type="text" class="cell-input cell-readonly" value="" data-field="spec" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-readonly" value="" data-field="unit" readonly tabindex="-1"></td>
  `;
  for (const c of canteens) {
    html += `<td><input type="text" class="cell-input cell-editable matrix-cell-qty" value="" data-canteen="${c}" placeholder="0"></td>`;
  }
  if (hasRemarks) {
    html += `<td><input type="text" class="cell-input cell-editable" value="" data-field="remark" placeholder="备注"></td>`;
  }
  html += `<td style="white-space:nowrap;"><button class="btn-delete-row" onclick="deleteMatrixRow(this)">✕</button></td>`;
  tr.innerHTML = html;
  tbody.appendChild(tr);
  bindMatrixRowEvents(tr, tbody);
  return tr;
}

// 初始化矩阵输入模式
function initSmallMatrixMode() {
  const canteens = getSmallCanteens();
  const area = document.getElementById('small-matrix-area');
  loadAllSmallMatrixData(canteens, area);
}

async function loadAllSmallMatrixData(canteens, area) {
  const allData = {};

  // Only load data if same day
  if (window._purchaseShouldLoadData) {
    for (const canteen of canteens) {
      const source = `${canteen}-厨房`;
      const orders = await window.api.getPurchaseOrders(source);
      const today = todayStr();
      for (const order of orders) {
        if (!order.created_at || !order.created_at.startsWith(today)) continue;
        const name = order.product_name;
        if (!name) continue;
        // 使用 name + spec 作为复合键，避免同名不同规格的产品合并到一行
        const key = name + (order.spec ? '|||' + order.spec : '');
        if (!allData[key]) {
          allData[key] = { name, spec: order.spec || '', unit: order.unit || '', remark: order.remark || '', quantities: {} };
        }
        allData[key].quantities[canteen] = order.quantity || '';
      }
    }
  }

  const keys = Object.keys(allData);
  renderSmallMatrix(area, canteens, keys, allData);
}

function renderSmallMatrix(area, canteens, keys, allData) {
  const hasRemarks = APP_SETTINGS.show_matrix_remarks !== 'off';
  const tbody = document.createElement('tbody');
  tbody.id = 'matrix-tbody';

  keys.forEach((key, idx) => {
    const d = allData[key];
    const tr = document.createElement('tr');
    let html = `
      <td>${idx + 1}</td>
      <td style="position:relative;">
        <input type="text" class="cell-input cell-editable" value="${escHtml(d.name)}" data-field="product_name" autocomplete="off" placeholder="输入品名...">
        <div class="autocomplete-dropdown" style="display:none;"></div>
      </td>
      <td><input type="text" class="cell-input cell-readonly" value="${escHtml(d.spec)}" data-field="spec" readonly tabindex="-1"></td>
      <td><input type="text" class="cell-input cell-readonly" value="${escHtml(d.unit)}" data-field="unit" readonly tabindex="-1"></td>
    `;
    for (const c of canteens) {
      const val = d.quantities[c] || '';
      html += `<td><input type="text" class="cell-input cell-editable matrix-cell-qty${val ? ' has-value' : ''}" value="${escHtml(val)}" data-canteen="${c}" placeholder="0"></td>`;
    }
    if (hasRemarks) {
      html += `<td><input type="text" class="cell-input cell-editable" value="${escHtml(d.remark)}" data-field="remark" placeholder="备注"></td>`;
    }
    html += `<td style="white-space:nowrap;"><button class="btn-delete-row" onclick="deleteMatrixRow(this)">✕</button></td>`;
    tr.innerHTML = html;
    tbody.appendChild(tr);
    bindMatrixRowEvents(tr, tbody);
  });

  if (keys.length === 0) {
    appendMatrixRow(tbody, 0);
  }

  area.innerHTML = `
    <div class="matrix-date-bar">
      <label>到货日期：</label>
      <input type="date" class="form-control" id="matrix-date" value="${getTomorrowStr()}" style="width:160px;">
    </div>
    <div class="matrix-container">
      <table class="matrix-table">
        <thead>
          <tr>
            <th>序号</th>
            <th class="matrix-name-col">品名 <button class="btn-copy-col" onclick="copyColumnToClipboard(this)" title="复制整列">📋</button></th>
            <th>规格</th>
            <th>单位</th>
            ${canteens.map(c => `<th class="matrix-qty-col">${c} <button class="btn-copy-col" onclick="copyColumnToClipboard(this)" title="复制整列">📋</button></th>`).join('')}
            ${hasRemarks ? '<th>备注 <button class="btn-copy-col" onclick="copyColumnToClipboard(this)" title="复制整列">📋</button></th>' : ''}
            <th>操作</th>
          </tr>
        </thead>
      </table>
    </div>
    <div style="margin-top:8px;">
      <button class="btn btn-sm" onclick="addMatrixEmptyRow()">+ 添加空白行</button>
    </div>
  `;

  const table = area.querySelector('.matrix-table');
  table.appendChild(tbody);
}

function addMatrixEmptyRow() {
  const tbody = document.getElementById('matrix-tbody');
  appendMatrixRow(tbody);
  renumberMatrixRows();
}

function deleteMatrixRow(btn) {
  const tr = btn.closest('tr');
  tr.remove();
  renumberMatrixRows();
  markPurchaseDirty();
}

function renumberMatrixRows() {
  document.querySelectorAll('#matrix-tbody tr').forEach((row, idx) => {
    row.querySelector('td:first-child').textContent = idx + 1;
  });
}

async function toggleMatrixRemarks() {
  await saveMatrixData();
  const current = APP_SETTINGS.show_matrix_remarks !== 'off';
  APP_SETTINGS.show_matrix_remarks = current ? 'off' : 'on';
  await window.api.setSetting('show_matrix_remarks', APP_SETTINGS.show_matrix_remarks);
  initSmallMatrixMode();
}

// 保存矩阵数据到 DB
async function saveMatrixData(silent) {
  const canteens = getSmallCanteens();
  const tbody = document.getElementById('matrix-tbody');
  if (!tbody) return;

  const dateInput = document.getElementById('matrix-date');
  const date = dateInput ? dateInput.value : getTomorrowStr();

  const sourceDates = canteens.map(c => ({ source: `${c}-厨房`, date }));
  const orders = [];
  const rows = tbody.querySelectorAll('tr');
  let savedCount = 0;

  for (const tr of rows) {
    const productName = tr.querySelector('[data-field="product_name"]')?.value?.trim();
    if (!productName) continue;

    const spec = tr.querySelector('[data-field="spec"]')?.value?.trim() || '';
    const unit = tr.querySelector('[data-field="unit"]')?.value?.trim() || '';
    const remark = tr.querySelector('[data-field="remark"]')?.value?.trim() || '';

    for (const canteen of canteens) {
      const qtyInput = tr.querySelector(`[data-canteen="${canteen}"]`);
      const quantity = qtyInput ? qtyInput.value.trim() : '';
      if (!quantity) continue;

      orders.push({
        source: `${canteen}-厨房`,
        receive_date: date,
        product_name: productName,
        spec,
        unit_price: 0,
        quantity,
        unit,
        amount: 0,
        remark,
        sort_order: savedCount,
      });
      savedCount++;
    }
  }

  // 静默保存时若矩阵无数据则跳过，防止新天误清历史
  if (silent && orders.length === 0) return;

  // 事务保护
  const result = await window.api.savePurchaseOrdersBatch(sourceDates, orders);
  if (!result.success) {
    if (!silent) showToast('保存失败: ' + result.error, 'error');
    return;
  }

  // Record the save date
  const today = todayStr();
  await window.api.setSetting('last_purchase_date', today);
  APP_SETTINGS.last_purchase_date = today;

  if (!silent) {
    showToast(`矩阵数据已保存 ${savedCount} 条`);
    for (const canteen of canteens) {
      await loadPurchaseGroupData(`${canteen}-厨房`);
    }
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
  await silentSavePurchaseOrders();
  showToast(`已将 ${fromCanteen} 厨房数据复制到 ${toCanteen}，已自动保存`);
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
  await silentSavePurchaseOrders();
  showToast(`已将 ${source} 厨房数据同步到 ${targets.length} 个小所，已自动保存`);
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
    const dateId = `date-${toSource}-${date}`.replace(/[\s-]/g, '_');

    const newDateGroup = document.createElement('div');
    newDateGroup.className = 'date-group';
    newDateGroup.id = dateId;
    newDateGroup.innerHTML = buildDateGroupHTML(date, '0 项');
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

    // Only load data if same day
    if (!window._purchaseShouldLoadData) return;

    const orders = await window.api.getPurchaseOrders(source);
    const today = todayStr();
    const byDate = {};
    orders.filter(o => o.created_at && o.created_at.startsWith(today)).forEach(o => {
      if (!byDate[o.receive_date]) byDate[o.receive_date] = [];
      byDate[o.receive_date].push(o);
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

  const dateId = source.includes('联华')
    ? `lianhua-date-${source}-${date}`.replace(/[\s-]/g, '_')
    : `date-${source}-${date}`.replace(/[\s-]/g, '_');
  if (document.getElementById(dateId)) return;

  const dateGroup = document.createElement('div');
  dateGroup.className = 'date-group';
  dateGroup.id = dateId;

  const labelSuffix = source.includes('联华') ? '发货' : '收货';
  dateGroup.innerHTML = buildDateGroupHTML(date, `${items.length} 项`, labelSuffix);

  groupContent.appendChild(dateGroup);

  const tbody = dateGroup.querySelector('tbody');
  items.forEach((item, idx) => {
    const tr = appendPurchaseRowWithData(tbody, item, idx);
  });
}

function appendPurchaseRowWithData(tbody, item, idx) {
  const tr = document.createElement('tr');
  if (item.id) tr.dataset.id = item.id;

  const price = item.unit_price != null ? parseFloat(item.unit_price) || 0 : 0;
  const qtyStr = String(item.quantity ?? '').trim();
  const qtyNum = parseFloat(qtyStr) || 0;
  // 数量含非数字文本（如"11条"）时使用 DB 中已保存的金额，不重新计算
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

  const dateId = source.includes('联华')
    ? `lianhua-date-${source}-${date}`.replace(/[\s-]/g, '_')
    : `date-${source}-${date}`.replace(/[\s-]/g, '_');

  // Check if date already exists
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

  // Expand parent group if not expanded
  const groupHeader = groupContent.previousElementSibling;
  if (!groupHeader.classList.contains('expanded')) {
    toggleGroup(groupHeader);
  }

  // Add empty rows (联华使用联华自动补全，厨房使用询价自动补全)
  const tbody = dateGroup.querySelector('tbody');
  for (let i = 0; i < APP_SETTINGS.purchase_rows; i++) {
    if (source.includes('联华')) {
      appendLianhuaRow(tbody, i);
    } else {
      appendPurchaseRow(tbody, i);
    }
  }
}

// 统一删除 date group（默认模式 / 多食堂 / 小所并列 / 联华 共用）
// 采购行有 dataset.id → 逐条 DELETE；联华行无 id → 仅 DOM 移除 + 空 source 兜底清理
async function deleteDateGroup(btn) {
  const dateGroup = btn.closest('.date-group');
  if (!confirm('确定删除此日期分组？')) return;

  const purchaseGroup = dateGroup.closest('.purchase-group');
  const source = purchaseGroup ? purchaseGroup.dataset.source : null;

  // 1. 删除带有 DB id 的行（已持久化的采购记录）
  const rows = dateGroup.querySelectorAll('tbody tr');
  for (const tr of rows) {
    if (tr.dataset.id) {
      try {
        await window.api.deletePurchaseOrder(parseInt(tr.dataset.id));
      } catch (err) {
        console.error('删除采购记录失败:', err);
      }
    }
  }

  // 2. 移除 DOM
  dateGroup.remove();
  markPurchaseDirty();

  // 3. 若删除后该 source 不再有 date group，仅清理该日期的 DB 记录（不动历史数据）
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
  markPurchaseDirty();
}

/** 仅用于厨房/面点房。联华请使用 appendLianhuaRow */
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
  const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';

  // 在当前行之后插入新行
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

  // 绑定事件
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
    onProductBlur: handleProductBlur,
    onQtyChange: (row) => recalcRowAmount(row),
    onFieldChange: (row) => recalcRowAmount(row),
    onAppendRow: (tbody, idx) => appendPurchaseRow(tbody, idx),
  });
}

// 失焦时自动匹配：键入全名后点别处，自动拉取规格、单位、单价
async function handleProductBlur(input) {
  if (!input.isConnected) return;
  const tr = input.closest('tr');
  const keyword = input.value.trim();
  if (!keyword) return;

  // 已有数据则不覆盖
  const existingSpec = tr.querySelector('[data-field="spec"]')?.value;
  const existingPrice = tr.querySelector('[data-field="unit_price"]')?.value;
  if (existingSpec || existingPrice) return;

  const purchaseGroup = tr.closest('.purchase-group');
  const isLianhua = purchaseGroup && purchaseGroup.dataset.source.includes('联华');

  try {
    let match = null;

    if (isLianhua) {
      match = lianhuaItems.find(i => i.name.toLowerCase() === keyword.toLowerCase());
    } else {
      // 按 date-group 的 receive_date 月份查询询价
      const targetMonth = getInquiryMonthForInput(input);
      const results = await resolveInquirySearch(keyword, targetMonth);
      // 优先精确匹配，否则取第一个结果
      match = results.find(r => r.name.toLowerCase() === keyword.toLowerCase()) || results[0];
    }

    if (match) {
      tr.querySelector('[data-field="spec"]').value = match.spec || '';
      // 使用盛销折扣后的价格
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

function recalcRowAmount(tr) {
  const priceInput = tr.querySelector('[data-field="unit_price"]');
  const qtyInput = tr.querySelector('[data-field="quantity"]');
  const amountCell = tr.querySelector('.amount-cell');

  const price = parseFloat(priceInput.value) || 0;
  const qtyStr = qtyInput.value.trim();

  // Check if quantity is a number
  const qtyNum = parseFloat(qtyStr);

  const dec = Math.max(0, APP_SETTINGS.price_decimals || 2);

  if (qtyStr && !isNaN(qtyNum) && !isNaN(Number(qtyStr))) {
    // Pure number (no trailing text) - calculate amount
    const factor = Math.pow(10, dec);
    const amount = Math.round(price * qtyNum * factor) / factor;
    amountCell.textContent = amount.toFixed(dec);
  } else {
    // Contains text (like "60片") - amount is 0
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

  // Check if this is in 联华 group
  const dateGroup = input.closest('.date-group');
  const purchaseGroup = input.closest('.purchase-group');
  const isLianhua = purchaseGroup && purchaseGroup.dataset.source.includes('联华');

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
      // Search from inquiry items: 按 date-group 的 receive_date 月份查询
      const targetMonth = getInquiryMonthForInput(input);
      results = await resolveInquirySearch(keyword, targetMonth);
    }

    results = sortAutocompleteResults(results, keyword);

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

    // Click to select
    const selectFn = input._autocompleteSelectFn || selectAutocompleteItem;
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
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

  // 使用盛销折扣后的价格
  const discountRate = parseFloat(APP_SETTINGS.discount1_rate) || 1;
  const dec = APP_SETTINGS.price_decimals || 2;
  const factor = Math.pow(10, dec);
  const discountedPrice = Math.round(rawPrice * discountRate * factor) / factor;

  input.value = name;
  tr.querySelector('[data-field="spec"]').value = spec;
  tr.querySelector('[data-field="unit_price"]').value = discountedPrice;
  tr.querySelector('[data-field="unit"]').value = unit;
  hideAutocomplete();

  // Focus on quantity input (configurable)
  if (APP_SETTINGS.auto_focus_qty !== 'off') {
    const qtyInput = tr.querySelector('[data-field="quantity"]');
    if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
  }
}

// 保存小所食堂所有 groups 数据（厨房+联华，所有小所）
// opts.onlySourcesWithData: true 时只清理有数据的 source（用于矩阵→groups切换，避免误删联华）
async function saveAllSmallGroupsData(opts = {}) {
  const canteens = getSmallCanteens();
  const allOrders = [];
  const sourcesWithData = new Set();

  for (const canteen of canteens) {
    for (const suffix of ['厨房', '联华']) {
      const source = `${canteen}-${suffix}`;
      const group = document.querySelector(`.purchase-group[data-source="${source}"]`);
      if (!group) continue;

      group.querySelectorAll('.date-group').forEach(dateGroup => {
        const date = getDateFromGroup(dateGroup);
        dateGroup.querySelectorAll('tbody tr').forEach((tr, idx) => {
          const data = getRowData(tr);
          if (!data) return;
          allOrders.push({
            source,
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
          sourcesWithData.add(source);
        });
      });
    }
  }

  // onlySourcesWithData: 只清理实际有 DOM 数据的 source
  // 否则：清理所有 source（包括被用户清空的分组）
  let sources;
  if (opts.onlySourcesWithData) {
    sources = [...sourcesWithData];
  } else {
    sources = canteens.flatMap(c => [`${c}-厨房`, `${c}-联华`]);
  }
  const result = await window.api.savePurchaseOrdersBatch(sources, allOrders);
  if (result.success) {
    const today = todayStr();
    await window.api.setSetting('last_purchase_date', today);
    APP_SETTINGS.last_purchase_date = today;
  }
}

// 收集 DOM 中所有联华数据并保存到 DB（用于矩阵模式，矩阵只存厨房不存联华）
async function saveLianhuaDomData(silent) {
  const canteens = getSmallCanteens();
  const allOrders = [];
  const sourceDates = [];
  const seenDates = new Set();

  for (const canteen of canteens) {
    const source = `${canteen}-联华`;
    const group = document.querySelector(`.purchase-group[data-source="${source}"]`);
    if (!group) continue;

    const dateGroupEls = group.querySelectorAll('.date-group');
    // 静默保存时无 dateGroup = 数据未加载，跳过防止误清历史
    // 显式保存时无 dateGroup 也跳过（按日期清除，无日期则无需操作）
    if (dateGroupEls.length === 0) continue;

    dateGroupEls.forEach(dateGroup => {
      const date = getDateFromGroup(dateGroup);
      const trs = [...dateGroup.querySelectorAll('tbody tr')];
      // 只有该 date-group 确实有有效数据行时才收集 sourceDate，防止空 date-group 误触发 DELETE
      let hasValidRow = false;
      trs.forEach((tr, idx) => {
        const data = getRowData(tr);
        if (!data) return;
        hasValidRow = true;
        allOrders.push({
          source,
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
        const key = `${source}|||${date}`;
        if (!seenDates.has(key)) {
          seenDates.add(key);
          sourceDates.push({ source, date });
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

// Save all purchase orders (including 联华)
// opts.silent: no toast, no reload (used for auto-save on page switch)
async function saveAllPurchaseOrders(opts = {}) {
  const silent = opts.silent || false;

  // 矩阵模式：保存矩阵数据 + 联华 DOM 数据
  if (APP_SETTINGS.xiaosuo_mode === 'small' && APP_SETTINGS.small_display_style === 'matrix') {
    await saveMatrixData(silent);
    // 矩阵只有厨房，联华数据在 DOM 中需要单独收集保存
    await saveLianhuaDomData(silent);
    return;
  }

  const allOrders = [];
  const sourceDates = [];
  const seenDates = new Set();
  const container = document.getElementById('purchase-container');
  // 收集所有 dateGroup（包括隐藏的面点房），避免隐藏时数据丢失
  const dateGroups = [...container.querySelectorAll('.date-group')];

  dateGroups.forEach(dateGroup => {
    const purchaseGroup = dateGroup.closest('.purchase-group');
    if (!purchaseGroup || !purchaseGroup.dataset.source) return;
    const source = purchaseGroup.dataset.source;
    const dateLabel = dateGroup.querySelector('.date-label');
    if (!dateLabel) return;
    const dateLabelText = dateLabel.textContent;
    // Handle both "收货" and "发货" suffix
    const receiveDate = dateLabelText.replace(' 收货', '').replace(' 发货', '').trim();
    const rows = dateGroup.querySelectorAll('tbody tr');

    let hasValidRow = false;
    rows.forEach((tr, idx) => {
      const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
      const amountText = tr.querySelector('.amount-cell')?.textContent || '0';
      const amount = parseFloat(amountText.replace('¥', '')) || 0;

      const productName = getData('product_name').trim();
      if (!productName) return; // Skip empty rows

      hasValidRow = true;
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

    // 只有该 date-group 确实有有效数据行时才收集 sourceDate，防止空 date-group 误触发 DELETE
    if (hasValidRow) {
      const key = `${source}|||${receiveDate}`;
      if (!seenDates.has(key)) {
        seenDates.add(key);
        sourceDates.push({ source: source, date: receiveDate });
      }
    }
  });

  try {
    // 如果 DOM 中没有任何有效数据，说明数据未加载（新天 shouldLoadData=false），跳过保存
    if (sourceDates.length === 0) return;

    // 事务保护：按 (source, date) 清除 + insert，不误伤同 source 其他日期
    const result = await window.api.savePurchaseOrdersBatch(sourceDates, allOrders);
    if (!result.success) {
      if (!silent) showToast('保存失败: ' + result.error, 'error');
      return;
    }

    // Record the save date
    const today = todayStr();
    await window.api.setSetting('last_purchase_date', today);
    APP_SETTINGS.last_purchase_date = today;

    resetPurchaseDirty();
    if (!silent) showToast(`已保存 ${allOrders.length} 条采购记录`);
  } catch (err) {
    if (!silent) showToast('保存失败: ' + err.message, 'error');
  }
}

// 静默保存（无 toast，用于页面切换时自动保存）
function silentSavePurchaseOrders() {
  return saveAllPurchaseOrders({ silent: true });
}

// Export all purchase orders — helper functions
function getDateFromGroup(dateGroup) {
  const label = dateGroup.querySelector('.date-label').textContent;
  return label.replace(' 收货', '').replace(' 发货', '').trim();
}

// 从 input 所在 date-group 提取 receive_date → 转为 "YYYY-MM" 询价月份
function getInquiryMonthForInput(input) {
  const dateGroup = input.closest('.date-group');
  if (!dateGroup) return null;
  // 优先使用 dataset.date（addLianhuaDateGroup 设置）
  if (dateGroup.dataset.date) return dateToMonthStr(dateGroup.dataset.date);
  return dateToMonthStr(getDateFromGroup(dateGroup));
}

// 当日持久化缓存：已确认的月份 fallback 选择，同日不重复弹窗
// 格式：{ _date: '2026-06-30', '2026-07': '2026-06' } → 7月沿用6月；null → 用户拒绝
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

// 弹窗询问：目标月份无询价时是否沿用上月
// 返回 true（沿用上月）或 false（手动输入）
function showInquiryFallbackDialog(targetMonth, fallbackMonth) {
  const targetLabel = targetMonth.replace('-', '年') + '月';
  const fallbackLabel = fallbackMonth ? fallbackMonth.replace('-', '年') + '月' : '上月';
  return confirm(
    `${targetLabel}询价尚未导入，是否沿用${fallbackLabel}询价？\n\n请尽快导入${targetLabel}询价。`
  );
}

// 核心查询函数：按目标月份搜索询价，缺失时降级处理
// opts.silent: true → 不弹窗，静默 fallback 到最新月份（用于 history 价格反查）
// 性能优化：缓存可用月份列表，避免每次按键多次 IPC 调用
async function resolveInquirySearch(keyword, targetMonth, opts = {}) {
  const { silent = false } = opts;

  // 懒初始化：缓存所有可用询价月份（首次调用时拉取一次）
  if (!window._availableInquiryMonths) {
    try {
      const months = await window.api.getInquiryMonths();
      window._availableInquiryMonths = months.map(m => m.month);
    } catch (e) {
      window._availableInquiryMonths = [];
    }
  }
  const avail = window._availableInquiryMonths;

  // 决定实际搜索的月份
  let searchMonth = targetMonth;

  if (targetMonth && !avail.includes(targetMonth)) {
    // 快速重检：用户可能刚在本 session 导入了该月询价（缓存过期）
    try {
      const fresh = await window.api.getInquiryMonths();
      const freshMonths = fresh.map(m => m.month);
      if (freshMonths.includes(targetMonth)) {
        window._availableInquiryMonths = freshMonths;
        return await window.api.searchInquiryItems(keyword, targetMonth);
      }
      // 同步更新缓存（可能其他月份也变了）
      window._availableInquiryMonths = freshMonths;
    } catch (e) {}

    // 目标月份无询价 → 查当日持久化缓存或弹窗
    const fallbackCache = getFallbackCache();
    const cached = fallbackCache[targetMonth];
    if (cached !== undefined) {
      searchMonth = cached; // null = 用户拒绝，沿用某月 = 直接用
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
      // silent: 优先上月，否则最新
      const fallbackMonth = getPreviousMonthStr(targetMonth);
      searchMonth = (fallbackMonth && window._availableInquiryMonths.includes(fallbackMonth)) ? fallbackMonth
        : (window._availableInquiryMonths.length > 0 ? window._availableInquiryMonths[0] : null);
    }
  }

  // 兜底：无有效 searchMonth 时用最新可用月份
  if (!searchMonth && window._availableInquiryMonths.length > 0) {
    searchMonth = window._availableInquiryMonths[0];
  }

  if (!searchMonth) return [];
  return await window.api.searchInquiryItems(keyword, searchMonth);
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

function buildDateLabel(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1])}月${parseInt(parts[2])}日 收货`;
  }
  return dateStr;
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
    name: title, title,
    headers: [],
    colWidths: [8, 15, 30, 25, 10, 10, 10, 10, 30, 15],
    rows: outRows,
  };
}

// 多食堂模式：厨房申购单按食堂分区块（食堂名→表头→数据）
function buildMultiCanteenKitchenSheet(canteenData, canteenImages) {
  const rows = [];
  for (const { canteen, rows: cRows, images } of canteenData) {
    // 食堂名标题行
    rows.push({ isHeader: true, data: [canteen], mergeRange: 'A:J' });

    let currentDate = null;
    let seq = 0;

    for (let i = 0; i < cRows.length; i++) {
      const row = cRows[i];
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
        imagePath: images[i]
      });
    }
  }
  return {
    name: '厨房申购单', title: '厨房申购单',
    headers: [],
    colWidths: [8, 15, 30, 25, 10, 10, 10, 10, 30, 15],
    rows,
  };
}

function buildLianhuaSheet(title, canteen, date, rows, images) {
  return {
    name: title,
    title: `${canteen}联华超市 ${date}`,
    headers: ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注', '实物图'],
    rows: rows.map((row, idx) => ({
      data: [idx + 1, canteen, date.replace(/-/g, '.'), row.code, row.product_name, row.unit, row.spec, row.unit_price, row.quantity, row.amount, (row.quantity || 0) * (row.split_qty || 1), row.remark, ''],
      imagePath: images[idx]
    }))
  };
}

// 合并所有小所联华到一张表
function buildMergedLianhuaSheet(canteens, exportDate, allRows) {
  const dateStr = exportDate ? exportDate.replace(/-/g, '.') : '';
  const displayDate = exportDate ? exportDate.replace(/-/g, '年').replace(/年(\d+)$/, '月$1日') : '小所';
  const rows = allRows.map((row, idx) => ({
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
  }));

  return {
    name: '联华超市',
    title: `${displayDate}联华超市`,
    headers: ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注', '实物图'],
    colWidths: [8, 14, 20, 12, 24, 10, 8, 12, 18, 14, 14, 14, 14],
    rows,
  };
}

function getLianhuaDateGroups(source) {
  const group = document.querySelector(`.purchase-group[data-source="${source}"]`);
  return group ? group.querySelectorAll('.date-group') : [];
}

// Export all purchase orders (main entry)
async function exportAllPurchaseOrders() {
  try {
    // 记录导出前的 last_purchase_date，取消时恢复
    const prevLastDate = APP_SETTINGS.last_purchase_date;

    // 导出前先静默保存，确保 DB 和 DOM 同步
    await silentSavePurchaseOrders();

    if (lianhuaItems.length === 0) {
      try { await loadLianhuaItems(); } catch (e) { /* ignore */ }
    }

    // 确保 DOM 中已加载 DB 数据（新天时 _purchaseShouldLoadData 为 false 会导致 DOM 为空）
    // 但如果 DOM 已有数据（用户输入或调取加载），跳过清空重载，避免覆盖用户正在编辑的内容
    if (!hasPurchasePageData()) {
      const wasShouldLoad = window._purchaseShouldLoadData;
      window._purchaseShouldLoadData = true;
      try {
        const mode = APP_SETTINGS.xiaosuo_mode;
        if (mode === 'small') {
          const canteens = getSmallCanteens();
          for (const canteen of canteens) {
            await loadPurchaseGroupData(`${canteen}-厨房`);
            await loadPurchaseGroupData(`${canteen}-联华`);
          }
        } else if (mode === 'on') {
          for (const canteen of MULTI_CANTEENS) {
            await loadPurchaseGroupData(`${canteen}-厨房`);
            await loadPurchaseGroupData(`${canteen}-联华`);
          }
        } else {
          await loadPurchaseGroupData(getKitchenSource());
          await loadPurchaseGroupData('联华');
          if (APP_SETTINGS.show_pastry !== 'off') await loadPurchaseGroupData(getPastrySource());
        }
      } finally {
        window._purchaseShouldLoadData = wasShouldLoad;
      }
    }

    const sheets = [];
    const mode = APP_SETTINGS.xiaosuo_mode;

    if (mode === 'small') {
      // 小所食堂模式：厨房并列，联华按日期
      await exportSmallCanteenOrders(sheets);
    } else if (mode === 'on') {
      // 多食堂模式：厨房按食堂分区块，联华合并一张 sheet
      const canteens = MULTI_CANTEENS;
      const canteenData = [];
      const allLianhuaRows = [];

      for (const canteen of canteens) {
        const kitchenSource = `${canteen}-厨房`;
        const kitchenRows = collectRows(kitchenSource);
        const images = kitchenRows.length > 0 ? await resolveImages(kitchenRows) : [];
        canteenData.push({ canteen, rows: kitchenRows, images });

        const lianhuaSource = `${canteen}-联华`;
        for (const dateGroup of getLianhuaDateGroups(lianhuaSource)) {
          const date = getDateFromGroup(dateGroup);
          const rows = collectLianhuaRows(dateGroup);
          rows.forEach(r => { r.canteen = canteen; r.date = date; });
          allLianhuaRows.push(...rows);
        }
      }

      if (canteenData.some(d => d.rows.length > 0)) {
        sheets.push(buildMultiCanteenKitchenSheet(canteenData));
      }
      if (allLianhuaRows.length > 0) {
        sheets.push(buildMergedLianhuaSheet(canteens, null, allLianhuaRows));
      }
    } else {
      // 默认模式
      const kitchenRows = collectRows(getKitchenSource());
      if (kitchenRows.length > 0) {
        sheets.push(buildKitchenSheet('厨房申购单', kitchenRows, await resolveImages(kitchenRows)));
      }
      if (APP_SETTINGS.show_pastry !== 'off') {
        const pastryRows = collectRows(getPastrySource());
        if (pastryRows.length > 0) {
          sheets.push(buildKitchenSheet(`${getPastrySource()}申购单`, pastryRows, await resolveImages(pastryRows)));
        }
      }
      for (const dateGroup of getLianhuaDateGroups('联华')) {
        const date = getDateFromGroup(dateGroup);
        const rows = collectLianhuaRows(dateGroup);
        if (rows.length === 0) continue;
        sheets.push(buildLianhuaSheet(date, '联华', date, rows, await resolveImages(rows)));
      }
    }

    if (sheets.length === 0) {
      showToast('没有订单数据', 'error');
      return;
    }

    // 从采购数据中提取月份（而非用今天日期），确保跨月采购单文件名正确
    const now = new Date();
    let maxMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.querySelectorAll('.date-group .date-label').forEach(label => {
      const dateText = label.textContent.replace(' 收货', '').replace(' 发货', '').trim();
      const monthStr = dateToMonthStr(dateText);
      if (monthStr && monthStr > maxMonthStr) maxMonthStr = monthStr;
    });
    const exportMonth = parseInt(maxMonthStr.split('-')[1]);
    const month = `${exportMonth}月`;
    const modeLabel = mode === 'small' ? '小所食堂' : (mode === 'on' ? '下涯、制杆厂、白南山' : (APP_SETTINGS.current_canteen || '洋安'));
    // DEBUG: 导出数据概览
    console.log('[EXPORT] sheets:', sheets.length, 'mode:', mode);
    sheets.forEach(s => {
      const count = s.rows.filter(r => !r.isHeader && !r.isSubHeader).length;
      console.log(`[EXPORT] sheet "${s.name}": ${count} data rows`);
      s.rows.filter(r => !r.isHeader && !r.isSubHeader).slice(0, 2).forEach(r => console.log('[EXPORT]   sample:', JSON.stringify(r.data?.slice(0, 4))));
    });

    const result = await window.api.exportPurchaseOrder(sheets, `${month}${modeLabel}采购单.xlsx`);
    if (result.success) {
      showToast(result.retryPath ? `文件被占用，已另存为: ${result.retryPath.split(/[\\/]/).pop()}` : '导出成功！');
      // 导出后清空页面 DOM（数据已在 DB + xlsx，采购页作为今日编辑区不应持久显示）
      clearPurchasePageDOM();
      resetPurchaseDirty();
      // 重置 last_purchase_date，下次进入采购页不再自动加载（导出即归档，需调取才可见）
      await window.api.setSetting('last_purchase_date', '');
      APP_SETTINGS.last_purchase_date = '';
    } else if (result.error !== '已取消') {
      showToast('导出失败: ' + result.error, 'error');
    } else {
      // 用户取消导出：恢复导出前的 last_purchase_date，避免 silentSave 的副作用
      await window.api.setSetting('last_purchase_date', prevLastDate);
      APP_SETTINGS.last_purchase_date = prevLastDate;
    }
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

// 导出后清空采购页所有 DOM 内容（DB 数据不动）
// 彻底删除 date-group div，防止空壳残留污染后续保存（stale group 导致 saveBatch 整源清除时误删其他日期数据）
function clearPurchasePageDOM() {
  const container = document.getElementById('purchase-container');
  if (container) {
    container.querySelectorAll('.date-group').forEach(dg => dg.remove());
  }
  // 矩阵模式
  const matrixTbody = document.getElementById('matrix-tbody');
  if (matrixTbody) matrixTbody.innerHTML = '';
}

// 调取历史采购数据回页面
async function showRecallPurchaseModal() {
  const today = todayStr();
  // 从 DB 获取最大的 receive_date 作为默认结束日期，确保跨月采购单（如月末录入的下月单）可被调取
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
    const mode = APP_SETTINGS.xiaosuo_mode;
    let sources = [];
    if (mode === 'small') {
      sources = getSmallCanteens().flatMap(c => [`${c}-厨房`, `${c}-联华`]);
    } else if (mode === 'on') {
      sources = MULTI_CANTEENS.flatMap(c => [`${c}-厨房`, `${c}-联华`]);
    } else {
      sources = [getKitchenSource(), '联华'];
      if (APP_SETTINGS.show_pastry !== 'off') sources.push(getPastrySource());
    }

    let totalLoaded = 0;
    for (const source of sources) {
      // 查询该 source 在日期范围内的所有订单
      const dateGroups = new Map();
      const allOrders = await window.api.getPurchaseOrders(source);
      const filtered = allOrders.filter(o => o.receive_date >= fromDate && o.receive_date <= toDate);

      for (const o of filtered) {
        const key = o.receive_date;
        if (!dateGroups.has(key)) dateGroups.set(key, []);
        dateGroups.get(key).push(o);
      }

      // 渲染到 DOM
      for (const [date, orders] of dateGroups) {
        await ensureDateGroup(source, date, orders);
        totalLoaded += orders.length;
      }
    }
    resetPurchaseDirty();
    showToast(`已加载 ${totalLoaded} 条记录`);
  } catch (err) {
    showToast('调取失败: ' + err.message, 'error');
  }
}

// 确保 date group 存在并填充数据
async function ensureDateGroup(source, date, orders) {
  const group = document.querySelector(`.purchase-group[data-source="${source}"]`);
  if (!group) return;

  const groupContent = group.querySelector('.group-content');
  if (!groupContent) return;

  // 展开分组
  const groupHeader = groupContent.previousElementSibling;
  if (groupHeader && !groupHeader.classList.contains('expanded')) {
    toggleGroup(groupHeader);
  }

  const dateId = source.includes('联华')
    ? `lianhua-date-${source}-${date}`.replace(/[\s-]/g, '_')
    : `date-${source}-${date}`.replace(/[\s-]/g, '_');

  let dateGroup = document.getElementById(dateId);
  if (!dateGroup) {
    // 添加新的 date group（联华用 addLianhuaDateGroup，其他手动创建）
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
          <span class="date-label">${date} 收货</span>
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

  // 清空后填充数据
  tbody.innerHTML = '';
  orders.forEach((o, idx) => {
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
    const src = source.includes('联华') ? attachLianhuaCellEvents : attachCellEvents;
    src(tr, tbody);
  });

  // 更新 summary
  const summary = dateGroup.querySelector('.date-summary');
  if (summary) summary.textContent = `${orders.length} 项`;
}

// 小所食堂导出：厨房并列，联华按日期
async function exportSmallCanteenOrders(sheets) {
  const canteens = getSmallCanteens();
  const style = APP_SETTINGS.small_export_style || 'matrix';

  // 获取导出日期：优先从矩阵日期输入，否则从第一个日期分组，最后用明天
  let exportDate = '';
  const matrixDate = document.getElementById('matrix-date');
  if (matrixDate && matrixDate.value) {
    exportDate = matrixDate.value;
  } else {
    // 从第一个小所的第一个日期分组获取
    for (const canteen of canteens) {
      const groups = getLianhuaDateGroups(`${canteen}-厨房`);
      if (groups.length > 0) {
        exportDate = getDateFromGroup(groups[0]);
        break;
      }
    }
    if (!exportDate) exportDate = getTomorrowStr();
  }

  // 1. 厨房 sheet
  if (style === 'matrix') {
    buildMatrixKitchenSheet(sheets, canteens, exportDate);
  } else {
    buildPairedKitchenSheets(sheets, canteens, exportDate);
  }

  // 2. 联华合并到一张表
  const allLianhuaRows = [];
  for (const canteen of canteens) {
    for (const dateGroup of getLianhuaDateGroups(`${canteen}-联华`)) {
      let date = getDateFromGroup(dateGroup);
      if (!date) date = exportDate;
      const rows = collectLianhuaRows(dateGroup);
      for (const row of rows) {
        allLianhuaRows.push({ ...row, canteen, date });
      }
    }
  }
  if (allLianhuaRows.length > 0) {
    sheets.push(buildMergedLianhuaSheet(canteens, exportDate, allLianhuaRows));
  }
}

// 样式1：矩阵式（品名×小所）
function buildMatrixKitchenSheet(sheets, canteens, exportDate) {
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

  const dateStr = exportDate ? exportDate.replace(/-/g, '年').replace(/年(\d+)$/, '月$1日') : '小所';
  sheets.push({
    name: '小所厨房',
    title: `${dateStr}厨房申购单`,
    headers: ['序号', '品名', '规格', '单位', ...canteens, '备注'],
    rows: names.map((name, idx) => ({
      data: [idx + 1, name, allData[name].spec, allData[name].unit, ...canteens.map(c => quantities[c][name] || 0), allData[name].remark || '']
    })),
  });
}

// 样式2：两两左右并列（同一个sheet内，垂直排列多组）
function buildPairedKitchenSheets(sheets, canteens, exportDate) {
  const allRows = [];
  const sub = ['序号', '品名', '规格', '单位', '数量', '备注'];

  for (let i = 0; i < canteens.length; i += 2) {
    const pair = canteens.slice(i, i + 2);
    const left = pair[0];
    const right = pair[1]; // 奇数时为 undefined
    const leftRows = collectRows(`${left}-厨房`);
    const rightRows = right ? collectRows(`${right}-厨房`) : [];

    // 小所名称行：左边跨A-F，右边跨H-M（如有）
    const mergeRanges = [{ range: 'A:F', text: left }];
    if (right) mergeRanges.push({ range: 'H:M', text: right });

    allRows.push({
      data: [left, '', '', '', '', '', '', right || '', '', '', '', '', ''],
      isHeader: true,
      mergeRanges,
    });

    // 表头行（带样式标记）
    allRows.push({ data: [...sub, '', ...sub], isSubHeader: true });

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

    // 空行分隔（最后一组不加）
    if (i + 2 < canteens.length) {
      allRows.push({ data: ['', '', '', '', '', '', '', '', '', '', '', '', ''] });
    }
  }

  if (allRows.length > 0) {
    const dateStr = exportDate ? exportDate.replace(/-/g, '年').replace(/年(\d+)$/, '月$1日') : '小所';
    sheets.push({
      name: '小所厨房',
      title: `${dateStr}厨房申购单`,
      headers: ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      rows: allRows,
      // 序号8 品名30 规格20 单位8 数量8 备注12 分割2
      colWidths: [8, 30, 20, 8, 8, 12, 2, 8, 30, 20, 8, 8, 12],
      headerHeight: 40,
      rowHeight: 30,
      titleFontSize: 36,
    });
  }
}
