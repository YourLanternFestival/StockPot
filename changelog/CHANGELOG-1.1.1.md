# v1.1.1 更新日志

## 数据安全修复

- **采购单保存改为事务保护**：`saveAllPurchaseOrders`、`saveMatrixData`、`saveAllSmallGroupsData` 全部使用 `savePurchaseOrdersBatch` 事务调用，clear + insert 在同一事务中，崩溃不丢数据
- **修复面点房隐藏时数据丢失**：移除 `saveAllPurchaseOrders` 中 `offsetParent !== null` 过滤条件，隐藏的面点房/非活动 tab 数据不再丢失
- **事务函数防嵌套**：`beginTransaction` 检查 `inTransaction` 标志，避免嵌套事务报错；`rollback` 也调用 `save()` 写回磁盘

## 功能修复

- **联华拆分单件计算**：导出时拆分单件列改为 `数量 × 每箱数量（split_qty）` 计算值，不再是静态的 split_qty 原值
- **多食堂导出合并**：多食堂模式（食堂C、食堂D、食堂E）导出时，厨房数据合并一张 sheet、联华数据合并一张 sheet，不再按食堂分开
- **采购单单价改为盛销折扣价**：自动补全和手动输入都使用 `APP_SETTINGS.discount1_rate` 折扣后的价格，小数位跟随 `price_decimals` 设置
- **导出列宽**：`buildKitchenSheet` 添加 `colWidths: [8, 15, 30, 25, 10, 10, 10, 10, 30, 15]`，品名/规格/备注列不再遮挡
- **粘贴逻辑修复**：使用 `totalCols` 边界检查，避免多列粘贴时溢出到下一列
- **关闭时不再弹采购单保存提醒**：`hasPurchaseData()` 直接返回 false，采购单已有自动保存机制
- **保存文件路径**：`dialog:saveFile` 使用 `app.getPath('documents')` 作为默认路径，不再定位到错误位置
- **历史查询改用 receive_date**：`getPurchaseHistoryDates` 和 `getPurchaseOrdersByDate` 按到货日期查询，不再依赖会被重置的 `created_at`
- **cleanOldPurchaseOrders 时区修复**：使用本地日期计算 cutoff，不再用 `toISOString()`（UTC 差 8 小时）

## 界面优化

- **侧边栏显示版本号**：标题下方显示 `v1.1.1`
- **Chart.js 改为本地加载**：不再依赖 CDN，内网环境可正常使用图表

## 移除功能

- **删除应用内更新功能**：`update:apply`、`update:selectPackage`、`update:getVersion` IPC handler 及相关 UI 全部移除（该功能在打包后不可用）

## 已知问题

- **SmartScreen 拦截**：频繁打包导致 exe 哈希值变化，Windows SmartScreen 云端标记拦截。需代码签名证书解决
