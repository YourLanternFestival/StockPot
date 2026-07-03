# Tasks: 重构数据导入导出

## Phase 1: 共享导入组件

- [x] **1.1** 在 `data-io.js` 中实现 `ImportDialog(config)` 弹窗组件
  - 文件选择 → XLSX 解析 → 表头提取
  - 智能列匹配（精确 → 别名 → 未匹配）
  - 映射确认 UI（3-6 行，自动匹配 + 手动调整下拉框）
  - 追加/覆盖模式选择
  - 预览前 5 行
  - 执行导入 + toast 反馈
- [x] **1.2** 在 `styles.css` 添加导入弹窗样式（映射表、预览表）— inline styles + `.checkbox-label` 已存在

## Phase 2: 三个独立导入入口

- [x] **2.1** 产品管理页：`importProducts()` 入口按钮 + 调用 ImportDialog
- [x] **2.2** 入库页：`importInboundRecords()` 入口按钮 + 调用 ImportDialog（含覆盖时清空入库数据）
- [x] **2.3** 出库页：`importOutboundRecords()` 入口按钮 + 调用 ImportDialog（含覆盖时清空出库数据）

## Phase 3: 导出重构

- [x] **3.1** 实现勾选式导出弹窗 `showExportDialog()`
- [x] **3.2** 实现 `doExportSelected()` 按勾选项生成多 sheet 工作簿
- [x] **3.3** 台账页替换 `exportAll` 按钮

## Phase 4: 清理

- [x] **4.1** 删除旧式导入面板 HTML（`#import-panel` 及内部所有元素）
- [x] **4.2** 删除旧式导入 JS（`toggleImportPanel`、`handleFileSelected`、`startImport` 等全部函数）
- [x] **4.3** 删除旧列映射 JS（`renderMapConfig`、`executeMapImport` 等）
- [x] **4.4** 清理无用 CSS（`.import-panel`、`.import-dropzone` 等）

## Phase 5: 验证

- [x] **5.1** 更新 `test/test-spec-regression.js` — 23 项导入导出 spec 测试
- [x] **5.2** 导出 → 导入自洽测试：导出表头能被导入的智能匹配解析
- [x] **5.3** 追加模式不覆盖已有数据 — `test-db.js` 含 DB 层追加去重测试
- [x] **5.4** 覆盖模式正确清空后导入 — `test-db.js` 含 DB 层覆盖测试
- [x] **5.5** 智能匹配准确率测试（精确/别名/包含/未匹配/空表头）
