# Handoff - 采购单模块未完成需求 & 已知问题

> 写于 2026-06-05，基于子代理代码审查报告整理

---

## 一、未完成需求

### 1.1 导出美化（未开始）

| 导出项 | 当前状态 | 目标 |
|--------|---------|------|
| 月度台账 | SheetJS，无格式化 | ExcelJS，表头加粗/底色/边框，金额1位小数，冻结前4列，自动列宽，零值空白 |
| 入库流水账 | SheetJS，无格式化 | 同台账美化风格 |
| 出库流水账 | SheetJS，无格式化 | 同台账美化风格 |

**关键文件**：
- `renderer/app.js` → `exportInventory()` (行 1438), `exportLedger()` (行 1459), `exportAll()` (行 1494)
- 需要将 SheetJS (`XLSX`) 替换为 ExcelJS，迁移到 `main.js` 通过 IPC 调用

### 1.2 采购单导出格式修正（部分完成）

**已完成**：
- `main.js` 的 `export:purchaseOrder` handler 已改为 ExcelJS，支持跨列居中、宋体15号、行高50
- 删除了"用途"列，改为"实物图"列

**未完成**：
- 图片嵌入尺寸需根据实际效果微调（当前 80×60，行高 50）
- 列宽需要根据实际数据测试后调整（当前用预设值）

### 1.3 多食堂模式（下涯/制杆厂/白南山）（框架在，问题多）

**需求描述**：
- 设置中开启"多食堂分页模式"
- 采购单页显示 Tab（下涯 | 制杆厂 | 白南山）
- 每个 Tab 下有：联华超市（从联华商品库选品）+ 厨房（自由录入）
- 联华商品库共享，但每个所的订单独立
- 导出时：三个所的厨房合一个 sheet（所名标题 + 3行分隔），联华合一个 sheet（同理）
- 文件名：`x月下涯、制杆厂、白南山采购单.xlsx`

**当前状态**：
- HTML 结构已搭建（Tab bar + multi-canteen-area）
- JS 框架已搭建（`initMultiCanteenMode`, `switchMultiCanteenTab`）
- Tab 切换只做显隐，不销毁 DOM（✓ 正确）
- 导出合并逻辑已实现

**存在的 Bug（见下方第二节）**：BUG-1, BUG-3, BUG-4, BUG-5

### 1.4 各小所食堂（完全未开始）

**需求描述**：
- 一个"各所食堂"导航入口
- 每页一个所（寿昌、梅城、大同、洋溪、乾潭等），不分并排
- 固定 20 行表格，列 = 序号/食堂名称/名称规格/单位/规格/单价/数量/金额/备注
- 支持从联华商品库导入
- 设置中可配置小所名称列表（增删）
- 导出时两两并排（寿昌+梅城一个 sheet，大同+洋溪一个 sheet，...）
- 表头参考 `6月各所采购单(3).xls`

**涉及的改动**：
- `db.js`：新建 `canteen_orders` 表
- `main.js`：新增 IPC handler
- `preload.js`：新增 API
- `renderer/app.js`：新页面逻辑 + 导出
- `renderer/index.html`：新导航项 + 新页面 HTML
- `renderer/styles.css`：新样式
- 设置页：小所名称管理 UI

### 1.5 导航栏名称调整（未完成）

- 当前"采购单"导航项名称需要根据食堂模式动态变化
- 或者保持"采购单"不变，在页面内显示当前模式标识

---

## 二、已知 Bug（按严重程度排序）

### 🔴 严重

#### BUG-1: `exportLianhuaOrderByDate` DOM id 查找永远失败
- **文件**: `renderer/app.js`
- **问题**: `addLianhuaDateGroup` 创建的 dateId 格式为 `lianhua-date_${source}_${date}`（连字符被替换），但 `exportLianhuaOrderByDate` 查找时用 `lianhua-date-${date}`（无 source，带连字符）
- **影响**: 单日期联华订单导出功能完全不可用
- **修复方向**: 统一 id 生成逻辑，或改用 `closest('.date-group')` 从按钮 DOM 向上查找

#### BUG-2: `editLianhuaItem` 函数未定义
- **文件**: `renderer/app.js`，`showManageLianhuaItems` 函数中
- **问题**: HTML 中引用了 `editLianhuaItem(${item.id})`，但该函数从未定义
- **影响**: 联华商品管理页面点击"编辑"按钮报 ReferenceError
- **修复方向**: 实现 `editLianhuaItem` 函数，或移除编辑按钮

### 🟡 中等

#### BUG-3: `isLianhua` 硬编码判断在多食堂模式下失效
- **文件**: `renderer/app.js`，`handleProductAutocomplete` 函数
- **行号**: 约 2121
- **问题**: `purchaseGroup.dataset.source === '联华'` 只匹配字面量，不匹配 `'下涯-联华'` 等
- **影响**: 如果多食堂联华行误用了通用自动补全路径，会查询询价数据而非联华商品库
- **修复方向**: 改为 `source.includes('联华')` 或 `source.endsWith('联华')`

#### BUG-4: 日期分组删除不清理数据库
- **文件**: `renderer/app.js`，`deleteDateGroup` 和 `deleteLianhuaDateGroup`
- **问题**: 只移除 DOM 元素，不调用 `deletePurchaseOrder` 清理数据库
- **影响**: 删除后重新加载数据会"复活"
- **修复方向**: 删除前遍历 tbody 中所有 tr，对有 `data-id` 的行调用 `deletePurchaseOrder`；或新增按 source+date 批量删除的 API

