# Handoff: fix-purchase-cross-date-corruption

**状态**: 17/19 tasks 完成（Task 9-10 需用户手动验证）
**日期**: 2026-06-23（第二轮）

## 本轮完成（第二轮修复）

### 代码修复
- **Task 11**: `saveAllPurchaseOrders` — 合并 orders 收集和 sourceDates 收集为一个循环，只有 date-group 内确实有有效品名行时才收集 sourceDate。空 date-group 不会被纳入 DELETE 范围。
- **Task 12**: `saveLianhuaDomData` — 同逻辑：先检查 date-group 是否有有效行，有才添加 sourceDate。防止空 date-group 触发 DELETE + nothing → 数据丢失。

### 针对性测试（DB 层模拟，6 个新测试）
- **Task 13** `test_saveAllPurchaseOrders_crossDate`：同一 source 两个日期，只编辑一个 → 另一个日期数据完整保留
- **Task 14** `test_emptyDateGroup_notCollected`：空 date-group → sourceDates 为空 → 不触发 DELETE → 所有数据保留
- **Task 15** `test_saveLianhuaDomData_noDateGroup`：无 date-group → 提前返回 → 跨食堂联华数据全部保留
- **Task 16** `test_saveMatrixData_crossDate`：矩阵保存 06-01 → 再保存 06-02 → 06-01 数据保留
- **Task 17** `test_recall_deleteSingle_export`：端到端场景 — 8条种子数据，删1条后导出 → 同 source 其他日期保留 + 其他 source（白南山）完全不受影响
- **Task 18** `test_clearDOM_hasPurchasePageData_false`：DOM 清空 → sourceDates=[] → 提前返回 → DB 不变

### 测试结果
```
test-db.js:              16/16 PASS (was 5, +11)
test-utils.js:           18/18 PASS
test-inquiry-months.js:   8/8  PASS
test-spec-regression.js: 96/96 PASS
──────────────────────────────
Total:                  138/138 PASS ✓
```

## 第一轮已完成（回顾）
- `clearPurchasePageDOM`: `dg.remove()` 彻底删除
- `savePurchaseOrdersBatch`: (source, date) 粒度
- `saveAllPurchaseOrders`, `saveMatrixData`, `saveLianhuaDomData`: 收集 unique pair
- `exportLianhuaOrderByDate`: DOM 遍历修复
- ID 格式统一

## 回答上一会话的核心问题

### Q1: 调取后删除单条→导出，是否造成别处食堂数据丢失？
**答：不会。** 三层保护：
1. saveBatch 按 (source, date) 清除，只管 DOM 中出现的 source+date
2. 未在 DOM 中的 source（如白南山-厨房）不会被 sourceDates 收集 → 完全不碰
3. 空 date-group（删光所有行后）不会被收集到 sourceDates → 不触发 DELETE

由 test_recall_deleteSingle_export（测试 17）覆盖验证。

### Q2: 删除某所整块联华数据，是否造成无法输入/无法点选日期？
**答：这是已有 UI 问题，非本次修改引入。** `clearPurchasePageDOM` 删除所有 date-group 后，"添加日期"按钮负责重建结构。如果用户删光所有行导致空 date-group 残留，本轮修复已确保不会因此误删 DB 数据。但 UI 白板重建路径不在本次修复范围。

### Q3: 96 个测试无一针对性测试？
**答：已修复。** 新增 11 个测试（test-db.js 从 5 个扩大到 16 个），覆盖：
- 跨日期保留
- 空 date-group 不被收集
- 无 date-group 提前返回
- 矩阵跨日期
- 调取→删除→导出端到端
- clearDOM 后保存不会误清

## 未完成（需用户手动验证）

- [ ] Task 9: 24号录入→导出→23号录入→导出→调取23-24→数据不混合
- [ ] Task 10: 导出后 last_purchase_date 为空，下次进入采购页不自动加载

## 涉及文件

| 文件 | 改动 |
|------|------|
| `renderer/purchase.js` | saveAllPurchaseOrders: 合并循环 + hasValidRow guard；saveLianhuaDomData: hasValidRow guard |
| `test/test-db.js` | +6 个针对性测试（Test 6-11） |
| `openspec/changes/fix-purchase-cross-date-corruption/` | proposal/design/tasks 更新 |
