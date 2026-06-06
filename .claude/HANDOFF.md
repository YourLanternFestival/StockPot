# Handoff：采购单小所模式改动

## 当前状态
- 所有改动已回退（`git checkout`），代码是干净的 master
- `disabledMcpjsonServers: ["brain-mcp", "wq-brain"]` 已加到 `settings.local.json`，重启生效

## 需求清单（7 项）

### Bug 修复
1. **样式1 DOM 顺序**：当前创建顺序是 厨房→联华→厨房→联华（按所交替），应改为 所有厨房→所有联华（厨房并列、联华并列）。原因：`.small-parallel` 用 `grid-template-columns: 1fr 1fr`，交替创建会导致厨房和联华配对而不是同类型配对。
2. **样式2 隐藏专属按钮**：矩阵模式下「复用单个小所」「一键同步到所有小所」不应显示（它们只对 groups 模式有意义）

### 设置迁移
3. **样式切换迁到设置页**：移除采购单页的「📋 样式1」「📊 样式2」按钮，在设置页「小所食堂」区域新增「采购单填写样式」下拉框（样式1：逐所输入 / 样式2：矩阵输入）
4. **样式2 隐藏分页标签**：矩阵模式下 `small-canteen-tabs` 不应展示
5. **切换样式提示数据丢失**：设置页切换填写样式时 confirm 提示

### 新增功能
6. **左右方向键列导航**（全局 utils.js）：光标在文本开头时 ArrowLeft 跳前一格，末尾时 ArrowRight 跳后一格。注意：自动补全下拉打开时不应触发（handleAutocompleteKeydown 只拦截 ↑↓EnterEsc，需要补上或在 handleCellKeydown 里检查下拉状态）
7. **Excel 列粘贴**（全局 utils.js）：粘贴多行文本时按当前列向下填充，超出行数时自动追加行。需要在各 tbody 上注册 `_appendRowFn`

## 数据流原则
- **DB 是唯一真相源**，不缓存 DOM，不搞 `smallModeInitialized`
- 进入页面：清空 DOM → 从 DB 加载
- 保存：读 DOM → 写 DB
- 样式切换：先 await save 当前数据到 DB → 清空 → 从 DB 加载新样式

## 关键文件
- `renderer/purchase.js`：小所模式核心逻辑（initSmallCanteenMode、switchSmallDisplayStyle、saveAllSmallGroupsData、saveMatrixData 等）
- `renderer/utils.js`：handleCellKeydown（键盘导航）、bindTableRowEvents（事件绑定）、列粘贴 handler
- `renderer/index.html`：小所操作栏（small-canteen-actions）、设置页（small-canteen-config）
- `renderer/settings.js`：SETTING_KEYS、SETTING_DEFAULTS、initSettingsPage、saveSettings、loadAppSettings

## 上次审查发现的额外问题（非本次需求，但值得注意）
- `saveAllSmallGroupsData` 只清有数据的 source，删光行后旧数据残留 DB
- `smallDisplayStyle` 硬编码 `'groups'`，重启后与 DB 设置不同步
- ArrowLeft 与自动补全下拉冲突