#### BUG-6: 保存清理逻辑中的硬编码
- **文件**: `renderer/app.js`，`saveAllPurchaseOrders`
- **问题**: `g.dataset.source === '联华'` 硬编码，多食堂的 `'下涯-联华'` 等不匹配
- **影响**: 当前用 `offsetParent !== null` 兜底，实际不影响，但代码意图不清晰
- **修复方向**: 改为 `source.includes('联华')` 或统一用可见性判断

### 🟢 低

#### BUG-5: 厨房和联华共用 `addDateGroup`，自动补全靠运行时判断
- **问题**: 设计隐患，厨房用询价数据，联华用联华商品库，但都走 `addDateGroup` → `appendPurchaseRow`
- **影响**: 如果联华分组误用了 `addDateGroup`（而非 `addLianhuaDateGroup`），自动补全数据源错误
- **修复方向**: 联华分组的"添加日期"按钮始终调用 `showAddLianhuaDate`，不暴露 `addDateGroup`

---

## 三、代码复用问题（低优先级）

| 编号 | 问题 | 位置 |
|------|------|------|
| REUSE-1 | 日期分组 table HTML 模板重复三处 | `addDateGroupToPage`, `addDateGroup`, `addLianhuaDateGroup` |
| REUSE-2 | 采购行 HTML 模板重复三处 | `appendPurchaseRow`, `appendLianhuaRow`, `appendPurchaseRowWithData` |
| REUSE-3 | 行数据提取逻辑重复四处 | `saveAllPurchaseOrders`, `collectRows`, 联华导出, `exportLianhuaOrderByDate` |
| REUSE-4 | 日期分组删除函数重复两处 | `deleteDateGroup`, `deleteLianhuaDateGroup` |

**建议**：合并为公共函数，通过参数区分行为（如 `createDateGroupHTML(options)`, `createPurchaseRow(item, isLianhua)`）

---

## 四、其他待处理

| 编号 | 问题 | 说明 |
|------|------|------|
| OTHER-1 | 退出时不检测采购单未保存数据 | `hasUnsavedData` 只检查入库/出库 |
| OTHER-2 | 模式切换时 `loadPurchaseGroupData` 清空未保存编辑 | `saveSettings` → `applyCanteenMode` 会重建 DOM |
| MISS-4 | 多食堂导出联华"客户名称"用各自所名 | 确认是否符合预期（下涯的联华导出显示"下涯"） |

---

## 五、关键文件索引

| 文件 | 说明 |
|------|------|
| `renderer/index.html` | 页面结构，采购单分组在 `#purchase-container` 内 |
| `renderer/app.js` | 所有前端逻辑，约 3100 行 |
| `renderer/styles.css` | 样式 |
| `main.js` | Electron 主进程，IPC handler，`export:purchaseOrder` 导出逻辑 |
| `preload.js` | contextBridge API 定义 |
| `db.js` | SQLite 数据库操作 |
| `6月洋安采购单.xls` | 洋安采购单参考格式 |
| `6月各所采购单(3).xls` | 各小所采购单参考格式（寿昌+梅城并排） |

---

## 六、建议实施顺序

1. **先修 Bug**：BUG-1 ~ BUG-4（影响基本功能）
2. **再做导出美化**：台账/入库/出库的 ExcelJS 格式化
3. **然后做各小所食堂**：新功能，独立模块，不影响现有代码
4. **最后做代码复用重构**：在功能稳定后再重构，避免引入新问题

  我的问题（核心）

  1. 过度设计，不刹车
  用户说"先做这个大块的 demo"，我却一口气搭了 6
  个分组、一堆新函数、新数据源。明明在单页洋安基础上改几个字段就能解决的事，我搞成了重写整个模块。

  2. 不看示例文件就动手
  用户给了 6月各所采购单(3).xls 和 6月洋安采购单.xls，我扫了一眼就按自己的理解编码。联华的"客户名称"写死"洋安"、导出格式
  不对、列名错误——都是因为没认真对照示例。

  3. 反复犯同一个错
  - 联华数据源问题：用户说了"共享联华分组数据"，我理解成共享订单，又理解成共享商品库，改了三版还没搞对
  - 硬编码问题：=== '联华' 写了一次，被指出后修了 appendPurchaseRowWithData，但 handleProductAutocomplete
  里还留着同样的硬编码
  - SQL JOIN 扇出：一个 bug 修了三处（getInventory, getDashboardStats, getExpiryAlerts），说明我不理解自己写的 SQL

  4. 抄代码不改逻辑
  从正常模式复制联华逻辑到多食堂模式时，直接调用了询价数据的接口，没有检查数据源是否正确。用户骂"复用功能不是让你直接抄
  过来什么都不改"，完全正确。

  5. 不做基本验证
  写完代码不自测，不检查函数是否存在（editLianhuaItem）、不检查 DOM id
  是否匹配（exportLianhuaOrderByDate）、不检查变量是否定义（date）。这些是最低限度的自检。

    教训

  收到示例文件时，应该先对照示例逐列确认表头和数据格式，再写任何代码。用户说"复用"时，应该问清楚复用的是数据、逻辑还是
  UI，而不是自己猜。改动量大时，应该先列清单让用户确认，而不是写完再被推翻。
