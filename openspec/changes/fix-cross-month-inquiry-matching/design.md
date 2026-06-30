# Design: 修复采购单跨月询价匹配 + 调取日期默认值

## 1. P1: 调取弹窗默认日期

**当前**：`showRecallPurchaseModal` 硬编码 `from = today, to = today`。

**问题**：receive_date > today 的采购单（月末录入的下月采购单）被默认日期范围排除，用户不手动改日期就调取不到。

**方案**：

```javascript
// 改前
function showRecallPurchaseModal() {
  const today = todayStr();
  openModal('调取采购历史', `
    <input id="recall-date-from" value="${today}">
    <input id="recall-date-to" value="${today}">
  `);
}

// 改后
async function showRecallPurchaseModal() {
  const today = todayStr();
  // 从 DB 查询所有 source 中最大的 receive_date 作为默认结束日期
  const maxDate = await getLatestReceiveDate() || today;
  // from = today，to = max(today, maxReceiveDate)
  const toDate = maxDate > today ? maxDate : today;
  openModal('调取采购历史', `
    <input id="recall-date-from" value="${today}">
    <input id="recall-date-to" value="${toDate}">
  `);
}
```

**`getLatestReceiveDate` 实现**：新增 preload API → main.js handler → db.js 查询 `SELECT MAX(receive_date) FROM purchase_orders`。

**关键设计**：
- from 保持 today（用户通常从今天开始查）
- to 默认取 DB 中最大的 receive_date（覆盖已录入的未来采购单）
- 如果 DB 无数据或最大日期 ≤ today，to 仍为 today（兼容空库场景）

**文件**：`renderer/purchase.js:1850-1859`, `preload.js`, `main.js`, `db.js`

## 2. P2: 自动补全按 receive_date 月份查询

**当前**：3 处自动补全都从 `document.getElementById('inquiry-month')?.value` 读取月份，fallback 到 `getInquiryMonths()[0].month`。

**问题**：跨月采购单的 receive_date 月份与 inquiry-month selector 月份不一致，匹配到错误的询价数据。

**方案**：新增 `getInquiryMonthForInput(input)` 辅助函数：

```javascript
// 从 input 所在 date-group 提取 receive_date，转换为 "YYYY-MM"
function getInquiryMonthForInput(input) {
  const dateGroup = input.closest('.date-group');
  if (!dateGroup) return null;
  
  const dateLabel = dateGroup.querySelector('.date-label');
  if (!dateLabel) return null;
  
  const dateText = dateLabel.textContent.replace(' 收货', '').replace(' 发货', '').trim();
  // dateText 可能是 "2026-07-01" 或 "7月1日"
  return dateToMonthStr(dateText);
}

// 将日期字符串转为 "YYYY-MM" 格式
function dateToMonthStr(dateStr) {
  // 尝试 "YYYY-MM-DD" 格式
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  
  // 尝试 "M月D日" 格式（DB 中存储的格式）
  const cnMatch = dateStr.match(/(\d+)月(\d+)日/);
  if (cnMatch) {
    const now = new Date();
    const year = now.getFullYear();
    const month = parseInt(cnMatch[1]);
    // 如果月份远小于当前月（如当前12月，日期是1月），推断为下一年
    const inferredYear = (month < now.getMonth() + 1 - 6) ? year + 1 : year;
    return `${inferredYear}-${String(month).padStart(2, '0')}`;
  }
  
  return null;
}
```

**使用方式**（以 `handleProductBlur` 为例）：

```javascript
// 改前
let currentMonth = document.getElementById('inquiry-month')?.value;
if (!currentMonth) {
  const months = await window.api.getInquiryMonths();
  currentMonth = months.length > 0 ? months[0].month : null;
}
const results = await window.api.searchInquiryItems(keyword, currentMonth);

// 改后
const targetMonth = getInquiryMonthForInput(input);
const results = await resolveInquirySearch(keyword, targetMonth);
```

**三处改动位置**：
- `handleMatrixProductBlur` (L440)
- `handleProductBlur` 失焦匹配 (L1165)
- `handleProductAutocomplete` 下拉搜索 (L1248)

## 3. P3: 缺少询价时弹窗降级

**`resolveInquirySearch(keyword, targetMonth)` 函数**：

```javascript
async function resolveInquirySearch(keyword, targetMonth) {
  // 先查目标月份
  if (targetMonth) {
    const results = await window.api.searchInquiryItems(keyword, targetMonth);
    if (results.length > 0) return results;
  }
  
  // 目标月份无结果，检查该月份是否有询价数据
  if (targetMonth) {
    const availableMonths = await window.api.getInquiryMonths();
    const monthExists = availableMonths.some(m => m.month === targetMonth);
    
    if (!monthExists) {
      // 弹窗询问是否沿用上月
      const fallbackMonth = getPreviousMonthStr(targetMonth);
      const useFallback = await showInquiryFallbackDialog(targetMonth, fallbackMonth);
      
      if (useFallback && fallbackMonth) {
        return await window.api.searchInquiryItems(keyword, fallbackMonth);
      }
    }
  }
  
  // 最后 fallback：用最新可用月份
  const months = await window.api.getInquiryMonths();
  const latestMonth = months.length > 0 ? months[0].month : null;
  if (latestMonth && latestMonth !== targetMonth) {
    return await window.api.searchInquiryItems(keyword, latestMonth);
  }
  
  return [];
}
```

**弹窗 `showInquiryFallbackDialog`**：

```
┌─────────────────────────────────────────────┐
│  询价数据缺失                                │
├─────────────────────────────────────────────┤
│                                             │
│  7月询价尚未导入，是否沿用6月询价？           │
│  请尽快导入7月询价。                         │
│                                             │
│     [沿用6月询价]        [手动输入]          │
│                                             │
└─────────────────────────────────────────────┘
```

- 使用 `confirm()` 或简单的 `openModal`，返回 boolean
- **首次弹窗后记录到 session 级别 flag**，同一月份不再重复弹窗（避免每次自动补全都弹）
- flag 格式：`window._inquiryFallbackConfirmed = { '2026-07': '2026-06' }`

**P2+P3 在 history.js 的应用**：

`enrichOrderPrices` (L102) 当前用最新月份反查。改为：

```javascript
// 改前
const months = await window.api.getInquiryMonths();
currentMonth = months.length > 0 ? months[0].month : null;
const results = await window.api.searchInquiryItems(order.product_name, currentMonth);

// 改后：按 order.receive_date 的月份查询，无则 fallback 最新
const orderMonth = dateToMonthStr(order.receive_date);
const results = await resolveInquirySearch(order.product_name, orderMonth);
```

history.js 中**不弹窗**——`resolveInquirySearch` 增加 `silent` 参数，history 场景传入 `{ silent: true }`，缺少时静默 fallback 到最新月份。

## 影响范围

- **无 IPC 协议变更**：`getInquiryMonths`、`searchInquiryItems` 已存在，仅调用方式变化
- **新增 IPC**：`getLatestReceiveDate` 用于 P1
- **新增辅助函数**：`getInquiryMonthForInput`、`dateToMonthStr`、`resolveInquirySearch`、`showInquiryFallbackDialog`、`getPreviousMonthStr`
- **session 级别状态**：`window._inquiryFallbackConfirmed` 避免重复弹窗
- **DB 层不变**：无需新表或 schema 变更
