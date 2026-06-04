// ===== State =====
let PRODUCTS = [];
let RECIPIENTS = [];
let selectedProductIds = new Set();
let trendChart = null;
let pieChart = null;

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
    case 'alerts': loadAlerts(); break;
    case 'products': loadProducts(); break;
    case 'purchase': initPurchasePage(); break;
    case 'inquiry': initInquiryPage(); break;
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
async function loadInventory(filter = '') {
  try {
    const inventory = await window.api.getInventory();
    const tbody = document.getElementById('inventory-body');

    const filtered = inventory.filter(p =>
      p.name.toLowerCase().includes(filter.toLowerCase())
    );

    tbody.innerHTML = filtered.map(p => {
      const statusClass = p.stock === 0 ? 'stock-zero' : p.stock < 5 ? 'stock-low' : 'stock-ok';
      const statusText = p.stock === 0 ? '缺货' : p.stock < 5 ? '偏低' : '正常';
      const tagClass = p.stock === 0 ? 'tag-danger' : p.stock < 5 ? 'tag-warning' : 'tag-success';
      return `<tr>
        <td>${p.id}</td><td>${p.name}</td><td>${p.spec}</td><td>${p.unit}</td>
        <td class="${statusClass}">${p.stock}</td><td>${p.total_in}</td><td>${p.total_out}</td>
        <td><span class="tag ${tagClass}">${statusText}</span></td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Inventory load error:', err);
  }
}

document.getElementById('inv-search').addEventListener('input', (e) => {
  loadInventory(e.target.value);
});

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

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><input type="checkbox" class="prod-cb" data-id="${p.id}" ${selectedProductIds.has(p.id) ? 'checked' : ''} onchange="toggleProductSelect(${p.id}, this.checked)"></td>
      <td>${p.id}</td><td>${p.name}</td><td>${p.spec}</td><td>${p.unit}</td>
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
      <div class="form-group"><label>保质期(月)</label><input type="number" class="form-control" id="np-months" min="0" value="0"></div>
      <div class="form-group"><label>保质期(日)</label><input type="number" class="form-control" id="np-days" min="0" value="0"></div>
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
      <div class="form-group"><label>保质期(月)</label><input type="number" class="form-control" id="ep-months" value="${p.shelf_months}"></div>
      <div class="form-group"><label>保质期(日)</label><input type="number" class="form-control" id="ep-days" value="${p.shelf_days}"></div>
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
  await window.api.updateProduct(id, {
    name, spec: document.getElementById('ep-spec').value.trim(), unit,
    shelf_months: parseInt(document.getElementById('ep-months').value) || 0,
    shelf_days: parseInt(document.getElementById('ep-days').value) || 0,
  });
  closeModal();
  showToast('已保存');
  loadProducts();
  refreshProductSelects();
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

// ===== Inbound Form =====
document.getElementById('in-product').addEventListener('change', async function() {
  const p = PRODUCTS.find(x => x.id === parseInt(this.value));
  if (p) {
    document.getElementById('in-spec').value = p.spec;
    document.getElementById('in-unit').value = p.unit;
    // Show case hint
    const hint = document.getElementById('in-case-hint');
    if (hint) {
      const match = p.spec.match(/(\d+)[^/]*\/箱/);
      hint.textContent = match ? `1箱 = ${match[1]}${p.unit}` : '';
    }
    calcInExpiry();
  } else {
    document.getElementById('in-spec').value = '';
    document.getElementById('in-unit').value = '';
    const hint = document.getElementById('in-case-hint');
    if (hint) hint.textContent = '';
  }
});

document.getElementById('in-prod-date').addEventListener('change', calcInExpiry);

function calcInExpiry() {
  const prodDate = document.getElementById('in-prod-date').value;
  const productId = parseInt(document.getElementById('in-product').value);
  if (!prodDate || !productId) return;
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p || !p.shelf_days) return;
  const d = new Date(prodDate);
  d.setDate(d.getDate() + p.shelf_days);
  document.getElementById('in-expiry').value = toLocalDateStr(d);
}

async function submitInbound() {
  const productId = parseInt(document.getElementById('in-product').value);
  const qty = parseFloat(document.getElementById('in-qty').value);
  const date = document.getElementById('in-date').value;

  if (!productId || !qty || !date) {
    showToast('请填写必填项', 'error');
    return;
  }

  await window.api.addInbound({
    product_id: productId,
    date,
    quantity: qty,
    remark: document.getElementById('in-remark').value.trim(),
    production_date: document.getElementById('in-prod-date').value || null,
    expiry_date: document.getElementById('in-expiry').value || null,
  });

  showToast('入库登记成功！');
  resetInboundForm();
  loadRecentInbound();
}

function resetInboundForm() {
  document.getElementById('in-product').value = '';
  document.getElementById('in-spec').value = '';
  document.getElementById('in-qty').value = '';
  document.getElementById('in-unit').value = '';
  document.getElementById('in-prod-date').value = '';
  document.getElementById('in-expiry').value = '';
  document.getElementById('in-remark').value = '';
  const hint = document.getElementById('in-case-hint');
  if (hint) hint.textContent = '';
}

async function loadRecentInbound() {
  try {
    const records = await window.api.getInbound({});
    const tbody = document.getElementById('recent-inbound');
    tbody.innerHTML = records.slice(0, 20).map(r => `
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

// ===== Outbound Form =====
document.getElementById('out-product').addEventListener('change', async function() {
  const p = PRODUCTS.find(x => x.id === parseInt(this.value));
  if (p) {
    document.getElementById('out-spec').value = p.spec;
    const inv = (await window.api.getInventory()).find(x => x.id === p.id);
    document.getElementById('out-stock').value = (inv ? inv.stock : 0) + ' ' + p.unit;
  } else {
    document.getElementById('out-spec').value = '';
    document.getElementById('out-stock').value = '';
  }
});

async function submitOutbound() {
  const productId = parseInt(document.getElementById('out-product').value);
  const qty = parseFloat(document.getElementById('out-qty').value);
  const date = document.getElementById('out-date').value;
  const recipient = document.getElementById('out-recipient').value;

  if (!productId || !qty || !date || !recipient) {
    showToast('请填写必填项', 'error');
    return;
  }

  // Check stock
  const inv = (await window.api.getInventory()).find(x => x.id === productId);
  if (inv && qty > inv.stock) {
    showToast(`库存不足！当前库存: ${inv.stock}`, 'error');
    return;
  }

  await window.api.addOutbound({
    product_id: productId,
    date,
    quantity: qty,
    recipient,
  });

  showToast('出库登记成功！');
  resetOutboundForm();
  loadRecentOutbound();
}

function resetOutboundForm() {
  document.getElementById('out-product').value = '';
  document.getElementById('out-spec').value = '';
  document.getElementById('out-qty').value = '';
  document.getElementById('out-stock').value = '';
  document.getElementById('out-recipient').value = '';
}

async function loadRecentOutbound() {
  try {
    const records = await window.api.getOutbound({});
    const tbody = document.getElementById('recent-outbound');
    tbody.innerHTML = records.slice(0, 20).map(r => `
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
  const sel = document.getElementById('out-recipient');
  const opt = document.createElement('option');
  opt.value = name; opt.textContent = name;
  sel.appendChild(opt); sel.value = name;
  closeModal();
  showToast(`已添加: ${name}`);
}

async function loadRecipientSelect() {
  try {
    RECIPIENTS = await window.api.getRecipients();
    const sel = document.getElementById('out-recipient');
    sel.innerHTML = '<option value="">请选择...</option>' +
      RECIPIENTS.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
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

  showToast('正在导入数据...', 'info');

  try {
    const pResult = await window.api.importProducts(pendingImportData.products);
    let msg = `产品: 导入${pResult.imported}条, 跳过${pResult.skipped}条`;

    // Import opening stock from ledger
    if (Object.keys(pendingImportData.openingStock).length > 0) {
      await window.api.importOpeningStock(pendingImportData.openingStock);
      msg += ` | 初始库存: 已设置`;
    }

    if (pendingImportData.inbound.length > 0) {
      const iResult = await window.api.importInbound(pendingImportData.inbound);
      msg += ` | 入库: 导入${iResult.imported}条, 跳过${iResult.skipped}条`;
    }

    if (pendingImportData.outbound.length > 0) {
      const oResult = await window.api.importOutbound(pendingImportData.outbound);
      msg += ` | 出库: 导入${oResult.imported}条, 跳过${oResult.skipped}条`;
    }

    showToast('导入完成！' + msg);
    pendingImportData = null;
    document.getElementById('import-preview').style.display = 'none';

    // Refresh data
    await refreshProductSelects();
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
  // Load lianhua items
  await loadLianhuaItems();
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
        <button class="btn btn-sm" onclick="event.stopPropagation(); addPurchaseRows(this)">+ 添加10行</button>
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

  // Add 10 empty rows
  const tbody = dateGroup.querySelector('tbody');
  for (let i = 0; i < 10; i++) {
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

  for (let i = 0; i < 10; i++) {
    appendPurchaseRow(tbody, currentCount + i);
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
    <td><button class="btn-delete-row" onclick="deletePurchaseRow(this)">✕</button></td>
  `;

  tbody.appendChild(tr);
  attachCellEvents(tr, tbody);
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
  // Only attach events to editable cells
  const inputs = tr.querySelectorAll('.cell-editable');
  inputs.forEach(input => {
    // Handle Enter key - move to next row same column
    input.addEventListener('keydown', (e) => {
      handleCellKeydown(e, input, tbody);
    });

    // Handle value change - calculate amount
    input.addEventListener('change', () => {
      recalcRowAmount(tr);
    });

    // Handle autocomplete for product_name
    if (input.dataset.field === 'product_name') {
      input.addEventListener('input', (e) => {
        handleProductAutocomplete(e.target);
      });
      input.addEventListener('focus', (e) => {
        handleProductAutocomplete(e.target);
      });
      input.addEventListener('blur', () => {
        setTimeout(() => hideAutocomplete(), 200);
      });
    }

    // Handle quantity input - recalculate on input
    if (input.dataset.field === 'quantity') {
      input.addEventListener('input', () => {
        recalcRowAmount(tr);
      });
    }
  });
}

function handleCellKeydown(e, input, tbody) {
  const tr = input.closest('tr');
  const td = input.closest('td');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const editableCols = Array.from(tr.querySelectorAll('.cell-editable'));
  const colIdx = editableCols.indexOf(input);
  const rowIdx = rows.indexOf(tr);

  switch (e.key) {
    case 'Enter':
      e.preventDefault();
      // Move to next row, same editable column position
      if (rowIdx < rows.length - 1) {
        const nextRow = rows[rowIdx + 1];
        const nextEditableCols = nextRow.querySelectorAll('.cell-editable');
        const nextInput = nextEditableCols[colIdx];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      } else {
        // Add new row if at last row
        appendPurchaseRow(tbody, rows.length);

        setTimeout(() => {
          const newRows = Array.from(tbody.querySelectorAll('tr'));
          const nextRow = newRows[newRows.length - 1];
          const nextEditableCols = nextRow.querySelectorAll('.cell-editable');
          const nextInput = nextEditableCols[colIdx];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }, 50);
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

    // Keyboard navigation in dropdown
    input.onkeydown = (e) => {
      const items = dropdown.querySelectorAll('.autocomplete-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        autocompleteIndex = Math.min(autocompleteIndex + 1, items.length - 1);
        updateAutocompleteHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        autocompleteIndex = Math.max(autocompleteIndex - 1, 0);
        updateAutocompleteHighlight(items);
      } else if (e.key === 'Enter' && autocompleteIndex >= 0) {
        e.preventDefault();
        selectAutocompleteItem(input, items[autocompleteIndex]);
      } else if (e.key === 'Escape') {
        hideAutocomplete();
      }
    };
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

// Save all purchase orders (including 联华)
async function saveAllPurchaseOrders() {
  const allOrders = [];
  const dateGroups = document.querySelectorAll('.date-group');

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
    // Clear all existing orders and save new ones
    await window.api.clearPurchaseOrders();
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

  // Load discount settings
  loadDiscountSettings();
});

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
function showAddLianhuaDate() {
  const tomorrow = getTomorrowStr();
  openModal('选择联华订单日期', `
    <div class="form-group">
      <label>发货日期</label>
      <input type="date" class="form-control" id="new-lianhua-date" value="${tomorrow}">
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddLianhuaDate()">确定</button>
  `);
}

function doAddLianhuaDate() {
  const date = document.getElementById('new-lianhua-date').value;
  if (!date) { showToast('请选择日期', 'error'); return; }
  closeModal();
  addLianhuaDateGroup(date);
}

// Add lianhua date group - same format as other groups
function addLianhuaDateGroup(date) {
  const groupContent = document.querySelector('.purchase-group[data-source="联华"] .group-content');
  if (!groupContent) return;

  const dateId = `lianhua-date-${date}`;
  if (document.getElementById(dateId)) {
    showToast('该日期已存在', 'error');
    return;
  }

  const dateGroup = document.createElement('div');
  dateGroup.className = 'date-group';
  dateGroup.id = dateId;
  dateGroup.dataset.date = date;
  dateGroup.dataset.source = '联华';

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

  // Add 5 empty rows (联华 default)
  const tbody = dateGroup.querySelector('tbody');
  for (let i = 0; i < 5; i++) {
    appendPurchaseRow(tbody, i);
  }
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

    const filePath = await window.api.saveFile(`联华超市${date.replace(/-/g, '')}.xls`);
    if (!filePath) return;

    const wsData = [
      ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注']
    ];

    orders.forEach(order => {
      wsData.push([
        order.index,
        '洋安',
        date.replace(/-/g, '.'),
        order.code,
        order.name,
        order.unit,
        order.spec,
        order.price,
        order.quantity,
        order.amount,
        order.split_qty,
        order.remark
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, date);
    XLSX.writeFile(wb, filePath);

    showToast('导出成功！');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

// Export all purchase orders (3 sheets in one xlsx)
async function exportAllPurchaseOrders() {
  try {
    const filePath = await window.api.saveFile('洋安采购单.xlsx');
    if (!filePath) return;

    const wb = XLSX.utils.book_new();

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

    // Export 洋安食堂厨房 sheet
    const kitchenRows = collectRows('洋安食堂厨房');
    const kitchenData = [
      ['洋安食堂厨房申购单', '', '', '', '', '', '', '', '', ''],
      ['序号', '收货日期', '品名', '规格', '单价', '数量', '单位', '金额', '用途', '备注要求']
    ];
    kitchenRows.forEach((row, idx) => {
      kitchenData.push([
        idx + 1,
        row.date,
        row.product_name,
        row.spec,
        row.unit_price,
        row.quantity,
        row.unit,
        row.amount,
        '',
        row.remark
      ]);
    });
    const wsKitchen = XLSX.utils.aoa_to_sheet(kitchenData);
    XLSX.utils.book_append_sheet(wb, wsKitchen, '洋安食堂厨房申购单');

    // Export 洋安面点房 sheet
    const pastryRows = collectRows('洋安面点房');
    const pastryData = [
      ['洋安面点房申购单', '', '', '', '', '', '', '', '', ''],
      ['序号', '收货日期', '品名', '规格', '单价', '数量', '单位', '金额', '用途', '备注要求']
    ];
    pastryRows.forEach((row, idx) => {
      pastryData.push([
        idx + 1,
        row.date,
        row.product_name,
        row.spec,
        row.unit_price,
        row.quantity,
        row.unit,
        row.amount,
        '',
        row.remark
      ]);
    });
    const wsPastry = XLSX.utils.aoa_to_sheet(pastryData);
    XLSX.utils.book_append_sheet(wb, wsPastry, '洋安面点房申购单');

    // Export 联华 sheet (different format)
    const lianhuaGroup = document.querySelector('.purchase-group[data-source="联华"]');
    if (lianhuaGroup) {
      const lianhuaDateGroups = lianhuaGroup.querySelectorAll('.date-group');
      lianhuaDateGroups.forEach(dateGroup => {
        const date = getDateFromGroup(dateGroup);
        const rows = dateGroup.querySelectorAll('tbody tr');

        const lianhuaData = [
          ['序号', '客户名称', '发货时间', '编码', '品名', '单位', '规格', '单价', '数量', '金额', '拆分单件', '备注']
        ];

        let hasData = false;
        rows.forEach((tr, idx) => {
          const getData = (field) => tr.querySelector(`[data-field="${field}"]`)?.value || '';
          const amountText = tr.querySelector('.amount-cell')?.textContent || '0';
          const amount = parseFloat(amountText.replace('¥', '')) || 0;

          const productName = getData('product_name').trim();
          if (!productName) return;

          hasData = true;

          // Find matching lianhua item
          const item = lianhuaItems.find(i => i.name === productName || productName.includes(i.name));

          lianhuaData.push([
            idx + 1,
            '洋安',
            date.replace(/-/g, '.'),
            item ? item.code : '',
            productName,
            getData('unit') || (item ? item.unit : '件'),
            getData('spec') || (item ? item.spec : ''),
            parseFloat(getData('unit_price')) || (item ? item.price : 0),
            parseFloat(getData('quantity')) || 0,
            amount,
            item ? item.split_qty : 1,
            getData('remark')
          ]);
        });

        if (hasData) {
          const wsLianhua = XLSX.utils.aoa_to_sheet(lianhuaData);
          // Sheet name is the date
          XLSX.utils.book_append_sheet(wb, wsLianhua, date);
        }
      });
    }

    XLSX.writeFile(wb, filePath);
    showToast('导出成功！');
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

  document.getElementById('inquiry-count').textContent = `${items.length} 条`;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted);">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((item, idx) => {
    const priceSX = item.price ? Math.round(item.price * discountSX * 10) / 10 : null;
    const priceYH = item.price ? Math.round(item.price * discountYH * 10) / 10 : null;

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

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.category}</td>
        <td style="text-align:left;">${item.name}</td>
        <td>${item.price || '-'}</td>
        <td>${priceSX || '-'}</td>
        <td>${priceYH || '-'}</td>
        <td>${item.unit || ''}</td>
        <td>${item.spec || ''}</td>
        <td>${changeHtml}</td>
        <td>${item.remark || ''}</td>
      </tr>
    `;
  }).join('');
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
function showAddInquiryItem() {
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
      <div class="form-group">
        <label>品名 <span class="required">*</span></label>
        <input type="text" class="form-control" id="new-inquiry-name" placeholder="请输入品名">
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

// Load and save discount settings
async function loadDiscountSettings() {
  try {
    const settings = await window.api.getAllSettings();
    if (settings.discount_shengxiao) {
      document.getElementById('discount-shengxiao').value = settings.discount_shengxiao;
    }
    if (settings.discount_youhong) {
      document.getElementById('discount-youhong').value = settings.discount_youhong;
    }
  } catch (err) {
    console.error('Load discount settings error:', err);
  }
}

async function saveDiscount() {
  const sx = document.getElementById('discount-shengxiao').value;
  const yh = document.getElementById('discount-youhong').value;

  try {
    await window.api.setSetting('discount_shengxiao', sx);
    await window.api.setSetting('discount_youhong', yh);
    showToast('折扣率已保存');

    // Refresh table if data exists
    if (inquiryData.length > 0) {
      renderInquiryTable(inquiryData);
    }
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}
