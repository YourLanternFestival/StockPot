# Design: 采购单三模式解耦

## 文件拆分

```
renderer/
├── purchase-core.js      # 共享工具（~400 行）
├── purchase-default.js   # 默认模式（~100 行）
├── purchase-multi.js     # 多食堂模式（~150 行）
├── purchase-small.js     # 小所模式（~300 行）
├── purchase.js           # 调度器 + 保存/导出（~200 行）
```

### 依赖图（加载顺序）

```
utils.js
  ↓
purchase-core.js     ← 被下面四个依赖
  ↓
purchase-default.js  ─┐
purchase-multi.js    ─┤  平级，无相互依赖
purchase-small.js    ─┘
  ↓
purchase.js          ← 调度器，依赖上面四个
  ↓
lianhua.js           ← 保持不变
```

### 跨文件调用

所有函数仍是全局函数（vanilla JS），跨文件调用通过全局 scope。新模式文件不调用彼此，只被 `purchase.js` 调度。

`lianhua.js` 保持独立，仅依赖 `purchase-core.js` 中的函数（`deleteDateGroup`、`getDateFromGroup` 等）。

---

## purchase-core.js 职责

从 `purchase.js` 中抽取以下函数（无模式判断逻辑）：

| 分类 | 函数 |
|---|---|
| HTML 构建 | `buildDateGroupHTML`, `buildPurchaseRowHTML` |
| 数据加载 | `loadPurchaseGroupData`, `addDateGroupToPage`, `appendPurchaseRowWithData` |
| 行操作 | `appendPurchaseRow`, `copyPurchaseRow`, `deletePurchaseRow`, `reindexPurchaseRows`, `addPurchaseRows` |
| 日期组操作 | `showAddDateDialog`, `doAddDateGroup`, `addDateGroup`, `deleteDateGroup`, `toggleDateGroup`, `ensureDateGroup` |
| 分组折叠 | `toggleGroup` |
| 数据收集 | `getRowData`, `collectRows`, `collectLianhuaRows`, `getDateFromGroup` |
| 自动补全 | `handleProductAutocomplete`, `selectAutocompleteItem`, `handleProductBlur`, `recalcRowAmount`, `attachCellEvents` |
| 询价查询 | `resolveInquirySearch`, `getInquiryMonthForInput`, `getFallbackCache`, `saveFallbackCache`, `showInquiryFallbackDialog` |
| 导出 helper | `buildKitchenSheet`, `buildLianhuaSheet`, `buildMergedLianhuaSheet`, `buildDateLabel`, `resolveImages`, `getLianhuaDateGroups` |
| 调取 | `showRecallPurchaseModal`, `doRecallPurchases` |
| 辅助 | `getTomorrowStr`, `clearPurchasePageDOM` |

---

## 统一接口

每个模式文件暴露：

```js
// purchase-default.js / purchase-multi.js / purchase-small.js
window.PurchaseMode = {
  init(),              // 创建 DOM + 加载数据
  getSaveData(),       // 返回 { sourceDates, orders } 供 saveAllPurchaseOrders 使用
  getExportSheets(),   // 返回 sheets[] 供 exportAllPurchaseOrders 使用
  getRecallSources(),  // 返回 sources[] 供 doRecallPurchases 使用
  clearDOM(),          // 清空 DOM
}
```

`purchase.js` 的 `applyCanteenMode()` 变成：

```js
async function applyCanteenMode() {
  const mode = APP_SETTINGS.xiaosuo_mode;
  // 隐藏所有容器
  hideAllContainers();
  
  if (mode === 'on') {
    PurchaseMulti.init();
    window._currentPurchaseMode = PurchaseMulti;
  } else if (mode === 'small') {
    PurchaseSmall.init();
    window._currentPurchaseMode = PurchaseSmall;
  } else {
    PurchaseDefault.init();
    window._currentPurchaseMode = PurchaseDefault;
  }
}
```

`saveAllPurchaseOrders` 和 `exportAllPurchaseOrders` 通过 `window._currentPurchaseMode` 委托。

---

## 小所模式删减

### 删除的代码
- `initSmallCanteenMode` 中 groups 分支（创建 `purchase-group` div 的逻辑）
- `switchSmallDisplayStyle` 全部
- `switchSmallCanteenPage`
- `getSmallCanteenPages`
- `saveAllSmallGroupsData`
- 矩阵中的 groups 数据重载逻辑（`switchSmallDisplayStyle` 里 groups→matrix 切换时的数据同步）

### 保留的代码
- `initSmallMatrixMode` / `loadAllSmallMatrixData` / `renderSmallMatrix`
- `saveMatrixData` / `saveLianhuaDomData`
- `copyKitchenData` / `showCopyCanteenDialog` / `doCopyCanteen`
- `showSyncAllDialog` / `doSyncAll`
- 矩阵专用事件：`bindMatrixRowEvents`, `appendMatrixRow`, `deleteMatrixRow`
- `addMatrixEmptyRow`, `toggleMatrixRemarks`
- `exportSmallCanteenOrders` + matrix/paired 两种导出

### HTML 变更
删除：`#small-canteen-area`, `#small-canteen-tabs`, groups 样式操作按钮（`#btn-copy-canteen`, `#btn-sync-all`）

保留并移到新的 `small-canteen-actions` 中：矩阵专用按钮（备注、联华加购）

设置页删除 `small-display-style` 选择器。

### 设置项清理
- 删除 `small_display_style` 的读取和保存
- `SETTING_KEYS` 移除 `small_display_style`
- `SETTING_DEFAULTS` 移除 `small_display_style`

---

## 多食堂配置化

### 设置项
新增 `multi_canteens` 设置项，JSON 数组，默认值：`'["下涯","制杆厂","白南山"]'`

### 设置页
参考小所列表的 `renderSmallCanteenList` / `addSmallCanteen` / `deleteSmallCanteen` 模式，新增多食堂列表编辑器。上限 4 个。

### 多食堂 tabs
`index.html` 中写死的 tabs 改为 JS 动态渲染。删除：
```html
<div id="multi-canteen-tabs" class="tab-bar" style="display:none;">
  <button ...>下涯</button>
  <button ...>制杆厂</button>
  <button ...>白南山</button>
</div>
```
改为空容器，由 `initMultiCanteenMode()` 动态生成。

### 命名
小所用"所"（寿昌、梅城...），多食堂用"食堂"（下涯食堂、制杆厂食堂...）。source 格式：`${name}-厨房` / `${name}-联华`。

---

## 安全修复

1. `onclick` 属性拼接：`showAddDateDialog('${src}')` → 使用 `data-source` 属性 + 事件委托，或用 `escHtml()` 包裹
2. `data-canteen="${c}"` → `data-canteen="${escHtml(c)}"`

这两个在 `initMultiCanteenMode` 和 `initSmallCanteenMode` 中均已出现，新代码直接修。
