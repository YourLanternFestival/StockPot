# 代码审计报告 — 2025-07-03 三次提交

**审计范围**: e9764b8 / 6e4fe69 / 1458f55  
**审计人**: Senior Developer  
**修复状态**: P0 + P1 + P2(部分) 已修复，全部测试通过

---

## P0 — 必须立即修复

### 1. `getDashboardStats` — `endStr` 在声明前被使用 (Temporal Dead Zone)

**文件**: `db.js:693-694`  
**引入提交**: 6e4fe69

```js
// line 693 — endStr 在此处被使用
const totalIn = queryOne('...WHERE date <= ?', [endStr]).c;
const totalOut = queryOne('...WHERE date <= ?', [endStr]).c;

// ...7 行之后才声明...
const endStr = toLocalDateStr(today);  // line 701
```

**影响**: 每次调用 `getDashboardStats()` 都会抛出 `ReferenceError: Cannot access 'endStr' before initialization`。仪表盘在应用启动时自动加载（`app.js:248` → `loadDashboard()` → `getDashboardStats()`），所以**每次启动应用仪表盘都会崩溃**，统计卡片、趋势图、饼图全部空白。

**修复**: 将 `today`/`startStr`/`endStr` 的声明移到 `totalIn`/`totalOut` 之前：

```js
function getDashboardStats() {
  const productCount = queryOne('SELECT COUNT(*) as c FROM products WHERE active = 1').c;

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 29);
  const startStr = toLocalDateStr(startDate);
  const endStr = toLocalDateStr(today);  // ← 先声明

  const totalIn = queryOne('...WHERE date <= ?', [endStr]).c;   // 再使用
  const totalOut = queryOne('...WHERE date <= ?', [endStr]).c;
  // ...
}
```

---

## P1 — 应尽快修复

### 2. 四个 CRUD 函数遗漏 `inTransaction` 守卫

**文件**: `db.js:328-337, 365-374`  
**相关提交**: e9764b8

| 函数 | 当前代码 | 问题 |
|------|---------|------|
| `updateInbound` | `save();` | 无条件保存 |
| `deleteInbound` | `save();` | 无条件保存 |
| `updateOutbound` | `save();` | 无条件保存 |
| `deleteOutbound` | `save();` | 无条件保存 |

`addInbound`/`addOutbound`/`addPurchaseOrder`/`updatePurchaseOrder`/`deletePurchaseOrder` 都已加上 `if (!inTransaction) save()` 守卫，但这4个被遗漏。

**风险**: 如果未来在事务中调用这些函数（如批量编辑/批量删除），`save()` 会将事务中间状态写入磁盘。若事务后续回滚，磁盘文件仍保留已提交的部分数据，导致数据不一致。

**修复**:
```js
function updateInbound(id, { date, quantity, remark, production_date, expiry_date }) {
  run('UPDATE inbound_records SET ...', [...]);
  if (!inTransaction) save();  // ← 加守卫
}
// 同理处理 deleteInbound / updateOutbound / deleteOutbound
```

### 3. 出库批量提交 — 同批次同一产品多行不扣减累计库存

**文件**: `renderer/outbound.js:180, 214-217`  
**相关提交**: e9764b8

```js
const inventory = await window.api.getInventory();  // ← 只取一次

for (const tr of rows) {
  // ...
  const inv = inventory.find(x => x.id === product.id);
  if (inv && qty > inv.stock) {  // ← 每行都和原始库存比
    skipped.push('库存不足');
    continue;
  }
  records.push({ product_id: product.id, ... });
}
```

**场景**: 库存 100，两行都出库同一产品各 80：
- 第1行: 80 ≤ 100 ✓ 通过
- 第2行: 80 ≤ 100 ✓ 通过
- 实际总出库: 160，超额 60

**修复**: 在循环中跟踪累计扣减量：

```js
const inventory = await window.api.getInventory();
const deductMap = {};  // { productId: 已扣减总量 }

for (const tr of rows) {
  // ...
  const inv = inventory.find(x => x.id === product.id);
  const alreadyDeducted = deductMap[product.id] || 0;
  const available = inv ? inv.stock - alreadyDeducted : 0;
  if (qty > available) {
    skipped.push(`第${rowIdx}行：${name} 库存不足（可用: ${available}，需要: ${qty}）`);
    continue;
  }
  deductMap[product.id] = alreadyDeducted + qty;
  records.push({ ... });
}
```

### 4. `getProductStockDetail` — `totalIn`/`totalOut` 未加 `date <= today` 过滤

**文件**: `db.js:463-471`  
**相关提交**: 6e4fe69（全链路过滤遗漏点）

```js
// stock 正确过滤了（用 monthEnd = today）
const stock = prevStock + monthIn - monthOut;

// 但累计值没有过滤 — 包含未来日期记录
const totalIn = queryOne(
  "SELECT COALESCE(SUM(quantity), 0) as v FROM inbound_records WHERE product_id = ?",
  // ← 缺少 AND date <= today
  [productId]
).v;
```

**影响**: 产品详情页显示的"累计入库/出库"包含未来日期记录，与库存数不一致。用户会看到 `累计入库 - 累计出库 + 期初 ≠ 当前库存` 的矛盾。

