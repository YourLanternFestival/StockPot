# Design: 出入库历史折叠树 + 移除天数设置

## 1. 数据结构：三级分组

从 DB 获取全量记录后，在前端按日期分组：

```
Year (2026)
├── Month (06月)
│   ├── Day (06-26) → [record, record, ...]
│   └── Day (06-25) → [record, ...]
└── Month (05月)
    └── ...
```

**分组函数**（公共工具，inbound/outbound 共用）：

```javascript
function groupRecordsByDate(records) {
  const tree = new Map(); // year -> month -> day -> records[]
  for (const r of records) {
    const d = parseLocalDate(r.date); // "2026-06-26" → Date
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (!tree.has(year)) tree.set(year, new Map());
    const yearMap = tree.get(year);
    if (!yearMap.has(month)) yearMap.set(month, new Map());
    const monthMap = yearMap.get(month);
    if (!monthMap.has(day)) monthMap.set(day, []);
    monthMap.get(day).push(r);
  }
  return tree;
}
```

**边界情况**：
- 无记录时显示空状态提示（"暂无历史记录"）
- 记录日期格式统一为 `YYYY-MM-DD`，兼容历史数据

## 2. HTML 结构

替换当前平表为树容器：

```html
<!-- 入库页：替代 #recent-inbound 平表 -->
<div class="history-tree" id="inbound-history-tree">
  <!-- JS 动态生成 -->
</div>

<!-- 出库页：替代 #recent-outbound 平表 -->
<div class="history-tree" id="outbound-history-tree">
  <!-- JS 动态生成 -->
</div>
```

**渲染输出结构**（JS 动态生成）：

```html
<div class="tree-year">
  <div class="tree-year-header" onclick="toggleTreeNode(this)">
    <span class="tree-caret">▼</span>
    <span class="tree-label">2026年</span>
    <span class="tree-count">120条</span>
  </div>
  <div class="tree-year-body">
    <div class="tree-month">
      <div class="tree-month-header" onclick="toggleTreeNode(this)">
        <span class="tree-caret">▼</span>
        <span class="tree-label">06月</span>
        <span class="tree-count">45条</span>
      </div>
      <div class="tree-month-body">
        <div class="tree-day">
          <div class="tree-day-header" onclick="toggleTreeNode(this)">
            <span class="tree-caret">▶</span>
            <span class="tree-label">06-26</span>
            <span class="tree-count">3条</span>
          </div>
          <div class="tree-day-body" style="display:none;">
            <table class="table">
              <tr><td>...</td></tr>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

## 3. 折叠交互

### 单个节点折叠

```javascript
function toggleTreeNode(header) {
  const body = header.nextElementSibling;
  const caret = header.querySelector('.tree-caret');
  const isOpen = body.style.display !== 'none';
  if (isOpen) {
    body.style.display = 'none';
    caret.textContent = '▶';
  } else {
    body.style.display = '';
    caret.textContent = '▼';
  }
}
```

### 默认折叠态

- **年份**：展开（`▼`）
- **月份**：展开（`▼`）
- **日期**：折叠（`▶`，`display:none`）

原因：用户通常知道要查哪个月，日期级别折叠可避免一次性展示过多记录。

### 全部展开/折叠按钮

在 `.card-header` 中增加两个小按钮：

```html
<button class="btn btn-sm" onclick="expandAllTree(this)">全部展开</button>
<button class="btn btn-sm" onclick="collapseAllTree(this)">全部折叠</button>
```

全部折叠收起到年份级别，全部展开展开到日期+记录级别。

## 4. 设置清理

### SETTING_KEYS 移除

从 `settings.js:2-28` 移除 `'inbound_history_days'` 和 `'outbound_history_days'`。

### SETTING_DEFAULTS 移除

从 `settings.js:30-57` 移除：
- `inbound_history_days: '20'`
- `outbound_history_days: '20'`

### APP_SETTINGS 移除

从 `app.js:106-116` 移除：
- `inbound_history_days: 20`
- `outbound_history_days: 20`

### loadAppSettings 清理

从 `settings.js:159-204` 移除：
```javascript
inbound_history_days: parseInt(g('inbound_history_days')) || 20,
outbound_history_days: parseInt(g('outbound_history_days')) || 20,
```

### initSettingsPage 清理

从 `settings.js:59-115` 移除：
```javascript
document.getElementById('setting-inbound-history-days').value = ...
document.getElementById('setting-outbound-history-days').value = ...
```

### HTML 设置面板清理

从 `index.html:792-806` 删除两个 form-group（入库历史展示天数、出库历史展示天数）：

```html
<!-- 删除这两块 -->
<div class="form-group">
  <label>入库历史展示天数</label>
  <input type="number" class="form-control" id="setting-inbound-history-days" ...>
