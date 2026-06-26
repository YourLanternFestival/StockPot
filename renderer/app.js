// ===== State =====
let PRODUCTS = [];
let RECIPIENTS = [];
let ENTER_MODE = 'next-row'; // 'next-row' | 'next-cell'
let PURCHASE_DIRTY = false;  // 采购页面是否有未保存修改
let NAV_PENDING_TARGET = null;  // 离开确认中的目标页面

function markPurchaseDirty() { PURCHASE_DIRTY = true; }
function resetPurchaseDirty() { PURCHASE_DIRTY = false; }

// 采购页面是否有实际数据（DOM 中有品名的行）
function hasPurchasePageData() {
  const container = document.getElementById('purchase-container');
  if (container) {
    const inputs = container.querySelectorAll('[data-field="product_name"]');
    for (const input of inputs) {
      if (input.value && input.value.trim()) return true;
    }
  }
  const matrixTbody = document.getElementById('matrix-tbody');
  if (matrixTbody) {
    const inputs = matrixTbody.querySelectorAll('[data-field="product_name"]');
    for (const input of inputs) {
      if (input.value && input.value.trim()) return true;
    }
  }
  return false;
}

// 侧边栏显示版本号
window.api.getAppVersion().then(v => {
  const el = document.getElementById('sidebar-version');
  if (el) el.textContent = `v${v}`;
});

// ===== 侧栏折叠 =====
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('.main-content');
  const titlebar = document.querySelector('.custom-titlebar');
  const isCollapsed = sidebar.classList.toggle('collapsed');
  // 保存状态
  window.api.setSetting('sidebar_collapsed', isCollapsed ? 'on' : 'off');
}

async function applySidebarState() {
  const s = await window.api.getAllSettings();
  if (s.sidebar_collapsed === 'on') {
    document.querySelector('.sidebar')?.classList.add('collapsed');
  }
}
applySidebarState();

// ===== Window Controls =====
function minimizeWindow() {
  window.electronAPI?.minimizeWindow();
}

function maximizeWindow() {
  window.electronAPI?.maximizeWindow();
}

function closeWindow() {
  window.electronAPI?.closeWindow();
}

// 双击拖拽区域切换最大化
document.addEventListener('DOMContentLoaded', () => {
  const dragRegion = document.querySelector('.drag-region');
  if (dragRegion) {
    dragRegion.addEventListener('dblclick', () => {
      maximizeWindow();
    });
  }
});

// 更新最大化按钮图标
function updateMaximizeButton(isMaximized) {
  const btn = document.getElementById('btn-maximize');
  if (!btn) return;

  if (isMaximized) {
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect fill="none" stroke="currentColor" width="9" height="9" x="1.5" y="1.5"/>
        <rect fill="var(--sidebar-bg)" width="7" height="7" x="3" y="0.5"/>
        <rect fill="none" stroke="currentColor" width="7" height="7" x="3" y="0.5"/>
      </svg>
    `;
    btn.title = '还原';
  } else {
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect fill="none" stroke="currentColor" width="9" height="9" x="1.5" y="1.5"/>
      </svg>
    `;
    btn.title = '最大化';
  }
}
let APP_SETTINGS = {
  inbound_rows: 5, outbound_rows: 5, purchase_rows: 10,
  inbound_history: 'on', inbound_history_days: 20,
  outbound_history: 'on', outbound_history_days: 20,
  discount1_name: '盛销', discount1_rate: '0.9008',
  discount2_name: '优宏', discount2_rate: '0.9058',
  price_decimals: 2,
  inv_inbound_limit: 5, inv_outbound_limit: 10,
  purchase_retention_days: 31,
  small_canteens: ['食堂F1', '食堂F2', '食堂F3', '食堂F4', '食堂F5', '食堂F6', '食堂F7'],
};

// ===== Navigation =====
async function navigateTo(page) {
  const currentPage = document.querySelector('.page.active');

  // 离开采购页面时检查是否有未保存修改（页面无数据时不触发）
  if (currentPage && currentPage.id === 'page-purchase') {
    if (PURCHASE_DIRTY && page !== 'purchase' && hasPurchasePageData()) {
      NAV_PENDING_TARGET = page;
      openModal('未保存的修改', `
        <p>采购页面有未保存的数据，是否保存？</p>
      `, `
        <button class="btn" onclick="doLeaveWithoutSave()">不保存</button>
        <button class="btn" onclick="closeModal(); NAV_PENDING_TARGET = null;">取消</button>
        <button class="btn btn-primary" onclick="doLeaveWithSave()">保存</button>
      `);
      return;
    }
    // 页面无数据时清理残留 dirty 标记
    if (PURCHASE_DIRTY && !hasPurchasePageData()) {
      resetPurchaseDirty();
    }
    // 无修改时直接离开（不再静默保存）
  }

  switchToPage(page);
}

async function doLeaveWithSave() {
  closeModal();
  try {
    await saveAllPurchaseOrders();
    resetPurchaseDirty();
    switchToPage(NAV_PENDING_TARGET);
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
    // 保存失败留在采购页
  }
  NAV_PENDING_TARGET = null;
}

function doLeaveWithoutSave() {
  closeModal();
  resetPurchaseDirty();
  switchToPage(NAV_PENDING_TARGET);
  NAV_PENDING_TARGET = null;
}

function switchToPage(page) {
  if (!page) return;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  const pageEl = document.getElementById(`page-${page}`);
  if (navItem) navItem.classList.add('active');
  if (pageEl) pageEl.classList.add('active');

  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'inventory': loadInventory(); break;
    case 'ledger': loadLedger(); break;
    case 'products': loadProducts(); break;
    case 'purchase': initPurchasePage(); break;
    case 'history': initHistoryPage(); break;
    case 'inquiry': initInquiryPage(); break;
    case 'inbound': initInboundPage(); break;
    case 'outbound': initOutboundPage(); break;
    case 'settings': initSettingsPage(); break;
    case 'help': break;
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', async (e) => {
    e.preventDefault();
    await navigateTo(item.dataset.page);
  });
});

