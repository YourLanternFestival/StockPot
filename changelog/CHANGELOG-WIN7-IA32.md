# Win7 IA32 分支变更记录

> 分支：`feat/win7-ia32-support`  
> 基准：`master`（2.1.0）  
> 日期：2026-06-15  
> 目标：主线 64 位版本追特性时参考，逐条 cherry-pick

---

## Bug 修复（5 项）

### 1. 导出采购单时联华超市内容为空

**文件**：`renderer/purchase.js`  
**根因**：`exportAllPurchaseOrders` 从 DOM 收集数据（`collectRows`/`collectLianhuaRows`），但隔天打开时 `_purchaseShouldLoadData` 为 `false`，`loadPurchaseGroupData` 直接 return，DOM 为空导致所有模式下联华（及厨房）导不出。  
**修复**：导出前临时设 `_purchaseShouldLoadData = true`，强制从 DB 重载全部采购分组到 DOM，finally 中恢复标志。覆盖小所 / 多食堂 / 默认三种模式。

### 2. 自动补全中完全一致的品名不在第一位

**文件**：`renderer/utils.js`（新增）、`inbound.js`、`outbound.js`、`purchase.js`、`lianhua.js`、`inquiry.js`  
**根因**：所有自动补全下拉结果按 DB 主键序或字母序排列，完全匹配的商品不会优先显示。  
**修复**：`utils.js` 新增 `sortAutocompleteResults(results, keyword)`，按「完全匹配 > 开头匹配 > 包含匹配」排序。已应用到 5 处自动补全。

### 3. 输入含文字的数量（如"11条"）时金额错误

**文件**：`renderer/purchase.js`、`renderer/lianhua.js`、`renderer/history.js`  
**根因**：  
- 编辑时 `recalcRowAmount` 的 `isPureNumber` 检查用 `String(parseFloat(qtyStr)) === qtyStr`，对 `"1.0"`、`"01"`、`".5"` 等合法数字误判为非纯数字。  
- 从 DB 加载时 `appendPurchaseRowWithData` 用 `parseFloat(item.quantity) * price` 无条件计算，`parseFloat("11条")` = 11 导致 55 元错误金额。`lianhua.js` 的 `loadLianhuaModalData` 同样问题。  
- `item.quantity || ''` 把数字 `0` 当 falsy 转成空串。  

**修复**：  
- `isPureNumber` 改用 `!isNaN(Number(qtyStr))`，正确识别 `"1.0"`/`"01"`/`".5"` 为纯数字。  
- `appendPurchaseRowWithData` / `loadLianhuaModalData`：非纯数字时使用 DB 已保存的 `item.amount`，不再重新计算。  
- `item.quantity || ''` → `item.quantity ?? ''`，保留 `0`。

### 4. 询价导入无法选择新月份

**文件**：`renderer/inquiry.js`  
**根因**：`showImportInquiryDialog` 将月份硬编码为 `2026-06` / `2026-05`，且下拉内容来自 DB 已有数据——从未导入过的月份不会出现。  
**修复**：动态生成当月 + 未来 2 个月 + DB 已有月份的并集，`Set` 去重后倒序展示。

### 5. 选中品名后强制跳到数量输入框（无开关）

**文件**：`renderer/settings.js`、`renderer/index.html`、`inbound.js`、`outbound.js`、`purchase.js`、`lianhua.js`  
**根因**：5 处自动补全选中后无条件 `qtyInput.focus()`，无关闭选项。  
**修复**：新增设置项 `auto_focus_qty`（默认 `"on"` 保持原行为，设为 `"off"` 后不再跳转）。设置页 → 常规 →「选中品名后自动跳转到数量」。

---

### 6. 折扣默认值与 HTML UI 不一致

**文件**：`renderer/app.js`、`renderer/settings.js`、`openspec/specs/settings/spec.md`  
**根因**：JS 代码中 `discount1_rate` 默认值为 `0.92`，`discount2_rate` 默认值为 `0.90`，但 HTML 输入框的 `value` 属性为 `0.9008` / `0.9058`。全新安装未保存设置时，`APP_SETTINGS` 回退到 JS 默认值 `0.92`，导致采购页单价计算为 `评估价 × 0.92` 而非 `评估价 × 0.9008`。  
**修复**：`app.js` 和 `settings.js` 中 `discount1_rate` → `'0.9008'`，`discount2_rate` → `'0.9058'`，与 HTML 默认值对齐。

### 7. 鉴证表导入月份范围调整

