# Tasks: 修复采购单跨日期数据污染

## 核心修复

- [x] Task 1: `clearPurchasePageDOM` — 彻底删除 date-group div（`dg.remove()` 替代清空 tbody）
- [x] Task 2: `main.js` — `savePurchaseOrdersBatch` handler 改为接收 `{sourceDates, orders}`，按 `(source, date)` 清除
- [x] Task 3: `preload.js` — 更新 `savePurchaseOrdersBatch` 参数传递
- [x] Task 4: `saveAllPurchaseOrders` — 收集 unique (source, date) 对，传给后端
- [x] Task 5: `saveMatrixData` — 同逻辑改为按日期清除
- [x] Task 6: `saveLianhuaDomData` — 同逻辑改为按日期清除

## 测试

- [x] Task 7: 更新 `test/test-db.js` 中 saveBatch 测试用例（参数格式适配 + 新增跨日期保留断言）
- [x] Task 8: 运行全量测试套件确认无回归（96/96 通过）

## 第二轮修复（2026-06-23：空 date-group 误收集 + 针对性测试）

- [x] Task 11: `saveAllPurchaseOrders` — 只收集有有效行的 date-group 的 sourceDate，空 date-group 跳过
- [x] Task 12: `saveLianhuaDomData` — 同上，date-group 内无有效行时不收集 sourceDate
- [x] Task 13: `test-db.js` — 新增 `test_saveAllPurchaseOrders_crossDate`：DOM 中两个不同日期都有数据 → DB 中两个日期数据都保留，互不覆盖
- [x] Task 14: `test-db.js` — 新增 `test_emptyDateGroup_notCollected`：空 date-group 不被收集到 sourceDates → 不触发 DELETE
- [x] Task 15: `test-db.js` — 新增 `test_saveLianhuaDomData_noDateGroup`：无 date-group 时跳过，不误清其他日期
- [x] Task 16: `test-db.js` — 新增 `test_saveMatrixData_crossDate`：按日期清除不误伤其他日期矩阵数据
- [x] Task 17: `test-db.js` — 新增 `test_recall_deleteSingle_export`：调取→删单行→导出，同一 source 其他日期数据保留，其他 source 数据完全不受影响
- [x] Task 18: `test-db.js` — 新增 `test_clearDOM_hasPurchasePageData_false`：`clearPurchasePageDOM` 后 `hasPurchasePageData` 返回 false
- [x] Task 19: 运行全量测试确认通过（138/138）

## 验证场景（需用户手动测试）

- [ ] Task 9: 24号录入→导出→23号录入→导出→调取23-24→数据不混合，各自独立
- [ ] Task 10: 导出后 `last_purchase_date` 为空，下次进入采购页不自动加载