**修复**:
```js
const todayStr = toLocalDateStr(new Date());
const totalIn = queryOne(
  "SELECT COALESCE(SUM(quantity), 0) as v FROM inbound_records WHERE product_id = ? AND date <= ?",
  [productId, todayStr]
).v;
const totalOut = queryOne(
  "SELECT COALESCE(SUM(quantity), 0) as v FROM outbound_records WHERE product_id = ? AND date <= ?",
  [productId, todayStr]
).v;
```

---

## P2 — 代码质量 / 健壮性

### 5. 确认弹窗 — 用户输入未转义，XSS 风险

**文件**: `renderer/inbound.js:256-265`, `renderer/outbound.js:237-246`  
**相关提交**: e9764b8

```js
// 品名、领取人直接拼入 innerHTML
const rowsPreview = records.map(r =>
  `<tr><td>${r.date}</td><td>${PRODUCTS.find(p=>p.id===r.product_id)?.name||r.product_id}</td><td>${r.quantity}</td></tr>`
).join('');
```

产品名来自用户输入，如果包含 `<script>` 或 `"` 等字符，会被当作 HTML 执行。虽然是 Electron 应用风险较低，但仍应防御。

**修复**: 使用已有的 `escHtml()` 函数：
```js
const rowsPreview = records.map(r => {
  const name = escHtml(PRODUCTS.find(p=>p.id===r.product_id)?.name || String(r.product_id));
  return `<tr><td>${escHtml(r.date)}</td><td>${name}</td><td>${escHtml(r.quantity)}</td></tr>`;
}).join('');
```

### 6. `markInboundHistoryDirty` / `markOutboundHistoryDirty` — 死代码

**文件**: `renderer/inbound.js:318`, `renderer/outbound.js:299`  
**相关提交**: 6e4fe69

这两个封装函数声明了但从未被调用。所有脏标记设置点都直接写 `inboundHistoryDirty = true`。

**建议**: 删除死代码，或统一通过函数调用设置脏标记以提高可维护性。

### 7. 旧导入函数使用 `run('BEGIN')` 而非 `beginTransaction()` — 事务管理不一致

**文件**: `db.js:582, 601, 618, 666`  
**状态**: 预存问题（非本次提交引入）

`importProducts`/`importOpeningStock`/`importRecords`/`clearAllData` 使用原始 `run('BEGIN')`，不设置 `inTransaction` 标志。如果这些函数内部调用了已加守卫的 `addInbound` 等函数，守卫会失效（因为 `inTransaction` 仍为 `false`），导致事务中间状态被 `save()` 写入磁盘。

**建议**: 统一使用 `beginTransaction()`/`commit()`/`rollback()` 封装。

### 8. 出库库存检查 — TOCTOU 竞态

**文件**: `renderer/outbound.js:180 vs 264`  
**相关提交**: e9764b8

库存检查（`getInventory()`）和实际写入（`batchAddOutbound()`）之间有时间差。单用户 Electron 应用风险低，但如果用户同时打开两个窗口操作，或前端有其他异步操作在间隙修改了数据，检查结果可能过期。

**建议**: 在 `batchAddOutbound` 数据库层加库存校验（事务内查询当前库存 → 校验 → 插入），实现原子性的检查-写入。

---

## 总结

| 级别 | 数量 | 关键问题 |
|------|------|---------|
| P0 | 1 | 仪表盘必崩（endStr 未声明先使用） |
| P1 | 3 | 事务守卫遗漏 / 批量出库超额 / 累计值不过滤 |
| P2 | 4 | XSS / 死代码 / 事务不一致 / TOCTOU |

**最优先**: 立即修复 P0（移动 `endStr` 声明位置），否则仪表盘完全不可用。

---

## 第二轮修复 — 用户反馈后追加

### 9. 删除单条记录后 DOM 全量重建导致输入卡顿

**文件**: `renderer/inbound.js:doDeleteInbound`, `renderer/outbound.js:doDeleteOutbound`  
**状态**: 已修复

**问题**: 删除单条记录后调用 `loadRecentInbound()`/`loadRecentOutbound()`，这些函数会 `getInbound({})` 拉取全部记录然后用 `container.innerHTML = renderHistoryTree(tree, 'inbound')` 重建整个历史树 DOM。记录多时阻塞主线程，输入框长时间无法响应。

**修复**: 新增 `removeHistoryRowFromDOM(recordId, type)` 函数（`utils.js`），只移除对应的 `<tr>` 元素并更新父级 day/month/year 计数，空节点自动清理。仅当 DOM 中找不到行时才退回全量刷新。

### 10. 删除/编辑后库存查询不实时刷新

**文件**: `renderer/inventory.js`, `renderer/inbound.js`, `renderer/outbound.js`, `renderer/utils.js`, `renderer/data-io.js`  
**状态**: 已修复

**问题**: 删除/编辑出入库记录后，库存查询页之前搜索的产品详情不会自动刷新，需要重新搜索才能看到最新数据。

**修复**: 新增全局 `inventoryDetailDirty` 标志。所有数据变更操作（删除/编辑/批量提交/批量删除/移动日期/导入）后设为 `true`。`inventory.js` 记录 `currentInvProductId`，切换到库存页时检查脏标记并自动刷新当前查询的产品详情。
