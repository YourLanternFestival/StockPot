# Design: 重构数据导入导出

## 1. 导入弹窗组件（ImportDialog）

三个页面（产品、入库、出库）共用同一个导入弹窗逻辑，通过参数区分。

```
ImportDialog(config)
  config.fields      — [{key, label, required, aliases}]  // 该场景的字段
  config.groupLabel  — "产品" | "入库" | "出库"
  config.onImport    — (records, mode) => Promise<result>  // 回调
```

### 1.1 流程

```
选文件 → 读表头 → 智能匹配列名 → 展示映射确认 → 选模式 → 预览前5行 → 执行
```

### 1.2 智能匹配

读取 Excel 第一行作为表头。对每个目标字段，按优先级匹配：

1. **精确匹配**：表头文本 == 字段 label（如 "材料名称" → name）
2. **别名匹配**：表头文本 ∈ 字段 aliases（如 "品名"、"名称"、"产品名" → name）
3. **包含匹配**：表头文本包含字段 label（如 "入库日期" 包含 "日期"？太泛，用 aliases 精确控制）

匹配结果展示为一个确认表格（3-6 行），每行显示：
- 字段名（如 "材料名称 *"）
- 匹配到的列名 + 绿色的 "✓ 已匹配"（或红色 "✗ 未匹配"）
- 下拉框可手动调整

非必填字段未匹配时不报警，必填字段（材料名称）未匹配时标红。

### 1.3 追加 vs 覆盖

弹窗底部提供两个按钮：
- **追加导入**（默认）：产品去重（按 name），出入库记录追加
- **覆盖导入**：先清空该类型数据，再导入

覆盖导入时有二次确认弹窗。

### 1.4 预览

点击"预览前5行"后，在弹窗底部展示一个迷你表格，显示按当前映射解析出的数据。用户确认无误后执行导入。

## 2. 各场景字段定义

### 产品导入（6 字段）

| key | label | required | aliases |
|-----|-------|----------|---------|
| name | 材料名称 | ✅ | 品名, 名称, 产品名, 产品名称, 货品名 |
| spec | 规格 | | 规格型号, 型号 |
| unit | 单位 | | 计量单位, 包装单位 |
| shelfMonths | 保质期(月) | | 保质期, 保质月份 |
| shelfDays | 保质期(日) | | 保质天数 |
| openingStock | 期初库存 | | 初始库存, 上月结存, 当前库存, 库存 |

### 入库导入（6 字段）

| key | label | required | aliases |
|-----|-------|----------|---------|
| name | 材料名称 | ✅ | 品名, 名称, 产品名 |
| date | 入库日期 | | 日期, 入库时间, 时间 |
| quantity | 入库数量 | | 数量, 入库量 |
| productionDate | 生产日期 | | 生产时间 |
| expiryDate | 到期日 | | 有效期至, 保质期至, 过期日 |
| remark | 入库备注 | | 备注, 说明 |

### 出库导入（4 字段）

| key | label | required | aliases |
|-----|-------|----------|---------|
| name | 材料名称 | ✅ | 品名, 名称, 产品名 |
| date | 出库日期 | | 日期, 出库时间, 时间 |
| quantity | 出库数量 | | 数量, 出库量 |
| recipient | 领取人 | | 领用人, 领取部门, 领料人, 签收人 |

## 3. 导入入口位置

| 页面 | 按钮位置 | 函数 |
|------|---------|------|
| 产品管理 (#page-products) | `page-header` 右侧，现有按钮旁 | `importProducts()` |
| 入库登记 (#page-inbound) | `page-header` 右侧 | `importInboundRecords()` |
| 出库登记 (#page-outbound) | `page-header` 右侧 | `importOutboundRecords()` |

按钮样式与现有 `导出 xlsx` 按钮一致，使用 upload icon。

## 4. 导出：台账页勾选式多选

### 4.1 交互

台账页 `exportAll` 按钮 → 弹窗，包含四个复选框：

```
☑ 产品列表
☑ 入库流水账
☑ 出库流水账
☐ 月度台账（当前选中的年月）
```

默认勾选前三项。点击"导出" → 同一工作簿，n 个 sheet。

### 4.2 Sheet 格式

复用现有导出格式（列序不变）：
- **产品数据**：序号, 材料名称, 规格, 单位, 保质期(月), 保质期(日)
- **入库流水账**：序号, 入库时间, 材料名称, 规格, 数量, 单位, 备注, 生产日期, 到期日
- **出库流水账**：序号, 出库时间, 名称, 规格, 数量, 单位, 领取人
- **月度台账**：与现有 `exportLedger()` 格式一致

### 4.3 文件命名

`数据导出_{日期}.xlsx`（如 "数据导出_2026-06-30.xlsx"）

## 5. 删除清单

### 5.1 HTML 删除
- `#import-panel` 整个面板（台账页拖拽区 + 预览 + 清空按钮）
- `#map-config-area` 列映射区域
- `#import-inbound`、`#import-outbound` 等复选框
- `exportAll` 按钮 → 替换为新的 `showExportDialog` 按钮

### 5.2 JS 删除
- `toggleImportPanel()`
- `handleFileSelected()`
- `startImport()` / `doStartImport()`
- `clearAndReimport()` / `doClearAll()`
- `renderMapConfig()` / `getMapFieldValues()` / `previewMapImport()`
- `executeMapImport()` / `doExecuteMapImport()`
- `exportAll()` → 替换为 `showExportDialog()` + `doExportSelected()`
- `MAP_FIELD_DEFS`、`mapFileHeaders`、`mapFileData` 等全局变量

### 5.3 CSS 清理
- `.import-panel`、`.import-dropzone`、`.dropzone-*` 相关样式

## 6. 数据流

```
用户点击导入 → 选文件(xlsx)
  → FileReader 读取
  → XLSX.read 解析
  → 取第一行作为 headers
  → 对每个 field 执行智能匹配
  → 渲染映射确认表（带手动调整下拉框）
  → 用户选模式（追加/覆盖）
  → 用户点"预览前5行"或直接"执行导入"
  → 按映射从 rows[1:] 提取数据
  → 覆盖模式：调用 clearInbound/clearOutbound/clearProducts
  → 追加模式：调用 importProducts/importInbound/importOutbound（去重）
  → 显示结果 toast
  → 刷新页面数据
```

## 7. 兼容性

- 导入导出的 xlsx 格式自洽：导出能吃的格式，导入能读
- 保留 `exportInventory()`（库存快照）不变
- 保留 `exportLedger()`（月度台账单独导出）不变
- 保留联华商品导入、询价鉴证表导入不变
- `clearAllData()` 函数保留（`doClearAll` 删除但 API 保留，可能被其他地方引用）
