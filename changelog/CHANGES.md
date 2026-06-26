# 技术债清理改动清单

> 2026-06-08 session，共 5 个文件，+365 / -322 行。
> 每个改动标注精确行号，方便后续 agent 快速定位和溯源。

---

## db.js（935 行）

### 1. 批量操作事务化（8 处）

所有批量写操作从"逐条 run + 逐条 save"改为"BEGIN → 批量 run → COMMIT → save 一次"，失败时 ROLLBACK。

| 函数 | 行号 | 改动 |
|------|------|------|
| `batchDeleteProducts` | 224-236 | 加 BEGIN/COMMIT/ROLLBACK |
| `updateRecipientOrder` | 331-343 | 同上 |
| `importProducts` | 511-528 | 同上 |
| `importOpeningStock` | 531-543 | 同上 |
| `importRecords` | 546-565 | 同上（影响 importInbound/importOutbound） |
| `clearAllData` | 582-600 | 同上 |
| `importInquiryItems` | 757-777 | 同上 |
| `importLianhuaItems` | 850-870 | 同上 |

**模式统一为：**
```js
run('BEGIN');
try {
  // ... 批量操作 ...
  run('COMMIT');
  save();
} catch (e) {
  run('ROLLBACK');
  throw e;
}
```

### 2. getInventoryByMonth 查询优化（行 427-483）

- **原来：** 6N+1 查询（每个产品 6 条：prevIn, prevOut, monthIn, monthOut, dailyIn, dailyOut）
- **现在：** 3 条查询（1 条 JOIN 拿汇总 + 1 条 UNION ALL 拿每日明细 + JS 侧分组）
- 返回值 shape 不变：`{ ...p, prevStock, monthIn, monthOut, currentStock, daily, hasActivity }`
- 额外字段 `prev_in, prev_out, month_in, month_out` 通过 `...p` 透传，renderer 不读取，无影响

### 3. getDashboardStats 查询优化（行 603-656）

- **原来：** 62 条查询（COUNT×3 + 每天 2 条×30 天）
- **现在：** 5 条查询（COUNT×3 + 1 条 UNION ALL 拿 30 天趋势 + 1 条 top10）
- `days` 数组 shape 不变：`{ label, inQty, outQty }`，30 条

### 4. getExpiryAlerts 子查询简化（行 486-508）

- **原来：** `WHERE p.id IN (SELECT ... HAVING stock > 0)` 嵌套子查询
- **现在：** `JOIN (...) s ON s.id = p.id AND s.stock > 0` 平铺 JOIN
- 功能等价：都只返回库存 > 0 的产品的预警

---

## main.js（564 行）

### 5. window:resize 补全 top/left（行 109-135）

- **原来：** `top` 和 `left` case 是空的 break，`x`/`y` 变量声明了但没用
- **现在：** 四个方向都实现，`delta = 10` 提取为常量
- `top`：setPosition(x, y - delta) + setSize(width, newHeight)
- `left`：setPosition(x - delta, y) + setSize(newWidth, height)
- 都有 minSize 保护

### 6. close handler 从 executeJavaScript 改为 IPC（行 506-560）

- **原来：** `executeJavaScript('hasUnsavedData()')` 直接调 renderer 全局函数
- **现在：** 通过 IPC 双向通信：
  - `ipcRequest` 封装了带超时的 IPC 请求-响应模式（行 511-520）
  - `close-check` / `close-check-result`：检查未保存数据（3s 超时）
  - `save-before-close` / `save-before-close-done`：保存后退出（10s 超时）
  - `closeInProgress` 防重复点击（行 508, 524）
  - renderer 无响应时自动 forceQuit（行 531）

---

## preload.js（131 行）

### 7. 新增 registerCloseCheck（行 12-27）

- 在 `electronAPI` 上新增 `registerCloseCheck(checkHandler, saveHandler)`
- renderer 调用此方法注册两个回调：检查未保存数据、保存数据
- 每个 handler 都有 try-catch：异常时仍发 IPC 响应，防止 main 挂死

---

## renderer/app.js（331 行）

### 8. hasPurchaseData 新增（行 293-305）

- 新函数，检查采购单页面是否有未填数据
- 选择器：`#page-purchase tbody`（匹配所有采购单表格的 tbody）
- `hasUnsavedData()` 现在调用它：`hasTableData('inbound-tbody') || hasTableData('outbound-tbody') || hasPurchaseData()`

### 9. submitCurrentPage 改为 async（行 311-320）

