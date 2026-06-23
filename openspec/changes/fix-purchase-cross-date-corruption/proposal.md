# Proposal: 修复采购单跨日期数据污染

## What

修复 `savePurchaseOrdersBatch` 按 source 整表清除导致不同日期数据互相覆盖的问题。同时修复 `clearPurchasePageDOM` 只清 tbody 不删 div 导致的空壳残留。

## Why

**用户报告的数据污染场景**（多食堂模式）：

```
24号写完采购单 → 导出（DOM 清空，DB 数据应保留）
  → 转头写 23号采购单 → 导出
  → 调取 23-24号 → 得到混合数据，24号内容被 23号覆盖
  → 历史页也是两日嵌合体
```

**根因链**：

1. `clearPurchasePageDOM` 只清 `.date-group tbody`，不删除 `.date-group` div 本身
   → 24号导出后，空的 24号 date-group div 残留在 DOM

2. 用户录入 23号数据 → DOM 中同时存在 24号空壳 + 23号数据

3. 23号导出 → `saveAllPurchaseOrders` 收集所有 `.date-group`
   → `savePurchaseOrdersBatch(sourceList, orders)` 被调用
   → **后端按 source 整表 DELETE**，再 INSERT 当前 DOM 中的 orders
   → 24号数据（不在 DOM 中）被永久抹除

4. 调取/history 查 DB → 24号数据已消失 → 数据污染

**设计文档矛盾**：`spec/purchase-leave-guard-export-clean.md` 明确写"不清空 DB 数据（导出的数据仍在 DB 中，history 页面可查）"，但当前 `savePurchaseOrdersBatch` 的整表清除逻辑违背了这一设计。

## Scope

### 修复
1. **`clearPurchasePageDOM`**：彻底删除 `.date-group` div（`dg.remove()`），不再残留空壳
2. **`savePurchaseOrdersBatch`**：后端改为按 `(source, receive_date)` 清除，替代按 source 整表清除
3. **`saveAllPurchaseOrders`**：收集 unique `(source, date)` 对传给后端

### 联动修复
4. **`saveMatrixData`**：同逻辑改为按日期清除
5. **`saveLianhuaDomData`**：同逻辑改为按日期清除

### 涉及文件
| 文件 | 改动 |
|------|------|
| `renderer/purchase.js` | `clearPurchasePageDOM`、`saveAllPurchaseOrders`、`saveMatrixData`、`saveLianhuaDomData` |
| `main.js` | `purchaseOrders:saveBatch` handler |
| `preload.js` | `savePurchaseOrdersBatch` 参数变更 |
| `test/test-db.js` | 更新 saveBatch 测试用例 |

## 本轮补充（2026-06-23）

基于探索分析发现的新问题：

### 6. 空 date-group 仍被收集导致误删
`saveAllPurchaseOrders` 和 `saveLianhuaDomData` 中，date-group div 存在但内部 tr=0 时，`sourceDates` 仍然收集该 (source, date)。saveBatch 会 DELETE + INSERT nothing → 该日数据永久丢失。需加入 guard：date-group 内无有效行时不收集其 sourceDate。

### 7. 针对性测试
现有 96 个测试全部通过，但无一定制——没有为新增逻辑写测试。需补：
- `saveLianhuaDomData` 空 date-group 不收集 sourceDate
- `saveAllPurchaseOrders` 跨日期保留（DOM 中两个不同日期的 date-group → DB 两个日期数据都保留）
- `clearPurchasePageDOM` 后 `hasPurchasePageData()` 返回 false
- `saveMatrixData` 按日期清除不误伤其他日期矩阵数据
- 调取→删单行→导出 端到端：同一 source 其他日期不受影响；其他 source 完全不受影响

## Out of Scope

- 调取→编辑→再导出 spec 补充（另开 change）
- 当日修改菜名不生效问题（红椒改红枣场景，待复现）
- 删除整块联华→UI 无法输入（已有 UI 问题，非本次修改引入）
