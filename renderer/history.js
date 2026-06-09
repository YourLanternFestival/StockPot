// ===== 历史采购记录 =====
let historySelectedDate = '';
let historyData = [];

async function initHistoryPage() {
  await loadHistoryDates();
}

async function loadHistoryDates() {
  try {
    const dates = await window.api.getPurchaseHistoryDates();
    const container = document.getElementById('history-dates');

    if (!dates || dates.length === 0) {
      container.innerHTML = '<span style="color:var(--text-muted);">暂无历史记录</span>';
      document.getElementById('history-content').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">暂无历史采购记录</div>';
      return;
    }

    container.innerHTML = dates.map((d, idx) => {
      const dateStr = d.date;
      const label = dateStr.slice(5); // "06-07"
      return `<button class="btn btn-sm ${idx === 0 ? 'btn-primary' : ''}" onclick="loadHistoryByDate('${dateStr}', this)">${label}</button>`;
    }).join('');

    // Load the most recent date
    await loadHistoryByDate(dates[0].date, container.querySelector('button'));
  } catch (err) {
    console.error('Load history dates error:', err);
  }
}

async function loadHistoryByDate(date, btn) {
  // Update button styles
  document.querySelectorAll('#history-dates button').forEach(b => {
    b.classList.remove('btn-primary');
  });
  if (btn) btn.classList.add('btn-primary');

  historySelectedDate = date;

  try {
    const orders = await window.api.getPurchaseOrdersByDate(date);

    // 对 unit_price=0 的记录从询价表反查价格（矩阵模式保存时不带价格）
    await enrichOrderPrices(orders);

    historyData = orders;
    renderHistoryContent(orders, date);
  } catch (err) {
    console.error('Load history by date error:', err);
  }
}

// 从询价表反查价格，填充 unit_price=0 的记录
async function enrichOrderPrices(orders) {
  const needPrice = orders.filter(o => (!o.unit_price || o.unit_price === 0) && o.product_name);
  if (needPrice.length === 0) return;

  const discountRate = parseFloat(APP_SETTINGS.discount1_rate) || 1;
  const dec = Math.max(0, APP_SETTINGS.price_decimals || 2);
  const factor = Math.pow(10, dec);

  // 获取最新月份的询价数据
  let currentMonth = null;
  try {
    const months = await window.api.getInquiryMonths();
    currentMonth = months.length > 0 ? months[0].month : null;
  } catch (e) { /* ignore */ }

  if (!currentMonth) return;

  // 逐条反查（批量查询避免全表扫描）
  for (const order of needPrice) {
    try {
      const results = await window.api.searchInquiryItems(order.product_name, currentMonth);
      const match = results.find(r => r.name.toLowerCase() === order.product_name.toLowerCase()) || results[0];
      if (match && match.price) {
        const rawPrice = match.price;
        order.unit_price = Math.round(rawPrice * discountRate * factor) / factor;
        // 纯数字校验：与 recalcRowAmount 一致，"60片" 等非纯数字 quantity 的 amount 为 0
        const qtyStr = String(order.quantity || '').trim();
        const qtyNum = parseFloat(qtyStr);
        if (qtyStr && !isNaN(qtyNum) && String(qtyNum) === qtyStr) {
          order.amount = Math.round(order.unit_price * qtyNum * factor) / factor;
        } else {
          order.amount = 0;
        }
      }
    } catch (e) { /* skip */ }
  }
}

// ===== 渲染：小所模式（每日一卡、所内分割） =====