**文件**：`renderer/inquiry.js`  
**根因**：导入弹窗月份下拉生成「当月 + 未来 2 个月」（如 6 月 → 6/7/8），用户期望「前月 + 当月 + 下月」（如 6 月 → 5/6/7），更符合实际使用场景（可能补录上月数据）。  
**修复**：offset 从 `0..2` 改为 `-1..1`，增加跨年下溢回绕（m < 1 → m += 12, y--）。

### 8. 离开确认空页面守卫

**文件**：`renderer/app.js`  
**根因**：导出采购单后 `clearPurchasePageDOM()` 清空 tbody 但保留 `.date-group` 元素。若 `PURCHASE_DIRTY` 因导出流程中的中间步骤残留为 true，切页离开时会弹出「未保存的修改」→ 点击保存 → `saveAllPurchaseOrders` 从空 date group 收集空数据 → DB 被空数组覆盖清空。  
**修复**：
- 新增 `hasPurchasePageData()` 全局函数，检查采购页 DOM 中是否存在非空品名输入
- `navigateTo()` 离开确认条件增加 `&& hasPurchasePageData()`——页面无数据时不弹窗
- 空页面时自动 `resetPurchaseDirty()` 清理残留标记

---

## 文件变更清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `renderer/utils.js` | 新增函数 | `sortAutocompleteResults()` |
| `renderer/inbound.js` | 修改 | 自动补全排序 + `auto_focus_qty` 开关 |
| `renderer/outbound.js` | 修改 | 自动补全排序 + `auto_focus_qty` 开关 |
| `renderer/purchase.js` | 修改 | 自动补全排序 + `auto_focus_qty` 开关 + 导出强制加载 + 金额计算修正 + isPureNumber 改进 |
| `renderer/lianhua.js` | 修改 | 自动补全排序 + `auto_focus_qty` 开关 + 金额计算修正 |
| `renderer/inquiry.js` | 修改 | 询价导入月份动态生成 + 月份范围调整（前月+当月+下月） |
| `renderer/history.js` | 修改 | isPureNumber 改进 + `?? ''` 零值处理 |
| `renderer/settings.js` | 修改 | 新增 `auto_focus_qty` 设置项（KEYS/DEFAULTS/load）+ 折扣默认值修正 |
| `renderer/index.html` | 修改 | 新增设置 UI（`#setting-auto-focus-qty`） |
| `renderer/app.js` | 修改 | 折扣默认值修正 + `hasPurchasePageData()` + 离开确认空页面守卫 |
| `openspec/specs/settings/spec.md` | 修改 | 折扣默认值文档更新 |

---

## Cherry-pick 注意事项

1. `sortAutocompleteResults` 是纯函数，无外部依赖，可直接合并。
2. `auto_focus_qty` 依赖 `SETTING_KEYS` / `SETTING_DEFAULTS` / `loadAppSettings` 三处同步添加。HTML 中 `id="setting-auto-focus-qty"` 遵循 `setting-{key}` 命名约定，`saveSettings` 循环自动识别。
3. 导出强制加载块在 `exportAllPurchaseOrders` 中，依赖 `loadPurchaseGroupData` / `getSmallCanteens` / `MULTI_CANTEENS` 等现有函数，与运行环境无关。
4. `isPureNumber` 从 `String(parseFloat) === qtyStr` 改为 `!isNaN(Number(qtyStr))` ——注意 `Number("")` = 0，需配合 `qtyStr !== ''` 前置判断。
5. `item.quantity ?? ''` 仅当 `item.quantity` 为 `null`/`undefined` 时才回退空串，不再误杀 `0`。
6. 折扣默认值：`app.js` 和 `settings.js` 的 `discount1_rate`/`discount2_rate` 需同步修改。涉及 `SETTING_DEFAULTS` 和 `APP_SETTINGS` 初始值两处，以及 `openspec/specs/settings/spec.md` 文档。
7. 鉴证表导入月份：offset 从 `0..2` 改为 `-1..1`，需加 `m < 1` 跨年下溢处理。`Set` 去重 + DB 已有月份并集逻辑不变。
8. `hasPurchasePageData()` 是全局函数，定义在 `app.js` 中，检查 `#purchase-container` 和 `#matrix-tbody` 中 `[data-field="product_name"]` 是否有非空值。`navigateTo()` 中离开确认条件追加 `&& hasPurchasePageData()`，空页面时 `resetPurchaseDirty()` 清理。
