# v1.1.2 更新日志

## 关键 Bug 修复

- **修复 0 点历史记录丢失**：`saveAllPurchaseOrders` 原先收集 DOM 中所有 `purchase-group` 的 source（包括空壳元素），新天 `shouldLoadData=false` 时 DOM 无数据但仍会 clear 所有 source，导致历史记录被清空。改为只收集有 `date-group` 的 source，无 dateGroup 则跳过保存
- **修复矩阵模式静默保存误清历史**：`saveMatrixData` 添加 `if (silent && orders.length === 0) return;` 守卫，新天矩阵为空时不再 clear 所有小所厨房数据
- **修复联华 DOM 数据保存误清历史**：`saveLianhuaDomData` 对无 dateGroup 的 source 区分静默/显式保存——静默保存跳过（防止新天误清），显式保存仍清理（用户主动清空数据时生效）
- **修复多食堂模式联华发货时间丢失**：`exportAllPurchaseOrders` 多食堂模式导出联华时，原代码未从 dateGroup 提取日期设置到 `r.date`，导致 `buildMergedLianhuaSheet` 回退到空字符串。添加 `r.date = getDateFromGroup(dateGroup)`

## 问题根因分析

### 0 点历史记录丢失

**触发路径**：
1. 用户在前一天添加采购数据并保存
2. 0 点后 app 重启或用户切换页面
3. `initPurchasePage` 设置 `shouldLoadData = false`（新天），`loadPurchaseGroupData` 直接 return，DOM 为空
4. 但 `initMultiCanteenMode` / `initSmallCanteenMode` 仍创建空壳 `purchase-group` 元素
5. 用户切换页面触发 `silentSavePurchaseOrders`
6. 原代码：`currentSources = 所有空壳 group 的 source`，`allOrders = []`
7. `savePurchaseOrdersBatch(6个source, [])` → DELETE 所有 source 的全部记录 → 历史全没

**修复逻辑**：从 dateGroup 反推 source，而非从 purchase-group 正推 source。无 dateGroup = 数据未加载 = 不纳入清理范围。

### 联华发货时间丢失

**触发路径**：多食堂模式导出时，联华行数据通过 `collectLianhuaRows` 收集，但该函数不包含 `date` 字段。小所模式导出有 `r.date = date`，多食堂模式遗漏了这行。

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `renderer/purchase.js` | `saveAllPurchaseOrders` source 收集逻辑；`saveMatrixData` 空数据守卫；`saveLianhuaDomData` 静默/显式区分；多食堂导出联华日期 |

## 审查结论

子代理审查确认三种模式（默认/多食堂/小所）的输入、保存、导出、历史记录、页面表现全链路正确。已修复的 4 个问题不会引入回归。
