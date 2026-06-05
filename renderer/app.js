// ===== State =====
let PRODUCTS = [];
let RECIPIENTS = [];
let selectedProductIds = new Set();
let trendChart = null;
let pieChart = null;
let ENTER_MODE = 'next-row'; // 'next-row' | 'next-cell'
let APP_SETTINGS = {
  inbound_rows: 5, outbound_rows: 5, purchase_rows: 10,
  inbound_history: 'on', inbound_history_days: 20,
  outbound_history: 'on', outbound_history_days: 20,
  discount1_name: '盛销', discount1_rate: '0.9008',
  discount2_name: '优宏', discount2_rate: '0.9058',
  price_decimals: 2,
  inv_inbound_limit: 5, inv_outbound_limit: 10,
};

// ===== Navigation =====
function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  const pageEl = document.getElementById(`page-${page}`);
  if (navItem) navItem.classList.add('active');
  if (pageEl) pageEl.classList.add('active');

  // Load data for the page
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'inventory': loadInventory(); break;
    case 'ledger': loadLedger(); break;
    case 'products': loadProducts(); break;
    case 'purchase': initPurchasePage(); break;
    case 'inquiry': initInquiryPage(); break;
    case 'inbound': initInboundPage(); break;
    case 'outbound': initOutboundPage(); break;
    case 'settings': initSettingsPage(); break;
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// ===== Toast =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== Modal =====
function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml || '';
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ===== Helpers =====
function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.substring(0, 10);
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d2 - d1) / 86400000);
}

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

// ===== Dashboard =====
async function loadDashboard() {
  try {
    const stats = await window.api.getDashboardStats();

    // Update stat cards
    document.getElementById('stat-products').textContent = stats.productCount;
    document.getElementById('stat-inbound').textContent = stats.totalIn.toLocaleString();
    document.getElementById('stat-outbound').textContent = stats.totalOut.toLocaleString();

    // Alert count
    const alerts = await window.api.getAlerts(30);
    document.getElementById('stat-alerts').textContent = alerts.length;
    document.getElementById('alert-badge').textContent = alerts.length;
    document.getElementById('alert-badge').style.display = alerts.length > 0 ? 'inline' : 'none';

    // Trend chart
    renderTrendChart(stats.days);

    // Pie chart
    renderPieChart(stats.top10);

    // Recent alerts
    renderDashboardAlerts(alerts.slice(0, 5));
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderTrendChart(days) {
  const ctx = document.getElementById('trend-chart');
  if (!ctx) return;
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days.map(d => d.label),
      datasets: [
        {
          label: '入库',
          data: days.map(d => d.inQty),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true, tension: 0.3, pointRadius: 2,
        },
        {
          label: '出库',
          data: days.map(d => d.outQty),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          fill: true, tension: 0.3, pointRadius: 2,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true }, x: { ticks: { maxRotation: 45, font: { size: 10 } } } }
    }
  });
}

function renderPieChart(top10) {
  const ctx = document.getElementById('pie-chart');
  if (!ctx) return;
  if (pieChart) pieChart.destroy();

  const data = top10.filter(x => x.stock > 0);
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(x => x.name.length > 10 ? x.name.substring(0, 10) + '...' : x.name),
      datasets: [{
        data: data.map(x => x.stock),
        backgroundColor: [
          '#4f6ef7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
          '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'
        ],
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } }
    }
  });
}

function renderDashboardAlerts(alerts) {
  const tbody = document.getElementById('dashboard-alerts-body');
  if (!alerts.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">暂无预警</td></tr>';
    return;
  }
  const today = todayStr();
  tbody.innerHTML = alerts.map(a => {
    const days = daysBetween(today, a.expiry_date);
    const tagClass = days < 0 ? 'tag-danger' : 'tag-warning';
    const statusText = days < 0 ? '已过期' : `${days}天后到期`;
    return `<tr>
      <td>${a.product_name}</td><td>${a.spec}</td><td>${a.quantity}${a.unit}</td>
      <td>${formatDate(a.expiry_date)}</td><td><span class="tag ${tagClass}">${statusText}</span></td>
    </tr>`;
  }).join('');
}

// ===== Inventory =====
async function loadInventory() {
  // Ensure PRODUCTS is loaded for autocomplete
  if (PRODUCTS.length === 0) {
    try { PRODUCTS = await window.api.getProducts(); } catch (e) { /* ignore */ }
  }
  // Update alert badge count
  try {
    const alerts = await window.api.getAlerts(30);
    const badge = document.getElementById('alert-badge');
    if (badge) {
      badge.textContent = alerts.length;
      badge.style.display = alerts.length > 0 ? 'inline' : 'none';
    }
  } catch (e) { /* ignore */ }
}

function switchInvTab(tabId) {
  document.querySelectorAll('#page-inventory .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('#page-inventory .tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));
  if (tabId === 'inv-alerts') loadAlerts();
}

// Inventory search autocomplete
(function() {
  const searchInput = document.getElementById('inv-search-input');
  const dropdown = document.getElementById('inv-search-dropdown');
  if (!searchInput || !dropdown) return;

  let searchIndex = -1;

  searchInput.addEventListener('input', () => {
    const keyword = searchInput.value.trim();
    if (keyword.length < 1) { dropdown.style.display = 'none'; return; }

    const results = PRODUCTS.filter(p => p.name.toLowerCase().includes(keyword.toLowerCase()));
    if (results.length === 0) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = results.map((item, idx) => `
      <div class="autocomplete-item" data-index="${idx}" data-id="${item.id}" data-name="${item.name}">
        <span class="item-name">${item.name}</span>
        <span class="item-spec">${item.spec || ''} | ${item.unit || ''}</span>
      </div>
    `).join('');
    dropdown.style.display = 'block';
    searchIndex = -1;

    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectInvProduct(item);
      });
    });
  });

  searchInput.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (e.key === 'ArrowDown' && items.length && dropdown.style.display === 'block') {
      e.preventDefault();
      searchIndex = Math.min(searchIndex + 1, items.length - 1);
      updateHighlight(items);
    } else if (e.key === 'ArrowUp' && items.length && dropdown.style.display === 'block') {
      e.preventDefault();
      searchIndex = Math.max(searchIndex - 1, 0);
      updateHighlight(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // If an item is highlighted in dropdown, select it
      if (searchIndex >= 0 && items[searchIndex]) {
        selectInvProduct(items[searchIndex]);
      } else {
        // Otherwise try to match the input value directly
        searchByExactName(searchInput.value.trim());
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  });

  searchInput.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 200));

  async function searchByExactName(name) {
    if (!name) return;
    dropdown.style.display = 'none';
    // Try exact match first, then partial
    let product = PRODUCTS.find(p => p.name === name);
    if (!product) product = PRODUCTS.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!product) product = PRODUCTS.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
    if (!product) {
      document.getElementById('inv-search-hint').textContent = '未找到匹配的材料';
      document.getElementById('inv-detail').style.display = 'none';
      return;
    }
    searchInput.value = product.name;
    try {
      const detail = await window.api.getProductStockDetail(
        product.id,
        APP_SETTINGS.inv_inbound_limit || 5,
        APP_SETTINGS.inv_outbound_limit || 10
      );
      if (!detail) return;
      renderInvDetail(detail);
    } catch (err) {
      console.error('Stock detail error:', err);
    }
  }

  function updateHighlight(items) {
    items.forEach((item, idx) => item.classList.toggle('active', idx === searchIndex));
    if (searchIndex >= 0 && items[searchIndex]) items[searchIndex].scrollIntoView({ block: 'nearest' });
  }

  async function selectInvProduct(item) {
    const productId = parseInt(item.dataset.id);
    searchInput.value = item.dataset.name;
    dropdown.style.display = 'none';

    try {
      const detail = await window.api.getProductStockDetail(
        productId,
        APP_SETTINGS.inv_inbound_limit || 5,
        APP_SETTINGS.inv_outbound_limit || 10
      );
      if (!detail) return;
      renderInvDetail(detail);
    } catch (err) {
      console.error('Stock detail error:', err);
    }
  }
})();

function renderInvDetail(detail) {
  const container = document.getElementById('inv-detail');
  container.style.display = 'block';
  document.getElementById('inv-search-hint').textContent = '';

  const { product, stock, prevStock, totalIn, totalOut, monthIn, monthOut, recentInbound, recentOutbound } = detail;

  // Stats
  document.getElementById('inv-prev-stock').textContent = prevStock;
  document.getElementById('inv-month-in').textContent = monthIn;
  document.getElementById('inv-month-out').textContent = monthOut;
  document.getElementById('inv-stock').textContent = stock;

  const statusEl = document.getElementById('inv-status');
  if (stock === 0) { statusEl.textContent = '缺货'; statusEl.style.color = 'var(--danger)'; }
  else if (stock < 5) { statusEl.textContent = '偏低'; statusEl.style.color = 'var(--warning)'; }
  else { statusEl.textContent = '正常'; statusEl.style.color = 'var(--success)'; }

  // Product info bar
  document.getElementById('inv-p-name').textContent = product.name;
  document.getElementById('inv-p-spec').textContent = product.spec || '-';
  document.getElementById('inv-p-unit').textContent = product.unit || '-';
  document.getElementById('inv-total-in').textContent = totalIn;
  document.getElementById('inv-total-out').textContent = totalOut;
  document.getElementById('inv-net-in').textContent = totalIn - totalOut;

  // Inbound records
  document.getElementById('inv-inbound-count').textContent = recentInbound.length;
  document.getElementById('inv-inbound-body').innerHTML = recentInbound.length === 0
    ? '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:16px;">暂无入库记录</td></tr>'
    : recentInbound.map(r => `<tr>
        <td>${formatDate(r.date)}</td><td>${r.quantity}</td>
        <td>${formatDate(r.production_date)}</td><td>${formatDate(r.expiry_date)}</td>
        <td>${r.remark || ''}</td>
      </tr>`).join('');

  // Outbound records
  document.getElementById('inv-outbound-count').textContent = recentOutbound.length;
  document.getElementById('inv-outbound-body').innerHTML = recentOutbound.length === 0
    ? '<tr><td colspan="3" class="text-muted" style="text-align:center;padding:16px;">暂无出库记录</td></tr>'
    : recentOutbound.map(r => `<tr>
        <td>${formatDate(r.date)}</td><td>${r.quantity}</td>
        <td>${r.recipient || ''}</td>
      </tr>`).join('');
}

// ===== Products =====
async function loadProducts(filter = '') {
  try {
    PRODUCTS = await window.api.getAllProducts();
    renderProductTable(filter);
  } catch (err) {
    console.error('Products load error:', err);
  }
}

