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

## 文件变更清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `renderer/utils.js` | 新增函数 | `sortAutocompleteResults()` |
| `renderer/inbound.js` | 修改 | 自动补全排序 + `auto_focus_qty` 开关 |
| `renderer/outbound.js` | 修改 | 自动补全排序 + `auto_focus_qty` 开关 |
| `renderer/purchase.js` | 修改 | 自动补全排序 + `auto_focus_qty` 开关 + 导出强制加载 + 金额计算修正 + isPureNumber 改进 |
| `renderer/lianhua.js` | 修改 | 自动补全排序 + `auto_focus_qty` 开关 + 金额计算修正 |
| `renderer/inquiry.js` | 修改 | 询价导入月份动态生成 |
| `renderer/history.js` | 修改 | isPureNumber 改进 + `?? ''` 零值处理 |
| `renderer/settings.js` | 修改 | 新增 `auto_focus_qty` 设置项（KEYS/DEFAULTS/load） |
| `renderer/index.html` | 修改 | 新增设置 UI（`#setting-auto-focus-qty`） |

---

## Cherry-pick 注意事项

1. `sortAutocompleteResults` 是纯函数，无外部依赖，可直接合并。
2. `auto_focus_qty` 依赖 `SETTING_KEYS` / `SETTING_DEFAULTS` / `loadAppSettings` 三处同步添加。HTML 中 `id="setting-auto-focus-qty"` 遵循 `setting-{key}` 命名约定，`saveSettings` 循环自动识别。
3. 导出强制加载块在 `exportAllPurchaseOrders` 中，依赖 `loadPurchaseGroupData` / `getSmallCanteens` / `MULTI_CANTEENS` 等现有函数，与运行环境无关。
4. `isPureNumber` 从 `String(parseFloat) === qtyStr` 改为 `!isNaN(Number(qtyStr))` ——注意 `Number("")` = 0，需配合 `qtyStr !== ''` 前置判断。
5. `item.quantity ?? ''` 仅当 `item.quantity` 为 `null`/`undefined` 时才回退空串，不再误杀 `0`。