// ===== Toast =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  // 限制最多 3 个 toast，超出移除最早的
  const existing = container.querySelectorAll('.toast');
  if (existing.length >= 3) existing[0].remove();
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

  // Clean old purchase orders (use configurable retention days)
  const retentionDays = APP_SETTINGS.purchase_retention_days || 31;
  await window.api.cleanOldPurchaseOrders(retentionDays);

  // Check if first launch and start tutorial
  checkAndStartTour();

  // 监听窗口状态变化
  window.electronAPI?.onWindowStateChanged?.((state) => {
    updateMaximizeButton(state.isMaximized);
  });

  // 帮助页面滚动时显示/隐藏返回目录按钮
  const mainContent = document.querySelector('.main-content');
  const backToTocBtn = document.getElementById('back-to-toc-btn');

  if (mainContent && backToTocBtn) {
    mainContent.addEventListener('scroll', () => {
      const activePage = document.querySelector('.page.active');
      if (activePage && activePage.id === 'page-help') {
        // 在帮助页面，滚动超过目录区域时显示按钮
        const tocSection = document.getElementById('help-toc');
        if (tocSection) {
          const tocBottom = tocSection.offsetTop + tocSection.offsetHeight;
          if (mainContent.scrollTop > tocBottom) {
            backToTocBtn.style.display = 'flex';
            setTimeout(() => backToTocBtn.classList.add('visible'), 10);
          } else {
            backToTocBtn.classList.remove('visible');
            setTimeout(() => backToTocBtn.style.display = 'none', 300);
          }
        }
      } else {
        backToTocBtn.classList.remove('visible');
        setTimeout(() => backToTocBtn.style.display = 'none', 300);
      }
    });
  }

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

// ===== 帮助页面搜索和跳转 =====
function scrollToHelpSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // 高亮显示目标章节
    section.style.transition = 'background-color 0.3s';
    section.style.backgroundColor = 'var(--primary-light)';
    setTimeout(() => {
      section.style.backgroundColor = '';
    }, 2000);
  }
}

function searchHelp(keyword) {
  const dropdown = document.getElementById('help-search-dropdown');
  const hint = document.getElementById('help-search-hint');

  if (!keyword || keyword.length < 1) {
    dropdown.style.display = 'none';
    hint.textContent = '输入关键词快速定位';
    return;
  }

  const sections = document.querySelectorAll('.help-section[id]');
  const results = [];

  sections.forEach(section => {
    const title = section.querySelector('h3')?.textContent || '';
    const keywords = section.dataset.keywords || '';
    const content = section.textContent || '';

    // 检查是否匹配
    const searchText = `${title} ${keywords} ${content}`.toLowerCase();
    if (searchText.includes(keyword.toLowerCase())) {
      results.push({
        id: section.id,
        title: title,
        keywords: keywords
      });
    }
  });

  if (results.length > 0) {
    dropdown.innerHTML = results.map(r => `
      <div class="autocomplete-item" onclick="scrollToHelpSection('${r.id}'); document.getElementById('help-search-dropdown').style.display='none'; document.getElementById('help-search-input').value='';">
        <span class="item-name">${r.title}</span>
        <span class="item-spec">${r.keywords.split(' ').slice(0, 3).join(' ')}</span>
      </div>
    `).join('');
    dropdown.style.display = 'block';
    hint.textContent = `找到 ${results.length} 个相关章节`;
  } else {
    dropdown.innerHTML = '<div class="autocomplete-item" style="color:var(--text-muted);cursor:default;">未找到相关内容</div>';
    dropdown.style.display = 'block';
    hint.textContent = '未找到匹配内容';
  }
}

// 点击其他地方关闭搜索下拉框
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('help-search-dropdown');
  const input = document.getElementById('help-search-input');
  if (dropdown && input && !dropdown.contains(e.target) && e.target !== input) {
    dropdown.style.display = 'none';
  }
});
function hasTableData(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return false;
  for (const tr of tbody.querySelectorAll('tr')) {
    const name = tr.querySelector('[data-field="product_name"]');
    if (name && name.value.trim()) return true;
  }
  return false;
}

function hasPurchaseData() {
  // 检查采购页是否有已填写但可能未自动保存的输入
  const purchasePage = document.getElementById('page-purchase');
  if (!purchasePage || !purchasePage.classList.contains('active')) return false;
  const inputs = purchasePage.querySelectorAll('.cell-editable');
  for (const input of inputs) {
    if (input.value && input.value.trim()) return true;
  }
  return false;
}

function hasUnsavedData() {
  return hasTableData('inbound-tbody') || hasTableData('outbound-tbody') || hasPurchaseData();
}

async function submitCurrentPage() {
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const id = activePage.id;
  if (id === 'page-inbound') await submitInboundBatch();
  else if (id === 'page-outbound') await submitOutboundBatch();
  else if (id === 'page-purchase' && typeof silentSavePurchaseOrders === 'function') {
    await silentSavePurchaseOrders();
  }
}

// Register close-check handler via IPC (replaces executeJavaScript coupling)
if (window.electronAPI?.registerCloseCheck) {
  window.electronAPI.registerCloseCheck(
    // Check: report whether there's unsaved data
    async () => ({ hasUnsaved: hasUnsavedData() }),
    // Save: save current page before close (must await all async saves)
    async () => { await submitCurrentPage(); }
  );
}