function renderProductTable(filter = '') {
  const tbody = document.getElementById('products-body');
  const filtered = PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  tbody.innerHTML = filtered.map((p, i) => `
    <tr>
      <td><input type="checkbox" class="prod-cb" data-id="${p.id}" ${selectedProductIds.has(p.id) ? 'checked' : ''} onchange="toggleProductSelect(${p.id}, this.checked)"></td>
      <td>${i + 1}</td><td>${p.name}</td><td>${p.spec}</td><td>${p.unit}</td>
      <td>${p.shelf_months}</td><td>${p.shelf_days}</td>
      <td>
        <button class="btn btn-sm" onclick="editProduct(${p.id})">编辑</button>
        <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteProduct(${p.id})">删除</button>
      </td>
    </tr>
  `).join('');

  updateSelectAllCheckbox();
  updateProductActionButtons();
}

function toggleProductSelect(id, checked) {
  if (checked) selectedProductIds.add(id); else selectedProductIds.delete(id);
  updateSelectAllCheckbox();
  updateProductActionButtons();
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.prod-cb').forEach(cb => {
    const id = parseInt(cb.dataset.id);
    cb.checked = checked;
    if (checked) selectedProductIds.add(id); else selectedProductIds.delete(id);
  });
  updateProductActionButtons();
}

function updateSelectAllCheckbox() {
  const selectAll = document.getElementById('select-all-products');
  if (!selectAll) return;
  const cbs = document.querySelectorAll('.prod-cb');
  const checked = document.querySelectorAll('.prod-cb:checked').length;
  selectAll.checked = cbs.length > 0 && checked === cbs.length;
  selectAll.indeterminate = checked > 0 && checked < cbs.length;
}

function updateProductActionButtons() {
  const btn = document.getElementById('btn-batch-delete');
  if (btn) {
    btn.style.display = selectedProductIds.size > 0 ? 'inline-flex' : 'none';
    btn.textContent = `🗑 删除选中 (${selectedProductIds.size})`;
  }
}

document.getElementById('prod-search').addEventListener('input', (e) => {
  renderProductTable(e.target.value);
});

function showAddProduct() {
  openModal('新增产品', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>材料名称</label><input type="text" class="form-control" id="np-name" placeholder="请输入材料名称"></div>
      <div class="form-group"><label>规格</label><input type="text" class="form-control" id="np-spec" placeholder="如: 500克/瓶"></div>
      <div class="form-group"><label>单位</label><input type="text" class="form-control" id="np-unit" placeholder="如: 瓶、包、桶"></div>
      <div class="form-group"><label>保质期(月)</label><input type="number" class="form-control" id="np-months" min="0" value="0" onchange="document.getElementById('np-days').value=this.value*30"></div>
      <div class="form-group"><label>保质期(日)</label><input type="number" class="form-control" id="np-days" min="0" value="0" placeholder="填写月数自动换算"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddProduct()">保存</button>
  `);
}

async function doAddProduct() {
  const name = document.getElementById('np-name').value.trim();
  const unit = document.getElementById('np-unit').value.trim();
  if (!name || !unit) { showToast('名称和单位必填', 'error'); return; }
  await window.api.addProduct({
    name, spec: document.getElementById('np-spec').value.trim(), unit,
    shelf_months: parseInt(document.getElementById('np-months').value) || 0,
    shelf_days: parseInt(document.getElementById('np-days').value) || 0,
  });
  closeModal();
  showToast('产品已添加');
  loadProducts();
  refreshProductSelects();
}

function editProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  openModal('编辑产品', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>材料名称</label><input type="text" class="form-control" id="ep-name" value="${p.name}"></div>
      <div class="form-group"><label>规格</label><input type="text" class="form-control" id="ep-spec" value="${p.spec}"></div>
      <div class="form-group"><label>单位</label><input type="text" class="form-control" id="ep-unit" value="${p.unit}"></div>
      <div class="form-group"><label>保质期(月)</label><input type="number" class="form-control" id="ep-months" value="${p.shelf_months}" onchange="document.getElementById('ep-days').value=this.value*30"></div>
      <div class="form-group"><label>保质期(日)</label><input type="number" class="form-control" id="ep-days" value="${p.shelf_days}" placeholder="填写月数自动换算"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doEditProduct(${id})">保存</button>
  `);
}

async function doEditProduct(id) {
  const name = document.getElementById('ep-name').value.trim();
  const unit = document.getElementById('ep-unit').value.trim();
  if (!name || !unit) { showToast('名称和单位必填', 'error'); return; }
  try {
    await window.api.updateProduct(id, {
      name, spec: document.getElementById('ep-spec').value.trim(), unit,
      shelf_months: parseInt(document.getElementById('ep-months').value) || 0,
      shelf_days: parseInt(document.getElementById('ep-days').value) || 0,
    });
    closeModal();
    showToast('已保存');
    loadProducts();
    refreshProductSelects();
  } catch (err) {
    console.error('Edit product error:', err);
    showToast('保存失败: ' + (err.message || err), 'error');
  }
}

function deleteProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  openModal('确认删除', `
    <p>确定要删除 <strong>${p.name}</strong> 吗？</p>
    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">历史入出库记录仍会保留。</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doDeleteProduct(${id})">确认删除</button>
  `);
}

async function doDeleteProduct(id) {
  await window.api.deleteProduct(id);
  selectedProductIds.delete(id);
  closeModal();
  showToast('产品已删除');
  loadProducts();
  refreshProductSelects();
}

function batchDeleteProducts() {
  if (selectedProductIds.size === 0) return;
  openModal('批量删除', `
    <p>确定要删除选中的 <strong>${selectedProductIds.size}</strong> 个产品吗？</p>
    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">历史入出库记录仍会保留。</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doBatchDelete()">确认删除</button>
  `);
}

async function doBatchDelete() {
  const ids = Array.from(selectedProductIds);
  await window.api.batchDeleteProducts(ids);
  const count = ids.length;
  selectedProductIds.clear();
  closeModal();
  showToast(`已删除 ${count} 个产品`);
  loadProducts();
  refreshProductSelects();
}

// ===== Product Select Helper =====
async function refreshProductSelects() {
  try {
    PRODUCTS = await window.api.getProducts();
    populateProductSelect('in-product');
    populateProductSelect('out-product');
  } catch (err) {
    console.error('Refresh selects error:', err);
  }
}

function populateProductSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">请选择材料...</option>' +
    PRODUCTS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

// ===== Inbound Table =====
let inboundInitialized = false;

function initInboundPage() {
  const tbody = document.getElementById('inbound-tbody');
  if (!inboundInitialized) {
    addInboundRows(APP_SETTINGS.inbound_rows);
    inboundInitialized = true;
  }
  loadRecentInbound();
}

function addInboundRows(count = 5) {
  const tbody = document.getElementById('inbound-tbody');
  const existingRows = tbody.querySelectorAll('tr').length;
  const today = todayStr();

  for (let i = 0; i < count; i++) {
    const rowNum = existingRows + i + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="row-num">${rowNum}</td>
      <td style="position:relative;">
        <input type="text" class="cell-input cell-editable" value="" data-field="product_name" autocomplete="off" placeholder="输入品名...">
        <div class="autocomplete-dropdown" style="display:none;"></div>
      </td>
      <td><input type="text" class="cell-input" value="" data-field="spec" readonly tabindex="-1"></td>
      <td><input type="number" class="cell-input cell-editable" value="" data-field="quantity" placeholder="0"></td>
      <td><input type="text" class="cell-input" value="" data-field="unit" readonly tabindex="-1"></td>
      <td><input type="date" class="cell-input cell-editable" value="${today}" data-field="date"></td>
      <td><input type="date" class="cell-input cell-editable" value="" data-field="production_date"></td>
      <td><input type="date" class="cell-input" value="" data-field="expiry_date" readonly tabindex="-1"></td>
      <td><input type="text" class="cell-input cell-editable" value="" data-field="remark" placeholder="可选"></td>
      <td><button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="removeInboundRow(this)">×</button></td>
    `;
    tbody.appendChild(tr);

    // Bind events
    bindInboundRowEvents(tr);
  }
}

function appendInboundRow(tbody) {
  const existingRows = tbody.querySelectorAll('tr').length;
  const today = todayStr();
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num">${existingRows + 1}</td>
    <td style="position:relative;">
      <input type="text" class="cell-input cell-editable" value="" data-field="product_name" autocomplete="off" placeholder="输入品名...">
      <div class="autocomplete-dropdown" style="display:none;"></div>
    </td>
    <td><input type="text" class="cell-input" value="" data-field="spec" readonly tabindex="-1"></td>
    <td><input type="number" class="cell-input cell-editable" value="" data-field="quantity" placeholder="0"></td>
    <td><input type="text" class="cell-input" value="" data-field="unit" readonly tabindex="-1"></td>
    <td><input type="date" class="cell-input cell-editable" value="${today}" data-field="date"></td>
    <td><input type="date" class="cell-input cell-editable" value="" data-field="production_date"></td>
    <td><input type="date" class="cell-input" value="" data-field="expiry_date" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input cell-editable" value="" data-field="remark" placeholder="可选"></td>
    <td><button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="removeInboundRow(this)">×</button></td>
  `;
  tbody.appendChild(tr);
  bindInboundRowEvents(tr);
  return tr;
}

function removeInboundRow(btn) {
  const tr = btn.closest('tr');
  tr.remove();
  renumberRows('inbound-tbody');
}

function renumberRows(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  tbody.querySelectorAll('tr').forEach((tr, idx) => {
    tr.querySelector('.row-num').textContent = idx + 1;
  });
}

function bindInboundRowEvents(tr) {
  const tbody = document.getElementById('inbound-tbody');
  bindTableRowEvents(tr, tbody, {
    onSelect: selectInboundProduct,
    onAutocomplete: handleInboundProductAutocomplete,
    onProductSelect: selectInboundProduct,
    onAppendRow: appendInboundRow,
  });
  // production_date change 触发到期日计算
  const prodInput = tr.querySelector('[data-field="production_date"]');
  if (prodInput) prodInput.addEventListener('change', () => calcRowExpiry(tr));
}

function handleInboundProductAutocomplete(input) {
  const keyword = input.value.trim();
  if (keyword.length < 1) {
    hideAutocomplete();
    return;
  }

  const td = input.closest('td');
  const dropdown = td.querySelector('.autocomplete-dropdown');
  if (!dropdown) return;

  const results = PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(keyword.toLowerCase())
  );

  if (results.length === 0) {
    hideAutocomplete();
    return;
  }

  dropdown.innerHTML = results.map((item, idx) => `
    <div class="autocomplete-item" data-index="${idx}" data-id="${item.id}" data-name="${item.name}" data-spec="${item.spec || ''}" data-unit="${item.unit || ''}" data-shelf-days="${item.shelf_days || 0}">
      <span class="item-name">${item.name}</span>
      <span class="item-spec">${item.spec || ''} | ${item.unit || ''}</span>
    </div>
  `).join('');

  dropdown.style.display = 'block';
  autocompleteIndex = -1;

  dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectInboundProduct(input, item);
    });
  });
}

