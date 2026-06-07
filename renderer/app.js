// ===== State =====
let PRODUCTS = [];
let RECIPIENTS = [];
let ENTER_MODE = 'next-row'; // 'next-row' | 'next-cell'
let APP_SETTINGS = {
  inbound_rows: 5, outbound_rows: 5, purchase_rows: 10,
  inbound_history: 'on', inbound_history_days: 20,
  outbound_history: 'on', outbound_history_days: 20,
  discount1_name: '盛销', discount1_rate: '0.9008',
  discount2_name: '优宏', discount2_rate: '0.9058',
  price_decimals: 2,
  inv_inbound_limit: 5, inv_outbound_limit: 10,
  small_canteens: ['寿昌', '梅城', '大同', '大洋', '洋溪', '三都', '乾潭'],
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

async function loadRecipientSelect() {
  try {
    RECIPIENTS = await window.api.getRecipients();
  } catch (err) {
    console.error('Load recipients error:', err);
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
  initLedgerYearSelector();
  document.getElementById('ledger-month').value = now.getMonth() + 1;

  // Load initial data
  await refreshProductSelects();
  await loadRecipientSelect();
  loadDashboard();
  loadRecentInbound();
  loadRecentOutbound();

  // Load all app settings into cache
  await loadAppSettings();

  // Check if first launch and start tutorial
  checkAndStartTour();

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

