# 联华超市模块

## 概述
管理联华超市的商品目录和订单。联华输入面板与厨房输入使用**完全相同的基础输入模板**，唯一差异是自动补全数据源（`lianhua_items` vs `inquiry_items`）。

## 数据模型

### lianhua_items
商品目录，包含编码、名称、单位、规格、价格和每箱数量（split_qty）。

## 需求

### 需求：商品目录管理
系统应维护联华商品目录，包含编码、名称、单位、规格、价格和每箱数量（split_qty）。

### 需求：目录自动补全
联华区域应从 `lianhua_items` 自动补全。所有自动补全相关函数（`handleLianhuaAutocomplete`、`selectLianhuaAutocompleteItem`、`handleLianhuaBlur`）与厨房版本逻辑相同，仅数据源不同。

### 需求：采购单集成 — 联华 = 基础输入模板
联华输入面板与厨房输入使用**完全相同的基础输入模板**（9列：序号、品名、规格、单价、数量、单位、金额、备注、操作），差异仅在于：
- 自动补全数据源：`lianhua_items`（联华）vs `inquiry_items`（厨房）
- 事件绑定：`attachLianhuaCellEvents` vs `attachCellEvents`
- 行追加：`appendLianhuaRow` vs `appendPurchaseRow`

联华区域作为采购单的子区域出现在每个食堂中：
- 默认模式：1 个联华区域（source="联华"），使用 `showAddDateDialog` 添加日期组
- 多食堂模式：每个食堂 1 个联华区域（source="{食堂}-联华"），使用 `showAddDateDialog` 添加日期组
- 小所分组样式：每个小所 1 个联华区域（source="{所名}-联华"），使用弹窗模式添加
- 小所矩阵样式：通过"联华加购"下拉弹窗添加

### 需求：弹窗联华加购（仅小所模式）
小所矩阵模式和分组模式下，联华通过弹窗（`showAddLianhuaDate`）添加，弹窗内使用基础输入模板的行结构。