- **原来：** 同步函数，不 await 异步保存
- **现在：** `async function`，三个分支都 `await`
  - `page-inbound` → `await submitInboundBatch()`
  - `page-outbound` → `await submitOutboundBatch()`
  - `page-purchase` → `await silentSavePurchaseOrders()`

### 10. close handler IPC 注册（行 322-331）

- **原来：** 暴露全局函数 `hasUnsavedData` / `submitCurrentPage` 给 `executeJavaScript`
- **现在：** 通过 `window.electronAPI.registerCloseCheck()` 注册，不再依赖全局函数名
- check handler 返回 `{ hasUnsaved: boolean }`
- save handler 调用 `await submitCurrentPage()`

---

## renderer/purchase.js（1638 行）

### 11. 新增 buildDateGroupHTML（行 31-63）

- 提取日期组 HTML 模板为共享函数
- 参数：`date`（日期字符串）、`summaryText`（摘要文字如"3 项"）
- 消除了 3 处内联重复：
  - `addDateGroupToPage`（原行 777-807）
  - `addDateGroup`（原行 930-960）
  - `copyKitchenData`（原行 684-714）

### 12. 新增 buildPurchaseRowHTML（行 65-82）

- 提取采购行 HTML 模板为共享函数
- 参数：`idx`（序号）、`values`（字段值对象）、`amountText`（金额显示文本）
- 消除了 3 处内联重复：
  - `appendPurchaseRowWithData`（原行 824-837）
  - `appendPurchaseRow`（原行 980-993）
  - `copyPurchaseRow`（原行 1047-1060）

### 13. applyCanteenMode 补全隐藏列表（行 84-98）

- **原来：** 隐藏列表缺 `small-matrix-area`，切到默认模式时矩阵面板残留可见
- **现在：** 隐藏列表加入 `smallMatrixEl`（`document.getElementById('small-matrix-area')`）
- 同时修复了数据丢失问题：矩阵面板残留导致 `saveAllPurchaseOrders` 走错分支

### 14. appendPurchaseRowWithData 使用 buildPurchaseRowHTML（行 812-827）

- **原来：** 内联 9 列 HTML
- **现在：** 调用 `buildPurchaseRowHTML(idx, {...}, amountText)`
- `unit_price` 传入 `price`（已 parseFloat），与原行为一致

### 15. appendPurchaseRow 使用 buildPurchaseRowHTML（行 978-982）

- **原来：** 内联 9 列空值 HTML
- **现在：** `buildPurchaseRowHTML(idx, {}, '')`

### 16. copyPurchaseRow 使用 buildPurchaseRowHTML（行 985-998）

- **原来：** 内联 9 列 HTML，值从 `getData()` 取
- **现在：** `buildPurchaseRowHTML(0, {...}, amountText)`
- `idx` 传 0，后续由 `reindexPurchaseRows` 修正

### 17. addDateGroup 使用 buildDateGroupHTML（行 916-917）

- **原来：** 内联完整日期组 HTML
- **现在：** `buildDateGroupHTML(date, '0 项')`

### 18. addDateGroupToPage 使用 buildDateGroupHTML（行 798-801）

- **原来：** 内联完整日期组 HTML
- **现在：** `buildDateGroupHTML(date, \`${items.length} 项\`)`

### 19. copyKitchenData 使用 buildDateGroupHTML（行 735）

- **原来：** 内联完整日期组 HTML
- **现在：** `buildDateGroupHTML(date, '0 项')`

### 20. saveAllPurchaseOrders 合并 silentSavePurchaseOrders（行 1252-1324）

- **原来：** 两个 95% 相同的函数（65 行 + 41 行）
- **现在：** `saveAllPurchaseOrders(opts = {})` 一个函数，`opts.silent` 控制 toast
- `silentSavePurchaseOrders()` 保留为薄包装：`return saveAllPurchaseOrders({ silent: true })`
- 矩阵模式分支：`saveMatrixData(silent)` 透传 silent 参数

---

## 不变但需注意的依赖关系

| 函数 | 依赖 | 说明 |
|------|------|------|
| `navigateTo` (app.js:66) | `silentSavePurchaseOrders` | 离开采购页时自动保存 |
| `initPurchasePage` (purchase.js:5) | `loadLianhuaItems`, `applyCanteenMode` | 进入采购页时加载 |
| `saveAllPurchaseOrders` (purchase.js:1252) | `saveMatrixData` | 矩阵模式走独立保存 |
| `loadPurchaseGroupData` (purchase.js:767) | `window._purchaseShouldLoadData` | 由 initPurchasePage 设置 |
| `hasPurchaseData` (app.js:293) | `#page-purchase tbody` 选择器 | 匹配 buildDateGroupHTML 创建的 tbody |

