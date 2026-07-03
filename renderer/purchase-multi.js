// ===== Purchase Mode: Multi-Canteen =====
// Depends on: purchase-core.js
// Data source format: ${canteen}-厨房 / ${canteen}-联华

let currentMultiCanteen = null;
let multiModeInitialized = false;

function getMultiCanteens() {
  // ponytail: fallback to defaults until settings.js is updated
  return (APP_SETTINGS.multi_canteens && APP_SETTINGS.multi_canteens.length > 0)
    ? APP_SETTINGS.multi_canteens
    : ['下涯', '制杆厂', '白南山'];
}

function initMultiCanteenMode() {
  const canteens = getMultiCanteens();
  const tabsEl = document.getElementById('multi-canteen-tabs');
  const areaEl = document.getElementById('multi-canteen-area');

  // Render tabs dynamically
  if (!currentMultiCanteen || !canteens.includes(currentMultiCanteen)) {
    currentMultiCanteen = canteens[0];
  }

  tabsEl.innerHTML = canteens.map(function(c) {
    return '<button class="tab-btn' + (c === currentMultiCanteen ? ' active' : '') + '" onclick="switchMultiCanteenTab(' + JSON.stringify(c) + ')">' + escHtml(c) + '</button>';
  }).join('');

  // Detect if canteen list changed, rebuild DOM
  const existingSources = new Set();
  areaEl.querySelectorAll('.purchase-group[data-source]').forEach(function(g) { existingSources.add(g.dataset.source); });
  const neededSources = new Set();
  canteens.forEach(function(c) { neededSources.add(c + '-厨房'); neededSources.add(c + '-联华'); });
  const sourcesChanged = existingSources.size !== neededSources.size ||
    [...neededSources].some(function(s) { return !existingSources.has(s); });

  if (!multiModeInitialized || sourcesChanged) {
    areaEl.querySelectorAll('.purchase-group').forEach(function(g) { g.remove(); });

    for (let i = 0; i < canteens.length; i++) {
      const canteen = canteens[i];
      const lianhuaSrc = canteen + '-联华';
      const lianhuaGroup = document.createElement('div');
      lianhuaGroup.className = 'purchase-group';
      lianhuaGroup.dataset.source = lianhuaSrc;
      lianhuaGroup.dataset.canteen = canteen;
      lianhuaGroup.style.display = 'none';
      // ponytail: escHtml on data-canteen and source for XSS safety
      lianhuaGroup.innerHTML = `
        <div class="group-header" onclick="toggleGroup(this)">
          <span class="group-toggle">▶</span>
          <h3>联华超市 - ${escHtml(canteen)}</h3>
          <div class="group-actions">
            <button class="btn btn-sm" data-add-date-source="${escHtml(lianhuaSrc)}">+ 添加日期</button>
          </div>
        </div>
        <div class="group-content" style="display:none;"></div>
      `;
      areaEl.appendChild(lianhuaGroup);

      const kitchenSrc = canteen + '-厨房';
      const kitchenGroup = document.createElement('div');
      kitchenGroup.className = 'purchase-group';
      kitchenGroup.dataset.source = kitchenSrc;
      kitchenGroup.dataset.canteen = canteen;
      kitchenGroup.style.display = 'none';
      kitchenGroup.innerHTML = `
        <div class="group-header" onclick="toggleGroup(this)">
          <span class="group-toggle">▶</span>
          <h3>${escHtml(canteen)}厨房</h3>
          <div class="group-actions">
            <button class="btn btn-sm" data-add-date-source="${escHtml(kitchenSrc)}">+ 添加日期</button>
          </div>
        </div>
        <div class="group-content" style="display:none;"></div>
      `;
      areaEl.appendChild(kitchenGroup);
    }
    multiModeInitialized = true;

    // Delegated event listener for "+ 添加日期" buttons (ponytail: avoids onclick XSS)
    if (!areaEl._addDateDelegated) {
      areaEl.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-add-date-source]');
        if (btn) {
          e.stopPropagation();
          showAddDateDialog(btn.dataset.addDateSource);
        }
      });
      areaEl._addDateDelegated = true;
    }
  }

  // Reload data from DB every time
  for (let i = 0; i < canteens.length; i++) {
    loadPurchaseGroupData(canteens[i] + '-联华');
    loadPurchaseGroupData(canteens[i] + '-厨房');
  }

  switchMultiCanteenTab(currentMultiCanteen);
}

