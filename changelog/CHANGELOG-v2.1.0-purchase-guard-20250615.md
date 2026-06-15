# v2.1.0 采购页面重构 — 2025-06-15

分支: `feat/win7-ia32-support`
Commit: `0545306`

---

## 变更概览

| 分类 | 内容 |
|------|------|
| Bug 修复 | deleteDateGroup DOM-only 导致 DB 不同步 |
| P0 修复 | clearPurchaseOrders 全表删除炸弹 |
| 新特性 | 采购页离开确认弹窗 |
| 新特性 | 导出后清空 DOM + 调取按钮 |
| 重构 | deleteDateGroup 四种模式统一函数 |

---

## Bug 修复

### 1. deleteDateGroup / deleteLianhuaDateGroup 删除不同步 DB

**症状**：点击删除 date group，仅移除 DOM 元素，DB 中数据未删除。`saveAllPurchaseOrders` 的 clear+reinsert 模式可在保存时补救，但当被删 date group 是某 source 的最后一个时，该 source 被跳过，旧数据残留。

**修复**：`deleteDateGroup` 统一处理默认/多食堂/小所并列/联华四种模式：
1. 逐条 DELETE 有 `dataset.id` 的行（已持久化记录）
2. 移除 DOM + 标记 dirty
3. 若 source 不再有 date group，按日期范围清理 DB（不动历史）

`deleteLianhuaDateGroup` 缩减为一行委托。

**涉及文件**：`renderer/purchase.js`、`renderer/lianhua.js`

### 2. clearPurchaseOrders 全表删除炸弹

**症状**：`clearPurchaseOrders(source)` 使用 `if (source)` 判断，空字符串等 falsy 值进入 else 分支执行 `DELETE FROM purchase_orders` 无条件全表清空。`saveAllPurchaseOrders` 收集 `#purchase-container` 下所有 date group（含隐藏模式的残留 DOM），若任一 source 为 falsy → 全删。

**修复**（三层防御）：
- `db.js`：`clearPurchaseOrders` 拒绝 falsy/空字符串，直接 throw
- `main.js`：`savePurchaseOrdersBatch` 遍历时跳过 falsy source
- `renderer/purchase.js`：`saveAllPurchaseOrders` 两轮遍历统一 null/truthy 检查

**涉及文件**：`db.js`、`main.js`、`renderer/purchase.js`

### 3. 新增 deletePurchaseOrdersByDate

按 source + receive_date 删除，仅清指定日期记录，不动历史数据。

**涉及文件**：`db.js`、`main.js`、`preload.js`

---

## 新特性

### A. 采购页离开确认

离开采购页时：
- 有未保存修改 → 弹窗 [不保存 / 取消 / 保存]
- 无修改 → 直接切页（不再静默保存）

全局 dirty flag（`PURCHASE_DIRTY`），覆盖 input 事件委托 + 所有显式 mutation 函数（添加行/删除行/删除 date group/联华弹窗保存等）。

**涉及文件**：`renderer/app.js`、`renderer/purchase.js`、`renderer/lianhua.js`

### B. 导出后清空 + 调取按钮

- `exportAllPurchaseOrders` 导出成功后清空采购页所有 date group DOM
- 新增「调取」按钮：弹窗选日期范围 → 从 DB 加载 → 渲染回采购页
- `ensureDateGroup` 自动创建 date group 并填充数据（覆盖全部模式）
- `clearPurchasePageDOM` 清空采购页 DOM（不动 DB）

**涉及文件**：`renderer/purchase.js`、`renderer/index.html`

---

## 已知问题

### 🐛 导出后误触保存弹窗导致记录丢失

**症状**：导出全部 → `exportAllPurchaseOrders` 内部保存 + 导出 xlsx + 清空 DOM → dirty flag 在导出过程中被标记 → 用户离开采购页时弹出「未保存的修改」→ 点确定保存 → `saveAllPurchaseOrders` 从空 DOM 收集数据 → 清空 DB 中对应 source 的记录。

**原因**：导出流程中 DOM 清空后 dirty 未重置，且空 DOM 保存 = 清理 DB。

**计划**：下次修复。方案：导出成功后立即 `resetPurchaseDirty()` 并在 `saveAllPurchaseOrders` 中检测空 DOM 时跳过而非保存。

**严重程度**：低（触发条件：导出完立刻切页 + 误点保存，数据在 xlsx 和 DB 历史中仍有备份）

---

## 涉及文件总览

| 文件 | 修改内容 |
|------|----------|
| `db.js` | `clearPurchaseOrders` 安全加固；新增 `deletePurchaseOrdersByDate` |
| `main.js` | `savePurchaseOrdersBatch` falsy source 防御；`deleteByDate` IPC |
| `preload.js` | `deletePurchaseOrdersByDate` 桥接 |
| `renderer/app.js` | dirty flag + 离开确认弹窗 + `switchToPage` 抽取 |
| `renderer/index.html` | 调取按钮 UI |
| `renderer/purchase.js` | `deleteDateGroup` 统一函数；dirty 埋点；导出清空 DOM；调取逻辑；`saveAllPurchaseOrders` null 检查统一 |
| `renderer/lianhua.js` | `deleteLianhuaDateGroup` 委托；dirty 埋点 |
| `spec/purchase-leave-guard-export-clean.md` | 需求规格说明 |
