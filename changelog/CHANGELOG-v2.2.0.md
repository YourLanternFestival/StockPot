# CHANGELOG v2.2.0

> 分支：`feat/port-ia32-to-x64`  
> 基准：`master`（v2.1.0）  
> 日期：2026-06-18  
> 架构：x64（64位）Electron 42 + sql.js WASM

---

## 新功能（6 项）

### 1. 采购页离开确认

**文件**：`renderer/app.js`、`renderer/purchase.js`、`renderer/lianhua.js`

采购页面有未保存修改时切页弹窗确认（保存 / 不保存 / 取消）。Dirty flag 覆盖所有修改操作：输入变更、增删行、增删 date group、矩阵模式数量列。

空页面守卫：导出后 DOM 清空的情况下切页不弹窗（`hasPurchasePageData()` 预检）。

### 2. 导出后采购页清空 + 调取按钮

**文件**：`renderer/purchase.js`、`renderer/index.html`

`exportAllPurchaseOrders()` 导出成功后清空所有 date group 的 DOM（数据已在 DB + xlsx 中）。采购页作为"今日编辑区"，导出即归档。

新增"调取"按钮：按日期范围从 DB 加载历史采购数据回页面，可编辑再导出。

### 3. deleteDateGroup DB 同步

**文件**：`renderer/purchase.js`、`db.js`

删除 DOM 中的 date group 时同步删除 DB 中对应 `purchase_orders` 数据。覆盖默认、多食堂、小所三种模式及联华 date group。

### 4. clearPurchaseOrders 安全守卫

**文件**：`db.js`

`clearPurchaseOrders(source)` 拒绝 `source` 为 `NULL`/空字符串的调用，防止误删全表数据。

### 5. clearAllData 完整性

**文件**：`db.js`

`clearAllData()` 覆盖全部 9 张数据表：products、inbound_records、outbound_records、recipients、purchase_orders、inquiry_items、lianhua_items、lianhua_orders、remark_memory。

### 6. copyKitchenData 自动落库

**文件**：`renderer/purchase.js`

复制厨房数据到其他食堂后自动静默保存到 DB，不再依赖手动保存，防止切页丢失。

---

## Bug 修复（8 项）

### 1. 导出采购单时联华超市内容为空

**文件**：`renderer/purchase.js`  
**根因**：隔天打开采购页时 `_purchaseShouldLoadData` 为 `false`，DOM 为空导致联华及厨房数据导出为空。  
**修复**：导出前临时设 `_purchaseShouldLoadData = true` 强制从 DB 加载全部数据，导出后恢复标志。

### 2. 自动补全排序：完全匹配不在第一位

**文件**：`renderer/utils.js`（新增 `sortAutocompleteResults`）、5 处自动补全调用点  
**根因**：所有自动补全结果按原始顺序排列，完全匹配项不优先。  
**修复**：新增 `sortAutocompleteResults(results, keyword)`，按「完全匹配 > 开头匹配 > 包含匹配」排序。已应用到入出库、采购、联华、询价 5 处自动补全。

### 3. 含文字数量（如"11条"）导致金额错误

**文件**：`renderer/purchase.js`、`renderer/lianhua.js`、`renderer/history.js`  
**根因**：`isPureNumber` 用 `String(parseFloat) === qtyStr` 误判 `"1.0"` / `"01"` / `".5"`；`parseFloat("11条")` = 11 错误参与金额计算；`item.quantity || ''` 误杀 `0`。  
**修复**：
- `isPureNumber` 改为 `!isNaN(Number(qtyStr))`
- 非纯数字时用 DB 已保存的 `item.amount` 而非重新计算
- `item.quantity || ''` → `item.quantity ?? ''`

### 4. 询价导入月份硬编码

**文件**：`renderer/inquiry.js`  
**根因**：月份下拉硬编码为 `2026-06` / `2026-05`，从未导入过的月份不可选。  
**修复**：动态生成当月 + 未来 2 个月 + DB 已有月份的并集，`Set` 去重后倒序展示。

### 5. 折扣默认值对齐

**文件**：`renderer/app.js`  
**根因**：`discount1_rate` 代码默认值 `0.92` 与 HTML 中的 `0.9008` 不一致，全新安装无设置时使用代码默认值导致价格偏差。  
**修复**：代码默认值改为 `0.9008`（盛销），`0.9058`（优宏），与 HTML / UI 一致。

### 6. hasPurchaseData 永远返回 false

