# v2.1.0 Bug 修复 & 新特性 — 2025-06-15

分支: `feat/win7-ia32-support`

---

## Bug 修复

### 1. 修复清空测试数据不彻底

**症状**：点击"清空所有数据"后，采购单、询价、联华商品等数据仍然残留。删除后点击导出，之前在编辑页被删除或修改的内容又变回旧数据。

**根因**：`db.js` 中 `clearAllData()` 仅清空了 `products`、`inbound_records`、`outbound_records`、`recipients` 四张表，遗漏了 `purchase_orders`、`inquiry_items`、`lianhua_orders`、`lianhua_items`、`remark_memory`。

**修复**：`clearAllData()` 增加 5 条 DELETE，确保全部业务表被清空。

**涉及文件**：`db.js`

### 1.1 补充：导出全部时已停用产品复活

**症状**：在产品管理中停用产品后，点击"导出全部"，xlsx 中仍包含已停用的产品。若用户用此 xlsx 清空重导，已停用的产品会以 active=1 复活。

**根因**：`exportAll()` 使用 `getAllProducts()` 导出全部产品（含 active=0），而导入时 `importProducts()` 总是创建 active=1 的新记录。

**修复**：`exportAll()` 改用 `getProducts()` 仅导出有效产品。

**涉及文件**：`renderer/data-io.js`

---

### 2. 修复保质期自动计算（日）失效

**症状**：入库登记页面选择产品并填写生产日期后，到期日不会自动计算；编辑入库记录时修改生产日期也不会重算到期日。

**根因**：
- `calcRowExpiry()` 使用 `new Date(prodDate)` 解析日期字符串。JavaScript 将 `YYYY-MM-DD` 按 UTC 解析，在 UTC 以西的时区会导致 `getDate()` 偏移一天。
- `editInbound()` 弹窗中生产日期字段没有绑定 `onchange` 事件，修改后不会触发到期日重算。

**修复**：
- 新增 `parseLocalDate()` 函数，用 `new Date(y, m-1, d)` 安全解析本地日期
- `calcRowExpiry()` 改用 `parseLocalDate`
- `editInbound()` 中查找产品保质期数据，生产日期 input 绑定 `onchange="recalcEditExpiry()"`
- 新增 `recalcEditExpiry()` 函数

**涉及文件**：`renderer/inbound.js`

---

### 3. 修复历史采购记录中"全选/全不选"按钮失效

**症状**：历史采购批量导出弹窗中，点击"全选"或"全不选"按钮没有任何反应。

**根因**：按钮使用 `this.closest('.export-dialog')` 查找复选框容器，但 `.export-dialog` 是按钮所在 div 的兄弟元素，不是祖先。`closest()` 只向上查找，永远找不到。

**修复**：改为 `this.parentElement.nextElementSibling` 正确导航到兄弟 div。

**涉及文件**：`renderer/history.js`

---

## 新特性

### 4. Excel 列映射导入

**需求**：用户有自定义格式的 Excel 库存表（列名、列序与系统默认模板不同），希望通过表格列映射来方便兼容导入历史数据。

**实现**：
- 在"月度台账 → 导入数据"面板新增"列映射导入"区域
- 选择 Excel 文件后，自动读取第一行表头
- 按三组展示 14 个可映射字段：

| 分组 | 字段 |
|------|------|
| 产品 | 材料名称*、规格、单位、保质期(月)、保质期(日)、期初库存 |
| 入库 | 入库日期、入库数量、生产日期、到期日、入库备注 |
| 出库 | 出库日期、出库数量、领取人 |

- 每个字段通过下拉框选择对应 Excel 列（A列、B列、C列...）
- 支持"预览前 5 行"确认映射关系
- 追加模式导入（不覆盖现有数据），自动去重产品名
- 已存在的产品跳过，入库/出库记录追加导入

**涉及文件**：`renderer/index.html`、`renderer/data-io.js`

---

## 涉及文件总览

| 文件 | 修改内容 |
|------|----------|
| `db.js` | `clearAllData()` 扩展 5 张表的 DELETE |
| `renderer/inbound.js` | `parseLocalDate()` 日期解析；`calcRowExpiry()` 时区修复；`editInbound()` 到期日自动重算 |
| `renderer/history.js` | "全选/全不选"按钮 DOM 导航修复 |
| `renderer/index.html` | 列映射导入 UI（选择文件 + 配置区） |
| `renderer/data-io.js` | 列映射导入全部 JS 逻辑（~250 行） |