function switchMultiCanteenTab(canteen) {
  currentMultiCanteen = canteen;
  document.querySelectorAll('#multi-canteen-tabs .tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.textContent === canteen);
  });
  document.querySelectorAll('#multi-canteen-area .purchase-group[data-canteen]').forEach(function(g) {
    g.style.display = g.dataset.canteen === canteen ? 'block' : 'none';
  });
}

// Save: collects all canteens' DOM data
function getMultiSaveData() {
  const canteens = getMultiCanteens();
  const allOrders = [];
  const sourceDates = [];
  const seenDates = new Set();

  for (let ci = 0; ci < canteens.length; ci++) {
    for (let si = 0; si < 2; si++) {
      const suffix = si === 0 ? '厨房' : '联华';
      const source = canteens[ci] + '-' + suffix;
      const group = document.querySelector('.purchase-group[data-source="' + source + '"]');
      if (!group) continue;

      group.querySelectorAll('.date-group').forEach(function(dateGroup) {
        const dateLabel = dateGroup.querySelector('.date-label');
        if (!dateLabel) return;
        const receiveDate = dateLabel.textContent.replace(' 收货', '').replace(' 发货', '').trim();
        const rows = dateGroup.querySelectorAll('tbody tr');

        let hasValidRow = false;
        rows.forEach(function(tr, idx) {
          const data = getRowData(tr);
          if (!data) return;
          hasValidRow = true;
          allOrders.push({
            source: source,
            receive_date: receiveDate,
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
          const key = source + '|||' + receiveDate;
          if (!seenDates.has(key)) {
            seenDates.add(key);
            sourceDates.push({ source: source, date: receiveDate });
          }
        }
      });
    }
  }

  return { sourceDates, allOrders };
}

// Export
async function getMultiExportSheets(sheets) {
  const canteens = getMultiCanteens();
  const canteenData = [];
  const allLianhuaRows = [];

  for (let i = 0; i < canteens.length; i++) {
    const canteen = canteens[i];
    const kitchenSource = canteen + '-厨房';
    const kitchenRows = collectRows(kitchenSource);
    const images = kitchenRows.length > 0 ? await resolveImages(kitchenRows) : [];
    canteenData.push({ canteen: canteen, rows: kitchenRows, images: images });

    const lianhuaSource = canteen + '-联华';
    const lianhuaGroups = getLianhuaDateGroups(lianhuaSource);
    for (let gi = 0; gi < lianhuaGroups.length; gi++) {
      const date = getDateFromGroup(lianhuaGroups[gi]);
      const rows = collectLianhuaRows(lianhuaGroups[gi]);
      rows.forEach(function(r) { r.canteen = canteen; r.date = date; });
      allLianhuaRows.push.apply(allLianhuaRows, rows);
    }
  }

  if (canteenData.some(function(d) { return d.rows.length > 0; })) {
    sheets.push(buildMultiCanteenKitchenSheet(canteenData));
  }
  if (allLianhuaRows.length > 0) {
    sheets.push(buildMergedLianhuaSheet(canteens, null, allLianhuaRows));
  }
}

function getMultiSources() {
  const canteens = getMultiCanteens();
  const sources = [];
  for (let i = 0; i < canteens.length; i++) {
    sources.push(canteens[i] + '-厨房');
    sources.push(canteens[i] + '-联华');
  }
  return sources;
}

function getMultiModeLabel() {
  return getMultiCanteens().join('、');
}
