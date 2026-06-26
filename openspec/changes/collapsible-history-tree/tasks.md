# Tasks: 出入库历史折叠树 + 移除天数设置 + 批量操作 + 导出入口

## Phase 1: 公共工具 + 样式

- [x] Task 1: `renderer/utils.js` — 新增 `groupRecordsByDate()`、`renderHistoryTree()`、`toggleTreeNode()`、`expandAllTree()`、`collapseAllTree()` 五个函数
- [x] Task 2: `renderer/styles.css` — 新增树组件样式（`.tree-year`、`.tree-month`、`.tree-day`、`.tree-caret`、`.tree-table`、`.tree-empty` 等）

## Phase 2: HTML 结构

- [x] Task 3: `renderer/index.html` — 入库页：替换平表为树容器，card-header 增加全部展开/折叠按钮
- [x] Task 4: `renderer/index.html` — 出库页：替换平表为树容器，card-header 增加全部展开/折叠按钮
- [x] Task 5: `renderer/index.html` — 设置页：删除"入库历史展示天数"和"出库历史展示天数"两个 `form-group`

## Phase 3: JS 逻辑

- [x] Task 6: `renderer/inbound.js` — 重写 `loadRecentInbound()`；新增 `exportInbound()`
- [x] Task 7: `renderer/outbound.js` — 重写 `loadRecentOutbound()`；新增 `exportOutbound()`
- [x] Task 8: `renderer/settings.js` — 从 `SETTING_KEYS` 和 `SETTING_DEFAULTS` 中移除两天数键
- [x] Task 9: `renderer/settings.js` — 从 `initSettingsPage()` 和 `loadAppSettings()` 中移除两天数键的读写
- [x] Task 10: `renderer/app.js` — 从 `APP_SETTINGS` 默认值中移除两天数键

## Phase 4: 批量操作 + 导出入口

- [x] Task 11: `renderer/utils.js` — 更新 `renderInboundRecordRow`/`renderOutboundRecordRow` 加复选框列；`renderHistoryTree` 加表头全选；新增 `toggleDayCheckboxes`、`getCheckedHistoryIds`、`deleteCheckedHistory`、`moveCheckedHistoryDate`、`doMoveCheckedHistoryDate`
- [x] Task 12: `renderer/index.html` — 入库/出库页 header 加"导出 xlsx"按钮；历史 card-header 加"删除选中""移至日期"按钮
- [x] Task 13: `renderer/styles.css` — 新增 `.tree-cb-cell` 复选框列样式

## Phase 5: 规格同步

- [x] Task 14: `openspec/specs/settings/spec.md` — 移除天数键，更新描述
- [x] Task 15: `openspec/specs/inventory/spec.md` — 折叠树 + 日级全选 + 批量删除/移动 + 导出入口场景

## Phase 6: 验证

- [x] Task 16: 运行测试确认现有测试全量通过（96/96 通过，无回归）
- [ ] Task 17: 手动验证：入库/出库页历史树折叠展开 + 复选框全选 + 批量删除 + 移至日期
- [ ] Task 18: 手动验证：入库/出库页"导出 xlsx"按钮功能正常
- [ ] Task 19: 手动验证：设置页天数配置已移除，历史开关仍正常
- [ ] Task 20: 手动验证：生物亲和主题下样式正确
