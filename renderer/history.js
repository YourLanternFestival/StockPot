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
    historyData = orders;
    renderHistoryContent(orders);
  } catch (err) {
    console.error('Load history by date error:', err);
  }
}

function renderHistoryContent(orders) {
  const container = document.getElementById('history-content');

  if (!orders || orders.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">该日期无采购记录</div>';
    return;
  }

  // Group by source
  const groups = {};
  orders.forEach(order => {
    const source = order.source || '未知';
    if (!groups[source]) groups[source] = [];
    groups[source].push(order);
  });

  const canteenMode = APP_SETTINGS.canteen_mode || 'default';
  const xiaosuoMode = APP_SETTINGS.xiaosuo_mode || 'off';

  // Determine group order based on mode
  let orderedSources = [];
  if (xiaosuoMode === 'small') {
    // 小所模式：按小所名分组
    const smallCanteens = APP_SETTINGS.small_canteens || [];
    smallCanteens.forEach(name => {
      orderedSources.push(`${name}-厨房`);
      orderedSources.push(`${name}-联华`);
    });
  } else if (xiaosuoMode === 'on') {
    // 多食堂模式
    ['下涯', '制杆厂', '白南山'].forEach(name => {
      orderedSources.push(`${name}-联华`);
      orderedSources.push(`${name}-厨房`);
    });
  } else {
    // 默认模式
    orderedSources = ['联华', '洋安厨房', '洋安面点房', '新安厨房', '新安面点房'];
  }

  // Add any sources not in the predefined order
  Object.keys(groups).forEach(source => {
    if (!orderedSources.includes(source)) {
      orderedSources.push(source);
    }
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
          <h3>${source} <span class="tag tag-info">${items.length} 项</span> <span style="margin-left:auto;font-weight:600;color:var(--primary);">¥${totalAmount.toFixed(2)}</span></h3>
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
                  <td>${item.unit_price || ''}</td>
                  <td>${item.quantity || ''}</td>
                  <td>${item.unit || ''}</td>
                  <td style="text-align:right;">${item.amount ? '¥' + item.amount.toFixed(2) : ''}</td>
                  <td>${item.remark || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  container.innerHTML = html || '<div style="text-align:center;padding:40px;color:var(--text-muted);">该日期无采购记录</div>';
}

function toggleHistoryGroup(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.group-toggle');
  const isVisible = body.style.display !== 'none';
  body.style.display = isVisible ? 'none' : 'block';
  toggle.style.transform = isVisible ? '' : 'rotate(90deg)';
}
