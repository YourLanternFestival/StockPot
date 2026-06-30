# Proposal: 修复采购单跨月询价匹配 + 调取日期默认值

## What

修复月末录入跨月采购单（如6月30日录入7月1日收货）的三个关联问题：

1. **P1 - 调取弹窗默认日期过滤掉未来数据**：`showRecallPurchaseModal` 默认 from=to=today，导致 receive_date 在 today 之后的采购单无法被调取，用户感知为"数据丢失"
2. **P2 - 自动补全月份来源错误**：采购页自动补全从 inquiry-month selector 读取月份，而非从当前 date-group 的 receive_date 提取，导致跨月采购单匹配到错误月份的询价
3. **P3 - 缺少询价时静默失败**：receive_date 对应月份无询价数据时，自动补全静默返回空，无降级、无提示

## Why

**用户报告的跨月数据丢失场景**：

```
6月30日 → 录入7月1日采购单 → 导出
  → clearPurchasePageDOM() 清空 DOM（正常行为：导出即归档）
  → 想追回 → 调取弹窗默认日期 [6/30, 6/30]
  → receive_date = "7月1日" 不在范围内
  → 调取为空 → 用户感知：数据丢了
```

数据实际在 DB 中（历史页可见），但调取弹窗的默认日期范围排除了未来日期。

**自动补全的月份错配**：

当前代码 3 处自动补全统一读取 `document.getElementById('inquiry-month')?.value`（询价页选择器），而非从当前 date-group 的 receive_date 计算月份。这导致：

- 7月1日采购单 → 自动补全查6月询价 → 价格错误
- 7月新出现的品名 → 6月询价中不存在 → 无法补全 → 手动输入

**无询价时的处理缺口**：

receive_date 对应月份询价未导入时，系统静默返回空结果，用户不知情。应提示用户并允许沿用上月询价作为临时方案。

## Scope

### P1: 调取默认日期
- `renderer/purchase.js`: `showRecallPurchaseModal` 改为从 DB 查询最大 receive_date 作为默认 to 值

### P2: 自动补全按 receive_date 月份查询
- `renderer/purchase.js`: 3 处自动补全逻辑：
  - `handleMatrixProductBlur`（L440）
  - `handleProductBlur` 失焦匹配（L1165）
  - `handleProductAutocomplete` 下拉搜索（L1248）
- 新增辅助函数：从 input 所在 date-group 提取 receive_date → 转换为 "YYYY-MM"

### P3: 缺少询价时弹窗降级
- 同上 3 处，询价查询前检查月份是否存在
- 不存在 → 弹窗："X月询价尚未导入，是否沿用上月询价？请尽快导入X月询价。"
- 是 → fallback 到最近可用月份
- 否 → 留空，手动输入

### P2+P3 联动
- `renderer/history.js`: `enrichOrderPrices`（L102）同样改为按 order 的 receive_date 月份查询，缺少时沿用上月

### 涉及文件
| 文件 | 改动 |
|------|------|
| `renderer/purchase.js` | P1: showRecallPurchaseModal；P2+P3: 3处自动补全 + 新增提取月份/弹窗函数 |
| `renderer/history.js` | P2+P3: enrichOrderPrices 价格反查月份 |
| `test/test-db.js` | 新增测试用例 |
| `openspec/specs/purchase/spec.md` | delta spec 更新 |
| `openspec/specs/purchase-history/spec.md` | delta spec 更新 |

## Out of Scope

- 询价导入工作流的 UI 改动
- 联华自动补全（使用 lianhua_items，不受 inquiry_items 影响）
- 调取后的编辑-再导出流程（已有 `fix-purchase-cross-date-corruption` 覆盖）
