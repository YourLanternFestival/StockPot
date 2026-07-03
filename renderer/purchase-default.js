// ===== Purchase Mode: Default (single canteen) =====
// Depends on: purchase-core.js

function getKitchenSource() {
  const canteen = APP_SETTINGS.current_canteen || '洋安';
  return canteen + '食堂厨房';
}

function getPastrySource() {
  const canteen = APP_SETTINGS.current_canteen || '洋安';
  return canteen + '面点房';
}

async function switchCanteen(canteen) {
  APP_SETTINGS.current_canteen = canteen;
  await window.api.setSetting('current_canteen', canteen);
  await window.api.setSetting('canteen_mode', canteen);
  initDefaultMode();
}

function initNormalCanteenMode() {
  initDefaultMode();
}

function initDefaultMode() {
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

  document.querySelectorAll('#canteen-switch .canteen-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.canteen === canteen);
  });
}

// Exports to purchase.js

function getDefaultSaveData() {
  const allOrders = [];
  const sourceDates = [];
  const seenDates = new Set();

  const container = document.getElementById('purchase-container');
  const dateGroups = [...container.querySelectorAll('.date-group')];

  dateGroups.forEach(function(dateGroup) {
    const purchaseGroup = dateGroup.closest('.purchase-group');
    if (!purchaseGroup || !purchaseGroup.dataset.source) return;
    const source = purchaseGroup.dataset.source;
    const dateLabel = dateGroup.querySelector('.date-label');
    if (!dateLabel) return;
    const receiveDate = dateLabel.textContent.replace(' 收货', '').replace(' 发货', '').trim();
    const rows = dateGroup.querySelectorAll('tbody tr');

    let hasValidRow = false;
    rows.forEach(function(tr, idx) {
      const getData = function(field) { return tr.querySelector('[data-field="' + field + '"]')?.value || ''; };
      const amountText = tr.querySelector('.amount-cell')?.textContent || '0';
      const amount = parseFloat(amountText.replace('¥', '')) || 0;

      const productName = getData('product_name').trim();
      if (!productName) return;

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

    if (hasValidRow) {
      const key = source + '|||' + receiveDate;
      if (!seenDates.has(key)) {
        seenDates.add(key);
        sourceDates.push({ source: source, date: receiveDate });
      }
    }
  });

  return { sourceDates, allOrders };
}

async function getDefaultExportSheets(sheets) {
  const kitchenRows = collectRows(getKitchenSource());
  if (kitchenRows.length > 0) {
    sheets.push(buildKitchenSheet('厨房申购单', kitchenRows, await resolveImages(kitchenRows)));
  }
  if (APP_SETTINGS.show_pastry !== 'off') {
    const pastryRows = collectRows(getPastrySource());
    if (pastryRows.length > 0) {
      sheets.push(buildKitchenSheet(getPastrySource() + '申购单', pastryRows, await resolveImages(pastryRows)));
    }
  }
  const lianhuaGroups = getLianhuaDateGroups('联华');
  for (let i = 0; i < lianhuaGroups.length; i++) {
    const date = getDateFromGroup(lianhuaGroups[i]);
    const rows = collectLianhuaRows(lianhuaGroups[i]);
    if (rows.length === 0) continue;
    sheets.push(buildLianhuaSheet(date, '联华', date, rows, await resolveImages(rows)));
  }
}

function getDefaultSources() {
  const sources = [getKitchenSource(), '联华'];
  if (APP_SETTINGS.show_pastry !== 'off') sources.push(getPastrySource());
  return sources;
}