function selectInboundProduct(input, item) {
  const tr = input.closest('tr');
  tr.querySelector('[data-field="product_name"]').value = item.dataset.name;
  tr.querySelector('[data-field="spec"]').value = item.dataset.spec;
  tr.querySelector('[data-field="unit"]').value = item.dataset.unit;
  tr.dataset.productId = item.dataset.id;
  tr.dataset.shelfDays = item.dataset.shelfDays;
  hideAutocomplete();
  calcRowExpiry(tr);

  // Move focus to quantity
  const qtyInput = tr.querySelector('[data-field="quantity"]');
  if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
}

function calcRowExpiry(tr) {
  const prodDate = tr.querySelector('[data-field="production_date"]').value;
  const shelfDays = parseInt(tr.dataset.shelfDays) || 0;
  const expiryInput = tr.querySelector('[data-field="expiry_date"]');
  if (prodDate && shelfDays > 0) {
    const d = new Date(prodDate);
    d.setDate(d.getDate() + shelfDays);
    expiryInput.value = toLocalDateStr(d);
  } else {
    expiryInput.value = '';
  }
}

async function submitInboundBatch() {
  const tbody = document.getElementById('inbound-tbody');
  const rows = tbody.querySelectorAll('tr');
  const records = [];

  for (const tr of rows) {
    const name = tr.querySelector('[data-field="product_name"]').value.trim();
    const qty = parseFloat(tr.querySelector('[data-field="quantity"]').value);
    const date = tr.querySelector('[data-field="date"]').value;
    if (!name || !qty || !date) continue;

    const product = PRODUCTS.find(p => p.name === name);
    if (!product) {
      showToast(`产品 "${name}" 不存在`, 'error');
      return;
    }

    records.push({
      product_id: product.id,
      date,
      quantity: qty,
      remark: tr.querySelector('[data-field="remark"]').value.trim(),
      production_date: tr.querySelector('[data-field="production_date"]').value || null,
      expiry_date: tr.querySelector('[data-field="expiry_date"]').value || null,
    });
  }

  if (records.length === 0) {
    showToast('没有有效的入库记录', 'error');
    return;
  }

  for (const r of records) {
    await window.api.addInbound(r);
  }

  showToast(`成功入库 ${records.length} 条记录`);
  tbody.innerHTML = '';
  inboundInitialized = false;
  initInboundPage();
}

async function loadRecentInbound() {
  const card = document.getElementById('recent-inbound')?.closest('.card');
  if (APP_SETTINGS.inbound_history === 'off') {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';
  try {
    const records = await window.api.getInbound({});
    const tbody = document.getElementById('recent-inbound');
    const days = APP_SETTINGS.inbound_history_days;
    tbody.innerHTML = records.slice(0, days).map(r => `
      <tr>
        <td>${formatDate(r.date)}</td><td>${r.product_name}</td>
        <td>${r.quantity}</td><td>${r.unit}</td>
        <td>${formatDate(r.production_date)}</td><td>${formatDate(r.expiry_date)}</td>
        <td>
          <button class="btn btn-sm" onclick='editInbound(${JSON.stringify(r).replace(/'/g, "&#39;")})'>编辑</button>
          <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteInbound(${r.id})">删除</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load recent inbound error:', err);
  }
}

function editInbound(r) {
  openModal('编辑入库记录', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>材料</label><input type="text" class="form-control" value="${r.product_name}" readonly></div>
      <div class="form-group"><label>数量</label><input type="number" class="form-control" id="ei-qty" value="${r.quantity}"></div>
      <div class="form-group"><label>入库日期</label><input type="date" class="form-control" id="ei-date" value="${formatDate(r.date)}"></div>
      <div class="form-group"><label>生产日期</label><input type="date" class="form-control" id="ei-prod" value="${formatDate(r.production_date)}"></div>
      <div class="form-group"><label>到期日</label><input type="date" class="form-control" id="ei-expiry" value="${formatDate(r.expiry_date)}"></div>
      <div class="form-group"><label>备注</label><input type="text" class="form-control" id="ei-remark" value="${r.remark || ''}"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doEditInbound(${r.id})">保存</button>
  `);
}

async function doEditInbound(id) {
  await window.api.updateInbound(id, {
    date: document.getElementById('ei-date').value,
    quantity: parseFloat(document.getElementById('ei-qty').value),
    remark: document.getElementById('ei-remark').value.trim(),
    production_date: document.getElementById('ei-prod').value || null,
    expiry_date: document.getElementById('ei-expiry').value || null,
  });
  closeModal();
  showToast('已更新');
  loadRecentInbound();
}

async function deleteInbound(id) {
  openModal('确认删除', '<p>确定要删除这条入库记录吗？</p>', `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doDeleteInbound(${id})">确认删除</button>
  `);
}

async function doDeleteInbound(id) {
  await window.api.deleteInbound(id);
  closeModal();
  showToast('已删除');
  loadRecentInbound();
}

// ===== Outbound Table =====
let outboundInitialized = false;

function initOutboundPage() {
  const tbody = document.getElementById('outbound-tbody');
  if (!outboundInitialized) {
    addOutboundRows(APP_SETTINGS.outbound_rows);
    outboundInitialized = true;
  }
  loadRecentOutbound();
}

function addOutboundRows(count = 5) {
  const tbody = document.getElementById('outbound-tbody');
  const existingRows = tbody.querySelectorAll('tr').length;
  const today = todayStr();

  for (let i = 0; i < count; i++) {
    const rowNum = existingRows + i + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="row-num">${rowNum}</td>
      <td style="position:relative;">
        <input type="text" class="cell-input cell-editable" value="" data-field="product_name" autocomplete="off" placeholder="输入品名...">
        <div class="autocomplete-dropdown" style="display:none;"></div>
      </td>
      <td><input type="text" class="cell-input" value="" data-field="spec" readonly tabindex="-1"></td>
      <td><input type="number" class="cell-input cell-editable" value="" data-field="quantity" placeholder="0"></td>
      <td><input type="text" class="cell-input" value="" data-field="unit" readonly tabindex="-1"></td>
      <td><input type="text" class="cell-input" value="" data-field="stock" readonly tabindex="-1"></td>
      <td><input type="date" class="cell-input cell-editable" value="${today}" data-field="date"></td>
      <td>
        <select class="cell-input cell-editable" data-field="recipient">
          <option value="">选择...</option>
          ${RECIPIENTS.map(r => `<option value="${r.name}">${r.name}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="removeOutboundRow(this)">×</button></td>
    `;
    tbody.appendChild(tr);

    bindOutboundRowEvents(tr);
  }
}

function appendOutboundRow(tbody) {
  const existingRows = tbody.querySelectorAll('tr').length;
  const today = todayStr();
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num">${existingRows + 1}</td>
    <td style="position:relative;">
      <input type="text" class="cell-input cell-editable" value="" data-field="product_name" autocomplete="off" placeholder="输入品名...">
      <div class="autocomplete-dropdown" style="display:none;"></div>
    </td>
    <td><input type="text" class="cell-input" value="" data-field="spec" readonly tabindex="-1"></td>
    <td><input type="number" class="cell-input cell-editable" value="" data-field="quantity" placeholder="0"></td>
    <td><input type="text" class="cell-input" value="" data-field="unit" readonly tabindex="-1"></td>
    <td><input type="text" class="cell-input" value="" data-field="stock" readonly tabindex="-1"></td>
    <td><input type="date" class="cell-input cell-editable" value="${today}" data-field="date"></td>
    <td>
      <select class="cell-input cell-editable" data-field="recipient">
        <option value="">选择...</option>
        ${RECIPIENTS.map(r => `<option value="${r.name}">${r.name}</option>`).join('')}
      </select>
    </td>
    <td><button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="removeOutboundRow(this)">×</button></td>
  `;
  tbody.appendChild(tr);
  bindOutboundRowEvents(tr);
  return tr;
}

function removeOutboundRow(btn) {
  const tr = btn.closest('tr');
  tr.remove();
  renumberRows('outbound-tbody');
}

function bindOutboundRowEvents(tr) {
  const tbody = document.getElementById('outbound-tbody');
  bindTableRowEvents(tr, tbody, {
    onSelect: selectOutboundProduct,
    onAutocomplete: handleOutboundProductAutocomplete,
    onProductSelect: selectOutboundProduct,
    onAppendRow: appendOutboundRow,
  });
}

async function handleOutboundProductAutocomplete(input) {
  const keyword = input.value.trim();
  if (keyword.length < 1) {
    hideAutocomplete();
    return;
  }

  const td = input.closest('td');
  const dropdown = td.querySelector('.autocomplete-dropdown');
  if (!dropdown) return;

  const inventory = await window.api.getInventory();
  const results = inventory.filter(p =>
    p.name.toLowerCase().includes(keyword.toLowerCase()) && p.stock > 0
  );

  if (results.length === 0) {
    hideAutocomplete();
    return;
  }

  dropdown.innerHTML = results.map((item, idx) => `
    <div class="autocomplete-item" data-index="${idx}" data-id="${item.id}" data-name="${item.name}" data-spec="${item.spec || ''}" data-unit="${item.unit || ''}" data-stock="${item.stock}">
      <span class="item-name">${item.name}</span>
      <span class="item-spec">${item.spec || ''} | 库存: ${item.stock} ${item.unit || ''}</span>
    </div>
  `).join('');

  dropdown.style.display = 'block';
  autocompleteIndex = -1;

  dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectOutboundProduct(input, item);
    });
  });
}

function selectOutboundProduct(input, item) {
  const tr = input.closest('tr');
  tr.querySelector('[data-field="product_name"]').value = item.dataset.name;
  tr.querySelector('[data-field="spec"]').value = item.dataset.spec;
  tr.querySelector('[data-field="unit"]').value = item.dataset.unit;
  tr.querySelector('[data-field="stock"]').value = item.dataset.stock;
  tr.dataset.productId = item.dataset.id;
  hideAutocomplete();

  const qtyInput = tr.querySelector('[data-field="quantity"]');
  if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
}

async function submitOutboundBatch() {
  const tbody = document.getElementById('outbound-tbody');
  const rows = tbody.querySelectorAll('tr');
  const records = [];
  const inventory = await window.api.getInventory();

  for (const tr of rows) {
    const name = tr.querySelector('[data-field="product_name"]').value.trim();
    const qty = parseFloat(tr.querySelector('[data-field="quantity"]').value);
    const date = tr.querySelector('[data-field="date"]').value;
    const recipient = tr.querySelector('[data-field="recipient"]').value;
    if (!name || !qty || !date || !recipient) continue;

    const product = PRODUCTS.find(p => p.name === name);
    if (!product) {
      showToast(`产品 "${name}" 不存在`, 'error');
      return;
    }

    const inv = inventory.find(x => x.id === product.id);
    if (inv && qty > inv.stock) {
      showToast(`${name} 库存不足！当前库存: ${inv.stock}`, 'error');
      return;
    }

    records.push({
      product_id: product.id,
      date,
      quantity: qty,
      recipient,
    });
  }

  if (records.length === 0) {
    showToast('没有有效的出库记录', 'error');
    return;
  }

  for (const r of records) {
    await window.api.addOutbound(r);
  }

  showToast(`成功出库 ${records.length} 条记录`);
  tbody.innerHTML = '';
  outboundInitialized = false;
  initOutboundPage();
}

async function loadRecentOutbound() {
  const card = document.getElementById('recent-outbound')?.closest('.card');
  if (APP_SETTINGS.outbound_history === 'off') {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';
  try {
    const records = await window.api.getOutbound({});
    const tbody = document.getElementById('recent-outbound');
    const days = APP_SETTINGS.outbound_history_days;
    tbody.innerHTML = records.slice(0, days).map(r => `
      <tr>
        <td>${formatDate(r.date)}</td><td>${r.product_name}</td>
        <td>${r.quantity}</td><td>${r.unit}</td><td>${r.recipient}</td>
        <td>
          <button class="btn btn-sm" onclick='editOutbound(${JSON.stringify(r).replace(/'/g, "&#39;")})'>编辑</button>
          <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteOutbound(${r.id})">删除</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load recent outbound error:', err);
  }
}

