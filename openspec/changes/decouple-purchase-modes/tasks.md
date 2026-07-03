# Tasks: 采购单三模式解耦 + 小所删减

## 文件拆分总览

```
purchase.js (2292行) ──extract──▶ purchase-core.js   共享工具（~900行）
                         ├──────▶ purchase-default.js 默认模式（~130行）
                         ├──────▶ purchase-multi.js   多食堂模式（~210行）
                         └──────▶ purchase-small.js   小所矩阵模式（~480行）
purchase.js (保留) ─────────────▶ 调度器 + save/export 入口（~250行）
```

依赖顺序（index.html 加载顺序）：`purchase-core.js` → `purchase-default.js` → `purchase-multi.js` → `purchase-small.js` → `purchase.js` → `lianhua.js`

> **已存在的拆分文件**：`purchase-core.js`、`purchase-default.js`、`purchase-multi.js`、`purchase-small.js` 已由上一轮创建，但**未接入 index.html** 且 **purchase.js 中对应函数未删除**。任务 1.x 负责接入 + 去重。

---

## Phase 1: 接入拆分文件 + 从 purchase.js 删重

### 1.1 在 index.html 中加载拆分文件

在 `<script src="purchase.js"></script>`（约 1208 行）之前插入四个 `<script>` 标签，顺序为：

```html
<script src="purchase-core.js"></script>
<script src="purchase-default.js"></script>
<script src="purchase-multi.js"></script>
<script src="purchase-small.js"></script>
```

此顺序保证：core 先定义 → 模式文件可用 core 函数 → purchase.js（调度器）可用所有模式函数 → lianhua.js 可用 core 函数。

### 1.2 验证 purchase-core.js 中函数与 purchase.js 一致后，从 purchase.js 删除重复定义

**边界规则**：只删除在 `purchase-core.js` 中已存在且实现等价（或 core 版本更正确）的函数。以下函数**从 purchase.js 删除**：

| 函数 | purchase.js 行号 | 备注 |
|---|---|---|
| `buildDateGroupHTML` | 48-81 | core 版本一致 |
| `buildPurchaseRowHTML` | 83-101 | core 版本一致 |
| `getTomorrowStr` | 943-948 | core 版本一致 |
| `getDateFromGroup` | 1565-1568 | core 版本一致 |
| `buildDateLabel` | 1728-1735 | core 版本一致 |
| `getRowData` | 1674-1688 | core 版本一致 |
| `collectRows` | 1690-1702 | core 版本一致 |
| `collectLianhuaRows` | 1704-1720 | core 版本一致 |
| `getLianhuaDateGroups` | 1843-1846 | core 版本一致 |
| `toggleGroup` | 950-962 | core 版本一致 |
| `toggleDateGroup` | 964-976 | core 版本一致 |
| `loadPurchaseGroupData` | 834-857 | core 版本一致 |
| `addDateGroupToPage` | 859-907 | core 版本一致 |
| `appendPurchaseRowWithData` | 909-941 | core 版本一致 |
| `appendPurchaseRow` | 1109-1115 | core 版本一致 |
| `copyPurchaseRow` | 1117-1144 | core 版本一致 |
| `deletePurchaseRow` | 1146-1162 | core 版本一致 |
| `reindexPurchaseRows` | 1164-1175 | core 版本一致 |
| `addPurchaseRows` | 1091-1107 | core 版本一致 |
| `showAddDateDialog` | 978-994 | core 版本一致 |
| `doAddDateGroup` | 996-1008 | core 版本一致 |
| `addDateGroup` | 1010-1050 | core 版本一致 |
| `deleteDateGroup` | 1052-1089 | core 版本一致 |
| `attachCellEvents` | 1177-1188 | core 版本一致 |
| `recalcRowAmount` | 1234-1257 | core 版本一致 |
| `handleProductAutocomplete` | 1259-1334 | core 版本一致 |
| `selectAutocompleteItem` | 1336-1360 | core 有更新版本 |
| `handleProductBlur` | 1190-1232 | core 版本一致 |
| `getInquiryMonthForInput` | 1571-1577 | core 版本一致 |
| `getFallbackCache` | 1581-1591 | core 版本一致 |
| `saveFallbackCache` | 1592-1594 | core 版本一致 |
| `showInquiryFallbackDialog` | 1598-1603 | core 版本一致 |
| `resolveInquirySearch` | 1609-1672 | core 版本一致 |
| `resolveImages` | 1722-1726 | core 版本一致 |
| `buildKitchenSheet` | 1737-1765 | core 版本一致 |
| `buildMultiCanteenKitchenSheet` | 1767-1798 | core 版本一致 |
| `buildLianhuaSheet` | 1800-1811 | core 版本一致 |
| `buildMergedLianhuaSheet` | 1813-1841 | core 版本一致 |
| `clearPurchasePageDOM` | 1989-1997 | core 版本一致 |
| `showRecallPurchaseModal` | 2000-2025 | core 版本一致 |
| `doRecallPurchases` | 2027-2071 | core 版本一致 |
| `ensureDateGroup` | 2073-2158 | core 版本一致 |