</div>
<div class="form-group">
  <label>出库历史展示天数</label>
  <input type="number" class="form-control" id="setting-outbound-history-days" ...>
</div>
```

**历史显示开关（`inbound_history` / `outbound_history`）保留**——用户仍可通过开关完全隐藏历史区域。

## 5. 渲染函数重构

### inbound.js — `loadRecentInbound()` 重写

```javascript
async function loadRecentInbound() {
  const card = document.getElementById('recent-inbound')?.closest('.card');
  if (APP_SETTINGS.inbound_history === 'off') {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';
  try {
    const records = await window.api.getInbound({});
    const container = document.getElementById('inbound-history-tree');
    if (!container) return;
    if (records.length === 0) {
      container.innerHTML = '<div class="tree-empty">暂无入库历史记录</div>';
      return;
    }
    const tree = groupRecordsByDate(records);
    container.innerHTML = renderHistoryTree(tree, 'inbound');
  } catch (err) {
    console.error('Load recent inbound error:', err);
  }
}
```

### 树渲染函数（放在 utils.js 中共用）

```javascript
function renderHistoryTree(tree, type) {
  // type: 'inbound' | 'outbound' — 决定表格列和编辑/删除回调
  const years = [...tree.keys()].sort((a, b) => b - a); // 降序
  return years.map(year => {
    const yearMap = tree.get(year);
    const months = [...yearMap.keys()].sort((a, b) => b - a);
    const yearCount = countRecords(yearMap);
    return `
      <div class="tree-year">
        <div class="tree-year-header" onclick="toggleTreeNode(this)">
          <span class="tree-caret">▼</span>
          <span class="tree-label">${year}年</span>
          <span class="tree-count">${yearCount}条</span>
        </div>
        <div class="tree-year-body">
          ${months.map(month => renderMonth(yearMap.get(month), year, month, type)).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderMonth(dayMap, year, month, type) {
  const days = [...dayMap.keys()].sort((a, b) => b - a);
  const monthCount = countDayRecords(dayMap);
  return `
    <div class="tree-month">
      <div class="tree-month-header" onclick="toggleTreeNode(this)">
        <span class="tree-caret">▼</span>
        <span class="tree-label">${String(month).padStart(2, '0')}月</span>
        <span class="tree-count">${monthCount}条</span>
      </div>
      <div class="tree-month-body">
        ${days.map(day => renderDay(dayMap.get(day), year, month, day, type)).join('')}
      </div>
    </div>`;
}

function renderDay(records, year, month, day, type) {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return `
    <div class="tree-day">
      <div class="tree-day-header" onclick="toggleTreeNode(this)">
        <span class="tree-caret">▶</span>
        <span class="tree-label">${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}</span>
        <span class="tree-count">${records.length}条</span>
      </div>
      <div class="tree-day-body" style="display:none;">
        ${renderRecordTable(records, type)}
      </div>
    </div>`;
}

function renderRecordTable(records, type) {
  if (type === 'inbound') {
    return `<table class="table tree-table">
      <thead><tr><th>材料</th><th>数量</th><th>单位</th><th>生产日期</th><th>到期日</th><th>备注</th><th>操作</th></tr></thead>
      <tbody>${records.map(r => `
        <tr>
          <td>${r.product_name}</td><td>${r.quantity}</td><td>${r.unit}</td>
          <td>${formatDate(r.production_date)}</td><td>${formatDate(r.expiry_date)}</td>
          <td>${r.remark || ''}</td>
          <td>
            <button class="btn btn-sm" onclick='editInbound(${JSON.stringify(r).replace(/'/g, "&#39;")})'>编辑</button>
            <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteInbound(${r.id})">删除</button>
          </td>
        </tr>`).join('')}
      </tbody></table>`;
  } else {
    return `<table class="table tree-table">
      <thead><tr><th>材料</th><th>数量</th><th>单位</th><th>领取人</th><th>操作</th></tr></thead>
      <tbody>${records.map(r => `
        <tr>
          <td>${r.product_name}</td><td>${r.quantity}</td><td>${r.unit}</td>
          <td>${r.recipient}</td>
          <td>
            <button class="btn btn-sm" onclick='editOutbound(${JSON.stringify(r).replace(/'/g, "&#39;")})'>编辑</button>
            <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteOutbound(${r.id})">删除</button>
          </td>
        </tr>`).join('')}
      </tbody></table>`;
  }
}
```

## 6. 样式设计

```css
/* 树节点通用 */
.tree-year, .tree-month, .tree-day { margin-left: 0; }
.tree-year-body { margin-left: 8px; }
.tree-month-body { margin-left: 16px; }
.tree-day-body { margin-left: 24px; }

.tree-year-header, .tree-month-header, .tree-day-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; cursor: pointer; border-radius: 4px;
  user-select: none; transition: background 0.15s;
}
.tree-year-header:hover, .tree-month-header:hover, .tree-day-header:hover {
  background: var(--primary-light, rgba(79,110,247,0.08));
}

.tree-year-header { font-size: 1.05em; font-weight: 600; }
.tree-month-header { font-size: 1em; font-weight: 500; }
.tree-day-header { font-size: 0.95em; }

.tree-caret { font-size: 10px; width: 14px; text-align: center; flex-shrink: 0; }
.tree-label { flex: 1; }
.tree-count { font-size: 0.85em; color: var(--text-muted); }

.tree-table { margin: 4px 0 8px 0; font-size: 0.9em; }
.tree-table th { font-size: 0.85em; padding: 4px 8px; }
.tree-table td { padding: 3px 8px; }

.tree-empty { text-align: center; color: var(--text-muted); padding: 24px; }
```

**生物亲和主题适配**：树节点头部 hover 背景色使用 `--primary-light`（已由主题系统控制），无需额外处理。

## 7. 数据流

```
页面加载 / 提交后刷新
  → loadRecentInbound() / loadRecentOutbound()
    → window.api.getInbound({}) / getOutbound({})  [DB 全量，按日期 DESC]
      → groupRecordsByDate(records)  [前端分组]
        → renderHistoryTree(tree, type)  [生成 HTML]
          → container.innerHTML = ...
```

**性能考量**：单食堂年数据量通常在 3000-5000 条/年。DB 全量查询 + 前端分组 + DOM 渲染在万级数据内可接受（<100ms）。如后续数据量增长，可在 DB 层加分页或虚拟滚动——本次不改 DB 查询。

## 8. 影响范围

- **编辑/删除回调不变**：`editInbound`、`deleteInbound`、`editOutbound`、`deleteOutbound` 函数签名不变，只在渲染时调整 onclick 传参
- **设置页保存逻辑不变**：`saveSettings()` 循环 `SETTING_KEYS`，移除两个键后自动跳过
- **历史开关逻辑不变**：`inbound_history` / `outbound_history` 的 on/off 逻辑完全保留
- **DB 层不变**：`getInbound({})` / `getOutbound({})` 查询不变
- **规格文件更新**：`openspec/specs/settings/spec.md` 和 `openspec/specs/inventory/spec.md` 同步更新
