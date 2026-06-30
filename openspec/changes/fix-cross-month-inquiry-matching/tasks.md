# Tasks: 修复采购单跨月询价匹配 + 调取日期默认值

## P1: 调取默认日期

- [x] Task 1: `db.js` — 新增 `getLatestReceiveDate()` 查询 `SELECT MAX(receive_date) FROM purchase_orders`
- [x] Task 2: `main.js` + `preload.js` — 新增 IPC `purchase:getLatestReceiveDate` handler 和 preload 桥接
- [x] Task 3: `renderer/purchase.js` — `showRecallPurchaseModal` 改为 async，调用 `getLatestReceiveDate()` 作为 to 的默认值

## P2: 自动补全按 receive_date 月份查询

- [x] Task 4: `renderer/purchase.js` — 新增 `getInquiryMonthForInput(input)`：从 date-group 提取 receive_date → "YYYY-MM"
- [x] Task 5: `renderer/utils.js` — 新增 `dateToMonthStr(dateStr)`（移入 utils.js 供全局复用）：统一处理 "YYYY-MM-DD" 和 "M月D日" 两种格式，含跨年推断
- [x] Task 6: `renderer/utils.js` — 新增 `getPreviousMonthStr(month)`（移入 utils.js 供全局复用）：计算上一个月（处理1月跨年）
- [x] Task 7: `renderer/purchase.js` — `handleProductAutocomplete` 改用 `getInquiryMonthForInput` + `resolveInquirySearch`
- [x] Task 8: `renderer/purchase.js` — `handleProductBlur` 失焦匹配同上
- [x] Task 9: `renderer/purchase.js` — `handleMatrixProductBlur` 同上

## P3: 缺少询价时弹窗降级

- [x] Task 10: `renderer/purchase.js` — 新增 `resolveInquirySearch(keyword, targetMonth, opts)`：核心查询函数，targetMonth 无数据时 fallback，无询价月份时触发弹窗
- [x] Task 11: `renderer/purchase.js` — 新增 `showInquiryFallbackDialog(targetMonth, fallbackMonth)`：弹窗"X月询价尚未导入，是否沿用上月询价？"
- [x] Task 12: `renderer/purchase.js` — session 级别去重：`window._inquiryFallbackCache` 记录已确认的月份 fallback 选择，同一月不重复弹
- [x] Task 13: `renderer/history.js` — `enrichOrderPrices` 改用 `dateToMonthStr(order.receive_date)` + 静默 fallback（不弹窗）

## Spec 更新

- [x] Task 13b: `openspec/specs/purchase/spec.md` — 新增"跨月询价匹配"章节：自动补全按 receive_date 月份、缺少询价弹窗降级、同日不重复、导入后实时生效、调取默认日期、导出文件名按采购月份
- [x] Task 13c: `openspec/specs/purchase-history/spec.md` — 新增"跨月价格反查"章节：enrichOrderPrices 按 receive_date 月份 + 静默 fallback

## 测试

- [x] Task 14: `test-db.js` — `test_getLatestReceiveDate_crossMonth`：DB 有跨月未来日期 → MAX 返回最大日期
- [x] Task 15: `test-db.js` — `test_getLatestReceiveDate_emptyDB`：空库 → null → 默认 to=today
- [x] Task 16: `test-db.js` — `test_dateToMonthStr_crossMonth`：格式转换 + 跨年推断（12月→1月=下一年）
- [x] Task 17: `test-db.js` — `test_getPreviousMonthStr`：月份回退 + 跨年边界
- [x] Task 18: `test-db.js` — `test_inquiryFallback_prevMonth`：目标月无询价 → fallback 上月
- [x] Task 19: `test-db.js` — `test_historyEnrichOrder_silentFallback`：history 静默 fallback 不弹窗
- [x] Task 19c: `test-db.js` — `test_inquiryImport_refreshCache`：mid-session 导入询价 → 缓存刷新 → 新月可用
- [x] Task 19d: `test-db.js` — `test_dateToMonthStr_edgeCases`：边界值（null/empty/非法/12月31日）
- [x] Task 19e: 全量回归 146/146 通过（24 db + 18 utils + 8 inquiry-months + 96 spec-regression）

## 手动验证

- [ ] Task 20: 6月30日录入7月1日采购单 → 导出 → 调取 → 默认日期覆盖到7月1日 → 数据可追回
- [ ] Task 21: 7月询价未导入 → 录入7月1日采购单 → 自动补全弹窗询问 → 选"沿用6月询价" → 自动补全用6月价格
- [ ] Task 22: 导入7月询价后 → 录入7月采购单 → 自动补全直接使用7月询价，不弹窗