**验证**：删除后 `purchase.js` 中不再有这些函数定义。启动应用，确认没有 `ReferenceError` 或 `already defined` 错误。

### 1.3 从 purchase.js 删除默认模式函数（已移至 purchase-default.js）

删除以下函数：
- `getKitchenSource`（37-40 行）
- `getPastrySource`（42-45 行）
- `switchCanteen`（149-154 行）
- `initNormalCanteenMode`（156-179 行）

> `purchase-default.js` 中已有 `getDefaultSaveData`、`getDefaultExportSheets`、`getDefaultSources`——这些是 purchase.js 中 save/export 需要调用的。确认 purchase.js 的 `saveAllPurchaseOrders` 和 `exportAllPurchaseOrders` 默认模式分支调用这些函数。

### 1.4 从 purchase.js 删除多食堂模式函数（已移至 purchase-multi.js）

删除以下函数：
- `MULTI_CANTEENS` 常量（182 行）
- `currentMultiCanteen` / `multiModeInitialized` 变量（183-184 行）
- `initMultiCanteenMode`（186-239 行）
- `switchMultiCanteenTab`（241-249 行）

> `purchase-multi.js` 中已有 `getMultiSaveData`、`getMultiExportSheets`、`getMultiSources`、`getMultiModeLabel`。确认 purchase.js 的 save/export 多食堂分支调用这些函数。

### 1.5 从 purchase.js 删除小所模式函数（已移至 purchase-small.js——但 Phase 2 会删减）

**暂时只删除已在 purchase-small.js 中有等价版本的函数**（Phase 2 会处理 groups 删除）：

- `getSmallCanteens`（254-256 行）— purchase-small.js 有等价版本
- `selectMatrixAutocompleteItem`（437-451 行）— purchase-small.js 有等价版本
- `handleMatrixProductBlur`（454-475 行）— purchase-small.js 有等价版本
- `bindMatrixRowEvents`（478-493 行）— purchase-small.js 有等价版本
- `appendMatrixRow`（496-523 行）— purchase-small.js 有等价版本
- `initSmallMatrixMode`（525-529 行）— purchase-small.js 有等价版本
- `loadAllSmallMatrixData`（531-556 行）— purchase-small.js 有等价版本
- `renderSmallMatrix`（558-619 行）— purchase-small.js 有等价版本
- `addMatrixEmptyRow`（621-625 行）— purchase-small.js 有等价版本
- `deleteMatrixRow`（627-632 行）— purchase-small.js 有等价版本
- `renumberMatrixRows`（634-638 行）— purchase-small.js 有等价版本
- `toggleMatrixRemarks`（640-647 行）— purchase-small.js 有等价版本
- `saveMatrixData`（649-713 行）— purchase-small.js 有等价版本
- `saveLianhuaDomData`（1415-1469 行）— purchase-small.js 有等价版本
- `showCopyCanteenDialog`（715-736 行）— purchase-small.js 有等价版本
- `doCopyCanteen`（738-752 行）— purchase-small.js 有等价版本
- `showSyncAllDialog`（754-770 行）— purchase-small.js 有等价版本
- `doSyncAll`（772-785 行）— purchase-small.js 有等价版本
- `copyKitchenData`（787-832 行）— purchase-small.js 的 `copyMatrixCanteenData` 替代
- `exportSmallCanteenOrders`（2160-2204 行）— purchase-small.js 的 `getSmallExportSheets` 替代
- `buildMatrixKitchenSheet`（2206-2232 行）— purchase-small.js 有等价版本
- `buildPairedKitchenSheets`（2234-2292 行）— purchase-small.js 有等价版本

