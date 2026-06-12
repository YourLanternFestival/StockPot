# Handoff — v2.1.0 后续优化

## 待修问题（按优先级）

### 高
1. **copyKitchenData 只操作 DOM 不落库** (`purchase.js:734-779`)
   - 复制厨房数据后只改 DOM，未调保存。切换页面数据丢失。

2. **每次单条写操作全量序列化数据库** (`db.js` 各处)
   - 每增/改/删一条就 `save()` 做 `db.export()` + `writeFileSync`。批量导入已用事务保护，单条操作未优化。

### 中
3. **历史渲染两个函数 80% 重复** (`history.js:142-285`)
   - `renderSmallCanteenHistory` 和 `renderMultiCanteenHistory` 结构相同，仅食堂列表不同。可合并。

4. **采购行 HTML 模板 4 处重复** (`purchase.js:66-83`, `lianhua.js` 多处)
   - `buildPurchaseRowHTML` 的变体在 4 个地方重复，改动需同步。

5. **按食堂循环 N+1 查询** (`purchase.js:487-489`, `history.js:74-92`)
   - `loadAllSmallMatrixData` 每个食堂发一次 IPC。
   - `enrichOrderPrices` 每个缺价格订单发一次查询。

6. **历史数据清理用 `created_at`，查询用 `receive_date`** (`db.js:734-741` vs `727-732`)
   - 导致未来到货日期的数据可能比预期更早被清理。

### 低
7. 导入询价月份选项硬编码（`inquiry.js:313-339`）
8. Toast 消息无上限堆积（`app.js:129-136`）
9. 导出联华客户名称硬编码为"洋安"（`lianhua.js:713`）
10. `hasPurchaseData()` 永远返回 false（`app.js:317`）

---

## v2.1.0 已完成

- 移除采购日期组 3 个硬限制
- 采购填写界面过滤历史数据（只显示今天及未来）
- 导出厨房申购单按日期分组隔断
- HTML 转义统一 + 死代码清理
- 历史页按模式隔离数据
- toFixed 字符串类型防崩溃
