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

// ===== Export Ledger =====
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