**暂不删除**（Phase 2 处理）：
- `initSmallCanteenMode`（268-357）— 需要重写
- `getSmallCanteenPages`（259-266）— groups 专属，Phase 2 删除
- `switchSmallCanteenPage`（359-380）— groups 专属，Phase 2 删除
- `switchSmallDisplayStyle`（385-432）— 整个函数 Phase 2 删除
- `saveAllSmallGroupsData`（1364-1412）— groups 专属，Phase 2 删除

---

## Phase 2: 删除小所 groups 样式（边界清晰的删减）

### 核心边界图

```
small-canteen-actions 工具栏（保留！只是去掉 groups/矩阵 显隐切换）
├── btn-toggle-remarks   ← 矩阵专属，保留
├── btn-copy-canteen     ← 共享（矩阵下用 copyMatrixCanteenData），保留
├── btn-sync-all         ← 共享（矩阵下用 copyMatrixCanteenData），保留
└── lianhua-dropdown     ← 共享（联华加购弹窗），保留

small-canteen-tabs       ← groups 专属 → 删除
small-canteen-area       ← groups DOM 容器 → 删除
small-matrix-area        ← 矩阵 DOM 容器 → 保留
```

### 2.1 HTML 删除

**删除以下元素**（约 522-536 行）：

1. `#small-canteen-tabs`（整个 div，522-524 行）— groups 的分页 tab 栏
2. `#small-canteen-area`（整个 div，535-536 行）— groups 的 purchase-group 容器

**保留**：
- `#small-canteen-actions`（526-534 行）— 工具栏，矩阵模式也需要
- `#small-matrix-area`（538 行）— 矩阵模式容器

**`#small-canteen-actions` 内部调整**：
- `btn-toggle-remarks`：去掉 `style="display:none;"`（矩阵下始终可见）
- `btn-copy-canteen`：保持不变
- `btn-sync-all`：保持不变
- `lianhua-dropdown` + 外层 `.dropdown-wrap`：保持不变

### 2.2 JS 删除：groups 专属函数

从 `purchase.js` 删除以下**仅 groups 模式使用**的函数：

1. **`getSmallCanteenPages`**（259-266）— 将小所分组为两两一页，仅 groups tab 使用
2. **`switchSmallCanteenPage`**（359-380）— 切换 groups 分页，仅 groups 使用
3. **`switchSmallDisplayStyle`**（385-432）— groups↔matrix 切换，删除后不需要
4. **`saveAllSmallGroupsData`**（1364-1412）— groups 模式保存，矩阵用 `saveMatrixData`
5. **`copyKitchenData`**（787-832）— groups 模式的复制逻辑，矩阵用 `copyMatrixCanteenData`

### 2.3 JS 重写：`initSmallCanteenMode`

当前 `initSmallCanteenMode`（268-357 行）做了三件事：
1. 渲染 groups 的 tab（`small-canteen-tabs`）
2. 创建 groups 的 purchase-group DOM（`small-canteen-area`）
3. 填充联华加购下拉（`lianhua-dropdown`）
4. 加载 groups 数据

**重写为**（替换 268-357 行）：

```js
function initSmallCanteenMode() {
  const canteens = getSmallCanteens();

  // 填充联华加购下拉（JSON.stringify 用于 JS 字符串上下文的安全转义）
  const dropdown = document.getElementById('lianhua-dropdown');
  if (dropdown) {
    dropdown.innerHTML = canteens.map(function(c) {
      return '<div class="dropdown-menu-item" onclick="showAddLianhuaDate(' + JSON.stringify(c + '-联华') + '); document.querySelectorAll(\'.dropdown-menu.open\').forEach(function(m) { m.classList.remove(\'open\'); });">' + escHtml(c) + '</div>';
    }).join('');
  }

  initSmallMatrixMode();
}
```

> **注意**：`showAddLianhuaDate` 在 `lianhua.js` 中定义。确保 `lianhua.js` 加载顺序正确（在 purchase-small.js 之后，已在 index.html 中正确排列）。

### 2.4 JS 重写：`applyCanteenMode` 小所分支