function editOutbound(r) {
  openModal('编辑出库记录', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>材料</label><input type="text" class="form-control" value="${r.product_name}" readonly></div>
      <div class="form-group"><label>数量</label><input type="number" class="form-control" id="eo-qty" value="${r.quantity}"></div>
      <div class="form-group"><label>出库日期</label><input type="date" class="form-control" id="eo-date" value="${formatDate(r.date)}"></div>
      <div class="form-group"><label>领取人</label><input type="text" class="form-control" id="eo-recipient" value="${r.recipient}"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doEditOutbound(${r.id})">保存</button>
  `);
}

async function doEditOutbound(id) {
  await window.api.updateOutbound(id, {
    date: document.getElementById('eo-date').value,
    quantity: parseFloat(document.getElementById('eo-qty').value),
    recipient: document.getElementById('eo-recipient').value.trim(),
  });
  closeModal();
  showToast('已更新');
  loadRecentOutbound();
}

async function deleteOutbound(id) {
  openModal('确认删除', '<p>确定要删除这条出库记录吗？</p>', `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doDeleteOutbound(${id})">确认删除</button>
  `);
}

async function doDeleteOutbound(id) {
  await window.api.deleteOutbound(id);
  closeModal();
  showToast('已删除');
  loadRecentOutbound();
}

async function addRecipient() {
  openModal('新增领取人', `
    <div class="form-group"><label>领取人名称</label><input type="text" class="form-control" id="new-recipient-name" placeholder="请输入名称"></div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddRecipient()">添加</button>
  `);
}

async function doAddRecipient() {
  const name = document.getElementById('new-recipient-name').value.trim();
  if (!name) return;
  await window.api.addRecipient(name);
  await refreshRecipientSelects();
  closeModal();
  showToast(`已添加: ${name}`);
}

async function refreshRecipientSelects() {
  RECIPIENTS = await window.api.getRecipients();
  // Refresh all recipient selects in outbound table
  document.querySelectorAll('#outbound-tbody select[data-field="recipient"]').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = '<option value="">选择...</option>' +
      RECIPIENTS.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    sel.value = val;
  });
}

async function loadRecipientSelect() {
  try {
    RECIPIENTS = await window.api.getRecipients();
  } catch (err) {
    console.error('Load recipients error:', err);
  }
}

// ===== Ledger =====
async function loadLedger() {
  try {
    const year = parseInt(document.getElementById('ledger-year').value);
    const month = parseInt(document.getElementById('ledger-month').value);
    const data = await window.api.getInventoryByMonth(year, month);

    const tbody = document.getElementById('ledger-body');
    const daysInMonth = new Date(year, month, 0).getDate();

    // Filter: only show products with activity or stock
    const active = data.filter(p => p.hasActivity);

    if (active.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${7 + daysInMonth}" style="text-align:center;padding:40px;color:var(--text-muted);">本月无活跃产品数据</td></tr>`;
      return;
    }

    tbody.innerHTML = active.map((p, idx) => {
      const dayCells = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayData = p.daily[d] || { in: 0, out: 0 };
        const inHtml = dayData.in > 0 ? `<span class="in-val">${dayData.in}</span>` : '';
        const outHtml = dayData.out > 0 ? `<span class="out-val">${dayData.out}</span>` : '';
        const sep = dayData.in > 0 && dayData.out > 0 ? '<span class="sep">/</span>' : '';
        dayCells.push(`<td class="ledger-day-cell">${inHtml}${sep}${outHtml}</td>`);
      }

      return `
        <tr class="ledger-row-expandable" onclick="toggleLedgerDetail(${idx})">
          <td class="sticky-col col-idx">${idx + 1}</td>
          <td class="sticky-col col-name">${p.name}</td>
          <td class="sticky-col col-unit">${p.unit}</td>
          <td>${p.prevStock}</td>
          <td>${p.monthIn}</td>
          <td>${p.monthOut}</td>
          <td><strong>${p.currentStock}</strong></td>
          ${dayCells.join('')}
        </tr>
        <tr class="ledger-detail-row" id="ledger-detail-${idx}">
          <td colspan="${7 + daysInMonth}" class="ledger-detail-cell">
            <div style="padding:10px;">
              <strong>${p.name}</strong> - ${year}年${month}月明细
              <div style="margin-top:8px;font-size:13px;color:#64748b;">
                上月结存: ${p.prevStock} | 本月入库: ${p.monthIn} | 本月出库: ${p.monthOut} | 当前库存: ${p.currentStock}
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Ledger load error:', err);
  }
}

function toggleLedgerDetail(idx) {
  const row = document.getElementById(`ledger-detail-${idx}`);
  if (row) row.classList.toggle('show');
}

document.getElementById('ledger-year').addEventListener('change', loadLedger);
document.getElementById('ledger-month').addEventListener('change', loadLedger);

// ===== Alerts =====
async function loadAlerts() {
  try {
    const alerts = await window.api.getAlerts(60);
    const today = todayStr();
    const tbody = document.getElementById('alerts-body');

    let expired = 0, soon = 0, upcoming = 0;
    alerts.forEach(a => {
      const days = daysBetween(today, a.expiry_date);
      if (days < 0) expired++;
      else if (days <= 30) soon++;
      else upcoming++;
    });

    document.getElementById('alert-expired-count').textContent = expired;
    document.getElementById('alert-soon-count').textContent = soon;
    document.getElementById('alert-upcoming-count').textContent = upcoming;

    const filter = document.getElementById('alert-filter').value;
    const filtered = alerts.filter(a => {
      const days = daysBetween(today, a.expiry_date);
      if (filter === 'expired') return days < 0;
      if (filter === 'soon') return days >= 0 && days <= 30;
      return true;
    });

    tbody.innerHTML = filtered.map(a => {
      const days = daysBetween(today, a.expiry_date);
      const tagClass = days < 0 ? 'tag-danger' : days <= 30 ? 'tag-warning' : 'tag-info';
      const statusText = days < 0 ? '已过期' : days <= 30 ? '即将到期' : '临期';
      return `<tr>
        <td>${a.product_name}</td><td>${a.spec}</td><td>${a.quantity}${a.unit}</td>
        <td>${formatDate(a.production_date)}</td><td>${formatDate(a.expiry_date)}</td>
        <td>${days < 0 ? days + '天' : days + '天'}</td>
        <td><span class="tag ${tagClass}">${statusText}</span></td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Alerts load error:', err);
  }
}

document.getElementById('alert-filter').addEventListener('change', loadAlerts);

// ===== Import Panel =====
function toggleImportPanel() {
  const panel = document.getElementById('import-panel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ===== Import =====
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelected(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFileSelected(fileInput.files[0]);
});

let pendingImportData = null;

function handleFileSelected(file) {
  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      pendingImportData = { products: [], inbound: [], outbound: [], openingStock: {} };

      // Parse 产品数据
      if (wb.SheetNames.includes('产品数据')) {
        const ws = wb.Sheets['产品数据'];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[1]) continue; // skip empty
          pendingImportData.products.push({
            name: String(row[1] || '').trim(),
            spec: String(row[2] || '').trim(),
            unit: String(row[3] || '').trim(),
            shelfMonths: parseInt(row[4]) || 0,
            shelfDays: parseInt(row[5]) || 0,
          });
        }
      }

      // Parse 台账表 → 提取「上月结存」作为初始库存
      // 台账表格式: 序号, 品名, 单位, 上月结存, 入库, 出库, 当前库存, 1日入, 1日出, ...
      for (const sheetName of wb.SheetNames) {
        if (sheetName.includes('台账')) {
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          // Data starts at row 5 (index 4), columns: 0=序号, 1=品名, 2=单位, 3=上月结存
          for (let i = 4; i < rows.length; i++) {
            const row = rows[i];
            const name = String(row[1] || '').trim();
            const openingStock = parseFloat(row[3]) || 0;
            if (name && openingStock > 0) {
              // Only set if not already set (first ledger found wins)
              if (!pendingImportData.openingStock[name]) {
                pendingImportData.openingStock[name] = openingStock;
              }
            }
          }
          break; // Use first ledger sheet found
        }
      }

      // Parse 入库流水账
      if (wb.SheetNames.includes('入库流水账') && document.getElementById('import-inbound').checked) {
        const ws = wb.Sheets['入库流水账'];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[2]) continue;
          pendingImportData.inbound.push({
            name: String(row[2] || '').trim(),
            date: excelSerialToDate(row[1]),
            quantity: parseFloat(row[4]) || 0,
            remark: String(row[6] || '').trim(),
            productionDate: excelSerialToDate(row[7]),
            expiryDate: excelSerialToDate(row[8]),
          });
        }
      }

      // Parse 出库流水账
      if (wb.SheetNames.includes('出库流水账') && document.getElementById('import-outbound').checked) {
        const ws = wb.Sheets['出库流水账'];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[2]) continue;
          pendingImportData.outbound.push({
            name: String(row[2] || '').trim(),
            date: excelSerialToDate(row[1]),
            quantity: parseFloat(row[4]) || 0,
            recipient: String(row[6] || '').trim(),
          });
        }
      }

      // Show preview
      const openingCount = Object.keys(pendingImportData.openingStock).length;
      document.getElementById('import-preview').style.display = 'block';
      document.getElementById('import-preview-stats').innerHTML =
        `<span class="tag">产品: ${pendingImportData.products.length}条</span>` +
        `<span class="tag">入库: ${pendingImportData.inbound.length}条</span>` +
        `<span class="tag">出库: ${pendingImportData.outbound.length}条</span>` +
        (openingCount > 0 ? `<span class="tag tag-success">初始库存: ${openingCount}条</span>` : '');
      showToast(`文件已识别: ${file.name}`, 'info');
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    showToast('文件解析失败: ' + err.message, 'error');
  }
}