---

# 后续改动建议

基于项目 spec 和代码审查，以下功能/问题值得后续处理。按优先级分层。

## 一、Spec 文档不一致（应修复）

| # | 问题 | 位置 |
|---|------|------|
| 1 | `remark_memory` 表未列入 core spec 的表定义清单 | inquiry/spec.md 有详细描述，core/spec.md 只列了 9 张表，漏了它（db.js 已有此表） |
| 2 | `lianhua_orders` 表已建但未被 renderer 使用 | db.js 创建了表并注册了 IPC，但 renderer 联华模块直接用 `purchase_orders`（source 含"联华"），这张表是死代码 |
| 3 | core spec 缺少 Schema 版本管理说明 | 目前靠直接改 CREATE TABLE + 两段 ALTER TABLE 迁移（静默吞错误），无版本号机制 |

## 二、已承诺但未做的功能

| # | 功能 | 来源 | 说明 |
|---|------|------|------|
| 1 | 食堂B、食堂X Excel 导入格式适配 | data-io/spec.md | "仅适配了食堂A格式，食堂B和食堂X待适配"——每个食堂的 Excel 结构不同，需要独立解析逻辑 |
| 2 | 增量更新机制 | core/spec.md | 提到"预计半个月后做增量更新"，目前无 spec、无代码，迁移全靠 xlsx 全量导入 |
| 3 | 数据库 Schema 版本管理 | core/spec.md | 应用启动时检查版本号，按需执行迁移脚本，替代当前的静默 ALTER TABLE |

## 三、高价值功能补充（直接影响日常使用）

| # | 功能 | 理由 |
|---|------|------|
| 1 | **库存不足预警** | 目前只有保质期预警，没有"某物料库存低于 X 就提醒"。食堂采购决策需要这个 |
| 2 | **采购单历史保留天数可配置** | 当前只保留 3 天就自动删除。月底对账、季度审计可能需要更长历史（settings 加一个 `purchase_history_days` 配置项） |
| 3 | **入库/出库记录修改日志** | 目前可以编辑和删除入出库记录，但没有操作痕迹。账实不符时无法追溯谁改了什么 |
| 4 | **打印功能** | 食堂经常需要打印采购单、出入库台账给管理人员签字，目前只有 Excel 导出，没有直接打印 |

## 四、中等价值功能

| # | 功能 | 理由 |
|---|------|------|
| 1 | **数据备份管理 UI** | 目前备份是自动的（启动时保留 3 天），用户无法手动触发备份、查看备份列表、或从备份恢复 |
| 2 | **批量修改产品信息** | 目前只能逐个编辑产品，统一调价（年度价格调整）需要一个个改 |
| 3 | **月度/年度统计报表** | Dashboard 只有 30 天趋势和 top-10。管理层可能需要月度汇总、年度同比等报表 |

## 五、低优先级

| # | 功能 | 理由 |
|---|------|------|
| 1 | 字体大小可调 | 用户群体是食堂工作人员，可能有年龄较大的用户 |
| 2 | 快捷键一览表 | 系统有很多键盘操作（Enter 导航、方向键、粘贴等），但没有快捷键速查 |

## 六、技术债（本次未处理的）

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| 1 | `purchase.js` 仍然 1638 行 | renderer/purchase.js | 本次只做了 HTML 去重和 save 合并，三种食堂模式的大量代码仍在一个文件里。可拆为 purchase-base / purchase-multi / purchase-small / purchase-export |
| 2 | `export:purchaseOrder` handler 172 行 | main.js:339-494 | 应提取到独立模块，字体常量应统一定义 |
| 3 | `APP_SETTINGS` 全局缓存可能与 DB 不同步 | renderer/app.js:54 | 无变更通知机制，任何模块可读到过期值。与 settings.js 的 `SETTING_DEFAULTS` 是两套默认值来源 |
| 4 | `handleProductBlur` / `handleMatrixProductBlur` 重复 | purchase.js:1050 / 400 | 逻辑相同（blur→搜索→填字段），差异仅在填哪些字段。可合并为带 options 的通用版本 |
| 5 | `toggleGroup` / `toggleDateGroup` 重复 | purchase.js:849 / 863 | 仅差一个 content 元素的 expanded class 切换。暂保留，因 CSS 动画依赖差异 |
| 6 | 多食堂模式 / 小所分组模式的 DOM 创建重复 | purchase.js:158 / 236 | `initMultiCanteenMode` 和 `initSmallCanteenMode` 构建相同的 purchase-group HTML 结构 |