当前 `applyCanteenMode`（104-147 行）在小所分支中：
1. 显示 `smallActionsEl`
2. 调用 `initSmallCanteenMode()`
3. 调用 `switchSmallDisplayStyle(savedStyle)` ← 这是问题根源

**完整重写 `applyCanteenMode`**（替换 104-147 行）。关键变更：

1. 删除 `smallTabsEl`、`smallAreaEl` 变量（HTML 元素已删除）
2. 删除 `await switchSmallDisplayStyle(savedStyle)` 调用
3. `smallActionsEl.style.display` 用 `'flex'`（不是 `'block'`），确保联华加购下拉的 `margin-left:auto` 生效
4. 显式设置 `smallMatrixEl.style.display = 'block'`

```js
async function applyCanteenMode() {
  const mode = APP_SETTINGS.xiaosuo_mode;
  const tabsEl = document.getElementById('multi-canteen-tabs');
  const switchEl = document.getElementById('canteen-switch');
  const multiArea = document.getElementById('multi-canteen-area');
  const smallActionsEl = document.getElementById('small-canteen-actions');
  const smallMatrixEl = document.getElementById('small-matrix-area');
  const lianhuaEl = document.getElementById('purchase-lianhua');
  const kitchenEl = document.getElementById('purchase-kitchen');
  const pastryEl = document.getElementById('purchase-pastry');

  // 隐藏所有
  [tabsEl, switchEl, multiArea, smallActionsEl, smallMatrixEl, lianhuaEl, kitchenEl, pastryEl].forEach(el => { if (el) el.style.display = 'none'; });

  // 清空非活动模式的 group-content，防止 saveAllPurchaseOrders 跨模式收集残留数据
  const clearGroupContents = (area) => {
    if (area) area.querySelectorAll('.group-content').forEach(gc => gc.innerHTML = '');
  };
  if (mode !== 'small') clearGroupContents(smallMatrixEl);
  if (mode !== 'on') clearGroupContents(multiArea);
  if (mode === 'on' || mode === 'small') { clearGroupContents(lianhuaEl); clearGroupContents(kitchenEl); clearGroupContents(pastryEl); }

  if (mode === 'on') {
    // 多食堂模式
    tabsEl.style.display = 'flex';
    multiArea.style.display = 'block';
    initMultiCanteenMode();
  } else if (mode === 'small') {
    // 小所食堂模式（仅矩阵）
    smallActionsEl.style.display = 'flex';
    smallMatrixEl.style.display = 'block';
    initSmallCanteenMode();
  } else {
    // 默认模式
    lianhuaEl.style.display = 'block';
    kitchenEl.style.display = 'block';
    switchEl.style.display = 'flex';
    initNormalCanteenMode();
  }
}
```

> **`display: flex` 而非 `display: block`**：`small-canteen-actions` 内联华加购下拉使用 `margin-left:auto` 右对齐，依赖 flex 容器。`display: block` 会导致下拉按钮被挤到导航栏下方。

### 2.5 设置页 HTML 删除

在设置页（约 844-851 行）删除 `small-display-style` 选择器：

**删除**：
```html
<div class="form-group">
  <label>采购单填写样式</label>
  <select class="form-control" id="setting-small-display-style" ...>
    <option value="groups">样式1：逐所输入（分页切换）</option>
    <option value="matrix">样式2：矩阵输入（品名×所名）</option>
  </select>
</div>
```

只保留"小所列表"和"厨房导出样式"两个配置项。

### 2.6 设置 JS 清理

在 `settings.js` 中：

1. **`SETTING_KEYS`**：删除 `'small_display_style'`
2. **`SETTING_DEFAULTS`**：删除 `small_display_style: 'groups'`
3. **`loadSettings`**：删除 `displayStyleEl` 特殊处理（105-107 行）
4. **`saveSettings`**：删除 `small_display_style: g('small_display_style')`（187 行）
5. **`toggleSmallCanteenConfig`**：删除 display-style 下拉的显隐逻辑（403 行附近）
6. **`onSmallDisplayStyleChange`**：删除整个函数（421-425 行）

---

## Phase 3: 多食堂名称可配置

### 3.1 设置项新增

在 `settings.js` 的 `SETTING_KEYS` 中添加 `'multi_canteens'`，`SETTING_DEFAULTS` 中添加：

