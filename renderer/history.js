// ===== 历史采购记录 =====
let historySelectedDate = '';
let historyData = [];

// 多食堂模式 canteen 列表（与 purchase.js 保持一致）
const MULTI_CANTEEN_NAMES = ['下涯', '制杆厂', '白南山'];

// 获取当前模式下应显示/排除的 source 列表
function getModeSourceFilter() {
  const mode = APP_SETTINGS.xiaosuo_mode || 'off';
  if (mode === 'on') {
    const sources = [];
    MULTI_CANTEEN_NAMES.forEach(c => { sources.push(`${c}-厨房`, `${c}-联华`); });
    return { sources, excludeSources: null };
  }
  if (mode === 'small') {
    const canteens = APP_SETTINGS.small_canteens || [];
    const sources = [];
    canteens.forEach(c => { sources.push(`${c}-厨房`, `${c}-面点房`, `${c}-联华`); });
    return { sources, excludeSources: null };
  }
  // 默认模式：排除多食堂和小食堂模式的 source
  const excludeSources = [];
  MULTI_CANTEEN_NAMES.forEach(c => { excludeSources.push(`${c}-厨房`, `${c}-联华`); });
  const smallCanteens = APP_SETTINGS.small_canteens || [];
  smallCanteens.forEach(c => { excludeSources.push(`${c}-厨房`, `${c}-面点房`, `${c}-联华`); });
  return { sources: null, excludeSources };
}

// 判断单条订单是否属于当前模式
function isOrderInCurrentMode(order) {
  const { sources, excludeSources } = getModeSourceFilter();
  const src = order.source || '';
  if (sources) return sources.includes(src);
  if (excludeSources) return !excludeSources.includes(src);
  return true;
}

async function initHistoryPage() {
  await loadHistoryDates();
}

