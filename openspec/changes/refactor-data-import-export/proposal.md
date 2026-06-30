# Proposal: 重构数据导入导出

## What

将数据导入导出从集中式变为**按页面独立入口 + 智能映射**。三块数据（产品列表、入库流水、出库流水）各自在自己的页面有导入/导出按钮，映射从 14 个字段降为 3-6 个，支持追加/覆盖双模式。台账页导出改为勾选式多选。

## Why

当前问题：

1. **列映射导入反人类**：14 个字段全部下拉手选，用户拿到一个入库 Excel 却要在出库字段、产品字段的干扰中找对应的入库字段
2. **旧式导入危险**：硬编码列序 + 导入前清空全部数据，只有当初定制格式的人能用
3. **导出不完整**：只有 `exportAll`（全部三张 sheet）和 `exportInventory`（库存快照），没有独立的产品/入库/出库导出
4. **两套导入并存**：旧式拖拽面板和列映射面板堆在台账页，概念混乱

## Scope

### 新增
1. **产品管理页**：导入产品按钮 → 智能映射弹窗（6 字段）→ 追加/覆盖选择 → 预览 → 执行
2. **入库页**：导入入库按钮 → 智能映射弹窗（6 字段）→ 追加/覆盖选择 → 预览 → 执行
3. **出库页**：导入出库按钮 → 智能映射弹窗（4 字段）→ 追加/覆盖选择 → 预览 → 执行
4. **台账页**：勾选式多选导出弹窗（产品列表 / 入库流水 / 出库流水 / 月度台账）

### 修改
5. 智能列匹配：读取 Excel 表头后自动匹配已知列名，用户只需确认
6. 导入模式：每个导入弹窗提供「追加导入」/「覆盖导入」选项
7. 共享导入组件：提取 `ImportDialog` 公共逻辑到 `utils.js`

### 删除
8. 台账页旧式拖拽导入面板（`#import-panel`、`handleFileSelected`、`startImport`、`clearAndReimport`）
9. 旧的列映射导入 UI（`renderMapConfig`、`executeMapImport` 等）
10. `exportAll` 按钮 → 替换为新的勾选式导出

### 涉及文件

| 文件 | 改动 |
|------|------|
| `renderer/data-io.js` | 删除旧导入逻辑，重写为 ImportDialog + 智能匹配 + 多选导出 |
| `renderer/index.html` | 删除 `#import-panel`，各页面加导入按钮，台账页改导出区域 |
| `renderer/products.js` | 新增 `importProducts()` 入口 |
| `renderer/inbound.js` | 新增 `importInboundRecords()` 入口 |
| `renderer/outbound.js` | 新增 `importOutboundRecords()` 入口 |
| `renderer/ledger.js` | 展示勾选导出弹窗 |
| `renderer/styles.css` | 导入弹窗样式 |
| `openspec/specs/data-io/spec.md` | 更新 spec |
| `test/test-spec-regression.js` | 更新测试 |

## Out of Scope

- 台账 sheet 的导入（用户明确不需要）
- 联华商品导入（已有独立入口）
- 询价鉴证表导入（已有独立入口）
- 采购单导入导出（已有独立逻辑）
