// ===== Inventory =====
async function loadInventory() {
  await ensureProducts();
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

// ===== Alerts =====
async function loadAlerts() {
  try {
    const shortDays = APP_SETTINGS.alert_short_days || 30;
    const longDays = APP_SETTINGS.alert_long_days || 60;
    const alerts = await window.api.getAlerts(longDays);
    const today = todayStr();
    const tbody = document.getElementById('alerts-body');

    // Update labels
    const soonLabel = document.getElementById('alert-soon-label');
    const upcomingLabel = document.getElementById('alert-upcoming-label');
    if (soonLabel) soonLabel.textContent = `${shortDays}天内到期`;
    if (upcomingLabel) upcomingLabel.textContent = `${longDays}天内到期`;

    let expired = 0, soon = 0, upcoming = 0;
    alerts.forEach(a => {
      const days = daysBetween(today, a.expiry_date);
      if (days < 0) expired++;
      else if (days <= shortDays) soon++;
      else upcoming++;
    });

    document.getElementById('alert-expired-count').textContent = expired;
    document.getElementById('alert-soon-count').textContent = soon;
    document.getElementById('alert-upcoming-count').textContent = upcoming;

    const filter = document.getElementById('alert-filter').value;
    const filtered = alerts.filter(a => {
      const days = daysBetween(today, a.expiry_date);
      if (filter === 'expired') return days < 0;
      if (filter === 'soon') return days >= 0 && days <= shortDays;
      return true;
    });

    tbody.innerHTML = filtered.map(a => {
      const days = daysBetween(today, a.expiry_date);
      const tagClass = days < 0 ? 'tag-danger' : days <= shortDays ? 'tag-warning' : 'tag-info';
      const statusText = days < 0 ? '已过期' : days <= shortDays ? '即将到期' : '临期';
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
