// ===== State =====
let PRODUCTS = [];
let RECIPIENTS = [];
let ENTER_MODE = 'next-row'; // 'next-row' | 'next-cell'

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
    case 'history': initHistoryPage(); break;
    case 'inquiry': initInquiryPage(); break;
    case 'inbound': initInboundPage(); break;
    case 'outbound': initOutboundPage(); break;
    case 'settings': initSettingsPage(); break;
    case 'help': break; // 帮助页面无需初始化
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

  // Clean old purchase orders (keep 3 days)
  await window.api.cleanOldPurchaseOrders(3);

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

