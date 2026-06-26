# Proposal: 代码质量优化 backlog

## What

修复 `.claude/handoff.md` 中记录的 10 项代码质量和健壮性问题。

## Why

v2.1.0 开发过程中通过探索扫描发现了 23 个问题，已修复安全关键的 4 项（HTML 转义、死代码、模式隔离、toFixed 防崩溃）。剩余 10 项虽非阻断性问题，但积累下去会增加维护负担和用户体验风险。

## Scope

### 高优先级（数据安全 / 用户体验）
1. **copyKitchenData 只操作 DOM 不落库** — 复制厨房数据后切换页面数据丢失
2. **hasPurchaseData() 永远返回 false** — 关闭时采购页从不触发未保存提醒

### 中优先级（代码质量 / 可维护性）
3. **renderSmallCanteenHistory / renderMultiCanteenHistory 80% 重复** — 合为通用函数
4. **采购行 HTML 模板 4 处重复** — 统一使用 buildPurchaseRowHTML
5. **loadAllSmallMatrixData N+1 查询** — 改批量查询
6. **enrichOrderPrices N+1 查询** — 改批量查询
7. **cleanOldPurchaseOrders 用 created_at 而非 receive_date** — 导致未来到货日期数据过早清理

### 低优先级（纸屑问题）
8. **导入询价月份选项硬编码** — 改为动态加载
9. **Toast 消息无上限堆积** — 限制最多 3-5 个
10. **导出联华客户名硬编码为"食堂A"** — 根据当前食堂动态设置

## Out of Scope

- 每次单条写操作全量序列化数据库（风险较高，需单独设计）