```js
multi_canteens: '["下涯","制杆厂","白南山"]',
```

### 3.2 设置页 UI

参考小所列表的 `renderSmallCanteenList` / `addSmallCanteen` / `deleteSmallCanteen` 模式，新增多食堂列表编辑器。

在 `#small-canteen-config` 上方（或 `#multi-canteen-config` 新区域），添加：
- 列表显示（可编辑名称 + 删除按钮）
- "+ 添加食堂" 按钮（上限 4）
- 提示："最多 4 个食堂，超过请转用小所模式"

### 3.3 保存/读取

- `loadSettings`：JSON.parse `multi_canteens`，fallback 到默认值
- `saveSettings`：JSON.stringify 后存入

### 3.4 HTML 清理

多食堂 tabs（513-517 行）已由 `purchase-multi.js` 动态渲染，但 HTML 中仍有写死的 buttons。删除 `#multi-canteen-tabs` 中的静态 `<button>` 元素，保留空容器：

```html
<div id="multi-canteen-tabs" class="tab-bar" style="display:none;"></div>
```

### 3.5 导出模式标签更新

`exportAllPurchaseOrders` 中多食堂的文件名 label 从硬编码 `'下涯、制杆厂、白南山'` 改为调用 `getMultiModeLabel()`（purchase-multi.js 已定义）。

---

## Phase 4: purchase.js 调度器收尾

### 4.1 确认 `saveAllPurchaseOrders` 模式分发

当前 1477 行：`APP_SETTINGS.xiaosuo_mode === 'small' && APP_SETTINGS.small_display_style === 'matrix'`

**必须改为**：`APP_SETTINGS.xiaosuo_mode === 'small'`（因为 `small_display_style` 已删除，小所模式现在永远是矩阵）

```js
async function saveAllPurchaseOrders(opts = {}) {
  const silent = opts.silent || false;
  const mode = APP_SETTINGS.xiaosuo_mode;

  // 小所模式（仅矩阵）
  if (mode === 'small') {
    await saveMatrixData(silent);
    await saveLianhuaDomData(silent);
    return;
  }

  // 多食堂模式
  if (mode === 'on') {
    const { sourceDates, allOrders } = getMultiSaveData();
    if (sourceDates.length === 0) return;
    const result = await window.api.savePurchaseOrdersBatch(sourceDates, allOrders);
    if (!result.success) { if (!silent) showToast('保存失败: ' + result.error, 'error'); return; }
    const today = todayStr();
    await window.api.setSetting('last_purchase_date', today);
    APP_SETTINGS.last_purchase_date = today;
    resetPurchaseDirty();
    if (!silent) showToast(`已保存 ${allOrders.length} 条采购记录`);
    return;
  }

  // 默认模式
  const { sourceDates, allOrders } = getDefaultSaveData();
  if (sourceDates.length === 0) return;
  const result = await window.api.savePurchaseOrdersBatch(sourceDates, allOrders);
  if (!result.success) { if (!silent) showToast('保存失败: ' + result.error, 'error'); return; }
  const today = todayStr();
  await window.api.setSetting('last_purchase_date', today);
  APP_SETTINGS.last_purchase_date = today;
  resetPurchaseDirty();
  if (!silent) showToast(`已保存 ${allOrders.length} 条采购记录`);
}
```

### 4.2 确认 `exportAllPurchaseOrders` 模式分发

当前 `exportAllPurchaseOrders` 中有三处硬编码需修改：

1. **1868-1873 行**（导出前重载数据）：`MULTI_CANTEENS` → `getMultiCanteens()`
2. **1892-1921 行**（sheets 构建）：删除内联的小所/多食堂导出逻辑，委托给各模式文件
3. **1957 行**（文件名 label）：`'下涯、制杆厂、白南山'` → `getMultiModeLabel()`

重写后：

