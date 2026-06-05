# 洋安出入库管理系统 - 交接文档

## 当前进度：代码模块化重构（进行中）

### 已完成的模块拆分
| 文件 | 职责 | 状态 |
|------|------|------|
| utils.js | 日期工具+自动补全基础设施+键盘导航 | ✅ |
| dashboard.js | 总览+图表+预警摘要 | ✅ |
| settings.js | 设置页+loadAppSettings | ✅ |
| ledger.js | 月度台账 | ✅ |
| products.js | 产品CRUD+批量选择 | ✅ |
| inventory.js | 库存查询+过期预警 | ✅ |
| inbound.js | 入库登记 | ✅ |
| outbound.js | 出库登记 | 🔄 进行中 |
| purchase.js | 食堂模式+厨房/面点房采购表 | ❌ 待做 |
| lianhua.js | 联华商品管理+联华行 | ❌ 待做 |
| inquiry.js | 询价管理 | ❌ 待做 |
| data-io.js | 数据导入导出 | ❌ 待做 |
| app.js | 入口+全局状态+导航+Toast/Modal | 瘦身中(2214行→目标~200行) |

### db.js 去重
- ✅ `getInboundRecords`/`getOutboundRecords` → 提取 `getRecords(table, filters)`
- ✅ `importInbound`/`importOutbound` → 提取 `importRecords(sqlFn, records)`

### 已修复的问题
| 问题 | 状态 |
|------|------|
| BUG1 导出采购单失效 | ✅ 模式隔离修复 |
| BUG2 类别自动识别失效 | ✅ getLatestCategoryForName |
| BUG3 库存字段串值 | ⚠️ 未复现 |
| BUG4 编辑物料不更新 | ✅ db.run日志+doEditProduct try-catch |
| 食堂模式重构 | ✅ 三模式+采购页切换 |
| 询价单品名称下拉选择 | ✅ 自动补全+联动 |
| 复制行按钮 | ✅ 询价表+采购单 |

### 待做
1. 完成剩余模块拆分（outbound/purchase/lianhua/inquiry/data-io）
2. 小所食堂模式（大块开发）
3. BUG3 库存字段串值（需复现步骤）

---

## 已完成功能

### 1. 产品管理
- ✅ 产品增删改查、批量删除、保质期联动换算、搜索

### 2. 入库登记
- ✅ 批量入库、产品自动补全、到期日自动计算、最近记录、键盘导航

### 3. 出库登记
- ✅ 批量出库、产品自动补全（显示库存）、库存不足提醒、键盘导航

### 4. 库存查询
- ✅ 实时库存计算、库存详情、过期预警分类

### 5. 月度台账
- ✅ 按月查看、每日明细、导入导出

### 6. 总览仪表盘
- ✅ 统计卡片、趋势图、饼图、临期预警

### 7. 采购单
- ✅ 食堂采购单管理、按日期分组、金额计算、保存加载、联华商品管理、导出(ExcelJS含图片)、复制行

### 8. 询价管理
- ✅ 月份/分类筛选、搜索、折扣计算、导入鉴证表、新增单品、实物图、品名自动补全、操作列(复制/删除)

### 9. 数据导入导出
- ✅ 导入产品/入库/出库、导出库存/台账/全部

---

## 技术栈

- **前端：** Electron + 原生HTML/CSS/JS
- **后端：** Node.js + sql.js (SQLite in-memory)
- **图表：** Chart.js
- **Excel：** XLSX.js (导入) + ExcelJS (导出含图片)

## 开发命令

```bash
npm install
npm start
npm run build
```

## 数据库位置

Windows: `%APPDATA%/洋安出入库管理系统/inventory.db`