async function startImport() {
  if (!pendingImportData) return;

  // Default overwrite: clear existing data before importing
  openModal('确认导入', `
    <p>导入将<strong>清空现有数据</strong>后重新导入，此操作不可撤销。</p>
    <p style="margin-top:8px;color:var(--text-secondary);">产品: ${pendingImportData.products.length}条 | 入库: ${pendingImportData.inbound.length}条 | 出库: ${pendingImportData.outbound.length}条</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doStartImport()">确认导入</button>
  `);
}

async function doStartImport() {
  if (!pendingImportData) return;
  closeModal();
  showToast('正在清空并重新导入...', 'info');

  try {
    await window.api.clearAllData();

    const pResult = await window.api.importProducts(pendingImportData.products);
    let msg = `产品: ${pResult.imported}条`;

    if (Object.keys(pendingImportData.openingStock).length > 0) {
      await window.api.importOpeningStock(pendingImportData.openingStock);
      msg += ` | 初始库存: 已设置`;
    }

    if (pendingImportData.inbound.length > 0) {
      const iResult = await window.api.importInbound(pendingImportData.inbound);
      msg += ` | 入库: ${iResult.imported}条`;
    }

    if (pendingImportData.outbound.length > 0) {
      const oResult = await window.api.importOutbound(pendingImportData.outbound);
      msg += ` | 出库: ${oResult.imported}条`;
    }

    showToast('导入完成！' + msg);
    pendingImportData = null;
    document.getElementById('import-preview').style.display = 'none';

    await refreshProductSelects();
    await loadRecentInbound();
    await loadRecentOutbound();
  } catch (err) {
    showToast('导入失败: ' + err.message, 'error');
  }
}

async function clearAndReimport() {
  openModal('确认清空', `
    <p style="color:var(--danger);font-weight:600;">⚠️ 此操作将清空所有产品、入库、出库数据！</p>
    <p style="margin-top:8px;">清空后可重新导入 xlsx 数据。此操作不可撤销。</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doClearAll()">确认清空</button>
  `);
}

async function doClearAll() {
  await window.api.clearAllData();
  closeModal();
  showToast('数据已清空，请重新导入');
  await refreshProductSelects();
}

