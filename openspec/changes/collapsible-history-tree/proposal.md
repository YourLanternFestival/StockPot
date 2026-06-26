# Proposal: 出入库历史折叠树 + 移除天数设置

## What

1. **出入库登记表历史折叠树**：将入库/出库页面底部的"最近记录"平表替换为按年→月→日三级折叠的历史数据树，用户可逐级展开/折叠查看任意时间段的历史记录。
2. **移除天数设置面板**：从设置页中移除 `inbound_history_days` 和 `outbound_history_days` 两个配置项，折叠树展示全部历史数据，不再通过天数截断。
3. **批量操作**：历史树每日记录行带复选框 + 表头日级全选，支持批量删除和批量移至指定日期。
4. **导出入口**：入库/出库页 header 各加"导出 xlsx"按钮，一键导出全部记录。

## Why

**用户痛点**：
- 当前"最近 N 天"平表只展示固定条数（默认 20 条），超出范围的记录无法在登记页直接查看，必须切到台账页
- 平表全部展开时信息密度低，难以快速定位某一天的记录
- "显示多少天"的设置项与折叠树功能重叠——折叠树天然支持按需展开，无需限制天数

**折叠树的价值**：
- 年/月/日三级导航，用户可快速跳转到目标时间段
- 折叠态省空间，展开态看详情，信息层级清晰
- 与台账页的横向日网格互补：台账侧重月度全貌，折叠树侧重时间线回溯

## Scope

### 新增
1. **入库页历史折叠树**：替换 `#recent-inbound` 平表，按日期分组为 Year → Month → Day 三级树
2. **出库页历史折叠树**：替换 `#recent-outbound` 平表，同逻辑
3. **折叠/展开交互**：点击年份/月份/日期标题切换折叠态，支持全部展开/全部折叠快捷操作
4. **默认折叠态**：年份展开、月份展开、日期折叠（中间态——用户能看到有哪些月，但记录行默认收起）
5. **批量勾选**：每日记录行带复选框，日表头带全选复选框，card-header 提供"删除选中"和"移至日期"按钮
6. **导出入口**：入库/出库页 header 新增"导出 xlsx"按钮

### 移除
5. **设置面板**：删除 `#tab-data` 中"入库历史展示天数"和"出库历史展示天数"两个输入框（历史显示开关保留）
6. **设置键清理**：从 `SETTING_KEYS`、`SETTING_DEFAULTS`、`APP_SETTINGS` 中移除 `inbound_history_days` 和 `outbound_history_days`
7. **加载逻辑清理**：`loadAppSettings()` 和 `initSettingsPage()` 中不再读写这两个键

### 涉及文件
| 文件 | 改动 |
|------|------|
| `renderer/inbound.js` | 重写 `loadRecentInbound()` 为树状渲染；新增 `exportInbound()` |
| `renderer/outbound.js` | 重写 `loadRecentOutbound()` 为树状渲染；新增 `exportOutbound()` |
| `renderer/utils.js` | 新增树渲染、复选框、批量操作共 10 个函数 |
| `renderer/index.html` | 替换平表为树容器；加导出/批量按钮；移除设置天数输入框 |
| `renderer/settings.js` | 清理 `SETTING_KEYS`、`SETTING_DEFAULTS`、`initSettingsPage`、`loadAppSettings` 中的天数键 |
| `renderer/app.js` | 清理 `APP_SETTINGS` 默认值中的天数键 |
| `renderer/styles.css` | 新增树组件样式 |

## Out of Scope

- 台账页改动（月度台账保持现有 31 列日网格）
- 采购历史页改动
- 历史记录搜索/过滤功能
- 历史记录分页/虚拟滚动（当前单食堂数据量在万级以内，全量渲染可接受）