**文件**：`renderer/app.js`  
**根因**：`hasUnsavedData()` 中采购页检查逻辑遍历了错误的 DOM 选择器，导致关闭窗口时采购页从未触发未保存提醒。  
**修复**：重写 `hasPurchaseData()` 和 `hasTableData()`，正确检查 `cell-editable` 输入。

### 7. cleanOldPurchaseOrders 清理依据错误

**文件**：`db.js`  
**根因**：清理过期采购单时使用 `created_at`（创建时间）而非 `receive_date`（收货日期），导致未来到货日期的数据被过早清理。  
**修复**：改为按 `receive_date` 判断过期。

### 8. Toast 消息无上限堆积

**文件**：`renderer/app.js`  
**根因**：连续操作时 toast 无限堆积遮挡界面。  
**修复**：限制最多 3 个 toast，超出移除最早的。

---

## 增强改进（6 项）

### 1. auto_focus_qty 开关

**文件**：`renderer/settings.js`、`renderer/index.html`、5 处自动补全调用点  
新增设置项：选中品名后是否自动跳转到数量输入框（默认 on，可关闭）。

### 2. 导出联华客户名动态化

**文件**：`renderer/lianhua.js`  
导出联华订单时客户名称从 `APP_SETTINGS.current_canteen` 动态获取，不再硬编码为"洋安"。

### 3. 采购行 HTML 模板统一

**文件**：`renderer/purchase.js`、`renderer/lianhua.js`  
4 处重复的采购行 HTML 构建代码统一为 `buildPurchaseRowHTML()` + `opts` 参数。

### 4. 退出前未保存检测（IPC）

**文件**：`main.js`、`preload.js`、`renderer/app.js`  
关闭窗口时通过 IPC 询问渲染进程是否有未保存数据（含 3s 超时），替代旧的 `executeJavaScript` 方案。

### 5. 数据库 save() 校验 + recordExists 诊断

**文件**：`db.js`  
保存数据库文件后验证文件完整性；新增 `recordExists(table, id)` 用于删除后二次确认。

### 6. 64位打包配置

**文件**：`package.json`  
构建目标改为 x64 only；artifactName 区分架构（`${name}-${arch}-${version}.${ext}`）。

---

## 本次热修复（2026-06-18）

### 入出库表快速复制按钮

**文件**：`renderer/index.html`  
入库表（材料名称、数量、备注）和出库表（材料名称、数量、出库日期、领取人）的表头新增 📋 按钮，点击复制整列数据到剪贴板。

### Ctrl+D 向下填充增强

**文件**：`renderer/utils.js`（新增 `fillDownColumn`）、`renderer/inbound.js`、`renderer/outbound.js`  
- Ctrl+D 向下填充从出库页扩展到入库页
- 统一为共享函数 `fillDownColumn(input, tbodyId)`，增加 `currentTr` 和 `startIdx` 有效性校验
- `fillDownOutbound` 保留为向后兼容别名

### 联华商品管理入口

**文件**：`renderer/index.html`  
联华超市分组头部新增「管理商品」按钮，可直接新增/编辑/删除联华商品，无需通过导入弹窗。

---

## 文件变更清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `renderer/app.js` | 修改 | 离开确认 + dirty flag + toast 限制 + hasPurchaseData 修复 + 折扣默认值 |
| `renderer/purchase.js` | 修改 | 导出强制加载 + 调取按钮 + copyKitchenData 落库 + 模板统一 + 金额修正 |
| `renderer/lianhua.js` | 修改 | 金额修正 + 模板统一 + 客户名动态化 + dirty flag |
| `renderer/inbound.js` | 修改 | 自动补全排序 + auto_focus_qty + Ctrl+D |
| `renderer/outbound.js` | 修改 | 自动补全排序 + auto_focus_qty + Ctrl+D 增强 |
| `renderer/inquiry.js` | 修改 | 导入月份动态生成 |
| `renderer/history.js` | 修改 | isPureNumber 改进 + `?? ''` 零值处理 |
| `renderer/settings.js` | 修改 | 新增 `auto_focus_qty` 设置项 |
| `renderer/utils.js` | 修改 | sortAutocompleteResults + fillDownColumn |
| `renderer/index.html` | 修改 | 调取按钮 + auto_focus_qty UI + 联华管理按钮 + 入出库复制按钮 |
| `db.js` | 修改 | save 校验 + recordExists + clearAllData 全量 + clearPurchaseOrders 安全守卫 + cleanOldPurchaseOrders receive_date |
| `main.js` | 修改 | IPC 关闭检测 + 窗口状态事件 |
| `preload.js` | 修改 | registerCloseCheck + 窗口状态回调 |
| `package.json` | 修改 | x64 build + artifactName |
