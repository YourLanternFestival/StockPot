# Proposal: 采购单三模式解耦

## What

将 `purchase.js`（2266 行）的三种食堂模式拆分为独立文件，共享公共层；同时删减小所 groups 样式、多食堂名称可配置。

## Why

- **DOM 重建成本**：`422c0d4` 刚修复了 `smallModeInitialized` 导致的小所 DOM 不重建 bug，这是耦合的直接代价
- **扩展阻力**：三种模式的 `if/else` 散布在 2266 行中，加第四种模式要改 N 处
- **业务变更**：刚好业务新增 2 个小所，多食堂后续可能变动负责人分管范围
- **小所 groups 样式已废弃**：业务定下来了只用 matrix

## Scope

### 拆文件
- `purchase-core.js` — 共享：HTML builder、行操作、自动补全、询价查询、调取
- `purchase-default.js` — 默认模式：init、食堂切换
- `purchase-multi.js` — 多食堂：init、tab 切换、名称可配置（≤4）
- `purchase-small.js` — 小所：matrix 输入、复制/同步
- `purchase.js` — 调度 + save/export 入口（依赖上面四个）

### 模式各自负责
- 自己的 DOM 创建（HTML 中只保留容器 div）
- 自己的数据加载
- 自己的导出 sheet 构建
- 暴露统一接口：`{ init(), getSaveData(), getExportSheets(), getRecallSources() }`

### 多食堂改造
- `MULTI_CANTEENS` 硬编码 → `APP_SETTINGS.multi_canteens`，默认 `['下涯', '制杆厂', '白南山']`
- 设置页：可编辑列表（改名、增删，上限 4）
- 多食堂 tabs 从静态 HTML → JS 动态渲染

### 小所删减
- 删除 groups 样式全部代码（`initSmallCanteenMode` 中的 groups 分支、`switchSmallDisplayStyle`、`saveAllSmallGroupsData`、`switchSmallCanteenPage`、`getSmallCanteenPages`）
- 删除 `small_display_style` 设置项
- 删除 `#small-canteen-area` + `#small-canteen-tabs` + groups 操作按钮 HTML
- 删除设置页中 display-style 选择器

### 安全修复
- `onclick` 属性中的 `src`/`canteen` 值用 `escHtml()` 包裹
- 事件委托替代拼接 `onclick` 属性

## Out of Scope

- 添加第四种模式
- 联华管理模块拆分（`lianhua.js` 不动）
- 历史页面模式相关代码（`history.js` 不动）
