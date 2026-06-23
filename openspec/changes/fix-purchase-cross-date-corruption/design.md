# Design: 修复采购单跨日期数据污染

## 1. clearPurchasePageDOM — 彻底删除 date-group

**当前**：只清空 `tbody.innerHTML` 和更新 `.date-summary` 文本，`.date-group` div 本身保留。

**问题**：空壳 date-group 残留，后续保存时作为 source 被纳入整表清除范围。

**方案**：`container.querySelectorAll('.date-group').forEach(dg => dg.remove())`。矩阵模式的 `#matrix-tbody` 清空逻辑不变。

**影响**：导出后采购页是真正的白板，用户需要"添加日期"或"调取"才能看到数据。这与 spec 的"采购页仅作为今日编辑区，导出即归档"一致。

**文件**：`renderer/purchase.js:1820-1830`

## 2. savePurchaseOrdersBatch — 按 (source, date) 清除

**当前**：`main.js` handler 接收 `{ sources, orders }`，对每个 source 执行 `db.clearPurchaseOrders(source)` 全表清除，再逐条 INSERT。

**问题**：一个 source 下所有日期的数据被清空，只重新插入当前 DOM 中的 orders。不在 DOM 的日期数据被永久删除。

**方案**：

```javascript
// main.js — 改前
ipcMain.handle('purchaseOrders:saveBatch', (e, { sources, orders }) => {
  db.beginTransaction();
  for (const source of sources) {
    db.clearPurchaseOrders(source);  // DELETE ALL for source
  }
  for (const order of orders) {
    db.addPurchaseOrder(order);
  }
  db.commit();
});

// main.js — 改后
ipcMain.handle('purchaseOrders:saveBatch', (e, { sourceDates, orders }) => {
  db.beginTransaction();
  // 按 (source, date) 精确清除，不影响同 source 其他日期
  for (const { source, date } of sourceDates) {
    if (source && date) {
      db.deletePurchaseOrdersByDate(source, date);
    }
  }
  for (const order of orders) {
    db.addPurchaseOrder(order);
  }
  db.commit();
});
```

**关键变化**：
- 参数从 `sources` (string[]) 改为 `sourceDates` ({source, date}[])
- 清除粒度从 source 级变为 source+date 级
- 事务保护不变（BEGIN → 清除 → 插入 → COMMIT/ROLLBACK）

**文件**：`main.js:205-221`, `preload.js:87`

## 3. saveAllPurchaseOrders — 收集 unique (source, date) 对

**当前**：收集 `sourcesWithDates`（Set of source string），传给 `savePurchaseOrdersBatch` 做整表清除。

**方案**：新增收集 `sourceDates`（Set of "source|||date" key），解构成 `{source, date}[]` 传给后端。

```javascript
// 收集 unique (source, date) 对
const sourceDates = [];
const seenDates = new Set();
dateGroups.forEach(dateGroup => {
  // ... (extract source, receiveDate)
  const key = `${source}|||${receiveDate}`;
  if (!seenDates.has(key)) {
    seenDates.add(key);
    sourceDates.push({ source, date: receiveDate });
  }
  // ... (collect orders)
});

// 传给后端
await window.api.savePurchaseOrdersBatch(sourceDates, allOrders);
```

**边界情况**：`currentSources.length === 0`（无 date-group）的提前返回逻辑保留——DOM 完全空时跳过保存。

**文件**：`renderer/purchase.js:1419-1498`

## 4. saveMatrixData — 同逻辑改为按日期清除

矩阵模式只有一个统一日期（`#matrix-date`），对每个小所 source 按该日期清除。

**文件**：`renderer/purchase.js:626-690`

## 5. saveLianhuaDomData — 同逻辑改为按日期清除

收集联华 DOM 数据中的 unique source+date 对，按对清除。

**文件**：`renderer/purchase.js:1368-1418`

## 6. 空 date-group 误收集修复（本轮新增）

**问题**：`saveAllPurchaseOrders` 和 `saveLianhuaDomData` 中，date-group div 存在但内部没有任何有效行（tr 为空或所有 tr 的 product_name 为空）时，该 (source, date) 仍被加入 `sourceDates`。saveBatch 执行 `DELETE FROM purchase_orders WHERE source=? AND receive_date=?` 后无 INSERT → 该日数据永久丢失。

**触发场景**：
- 调取后用户删光某个 date-group 下所有行 → 导出 → 该日 DB 数据被清空
- DOM 残留空 date-group div → 静默保存时误清对应日期的历史数据

**方案**：在收集 `sourceDates` 时，只收集**确实有有效行**的 date-group。在 `saveAllPurchaseOrders` 中，先判断 date-group 内是否有 product_name 非空的行，没有则跳过该 date-group。`saveLianhuaDomData` 同理。

**文件**：`renderer/purchase.js:1441-1491`, `renderer/purchase.js:1389-1412`

## 影响范围

- **IPC 协议变更**：`purchaseOrders:saveBatch` 参数从 `{sources, orders}` 变为 `{sourceDates, orders}`。`sourceDates` 类型为 `{source: string, date: string}[]`
- **DB 层不变**：`deletePurchaseOrdersByDate(source, date)` 已存在，无需新增 DB 函数
- **事务保护不变**：BEGIN/COMMIT/ROLLBACK 逻辑完全保留
- **测试更新**：`test/test-db.js` 中的 saveBatch 测试需同步更新参数格式
