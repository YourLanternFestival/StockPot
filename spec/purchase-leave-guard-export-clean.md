# Spec: 采购页面离开确认 + 导出后清空

状态: 已实现
分支: feat/win7-ia32-support
日期: 2025-06-15

---

## A. 离开采购页面时确认保存

### 现状
`navigateTo()` 在离开采购页面时调用 `silentSavePurchaseOrders()` 静默保存，不询问用户。

### 目标行为
- 采购页面有未保存修改时 → 弹窗确认 [不保存] [取消] [保存]
- 无修改时 → 直接离开，不弹窗

### Dirty Flag 追踪

覆盖四种模式（默认/多食堂、小所矩阵、小所并列、联华）：

| 操作 | 标记 dirty |
|------|-----------|
| 任何 input/textarea 值变更（含品名、规格、单价、数量、备注） | ✅ |
| 添加行（addPurchaseRows / appendPurchaseRow / appendLianhuaRow / modalLianhuaAddRows） | ✅ |
| 删除行（deletePurchaseRow / deleteMatrixRow / deleteModalLianhuaRow） | ✅ |
| 删除 date group（deleteDateGroup / deleteLianhuaDateGroup） | ✅ |
| 添加 date group（addLianhuaDateGroup / showAddLianhuaDate → doSaveLianhuaFromModal） | ✅ |
| 矩阵模式数量列变更 | ✅ |

| 操作 | 重置 dirty |
|------|-----------|
| 保存成功（saveAllPurchaseOrders 返回 success） | ✅ |
| 导出全部（exportAllPurchaseOrders 内部调用 save） | ✅ |
| 页面初始化加载数据后（initPurchasePage 完成） | ✅ |
| 切换日期/加载历史数据 | ✅ |

### 弹窗交互

```
┌─────────────────────────────────┐
│  有未保存的采购数据               │
│                                 │
│  是否保存当前修改？               │
│                                 │
│  [不保存]    [取消]    [保存]    │
└─────────────────────────────────┘
```

- **保存** → `saveAllPurchaseOrders()` → 成功后切页
- **不保存** → 直接切页（丢弃 DOM 修改，下次进入从 DB 加载）
- **取消** → 留在采购页

### 边界情况
- 保存失败时 → toast 报错，留在采购页（不丢数据）
- 快速双击导航 → 防抖，弹窗期间忽略第二次点击
- 矩阵模式 → 同样适用（矩阵的数据变更也需要追踪）

#### 边界情况：空页面不触发离开确认

- **场景**：导出后清空 DOM → 切页时不应弹窗。导出全部成功后会调用 `clearPurchasePageDOM()` 清空 DOM 并 `resetPurchaseDirty()`。但如果 dirty flag 因导出流程中间步骤残留为 true，而 DOM 已空，离开确认弹窗会让用户误点"保存"→ 空 DOM 保存 → DB 数据被清空。
- **修复**：`navigateTo()` 增加 `hasPurchasePageData()` 检查。该函数遍历 `#purchase-container` 和 `#matrix-tbody` 中所有 `[data-field="product_name"]` input，任一非空即返回 true。
- **守卫逻辑**：
  - `PURCHASE_DIRTY && page !== 'purchase' && hasPurchasePageData()` → 弹窗确认
  - `PURCHASE_DIRTY && !hasPurchasePageData()` → 不弹窗 + 自动 `resetPurchaseDirty()`
  - 无 dirty → 直接离开
- 涉及文件：`renderer/app.js`

---

## B. 导出后采购页清空 + 调取按钮

### 现状
`exportAllPurchaseOrders()` 导出前静默保存，导出后数据仍留在采购页 DOM 中。用户可能误以为导出=归档，实际数据仍可编辑。

### 目标行为
导出全部采购单后，清空当前采购页所有 date group 内容。采购页仅作为"今日编辑区"，导出即归档。历史数据通过 history 页面查看或通过"调取"按钮按需加载。

### 实现

#### B1. 导出后清空
`exportAllPurchaseOrders()` 成功后：
1. 保存当前数据到 DB（已有）
2. 导出 xlsx（已有）
3. **新增**：清空所有 date group 的 tbody 内容（DOM 清空，不删 DB）
4. **新增**：重置 dirty flag

清空范围：
- 默认/多食堂/小所并列模式：所有 `.date-group tbody` 清空
- 小所矩阵模式：`#matrix-tbody` 清空
- 联华 date group：同上

不清空 DB 数据（导出的数据仍在 DB 的 purchase_orders 表中，history 页面可查）。

#### B2. 调取按钮
在采购页面新增"调取"按钮，点击后弹出日期范围选择器：

```
┌─────────────────────────────────────┐
│  调取历史采购数据                      │
│                                     │
│  从 [____] 到 [____]   (日期选择器)    │
│                                     │
│  数据来源：采购单 (purchase_orders)    │
│                                     │
│  [取消]              [加载到页面]     │
└─────────────────────────────────────┘
```

调取行为：
- 按日期范围 + source 从 `purchase_orders` 表查询
- 将查询结果按 source + receive_date 分组渲染为 date group
- 加载到页面的数据可编辑、可再导出
- 走正常 dirty 追踪（加载后 dirty=false）

#### B3. 页面初始化逻辑调整
`initPurchasePage()` 加载时：
- 默认**不加载**任何历史采购数据
- 仅加载 today 的联华 items（商品列表，用于自动补全）
- 空的 date group 容器保留（用户可直接新增今日采购）

### 交互流程

```
进入采购页 → 空白编辑区
    ↓
填写今日采购数据
    ↓
点击"导出全部" → 保存 + 导出 xlsx + 清空页面
    ↓
采购页恢复空白（数据已在 DB + xlsx）
    ↓
需要查看/修改历史 → 点"调取"选择日期范围加载
                 → 或去 history 页面查看
```

### 边界情况
- 导出后若用户立刻点"调取"同一天的数据 → 数据从 DB 加载回页面，可编辑再导出
- 导出时若有未保存修改 → 先保存再导出再清空（与现状一致，多了清空步骤）
- 清空仅影响当前显示的 DOM，DB 和已下载的 xlsx 文件不受影响

---

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `renderer/app.js` | `navigateTo` 改为弹窗确认（dirty 检查），新增 dirty flag 管理 + `hasPurchasePageData()` 空页面守卫 |
| `renderer/purchase.js` | dirty flag 埋点（所有修改操作）；导出后清空 DOM；新增调取按钮 + 弹窗逻辑 |
| `renderer/lianhua.js` | dirty flag 埋点（联华相关操作） |
| `renderer/index.html` | 调取按钮 UI |