// ===== Export =====
async function exportInventory() {
  try {
    const filePath = await window.api.saveFile('库存数据.xlsx');
    if (!filePath) return;

    const inventory = await window.api.getInventory();
    const wsData = [['序号', '材料名称', '规格', '单位', '当前库存', '累计入库', '累计出库']];
    inventory.forEach((p, i) => {
      wsData.push([i + 1, p.name, p.spec, p.unit, p.stock, p.total_in, p.total_out]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '库存数据');
    XLSX.writeFile(wb, filePath);
    showToast('导出成功！');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

async function exportLedger() {
  try {
    const year = parseInt(document.getElementById('ledger-year').value);
    const month = parseInt(document.getElementById('ledger-month').value);
    const filePath = await window.api.saveFile(`${year}年${month}月台账表.xlsx`);
    if (!filePath) return;

    const data = await window.api.getInventoryByMonth(year, month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const active = data.filter(p => p.hasActivity);

    // Header
    const header = ['序号', '品名', '单位', '上月结存', '本月入库', '本月出库', '当前库存'];
    for (let d = 1; d <= daysInMonth; d++) header.push(`${d}日入库`, `${d}日出库`);

    const wsData = [header];
    active.forEach((p, i) => {
      const row = [i + 1, p.name, p.unit, p.prevStock, p.monthIn, p.monthOut, p.currentStock];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayData = p.daily[d] || { in: 0, out: 0 };
        row.push(dayData.in || '', dayData.out || '');
      }
      wsData.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, `${year}年${month}月台账`);
    XLSX.writeFile(wb, filePath);
    showToast('导出成功！');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

async function exportAll() {
  try {
    const filePath = await window.api.saveFile('全部数据导出.xlsx');
    if (!filePath) return;

    const products = await window.api.getAllProducts();
    const inbound = await window.api.getInbound({});
    const outbound = await window.api.getOutbound({});

    const wb = XLSX.utils.book_new();

    // Products sheet
    const pData = [['序号', '材料名称', '规格', '单位', '保质期(月)', '保质期(日)']];
    products.forEach((p, i) => pData.push([i + 1, p.name, p.spec, p.unit, p.shelf_months, p.shelf_days]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pData), '产品数据');

    // Inbound sheet
    const iData = [['序号', '入库时间', '材料名称', '规格', '数量', '单位', '备注', '生产日期', '到期日']];
    inbound.forEach((r, i) => iData.push([i + 1, r.date, r.product_name, r.spec, r.quantity, r.unit, r.remark, r.production_date, r.expiry_date]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(iData), '入库流水账');

    // Outbound sheet
    const oData = [['序号', '出库时间', '名称', '规格', '数量', '单位', '领取人']];
    outbound.forEach((r, i) => oData.push([i + 1, r.date, r.product_name, r.spec, r.quantity, r.unit, r.recipient]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(oData), '出库流水账');

    XLSX.writeFile(wb, filePath);
    showToast('导出成功！');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

// ===== Purchase Orders =====
let autocompleteDropdown = null;
let autocompleteIndex = -1;

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
  const isMulti = APP_SETTINGS.xiaosuo_mode === 'on';
  const tabsEl = document.getElementById('multi-canteen-tabs');
  const switchEl = document.getElementById('canteen-switch');
  const multiArea = document.getElementById('multi-canteen-area');
  const lianhuaEl = document.getElementById('purchase-lianhua');
  const kitchenEl = document.getElementById('purchase-kitchen');
  const pastryEl = document.getElementById('purchase-pastry');

  if (isMulti) {
    lianhuaEl.style.display = 'none';
    kitchenEl.style.display = 'none';
    pastryEl.style.display = 'none';
    switchEl.style.display = 'none';
    tabsEl.style.display = 'flex';
    multiArea.style.display = 'block';
    initMultiCanteenMode();
  } else {
    tabsEl.style.display = 'none';
    multiArea.style.display = 'none';
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

function bindTableRowEvents(tr, tbody, options = {}) {
  const { onSelect, onAutocomplete, onProductSelect, onQtyChange, onFieldChange, onAppendRow } = options;
  tr.querySelectorAll('.cell-editable').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (input.dataset.field === 'product_name' && handleAutocompleteKeydown(e, input, onSelect)) return;
      handleCellKeydown(e, input, tbody, onAppendRow);
    });

    if (input.dataset.field === 'product_name' && onAutocomplete && onProductSelect) {
      bindAutocompleteEvents(input, onAutocomplete, onProductSelect);
    }

    if (onFieldChange) input.addEventListener('change', () => onFieldChange(tr));
    if (input.dataset.field === 'quantity' && onQtyChange) input.addEventListener('input', () => onQtyChange(tr));
  });
}

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
  recalcRowAmount(tr);

  // Move focus to quantity field
  const qtyInput = tr.querySelector('[data-field="quantity"]');
  if (qtyInput) {
    qtyInput.focus();
    qtyInput.select();
  }
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
  } else if (e.key === 'Enter' && autocompleteIndex >= 0) {
    e.preventDefault();
    selectFn(input, items[autocompleteIndex]);
    return true;
  } else if (e.key === 'Escape') {
    hideAutocomplete();
    return true;
  }
  return false;
}

// 绑定自动补全的 input/focus/blur 事件
function bindAutocompleteEvents(input, searchFn, selectFn) {
  input.addEventListener('input', () => searchFn(input));
  input.addEventListener('focus', () => searchFn(input));
  input.addEventListener('blur', () => setTimeout(hideAutocomplete, 200));
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

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  // Set today's date on date inputs
  const today = todayStr();
  document.querySelectorAll('input[type="date"]').forEach(input => {
    if (!input.value) input.value = today;
  });

  // Set current month on ledger selector
  const now = new Date();
  document.getElementById('ledger-year').value = now.getFullYear();
  document.getElementById('ledger-month').value = now.getMonth() + 1;

  // Load initial data
  await refreshProductSelects();
  await loadRecipientSelect();
  loadDashboard();
  loadRecentInbound();
  loadRecentOutbound();

  // Load all app settings into cache
  await loadAppSettings();

  // Ctrl+Enter 切换回车导航模式
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      ENTER_MODE = ENTER_MODE === 'next-row' ? 'next-cell' : 'next-row';
      const label = ENTER_MODE === 'next-row' ? '跳到下一行同列' : '跳到下一行首格';
      showToast(`回车导航：${label}`);
      const sel = document.getElementById('setting-enter-mode');
      if (sel) sel.value = ENTER_MODE;
      window.api.setSetting('enter_mode', ENTER_MODE);
    }
  });
});

// ===== 退出前未保存检测 =====
function hasTableData(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return false;
  for (const tr of tbody.querySelectorAll('tr')) {
    const name = tr.querySelector('[data-field="product_name"]');
    if (name && name.value.trim()) return true;
  }
  return false;
}

function hasUnsavedData() {
  return hasTableData('inbound-tbody') || hasTableData('outbound-tbody');
}

function submitCurrentPage() {
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const id = activePage.id;
  if (id === 'page-inbound') submitInboundBatch();
  else if (id === 'page-outbound') submitOutboundBatch();
}

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
          split_qty: 1, // Default 1, user can edit later
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

async function deleteLianhuaItem(id) {
  if (!confirm('确定删除？')) return;
  await window.api.deleteLianhuaItem(id);
  await loadLianhuaItems();
  showManageLianhuaItems();
}

// Show add lianhua date dialog
function showAddLianhuaDate(source) {
  source = source || '联华';
  const tomorrow = getTomorrowStr();
  openModal('选择联华订单日期', `
    <div class="form-group">
      <label>发货日期</label>
      <input type="date" class="form-control" id="new-lianhua-date" value="${tomorrow}">
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddLianhuaDate('${source}')">确定</button>
  `);
}

function doAddLianhuaDate(source) {
  const date = document.getElementById('new-lianhua-date').value;
  if (!date) { showToast('请选择日期', 'error'); return; }
  closeModal();
  addLianhuaDateGroup(date, source);
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
    <td style="white-space:nowrap;"><button class="btn btn-sm" onclick="copyPurchaseRow(this)" title="复制行">📋</button> <button class="btn-delete-row" onclick="deletePurchaseRow(this)">✕</button></td>
  `;
  tbody.appendChild(tr);
  attachLianhuaCellEvents(tr, tbody);
}

function attachLianhuaCellEvents(tr, tbody) {
  bindTableRowEvents(tr, tbody, {
    onSelect: selectLianhuaAutocompleteItem,
    onAutocomplete: handleLianhuaAutocomplete,
    onProductSelect: selectLianhuaAutocompleteItem,
    onQtyChange: (row) => recalcRowAmount(row),
    onFieldChange: () => {},
    onAppendRow: () => {
      const currentCount = tbody.querySelectorAll('tr').length;
      appendLianhuaRow(tbody, currentCount);
    }
  });
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

// Export all purchase orders (3 sheets in one xlsx)
async function exportAllPurchaseOrders() {
  try {
    // 确保联华商品数据已加载
    if (lianhuaItems.length === 0) {
      try { await loadLianhuaItems(); } catch (e) { /* ignore */ }
    }
    const photoFolder = APP_SETTINGS.photo_folder;

    // Helper function to get date from date group
    const getDateFromGroup = (dateGroup) => {
      const label = dateGroup.querySelector('.date-label').textContent;
      return label.replace(' 收货', '').replace(' 发货', '').trim();
    };

    // Helper function to collect rows from date groups
    const collectRows = (source) => {
      const group = document.querySelector(`.purchase-group[data-source="${source}"]`);
      if (!group) return [];

      const dateGroups = group.querySelectorAll('.date-group');
      const allRows = [];

      dateGroups.forEach(dateGroup => {
        const date = getDateFromGroup(dateGroup);
        const rows = dateGroup.querySelectorAll('tbody tr');

        rows.forEach(tr => {
          const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
          const amountText = tr.querySelector('.amount-cell')?.textContent || '0';
          const amount = parseFloat(amountText.replace('¥', '')) || 0;

          const productName = getData('product_name').trim();
          if (!productName) return;

          allRows.push({
            date: date,
            product_name: productName,
            spec: getData('spec'),
            unit_price: parseFloat(getData('unit_price')) || 0,
            quantity: getData('quantity'),
            unit: getData('unit'),
            amount: amount,
            remark: getData('remark')
          });
        });
      });

      return allRows;
    };

    // Look up image paths for rows
    async function resolveImages(rows) {
      if (!photoFolder) return rows.map(() => null);
      const promises = rows.map(row => window.api.findImage(row.product_name, row.spec, photoFolder).catch(() => null));
      return Promise.all(promises);
    }

    // Build sheets array for main process export
    const sheets = [];
    const isMultiCanteenExport = APP_SETTINGS.xiaosuo_mode === 'on';

    if (isMultiCanteenExport) {
      // 多食堂模式：只导出下涯/制杆厂/白南山的数据
      for (const canteen of MULTI_CANTEENS) {
        // 厨房
        const kitchenRows = collectRows(`${canteen}-厨房`);
        if (kitchenRows.length > 0) {
          const images = await resolveImages(kitchenRows);
          sheets.push({
            name: `${canteen}厨房申购单`,
            title: `${canteen}厨房申购单`,
            headers: ['序号', '收货日期', '品名', '规格', '单价', '数量', '单位', '金额', '备注要求', '实物图'],
            rows: kitchenRows.map((row, idx) => ({
              data: [idx + 1, row.date, row.product_name, row.spec, row.unit_price, row.quantity, row.unit, row.amount, row.remark, ''],
              imagePath: images[idx]
            }))
          });
        }
        // 联华
        const lianhuaGroupEl = document.querySelector(`.purchase-group[data-source="${canteen}-联华"]`);
        if (lianhuaGroupEl) {
          for (const dateGroup of lianhuaGroupEl.querySelectorAll('.date-group')) {
            const date = getDateFromGroup(dateGroup);
            const rows = dateGroup.querySelectorAll('tbody tr');
            const lianhuaRows = [];
            rows.forEach(tr => {
              const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
              const amountText = tr.querySelector('.amount-cell')?.textContent || '0';
              const amount = parseFloat(amountText.replace('¥', '')) || 0;
              const productName = getData('product_name').trim();
              if (!productName) return;
              const item = lianhuaItems.find(i => i.name === productName || productName.includes(i.name));
              lianhuaRows.push({
                product_name: productName, unit: getData('unit') || (item ? item.unit : '件'),
                spec: getData('spec') || (item ? item.spec : ''),
                unit_price: parseFloat(getData('unit_price')) || (item ? item.price : 0),
                quantity: parseFloat(getData('quantity')) || 0, amount, code: item ? item.code : '',
                split_qty: item ? item.split_qty : 1, remark: getData('remark')
              });
            });
            if (lianhuaRows.length === 0) continue;
            const images = await resolveImages(lianhuaRows);
            sheets.push({
              name: `${canteen}-${date}`,
              title: `${canteen}联华超市 ${date}`,
              headers: ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注', '实物图'],
              rows: lianhuaRows.map((row, idx) => ({
                data: [idx + 1, canteen, date.replace(/-/g, '.'), row.code, row.product_name, row.unit, row.spec, row.unit_price, row.quantity, row.amount, row.split_qty, row.remark, ''],
                imagePath: images[idx]
              }))
            });
          }
        }
      }
    } else {
      // 普通模式：只导出当前食堂的厨房/面点房 + 联华
      const kitchenSources = [getKitchenSource()];
      if (APP_SETTINGS.show_pastry !== 'off') kitchenSources.push(getPastrySource());

      for (const source of kitchenSources) {
        const rows = collectRows(source);
        if (rows.length === 0) continue;
        const images = await resolveImages(rows);
        sheets.push({
          name: source + '申购单',
          title: source + '申购单',
          headers: ['序号', '收货日期', '品名', '规格', '单价', '数量', '单位', '金额', '备注要求', '实物图'],
          rows: rows.map((row, idx) => ({
            data: [idx + 1, row.date, row.product_name, row.spec, row.unit_price, row.quantity, row.unit, row.amount, row.remark, ''],
            imagePath: images[idx]
          }))
        });
      }

      const lianhuaGroup = document.querySelector('.purchase-group[data-source="联华"]');
      if (lianhuaGroup) {
        for (const dateGroup of lianhuaGroup.querySelectorAll('.date-group')) {
          const date = getDateFromGroup(dateGroup);
          const rows = dateGroup.querySelectorAll('tbody tr');
          const lianhuaRows = [];
          rows.forEach((tr) => {
            const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
            const amountText = tr.querySelector('.amount-cell')?.textContent || '0';
            const amount = parseFloat(amountText.replace('¥', '')) || 0;
            const productName = getData('product_name').trim();
            if (!productName) return;
            const item = lianhuaItems.find(i => i.name === productName || productName.includes(i.name));
            lianhuaRows.push({
              product_name: productName, unit: getData('unit') || (item ? item.unit : '件'),
              spec: getData('spec') || (item ? item.spec : ''),
              unit_price: parseFloat(getData('unit_price')) || (item ? item.price : 0),
              quantity: parseFloat(getData('quantity')) || 0, amount, code: item ? item.code : '',
              split_qty: item ? item.split_qty : 1, remark: getData('remark')
            });
          });
          if (lianhuaRows.length === 0) continue;
          const lianhuaImages = await resolveImages(lianhuaRows);
          sheets.push({
            name: date,
            title: `联华超市 ${date}`,
            headers: ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注', '实物图'],
            rows: lianhuaRows.map((row, idx) => ({
              data: [idx + 1, APP_SETTINGS.current_canteen || '洋安', date.replace(/-/g, '.'), row.code, row.product_name, row.unit, row.spec, row.unit_price, row.quantity, row.amount, row.split_qty, row.remark, ''],
              imagePath: lianhuaImages[idx]
            }))
          });
        }
      }
    }

    if (sheets.length === 0) {
      showToast('没有订单数据', 'error');
      return;
    }

    const now = new Date();
    const month = `${now.getMonth() + 1}月`;
    const mode = isMultiCanteenExport ? '下涯、制杆厂、白南山' : (APP_SETTINGS.canteen_mode || '洋安');
    const defaultName = `${month}${mode}采购单.xlsx`;

    const result = await window.api.exportPurchaseOrder(sheets, defaultName);
    if (result.success) {
      showToast('导出成功！');
    } else if (result.error !== '已取消') {
      showToast('导出失败: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

// ===== Inquiry Management =====
let inquiryData = [];
let prevMonthData = {};

async function initInquiryPage() {
  await loadInquiryMonths();
  await loadInquiryItems();
}

async function loadInquiryMonths() {
  try {
    const months = await window.api.getInquiryMonths();
    const select = document.getElementById('inquiry-month');
    select.innerHTML = '<option value="">请选择月份</option>';

    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.month;
      opt.textContent = m.month;
      select.appendChild(opt);
    });

    // Select the latest month
    if (months.length > 0) {
      select.value = months[0].month;
    }
  } catch (err) {
    console.error('Load inquiry months error:', err);
  }
}

async function loadInquiryItems() {
  const month = document.getElementById('inquiry-month').value;
  const category = document.getElementById('inquiry-category').value;

  if (!month) {
    document.getElementById('inquiry-body').innerHTML =
      '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted);">请先导入鉴证表数据</td></tr>';
    document.getElementById('inquiry-count').textContent = '0 条';
    return;
  }

  try {
    inquiryData = await window.api.getInquiryItems(month, category);

    // Load previous month data for comparison (key: name + spec)
    const prevMonth = getPreviousMonth(month);
    if (prevMonth) {
      const prevItems = await window.api.getInquiryItems(prevMonth);
      prevMonthData = {};
      prevItems.forEach(item => {
        // Use name + spec as key for comparison
        const key = `${item.name}|${item.spec || ''}`;
        prevMonthData[key] = item.price;
      });
    } else {
      prevMonthData = {};
    }

    renderInquiryTable(inquiryData);
  } catch (err) {
    console.error('Load inquiry items error:', err);
  }
}

function getPreviousMonth(month) {
  // month format: "2026-06"
  const [year, mon] = month.split('-').map(Number);
  if (mon === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(mon - 1).padStart(2, '0')}`;
}

function renderInquiryTable(items) {
  const tbody = document.getElementById('inquiry-body');
  const discountSX = parseFloat(document.getElementById('discount-shengxiao').value) || 0.9008;
  const discountYH = parseFloat(document.getElementById('discount-youhong').value) || 0.9058;
  const dec = APP_SETTINGS.price_decimals;
  const factor = Math.pow(10, dec);

  document.getElementById('inquiry-count').textContent = `${items.length} 条`;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--text-muted);">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((item, idx) => {
    const priceSX = item.price ? Math.round(item.price * discountSX * factor) / factor : null;
    const priceYH = item.price ? Math.round(item.price * discountYH * factor) / factor : null;

    // Calculate price change using name + spec as key
    const key = `${item.name}|${item.spec || ''}`;
    const prevPrice = prevMonthData[key];
    let changeHtml = '';
    if (prevPrice && item.price) {
      const diff = Math.round((item.price - prevPrice) * 10) / 10;
      if (diff > 0) {
        changeHtml = `<span class="price-up">↑${diff}</span>`;
      } else if (diff < 0) {
        changeHtml = `<span class="price-down">↓${Math.abs(diff)}</span>`;
      } else {
        changeHtml = '<span class="price-same">-</span>';
      }
    } else if (!prevPrice && item.price) {
      changeHtml = '<span class="price-na">新增</span>';
    } else {
      changeHtml = '<span class="price-na">-</span>';
    }

    const imageCellId = `img-cell-${idx}`;

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.category}</td>
        <td style="text-align:left;">${item.name}</td>
        <td>${item.price ? Number(item.price).toFixed(dec) : '-'}</td>
        <td>${priceSX != null ? priceSX.toFixed(dec) : '-'}</td>
        <td>${priceYH != null ? priceYH.toFixed(dec) : '-'}</td>
        <td>${item.unit || ''}</td>
        <td>${item.spec || ''}</td>
        <td>${changeHtml}</td>
        <td>${item.remark || ''}</td>
        <td id="${imageCellId}" class="image-cell">
          <button class="btn btn-sm btn-image-add" onclick="addInquiryImage(this, '${item.name.replace(/'/g, "\\'")}', '${(item.spec || '').replace(/'/g, "\\'")}')" title="添加图片">📷</button>
        </td>
        <td>
          <button class="btn btn-sm" onclick='copyInquiryItem(${JSON.stringify(item).replace(/'/g, "&#39;")})' title="复制">📋</button>
          <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteInquiryItem(${item.id})" title="删除">✕</button>
        </td>
      </tr>
    `;
  }).join('');

  // Load images asynchronously
  loadInquiryImages(items);
}

async function copyInquiryItem(item) {
  const month = document.getElementById('inquiry-month').value;
  if (!month) { showToast('请先选择月份', 'error'); return; }
  await showAddInquiryItem();
  const nameEl = document.getElementById('new-inquiry-name');
  const catEl = document.getElementById('new-inquiry-category');
  const unitEl = document.getElementById('new-inquiry-unit');
  const specEl = document.getElementById('new-inquiry-spec');
  const priceEl = document.getElementById('new-inquiry-price');
  if (nameEl) nameEl.value = item.name;
  if (catEl) catEl.value = item.category;
  if (unitEl) unitEl.value = item.unit || '';
  if (specEl) specEl.value = item.spec || '';
  if (priceEl && item.price) priceEl.value = item.price;
}

function deleteInquiryItem(id) {
  openModal('确认删除', '<p>确定要删除这条询价记录吗？</p>', `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doDeleteInquiryItem(${id})">确认删除</button>
  `);
}

async function doDeleteInquiryItem(id) {
  try {
    await window.api.deleteInquiryItem(id);
    closeModal();
    showToast('已删除');
    await loadInquiryItems();
  } catch (err) {
    showToast('删除失败: ' + err.message, 'error');
  }
}

async function loadInquiryImages(items) {
  const photoFolder = APP_SETTINGS.photo_folder;
  if (!photoFolder) return;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const cell = document.getElementById(`img-cell-${idx}`);
    if (!cell) continue;

    try {
      const imagePath = await window.api.findImage(item.name, item.spec, photoFolder);
      if (imagePath) {
        const imgUrl = 'file:///' + imagePath.replace(/\\/g, '/');
        cell.innerHTML = `<img src="${imgUrl}" class="inquiry-thumb" onclick="viewImage(this.src)" title="点击查看大图">`;
      }
    } catch (err) {
      console.error('Load image error:', err);
    }
  }
}

async function addInquiryImage(btn, name, spec) {
  const photoFolder = APP_SETTINGS.photo_folder;
  if (!photoFolder) {
    showToast('请先在设置中配置照片文件夹路径', 'error');
    return;
  }

  const result = await window.api.addImage(name, spec, photoFolder);
  if (result.success) {
    showToast('图片添加成功');
    const cell = btn.closest('td');
    if (cell) {
      const imgUrl = 'file:///' + result.path.replace(/\\/g, '/');
      cell.innerHTML = `<img src="${imgUrl}" class="inquiry-thumb" onclick="viewImage(this.src)" title="点击查看大图">`;
    }
  } else if (result.error !== '已取消') {
    showToast('添加失败: ' + result.error, 'error');
  }
}

function viewImage(imageSrc) {
  openModal('实物图片查看', `
    <div style="text-align:center;">
      <img src="${imageSrc}" style="max-width:100%;max-height:70vh;object-fit:contain;">
    </div>
  `, `
    <button class="btn" onclick="closeModal()">关闭</button>
  `);
}

async function searchInquiry() {
  const keyword = document.getElementById('inquiry-search').value.trim();
  const month = document.getElementById('inquiry-month').value;

  if (!keyword) {
    renderInquiryTable(inquiryData);
    return;
  }

  // Filter from current data
  const filtered = inquiryData.filter(item =>
    item.name.toLowerCase().includes(keyword.toLowerCase())
  );
  renderInquiryTable(filtered);
}

// Show import inquiry dialog
function showImportInquiryDialog() {
  openModal('导入鉴证表', `
    <div class="form-group" style="margin-bottom:16px;">
      <label>选择月份</label>
      <select class="form-control" id="import-month">
        <option value="2026-06">2026年6月</option>
        <option value="2026-05">2026年5月</option>
      </select>
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label>选择文件</label>
      <div class="import-dropzone" id="inquiry-dropzone" style="padding:20px;">
        <p>点击选择鉴证表文件（.xlsx）</p>
        <input type="file" id="inquiry-file-input" accept=".xlsx" style="display:none;" onchange="handleInquiryFileSelected(this)">
        <button class="btn btn-primary" onclick="document.getElementById('inquiry-file-input').click()">选择文件</button>
      </div>
      <div id="inquiry-file-name" style="margin-top:8px;color:var(--text-muted);font-size:13px;"></div>
    </div>
    <div id="inquiry-import-preview" style="display:none;">
      <h4 style="margin-bottom:8px;">预览导入数据</h4>
      <div id="inquiry-preview-stats"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" id="btn-start-import-inquiry" onclick="startImportInquiry()" disabled>开始导入</button>
  `);
}

let pendingInquiryData = null;

function handleInquiryFileSelected(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  document.getElementById('inquiry-file-name').textContent = `已选择: ${file.name}`;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      const items = [];
      const categories = {
        '米面粮油类': '米面粮油类',
        '肉禽蛋类': '肉禽蛋类',
        '水果蔬菜及豆制品类': '水果蔬菜及豆制品类',
        '速冻食品类': '速冻食品类',
        '乳品饮料类': '乳品饮料类',
        '海鲜水产类': '海鲜水产类',
        '干货调料及腌制品类': '干货调料及腌制品类'
      };

      // Parse each sheet
      wb.SheetNames.forEach(sheetName => {
        const category = categories[sheetName];
        if (!category) return;

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Data starts at row 4 (index 3), columns: 序号, 名称, 评估价格, 单位, 规格, 备注
        for (let i = 3; i < rows.length; i++) {
          const row = rows[i];
          const name = String(row[1] || '').trim();
          if (!name) continue;
          // 跳过表头残留行
          if (name === '单位' || name === '规格' || name === '名称' || name === '品名') continue;

          items.push({
            category: category,
            name: name,
            price: parseFloat(row[2]) || null,
            unit: String(row[3] || '').trim(),
            spec: String(row[4] || '').trim(),
            remark: String(row[5] || '').trim()
          });
        }
      });

      pendingInquiryData = items;

      // Show preview
      document.getElementById('inquiry-import-preview').style.display = 'block';
      document.getElementById('inquiry-preview-stats').innerHTML =
        `<span class="tag tag-success">共 ${items.length} 条数据</span>`;
      document.getElementById('btn-start-import-inquiry').disabled = false;

    } catch (err) {
      showToast('文件解析失败: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function startImportInquiry() {
  if (!pendingInquiryData) return;

  const month = document.getElementById('import-month').value;

  try {
    const result = await window.api.importInquiryItems(month, pendingInquiryData);
    showToast(`导入成功！共 ${result.imported} 条数据`);
    closeModal();
    pendingInquiryData = null;

    // Refresh
    await loadInquiryMonths();
    document.getElementById('inquiry-month').value = month;
    await loadInquiryItems();
  } catch (err) {
    showToast('导入失败: ' + err.message, 'error');
  }
}

// Show add inquiry item dialog
async function showAddInquiryItem() {
  const month = document.getElementById('inquiry-month').value;
  if (!month) {
    showToast('请先选择月份', 'error');
    return;
  }

  openModal('新增询价单品', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group">
        <label>月份</label>
        <input type="text" class="form-control" value="${month}" readonly>
      </div>
      <div class="form-group">
        <label>分类</label>
        <select class="form-control" id="new-inquiry-category">
          <option value="米面粮油类">米面粮油类</option>
          <option value="肉禽蛋类">肉禽蛋类</option>
          <option value="水果蔬菜及豆制品类">水果蔬菜及豆制品类</option>
          <option value="速冻食品类">速冻食品类</option>
          <option value="乳品饮料类">乳品饮料类</option>
          <option value="海鲜水产类">海鲜水产类</option>
          <option value="干货调料及腌制品类">干货调料及腌制品类</option>
        </select>
      </div>
      <div class="form-group" style="position:relative;">
        <label>品名 <span class="required">*</span></label>
        <input type="text" class="form-control" id="new-inquiry-name" placeholder="输入检索或手动输入" autocomplete="off">
        <div class="autocomplete-dropdown" id="new-inquiry-name-dropdown" style="display:none;"></div>
      </div>
      <div class="form-group">
        <label>评估价格</label>
        <input type="number" class="form-control" id="new-inquiry-price" placeholder="可选" step="0.1">
      </div>
      <div class="form-group">
        <label>单位</label>
        <input type="text" class="form-control" id="new-inquiry-unit" placeholder="如: 斤、个、箱">
      </div>
      <div class="form-group">
        <label>规格</label>
        <input type="text" class="form-control" id="new-inquiry-spec" placeholder="如: 10千克/袋">
      </div>
      <div class="form-group" style="grid-column: 1 / -1;">
        <label>备注</label>
        <input type="text" class="form-control" id="new-inquiry-remark" placeholder="可选">
      </div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddInquiryItem('${month}')">保存</button>
  `);

  // 品名自动补全 + 分类/单位/规格联动
  const nameInput = document.getElementById('new-inquiry-name');
  const dropdown = document.getElementById('new-inquiry-name-dropdown');
  const catSelect = document.getElementById('new-inquiry-category');
  let categoryManuallyChanged = false;
  if (catSelect) {
    catSelect.addEventListener('change', () => { categoryManuallyChanged = true; });
  }

  // 确保 PRODUCTS 已加载
  if (PRODUCTS.length === 0) {
    try { PRODUCTS = await window.api.getProducts(); } catch (e) { /* ignore */ }
  }

  if (nameInput && dropdown) {
    nameInput.addEventListener('input', () => {
      const keyword = nameInput.value.trim();
      if (keyword.length < 1) { dropdown.style.display = 'none'; return; }
      const results = PRODUCTS.filter(p => p.name.toLowerCase().includes(keyword.toLowerCase()));
      if (results.length === 0) { dropdown.style.display = 'none'; return; }
      dropdown.innerHTML = results.map(item => `
        <div class="autocomplete-item" data-name="${item.name}" data-spec="${item.spec || ''}" data-unit="${item.unit || ''}">
          <span class="item-name">${item.name}</span>
          <span class="item-spec">${item.spec || ''} | ${item.unit || ''}</span>
        </div>
      `).join('');
      dropdown.style.display = 'block';
      dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          nameInput.value = el.dataset.name;
          document.getElementById('new-inquiry-unit').value = el.dataset.unit;
          document.getElementById('new-inquiry-spec').value = el.dataset.spec;
          dropdown.style.display = 'none';
          // 自动识别分类
          if (!categoryManuallyChanged) {
            window.api.getLatestCategoryForName(el.dataset.name).then(category => {
              if (category && catSelect) catSelect.value = category;
            }).catch(() => {});
          }
        });
      });
    });

    nameInput.addEventListener('blur', () => {
      setTimeout(() => dropdown.style.display = 'none', 200);
      // 手动输入时也尝试识别分类
      if (categoryManuallyChanged) return;
      const val = nameInput.value.trim();
      if (!val) return;
      window.api.getLatestCategoryForName(val).then(category => {
        if (category && catSelect) catSelect.value = category;
      }).catch(() => {});
    });
  }
}