async function loadHistoryDates() {
  try {
    const retentionDays = APP_SETTINGS.purchase_retention_days || 31;
    const { sources, excludeSources } = getModeSourceFilter();
    const dates = await window.api.getPurchaseHistoryDates(retentionDays, sources, excludeSources);
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
  document.querySelectorAll('#history-dates button').forEach(b => {
    b.classList.remove('btn-primary');
  });
  if (btn) btn.classList.add('btn-primary');

  historySelectedDate = date;

  try {
    let orders = await window.api.getPurchaseOrdersByDate(date);

    // 只保留当前模式下的订单
    orders = (orders || []).filter(isOrderInCurrentMode);

    if (orders.length === 0) {
      document.getElementById('history-content').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">该日期在当前模式下无采购记录</div>';
      return;
    }

    try {
      await enrichOrderPrices(orders);
    } catch (e) {
      console.error('[history] enrichOrderPrices failed:', e);
    }

    historyData = orders;
    renderHistoryContent(orders, date);
  } catch (err) {
    console.error('Load history by date error:', err);
  }
}

// 从询价表反查价格，填充 unit_price=0 的记录
// 按每条 order 的 receive_date 月份查询，缺失时静默 fallback
async function enrichOrderPrices(orders) {
  const needPrice = orders.filter(o => (!o.unit_price || o.unit_price === 0) && o.product_name);
  if (needPrice.length === 0) return;

  const discountRate = parseFloat(APP_SETTINGS.discount1_rate) || 1;
  const dec = Math.max(0, APP_SETTINGS.price_decimals || 2);
  const factor = Math.pow(10, dec);

  // 获取所有可用询价月份（复用 purchase.js 的缓存，避免重复 IPC）
  if (!window._availableInquiryMonths) {
    try {
      const months = await window.api.getInquiryMonths();
      window._availableInquiryMonths = months.map(m => m.month);
    } catch (e) { /* ignore */ }
  }
  const availableMonths = window._availableInquiryMonths || [];
  if (availableMonths.length === 0) return;
  const monthSet = new Set(availableMonths);

  // 逐条反查：按 receive_date 月份查询，缺失时 fallback
  for (const order of needPrice) {
    try {
      const targetMonth = dateToMonthStr(order.receive_date);
      let searchMonth = null;

      // 1. 优先用 targetMonth
      if (targetMonth && monthSet.has(targetMonth)) {
        searchMonth = targetMonth;
      } else if (targetMonth) {
        // 2. targetMonth 缺失 → fallback 上月
        const prevMonth = getPreviousMonthStr(targetMonth);
        if (prevMonth && monthSet.has(prevMonth)) {
          searchMonth = prevMonth;
        }
      }

      // 3. 兜底：最新月份
      if (!searchMonth && availableMonths.length > 0) {
        searchMonth = availableMonths[0].month;
      }
      if (!searchMonth) continue;

      const results = await window.api.searchInquiryItems(order.product_name, searchMonth);
      const match = results.find(r => r.name.toLowerCase() === order.product_name.toLowerCase()) || results[0];
      if (match && match.price) {
        const rawPrice = match.price;
        order.unit_price = Math.round(rawPrice * discountRate * factor) / factor;
        // 纯数字校验：与 recalcRowAmount 一致，"60片" 等非纯数字 quantity 的 amount 为 0
        const qtyStr = String(order.quantity ?? '').trim();
        const qtyNum = parseFloat(qtyStr);
        if (qtyStr && !isNaN(qtyNum) && !isNaN(Number(qtyStr))) {
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
        <h3>${date} 采购单 <span style="margin-left:auto;font-weight:600;color:var(--primary);">合计: ¥${Number(grandTotal).toFixed(dec)}</span></h3>
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
    html += `<div style="text-align:right;font-weight:600;padding:8px 4px;color:var(--primary);">${c.name}合计: ¥${Number(canteenTotal).toFixed(dec)}</div>`;
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
        <td>${Number(item.unit_price || 0).toFixed(dec)}</td>
        <td>${item.quantity || ''}</td>
        <td>${item.unit || ''}</td>
        <td style="text-align:right;">${item.amount != null ? '¥' + Number(item.amount).toFixed(dec) : ''}</td>
        <td>${item.remark || ''}</td>
      </tr>
    `;
  });
  html += `
        </tbody>
      </table>
      <div style="text-align:right;font-size:13px;color:var(--text-muted);padding:4px;">小计: ¥${Number(subtotal).toFixed(dec)}</div>
    </div>
  `;
  return html;
}

// ===== 渲染：默认/多食堂模式（按 source 分组） =====

// 多食堂模式历史：按所分割（复用小所模式的分割线布局）
function renderMultiCanteenHistory(orders, date) {
  const dec = APP_SETTINGS.price_decimals || 2;
  const canteenNames = ['下涯', '制杆厂', '白南山'];

  const groups = {};
  orders.forEach(order => {
    const source = order.source || '未知';
    if (!groups[source]) groups[source] = [];
    groups[source].push(order);
  });

  const canteenData = [];
  canteenNames.forEach(name => {
    const kitchen = groups[`${name}-厨房`] || [];
    const lianhua = groups[`${name}-联华`] || [];
    if (kitchen.length === 0 && lianhua.length === 0) return;
    canteenData.push({ name, kitchen, lianhua });
  });

  if (canteenData.length === 0) {
    return '<div style="text-align:center;padding:40px;color:var(--text-muted);">该日期无采购记录</div>';
  }

  const grandTotal = canteenData.reduce((sum, c) => {
    return sum + c.kitchen.reduce((s, i) => s + (i.amount || 0), 0) + c.lianhua.reduce((s, i) => s + (i.amount || 0), 0);
  }, 0);

  let html = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header" style="cursor:pointer;" onclick="toggleHistoryGroup(this)">
        <span class="group-toggle" style="transition:transform 0.2s;">▶</span>
        <h3>${date} 采购单 <span style="margin-left:auto;font-weight:600;color:var(--primary);">合计: ¥${Number(grandTotal).toFixed(dec)}</span></h3>
      </div>
      <div class="card-body" style="display:none;padding:16px;">
  `;

  canteenData.forEach(c => {
    const kitchenSum = c.kitchen.reduce((s, i) => s + (i.amount || 0), 0);
    const lianhuaSum = c.lianhua.reduce((s, i) => s + (i.amount || 0), 0);
    const canteenTotal = kitchenSum + lianhuaSum;

    html += `<div class="history-canteen-section" style="margin-bottom:24px;">`;
    html += `<div class="history-canteen-divider" style="text-align:center;margin:16px 0 12px;font-weight:600;color:var(--primary);font-size:14px;">————————${c.name}————————</div>`;

    if (c.kitchen.length > 0) {
      html += renderHistoryTable('厨房申购', c.kitchen, kitchenSum, dec);
    }
    if (c.lianhua.length > 0) {
      html += renderHistoryTable('联华加购', c.lianhua, lianhuaSum, dec);
    }

    html += `<div style="text-align:right;font-weight:600;padding:8px 4px;color:var(--primary);">${c.name}合计: ¥${Number(canteenTotal).toFixed(dec)}</div>`;
    html += `</div>`;
  });

  html += `</div></div>`;
  return html;
}

// 默认模式历史：按 source 分组（每个 source 独立卡片）
function renderDefaultHistory(orders) {
  const dec = APP_SETTINGS.price_decimals || 2;

  const groups = {};
  orders.forEach(order => {
    const source = order.source || '未知';
    if (!groups[source]) groups[source] = [];
    groups[source].push(order);
  });

  const orderedSources = ['联华', '洋安食堂厨房', '洋安面点房', '新安食堂厨房', '新安面点房', '洋安厨房', '新安厨房'];
  Object.keys(groups).forEach(source => {
    if (!orderedSources.includes(source)) orderedSources.push(source);
  });

  let html = '';
  orderedSources.forEach(source => {
    const items = groups[source];
    if (!items || items.length === 0) return;
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    html += `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="cursor:pointer;" onclick="toggleHistoryGroup(this)">
          <span class="group-toggle" style="transition:transform 0.2s;">▶</span>
          <h3>${source} <span class="tag tag-info">${items.length} 项</span> <span style="margin-left:auto;font-weight:600;color:var(--primary);">¥${Number(totalAmount).toFixed(dec)}</span></h3>
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
                  <td>${Number(item.unit_price || 0).toFixed(dec)}</td>
                  <td>${item.quantity || ''}</td>
                  <td>${item.unit || ''}</td>
                  <td style="text-align:right;">${item.amount != null ? '¥' + Number(item.amount).toFixed(dec) : ''}</td>
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
  } else if (xiaosuoMode === 'on') {
    container.innerHTML = renderMultiCanteenHistory(orders, date);
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

// ===== 批量导出历史采购单 =====
async function exportHistoryBatch() {
  try {
    const dates = await window.api.getPurchaseHistoryDates(APP_SETTINGS.purchase_retention_days || 31);
    if (!dates || dates.length === 0) {
      showToast('暂无历史记录可导出', 'error');
      return;
    }

    // 弹窗让用户选择要导出的日期
    const selected = await showHistoryExportDialog(dates);
    if (!selected || selected.length === 0) return;

    const dec = APP_SETTINGS.price_decimals || 2;
    const sheets = [];

    for (const date of selected) {
      const orders = await window.api.getPurchaseOrdersByDate(date);
      await enrichOrderPrices(orders);
      if (orders.length === 0) continue;

      // 按 source 分组
      const groups = {};
      orders.forEach(o => {
        const src = o.source || '未知';
        if (!groups[src]) groups[src] = [];
        groups[src].push(o);
      });

      // 区分厨房和联华
      const kitchenRows = [];
      const lianhuaRows = [];

      for (const [source, items] of Object.entries(groups)) {
        const isLianhua = source === '联华' || source.endsWith('-联华');
        const canteenName = isLianhua
          ? source.replace('-联华', '')
          : source.replace(/食堂厨房$|厨房$|面点房$/, '');

        items.forEach(item => {
          const row = {
            canteen: canteenName,
            source,
            product_name: item.product_name,
            spec: item.spec,
            unit_price: item.unit_price,
            quantity: item.quantity,
            unit: item.unit,
            amount: item.amount,
            remark: item.remark,
          };
          if (isLianhua) {
            lianhuaRows.push(row);
          } else {
            kitchenRows.push(row);
          }
        });
      }

      // 厨房 sheet
      if (kitchenRows.length > 0) {
        const kGroups = {};
        kitchenRows.forEach(r => {
          if (!kGroups[r.source]) kGroups[r.source] = [];
          kGroups[r.source].push(r);
        });

        const rows = [];
        for (const [source, items] of Object.entries(kGroups)) {
          const label = source.replace(/食堂厨房$|厨房$/, '');
          rows.push({ isHeader: true, data: [label], mergeRange: 'A:I' });
          rows.push({ isSubHeader: true, data: ['序号', '品名', '规格', '单价', '数量', '单位', '金额', '备注', ''] });
          items.forEach((item, idx) => {
            rows.push({ data: [idx + 1, item.product_name, item.spec, item.unit_price, item.quantity, item.unit, item.amount, item.remark, ''] });
          });
        }

        sheets.push({
          name: `${date}-厨房`,
          title: `${date} 厨房申购单`,
          headers: [],
          colWidths: [8, 20, 15, 10, 10, 8, 10, 20],
          rows,
        });
      }

      // 联华 sheet
      if (lianhuaRows.length > 0) {
        sheets.push({
          name: `${date}-联华`,
          title: `${date} 联华超市`,
          headers: ['序号', '客户名称', '品名', '单位', '规格', '单价', '数量', '金额', '备注'],
          colWidths: [8, 14, 24, 10, 8, 12, 18, 14, 14],
          rows: lianhuaRows.map((row, idx) => ({
            data: [idx + 1, row.canteen, row.product_name, row.unit, row.spec, row.unit_price, row.quantity, row.amount, row.remark]
          })),
        });
      }
    }

    if (sheets.length === 0) {
      showToast('所选日期无数据可导出', 'error');
      return;
    }

    const defaultName = `历史采购单(${selected[0]}至${selected[selected.length - 1]}).xlsx`;
    const result = await window.api.exportPurchaseOrder(sheets, defaultName);
    if (result.success) {
      showToast(result.retryPath ? `文件被占用，已另存为: ${result.retryPath.split(/[\\/]/).pop()}` : `导出成功！共 ${selected.length} 天 ${sheets.length} 张表`);
    } else if (result.error !== '已取消') {
      showToast('导出失败: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

function showHistoryExportDialog(dates) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:center;justify-content:center;';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--card-bg);border-radius:12px;padding:24px;max-width:480px;width:90%;max-height:70vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);';

    panel.innerHTML = `
      <h3 style="margin:0 0 16px;">选择导出日期</h3>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button class="btn btn-sm" onclick="this.parentElement.nextElementSibling.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=true)">全选</button>
        <button class="btn btn-sm" onclick="this.parentElement.nextElementSibling.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=false)">全不选</button>
      </div>
      <div class="export-dialog" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
        ${dates.map((d, i) => `
          <label style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;${i === 0 ? 'background:var(--primary-light);' : ''}">
            <input type="checkbox" value="${d.date}" ${i === 0 ? 'checked' : ''}> ${d.date.slice(5)}
          </label>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn" id="btn-export-cancel">取消</button>
        <button class="btn btn-primary" id="btn-export-confirm">导出</button>
      </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(null); }
    });
    panel.querySelector('#btn-export-cancel').onclick = () => { overlay.remove(); resolve(null); };
    panel.querySelector('#btn-export-confirm').onclick = () => {
      const checked = Array.from(panel.querySelectorAll('input:checked')).map(c => c.value);
      overlay.remove();
      resolve(checked);
    };
  });
}