```js
async function exportAllPurchaseOrders() {
  try {
    const prevLastDate = APP_SETTINGS.last_purchase_date;
    await silentSavePurchaseOrders();
    if (lianhuaItems.length === 0) {
      try { await loadLianhuaItems(); } catch (e) {}
    }

    // 导出前确保 DOM 中有 DB 数据
    if (!hasPurchasePageData()) {
      const wasShouldLoad = window._purchaseShouldLoadData;
      window._purchaseShouldLoadData = true;
      try {
        const mode = APP_SETTINGS.xiaosuo_mode;
        if (mode === 'small') {
          const canteens = getSmallCanteens();
          for (const c of canteens) {
            await loadPurchaseGroupData(c + '-厨房');
            await loadPurchaseGroupData(c + '-联华');
          }
        } else if (mode === 'on') {
          const canteens = getMultiCanteens();
          for (const c of canteens) {
            await loadPurchaseGroupData(c + '-厨房');
            await loadPurchaseGroupData(c + '-联华');
          }
        } else {
          await loadPurchaseGroupData(getKitchenSource());
          await loadPurchaseGroupData('联华');
          if (APP_SETTINGS.show_pastry !== 'off') await loadPurchaseGroupData(getPastrySource());
        }
      } finally {
        window._purchaseShouldLoadData = wasShouldLoad;
      }
    }

    const sheets = [];
    const mode = APP_SETTINGS.xiaosuo_mode;

    if (mode === 'small') {
      await getSmallExportSheets(sheets);
    } else if (mode === 'on') {
      await getMultiExportSheets(sheets);
    } else {
      await getDefaultExportSheets(sheets);
    }

    if (sheets.length === 0) { showToast('没有订单数据', 'error'); return; }

    // 文件名月份提取...
    const modeLabel = mode === 'small' ? '小所食堂' : (mode === 'on' ? getMultiModeLabel() : (APP_SETTINGS.current_canteen || '洋安'));
    // ... 导出逻辑 ...
  }
}
```

### 4.3 确认 `doRecallPurchases` 模式分发

使用 `getSmallSources()` / `getMultiSources()` / `getDefaultSources()` 获取各模式的 source 列表。

---

## Phase 5: 验证

### 5.1 启动应用，验证各模式

- [ ] 默认模式：洋安/新安切换正常，厨房 + 面点房 + 联华数据加载正常
- [ ] 多食堂模式：tabs 动态渲染，切换正常，数据加载/保存正常
- [ ] 小所模式：矩阵渲染正常，联华加购下拉正常，复制/同步正常
- [ ] 模式切换：从小所切到默认，再切回小所，无残留 DOM，无报错

### 5.2 小所边界专项验证

- [ ] 矩阵表格渲染：品名列 + 各所数量列 + 备注列 + 操作列
- [ ] 矩阵自动补全：输入品名 → 下拉 → 选中填充规格/单位
- [ ] 矩阵保存：数据写入 DB，source 格式为 `{所名}-厨房`
- [ ] 联华加购下拉：点击展开，选择小所，弹窗填写联华数据，保存到 `{所名}-联华`
- [ ] 复用单个小所：从 A 所复制数量到 B 所
- [ ] 一键同步：从 A 所同步到所有其他所
- [ ] 矩阵备注列：toggleMatrixRemarks 展开/隐藏
- [ ] 导出：矩阵式 + 两两并列式均正常
- [ ] **确认 groups 相关代码已彻底删除**：`grep -r "small_display_style\|switchSmallDisplayStyle\|switchSmallCanteenPage\|getSmallCanteenPages\|saveAllSmallGroupsData" renderer/` 仅在 purchase-small.js 的注释中出现

### 5.3 设置页验证

- [ ] 小所配置页不再显示"采购单填写样式"选择器
- [ ] 多食堂配置页显示可编辑列表，上限 4 个
- [ ] 修改多食堂名称后，采购页 tabs 更新
- [ ] 保存设置后重启应用，配置持久化

### 5.4 回归测试

```bash
node test/test-spec-regression.js
```

---

## 不动的代码（明确边界）

以下文件/功能**不做任何修改**：

- `lianhua.js` — 联华管理模块保持独立，仅依赖 purchase-core.js 的函数（`deleteDateGroup`、`getDateFromGroup` 等），这些函数在 core 中保持不变
- `history.js` — 历史页面模式相关代码不动（但 Phase 3.5 提到历史页需动态读取 `multi_canteens`——此为已知遗留，不做修改）
- `db.js` — 数据库层不动
- `utils.js` — 工具函数层不动
- CSS — 不新增、不修改（`small-canteen-actions` 的 `display:flex` 替代 `display:block` 除外，若 CSS 中无此样式则在 HTML 中用 inline style）
