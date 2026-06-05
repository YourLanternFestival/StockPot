// ===== Dashboard =====
let trendChart = null;
let pieChart = null;

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