async function doAddInquiryItem(month) {
  const name = document.getElementById('new-inquiry-name').value.trim();
  if (!name) {
    showToast('请输入品名', 'error');
    return;
  }

  const data = {
    month: month,
    category: document.getElementById('new-inquiry-category').value,
    name: name,
    price: parseFloat(document.getElementById('new-inquiry-price').value) || null,
    unit: document.getElementById('new-inquiry-unit').value.trim(),
    spec: document.getElementById('new-inquiry-spec').value.trim(),
    remark: document.getElementById('new-inquiry-remark').value.trim()
  };

  try {
    await window.api.addInquiryItem(data);
    closeModal();
    showToast('已添加');
    await loadInquiryItems();
  } catch (err) {
    showToast('添加失败: ' + err.message, 'error');
  }
}

async function saveDiscount() {
  const sx = document.getElementById('discount-shengxiao').value;
  const yh = document.getElementById('discount-youhong').value;

  try {
    await window.api.setSetting('discount1_rate', sx);
    await window.api.setSetting('discount2_rate', yh);
    await loadAppSettings();
    showToast('折扣率已保存');

    // Refresh table if data exists
    if (inquiryData.length > 0) {
      renderInquiryTable(inquiryData);
    }
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

// ===== Settings Page =====
const SETTING_KEYS = [
  'inbound_rows', 'outbound_rows', 'purchase_rows',
  'inbound_history', 'inbound_history_days',
  'outbound_history', 'outbound_history_days',
  'discount1_name', 'discount1_rate',
  'discount2_name', 'discount2_rate',
  'price_decimals',
  'enter_mode',
  'photo_folder',
  'inv_inbound_limit', 'inv_outbound_limit',
  'canteen_mode', 'show_pastry', 'xiaosuo_mode',
  'current_canteen',
];

const SETTING_DEFAULTS = {
  inbound_rows: '5', outbound_rows: '5', purchase_rows: '10',
  inbound_history: 'on', inbound_history_days: '20',
  outbound_history: 'on', outbound_history_days: '20',
  discount1_name: '盛销', discount1_rate: '0.9008',
  discount2_name: '优宏', discount2_rate: '0.9058',
  price_decimals: '2',
  enter_mode: 'next-row',
  photo_folder: '',
  inv_inbound_limit: '5', inv_outbound_limit: '10',
  canteen_mode: '洋安', show_pastry: 'on', xiaosuo_mode: 'off',
  current_canteen: '洋安',
};

async function initSettingsPage() {
  try {
    const settings = await window.api.getAllSettings();
    document.getElementById('setting-inbound-rows').value = settings.inbound_rows || SETTING_DEFAULTS.inbound_rows;
    document.getElementById('setting-outbound-rows').value = settings.outbound_rows || SETTING_DEFAULTS.outbound_rows;
    document.getElementById('setting-purchase-rows').value = settings.purchase_rows || SETTING_DEFAULTS.purchase_rows;
    document.getElementById('setting-inbound-history').value = settings.inbound_history || SETTING_DEFAULTS.inbound_history;
    document.getElementById('setting-inbound-history-days').value = settings.inbound_history_days || SETTING_DEFAULTS.inbound_history_days;
    document.getElementById('setting-outbound-history').value = settings.outbound_history || SETTING_DEFAULTS.outbound_history;
    document.getElementById('setting-outbound-history-days').value = settings.outbound_history_days || SETTING_DEFAULTS.outbound_history_days;
    document.getElementById('setting-discount1-name').value = settings.discount1_name || SETTING_DEFAULTS.discount1_name;
    document.getElementById('setting-discount1-rate').value = settings.discount1_rate || SETTING_DEFAULTS.discount1_rate;
    document.getElementById('setting-discount2-name').value = settings.discount2_name || SETTING_DEFAULTS.discount2_name;
    document.getElementById('setting-discount2-rate').value = settings.discount2_rate || SETTING_DEFAULTS.discount2_rate;
    document.getElementById('setting-price-decimals').value = settings.price_decimals || SETTING_DEFAULTS.price_decimals;
    document.getElementById('setting-enter-mode').value = settings.enter_mode || SETTING_DEFAULTS.enter_mode;
    document.getElementById('setting-photo-folder').value = settings.photo_folder || SETTING_DEFAULTS.photo_folder;
    document.getElementById('setting-inv-inbound-limit').value = settings.inv_inbound_limit || SETTING_DEFAULTS.inv_inbound_limit;
    document.getElementById('setting-inv-outbound-limit').value = settings.inv_outbound_limit || SETTING_DEFAULTS.inv_outbound_limit;
    // 食堂模式：兼容旧格式
    const rawMode = settings.canteen_mode || SETTING_DEFAULTS.canteen_mode;
    const xiaosuoMode = settings.xiaosuo_mode || SETTING_DEFAULTS.xiaosuo_mode;
    let modeValue = 'default';
    if (xiaosuoMode === 'on' || ['下涯','制杆厂','白南山'].includes(rawMode)) {
      modeValue = 'multi';
    }
    document.getElementById('setting-canteen-mode').value = modeValue;
  } catch (err) {
    console.error('Load settings error:', err);
  }
}

async function selectPhotoFolder() {
  const folder = await window.api.selectFolder();
  if (folder) {
    document.getElementById('setting-photo-folder').value = folder;
  }
}

async function saveSettings() {
  try {
    for (const key of SETTING_KEYS) {
      const el = document.getElementById(`setting-${key.replace(/_/g, '-')}`);
      if (el) await window.api.setSetting(key, el.value);
    }

    // 食堂模式：将新模式映射到旧的 canteen_mode / xiaosuo_mode / show_pastry
    const mode = document.getElementById('setting-canteen-mode').value;
    if (mode === 'multi') {
      await window.api.setSetting('canteen_mode', '下涯');
      await window.api.setSetting('xiaosuo_mode', 'on');
      await window.api.setSetting('show_pastry', 'off');
    } else {
      await window.api.setSetting('xiaosuo_mode', 'off');
      await window.api.setSetting('show_pastry', 'on');
      // current_canteen 由采购单页的切换按钮控制，这里不覆盖
    }

    await loadAppSettings();
    if (document.getElementById('page-purchase').classList.contains('active')) {
      applyCanteenMode();
    }
    showToast('设置已保存');
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

async function loadAppSettings() {
  try {
    const s = await window.api.getAllSettings();
    const g = (k) => s[k] || SETTING_DEFAULTS[k];
    APP_SETTINGS = {
      inbound_rows: parseInt(g('inbound_rows')) || 5,
      outbound_rows: parseInt(g('outbound_rows')) || 5,
      purchase_rows: parseInt(g('purchase_rows')) || 10,
      inbound_history: g('inbound_history'),
      inbound_history_days: parseInt(g('inbound_history_days')) || 20,
      outbound_history: g('outbound_history'),
      outbound_history_days: parseInt(g('outbound_history_days')) || 20,
      discount1_name: g('discount1_name'),
      discount1_rate: g('discount1_rate'),
      discount2_name: g('discount2_name'),
      discount2_rate: g('discount2_rate'),
      price_decimals: parseInt(g('price_decimals')) || 2,
      photo_folder: g('photo_folder'),
      inv_inbound_limit: parseInt(g('inv_inbound_limit')) || 5,
      inv_outbound_limit: parseInt(g('inv_outbound_limit')) || 10,
      canteen_mode: g('canteen_mode'),
      show_pastry: g('show_pastry'),
      xiaosuo_mode: g('xiaosuo_mode'),
      current_canteen: g('current_canteen') || g('canteen_mode') || '洋安',
    };
    ENTER_MODE = g('enter_mode');
    // 同步到询价页内联折扣输入框
    syncDiscountToInquiry();
  } catch (err) {
    console.error('Load app settings error:', err);
  }
}

function syncDiscountToInquiry() {
  const sxEl = document.getElementById('discount-shengxiao');
  const yhEl = document.getElementById('discount-youhong');
  if (sxEl) sxEl.value = APP_SETTINGS.discount1_rate;
  if (yhEl) yhEl.value = APP_SETTINGS.discount2_rate;
  // 更新表头折扣名称
  const h1 = document.getElementById('header-discount1');
  const h2 = document.getElementById('header-discount2');
  if (h1) h1.textContent = APP_SETTINGS.discount1_name + '价';
  if (h2) h2.textContent = APP_SETTINGS.discount2_name + '价';
}
