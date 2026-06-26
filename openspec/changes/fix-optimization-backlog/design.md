# Design: 代码质量优化 backlog

## 1. copyKitchenData 落库

**当前**: `copyKitchenData()` 只克隆 DOM 节点，不调用保存。显示 toast "已复制" 但数据未持久化。

**方案**: DOM 操作完成后，调用 `silentSavePurchaseOrders()` 静默落库。toast 文案改为"已复制并自动保存"。

**文件**: `renderer/purchase.js:734-779`

## 2. hasPurchaseData 采购页检查

**当前**: 永远返回 `false`，注释说"已有自动保存机制"。但自动保存有间隔，关闭时可能丢失最后几秒的输入。

**方案**: 检查采购页面是否存在非空输入框（`.cell-editable` 中有 `value`），返回 `true` 则触发关闭确认。

**文件**: `renderer/app.js:317-320`

## 3. 合并历史渲染函数

**当前**: `renderSmallCanteenHistory` (142行) 和 `renderMultiCanteenHistory` (223行) 结构完全相同，仅食堂名列表不同。

**方案**: 提取 `renderHistoryByCanteens(orders, date, canteenNames)` 通用函数，接受食堂名数组参数。两个原函数变为薄包装。

**文件**: `renderer/history.js:142-285`

## 4. 统一采购行 HTML 模板

**当前**: `buildPurchaseRowHTML` 在 purchase.js，`lianhua.js` 中有 3 处内联变体。

**方案**: `buildPurchaseRowHTML` 增加 options 参数 `{ useEscaping, showCopyBtn }`，lianhua.js 统一调用。

**文件**: `renderer/purchase.js:66-83`, `renderer/lianhua.js` 多处

## 5-6. 批量查询

**方案**: 
- 新增 `getPurchaseOrdersBySources(sources[])` API，替代循环调用
- 新增 `searchInquiryItemsBatch(names[], month)` API，替代逐条查询

**文件**: `db.js`, `main.js`, `preload.js`, `renderer/purchase.js`, `renderer/history.js`

## 7. 清理字段统一

**方案**: `cleanOldPurchaseOrders` 改为使用 `receive_date` 而非 `created_at`。用 `MAX(receive_date, created_at)` 或仅用 `receive_date`。

**文件**: `db.js:734-741`

## 8. 动态月份选项

**方案**: `showImportInquiryDialog` 改为调用 `window.api.getInquiryMonths()` 动态加载月份列表。

**文件**: `renderer/inquiry.js:313-339`

## 9. Toast 限流

**方案**: 维护 toast 队列，最多显示 3 个。超出时移除最早的元素。

**文件**: `renderer/app.js:129-136`

## 10. 联华客户名动态化

**方案**: 从 `APP_SETTINGS.current_canteen` 获取当前食堂名，替换硬编码的固定值。

**文件**: `renderer/lianhua.js:713`

## 影响范围

所有改动限于 renderer 层和 db.js，不变更 schema、不变更 IPC 协议（除新增 2 个批量查询 API 外不破坏现有接口）。
