// ===== Dashboard =====
let trendChart = null;
let pieChart = null;

async function loadDashboard() {
  try {
    // 动态更新日期显示（避免硬编码年份过期）
    const now = new Date();
    const dateEl = document.getElementById('dashboard-date');
    if (dateEl) dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

    const stats = await window.api.getDashboardStats();

    // Update stat cards
    document.getElementById('stat-products').textContent = stats.productCount;
    document.getElementById('stat-inbound').textContent = stats.totalIn.toLocaleString();
    document.getElementById('stat-outbound').textContent = stats.totalOut.toLocaleString();

    // Alert count
    const alerts = await window.api.getAlerts(APP_SETTINGS.alert_short_days || 30);
    document.getElementById('stat-alerts').textContent = alerts.length;
    document.getElementById('alert-badge').textContent = alerts.length;
    document.getElementById('alert-badge').style.display = alerts.length > 0 ? 'inline' : 'none';

    // Trend chart
    renderTrendChart(stats.days);

    // Pie chart
    renderPieChart(stats.top10);
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
          borderColor: '#5D8A3C',
          backgroundColor: 'rgba(93,138,60,0.08)',
          fill: true, tension: 0.3, pointRadius: 2,
        },
        {
          label: '出库',
          data: days.map(d => d.outQty),
          borderColor: '#C04A1A',
          backgroundColor: 'rgba(192,74,26,0.06)',
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
          '#3E4A32', '#5D6B4D', '#8FBC8F', '#C8B89E', '#D4E4C1',
          '#A8C898', '#7BA06F', '#B8D4A0', '#D0C8B0', '#E8E0D0'
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
