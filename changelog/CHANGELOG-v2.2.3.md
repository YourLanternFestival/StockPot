# CHANGELOG v2.2.3

> 分支：`feat/port-ia32-to-x64`
> 基准：v2.2.2
> 日期：2026-06-30

---

## 修复（2 项）

### 1. 采购单跨月询价匹配 + 调取日期修复

**文件**：`renderer/purchase.js`、`renderer/history.js`、`renderer/utils.js`、`db.js`、`main.js`、`preload.js`

**问题**：月末录入下月采购单（如6月30日录入7月1日收货）时：
- 自动补全从询价页 selector 读月份 → 查6月询价而非7月
- 导出后调取弹窗默认日期 [today, today] → 7月数据被过滤 → 用户感知数据丢失

**修复**：
- 自动补全按 date-group 的 receive_date 提取月份（`dateToMonthStr` → `getInquiryMonthForInput`）
- 目标月份无询价 → 弹窗"7月询价尚未导入，是否沿用6月询价？"（localStorage 同日持久化，不重复弹）
- 导入询价后实时生效（缓存自动刷新）
- 调取弹窗 to 默认值改为 DB 最大 receive_date
- history 价格反查同样按 receive_date 月份 + 静默 fallback
- 导出文件名从采购数据提取月份（跨月单文件名不再写错）

### 2. 采购单跨日期数据污染修复（v2.2.2 补丁）

**文件**：`renderer/purchase.js`、`main.js`、`preload.js`、`test/test-db.js`

- `clearPurchasePageDOM` 彻底删除 date-group div
- `savePurchaseOrdersBatch` 按 (source, date) 粒度清除
- 空 date-group 不被收集到 sourceDates → 不误删 DB 数据
- 138/138 测试通过

---

## 测试

| 套件 | 数量 | 状态 |
|------|------|------|
| test-db.js | 24 | ✓ |
| test-utils.js | 18 | ✓ |
| test-inquiry-months.js | 8 | ✓ |
| test-spec-regression.js | 96 | ✓ |
| **合计** | **146** | **全部通过** |