function renderSmallCanteenHistory(orders, date) {
  const dec = APP_SETTINGS.price_decimals || 2;
  const smallCanteens = APP_SETTINGS.small_canteens || [];

  // 按 source 分组
  const groups = {};
  orders.forEach(order => {
    const source = order.source || '未知';
    if (!groups[source]) groups[source] = [];
    groups[source].push(order);
  });

  // 按小所聚合：每个小所有厨房和联华两个子集
  const canteenData = [];
  const seenCanteens = new Set();

  // 先按配置顺序
  const orderedNames = [...smallCanteens];
  // 再补数据中有但配置里没有的旧小所
  Object.keys(groups).forEach(source => {
    const name = source.replace(/-厨房$/, '').replace(/-联华$/, '');
    if (!orderedNames.includes(name)) orderedNames.push(name);
  });

  orderedNames.forEach(name => {
    const kitchenKey = `${name}-厨房`;
    const lianhuaKey = `${name}-联华`;
    const kitchen = groups[kitchenKey] || [];
    const lianhua = groups[lianhuaKey] || [];
    if (kitchen.length === 0 && lianhua.length === 0) return;
    seenCanteens.add(name);
    canteenData.push({ name, kitchen, lianhua });
  });

  if (canteenData.length === 0) {
    return '<div style="text-align:center;padding:40px;color:var(--text-muted);">该日期无采购记录</div>';
  }

  // 总计
  const grandTotal = canteenData.reduce((sum, c) => {
    const kitchenSum = c.kitchen.reduce((s, i) => s + (i.amount || 0), 0);
    const lianhuaSum = c.lianhua.reduce((s, i) => s + (i.amount || 0), 0);
    return sum + kitchenSum + lianhuaSum;
  }, 0);

  let html = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header" style="cursor:pointer;" onclick="toggleHistoryGroup(this)">
        <span class="group-toggle" style="transition:transform 0.2s;">▶</span>
        <h3>${date} 采购单 <span style="margin-left:auto;font-weight:600;color:var(--primary);">合计: ¥${grandTotal.toFixed(dec)}</span></h3>
      </div>
      <div class="card-body" style="display:none;padding:16px;">
  `;

  canteenData.forEach(c => {
    const kitchenSum = c.kitchen.reduce((s, i) => s + (i.amount || 0), 0);
    const lianhuaSum = c.lianhua.reduce((s, i) => s + (i.amount || 0), 0);
    const canteenTotal = kitchenSum + lianhuaSum;

    html += `<div class="history-canteen-section" style="margin-bottom:24px;">`;
    html += `<div class="history-canteen-divider" style="text-align:center;margin:16px 0 12px;font-weight:600;color:var(--primary);font-size:14px;">————————${c.name}————————</div>`;

    // 厨房
    if (c.kitchen.length > 0) {
      html += renderHistoryTable('厨房申购', c.kitchen, kitchenSum, dec);
    }

    // 联华
    if (c.lianhua.length > 0) {
      html += renderHistoryTable('联华加购', c.lianhua, lianhuaSum, dec);
    }

    // 所合计
    html += `<div style="text-align:right;font-weight:600;padding:8px 4px;color:var(--primary);">${c.name}合计: ¥${canteenTotal.toFixed(dec)}</div>`;
    html += `</div>`;
  });

  html += `</div></div>`;
  return html;
}

function renderHistoryTable(title, items, subtotal, dec) {
  let html = `
    <div style="margin-bottom:8px;">
      <div style="font-weight:500;margin-bottom:4px;font-size:13px;color:var(--text-secondary);">${title}</div>
      <table class="table" style="font-size:13px;">
        <thead>
          <tr>
            <th style="width:40px;">序号</th>
            <th style="min-width:120px;">品名</th>
            <th>规格</th>
            <th>单价</th>
            <th>数量</th>
            <th>单位</th>
            <th>金额</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
  `;
  items.forEach((item, idx) => {
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td style="text-align:left;">${item.product_name}</td>
        <td>${item.spec || ''}</td>
        <td>${(item.unit_price || 0).toFixed(dec)}</td>
        <td>${item.quantity || ''}</td>
        <td>${item.unit || ''}</td>
        <td style="text-align:right;">${item.amount != null ? '¥' + item.amount.toFixed(dec) : ''}</td>
        <td>${item.remark || ''}</td>
      </tr>
    `;
  });
  html += `
        </tbody>
      </table>
      <div style="text-align:right;font-size:13px;color:var(--text-muted);padding:4px;">小计: ¥${subtotal.toFixed(dec)}</div>
    </div>
  `;
  return html;
}

// ===== 渲染：默认/多食堂模式（按 source 分组） =====

function renderDefaultHistory(orders) {
  const dec = APP_SETTINGS.price_decimals || 2;
  const xiaosuoMode = APP_SETTINGS.xiaosuo_mode || 'off';

  // 按 source 分组
  const groups = {};
  orders.forEach(order => {
    const source = order.source || '未知';
    if (!groups[source]) groups[source] = [];
    groups[source].push(order);
  });

  // 确定 source 排序
  let orderedSources = [];
  if (xiaosuoMode === 'on') {
    ['下涯', '制杆厂', '白南山'].forEach(name => {
      orderedSources.push(`${name}-联华`);
      orderedSources.push(`${name}-厨房`);
    });
  } else {
    orderedSources = ['联华', '洋安食堂厨房', '洋安面点房', '新安食堂厨房', '新安面点房', '洋安厨房', '新安厨房'];
  }
  Object.keys(groups).forEach(source => {
    if (!orderedSources.includes(source)) orderedSources.push(source);
  });

  let html = '';
  orderedSources.forEach(source => {
    const items = groups[source];
    if (!items || items.length === 0) return;
    const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

    html += `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="cursor:pointer;" onclick="toggleHistoryGroup(this)">
          <span class="group-toggle" style="transition:transform 0.2s;">▶</span>
          <h3>${source} <span class="tag tag-info">${items.length} 项</span> <span style="margin-left:auto;font-weight:600;color:var(--primary);">¥${totalAmount.toFixed(dec)}</span></h3>
        </div>
        <div class="card-body" style="display:none;padding:0;">
          <table class="table" style="font-size:13px;">
            <thead>
              <tr>
                <th style="width:40px;">序号</th>
                <th style="min-width:120px;">品名</th>
                <th>规格</th>
                <th>单价</th>
                <th>数量</th>
                <th>单位</th>
                <th>金额</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td style="text-align:left;">${item.product_name}</td>
                  <td>${item.spec || ''}</td>
                  <td>${(item.unit_price || 0).toFixed(dec)}</td>
                  <td>${item.quantity || ''}</td>
                  <td>${item.unit || ''}</td>
                  <td style="text-align:right;">${item.amount != null ? '¥' + item.amount.toFixed(dec) : ''}</td>
                  <td>${item.remark || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  return html || '<div style="text-align:center;padding:40px;color:var(--text-muted);">该日期无采购记录</div>';
}

// ===== 入口 =====

function renderHistoryContent(orders, date) {
  const container = document.getElementById('history-content');
  const xiaosuoMode = APP_SETTINGS.xiaosuo_mode || 'off';

  if (!orders || orders.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">该日期无采购记录</div>';
    return;
  }

  if (xiaosuoMode === 'small') {
    container.innerHTML = renderSmallCanteenHistory(orders, date);
  } else {
    container.innerHTML = renderDefaultHistory(orders);
  }
}

function toggleHistoryGroup(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.group-toggle');
  const isVisible = body.style.display !== 'none';
  body.style.display = isVisible ? 'none' : 'block';
  toggle.style.transform = isVisible ? '' : 'rotate(90deg)';
}
