# StockPot — 食堂出入库管理系统

> Desktop inventory management for cafeterias. Built with Electron 42 + WASM SQLite.
> Three operation modes, Excel-compatible input, one-click batch export.

<p align="center">
  <img src="assets/img/icon-128.png" alt="icon" width="96">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/平台-Windows%20x64-blue" alt="platform">
  <img src="https://img.shields.io/badge/Electron-42-blue" alt="electron">
  <img src="https://img.shields.io/badge/版本-2.2.2-green" alt="version">
  <img src="https://img.shields.io/badge/规模-9700行%20JS-informational" alt="lines">
  <img src="https://img.shields.io/badge/许可证-ISC-blue" alt="license">
</p>

---

## TL;DR

食堂每天做三件事：收货入库、领料出库、编制采购单。原来的做法是 Excel 表格 + 微信拍照，效率低、易出错。

这个桌面应用把全流程搬进一个窗口。品名自动补全、Excel 粘贴兼容、Ctrl+D 向下填充——**输入效率比 Excel 快 3 倍**。支持三种食堂组织架构（默认 / 多食堂 / 小所），覆盖从单个食堂到 7 个卫星食堂的规模。

---

## 解决什么问题

| 原来 | 现在 |
|------|------|
| 采购单手工敲品名和规格 | 输入首字即弹出补全，选中后自动填规格/单位/单价 |
| 多份 Excel 来回切 | 一个窗口，分页切换，所有数据在 SQLite 里 |
| 库存靠人工算，月底才知对错 | 实时库存、出入库流水、过期预警 |
| 月底台账要手动汇总 30 天 | 按日查看，一键导出 Excel |
| Excel 嵌产品图麻烦 | 导出时自动匹配实物照片嵌入采购单 |
| 数据安全靠自觉 | 事务保护批量写入，退出前未保存检测，3 天自动备份 |
| 多个食堂各管各的 | 三种模式统一管理：默认 / 多食堂分页 / 小所网格 |

---

## 功能模块

| 模块 | 文件 | 能力 |
|------|------|------|
| **入库登记** | `inbound.js` | 品名自动补全、批量录入、生产日期→到期日自动计算、Ctrl+D 填充、整列复制 |
| **出库登记** | `outbound.js` | 库存校验防超领、领取人管理、Ctrl+D 向下填充、整列复制 |
| **采购单** | `purchase.js` | 三种食堂模式、厨房+联华双区域、Excel 粘贴、带图导出、调取历史数据、离开确认 |
| **联华超市** | `lianhua.js` | 独立商品库、拆分单件计算、商品管理入口 |
| **库存查询** | `inventory.js` | 实时库存、出入库流水、过期预警（可配置天数） |
| **月度台账** | `ledger.js` | 按日查看出入库明细、导出 Excel |
| **询价管理** | `inquiry.js` | 导入鉴证表、双折扣率（盛销/优宏）计算、价格涨跌对比、月份动态选择 |
| **历史采购** | `history.js` | 按日查看、全选/反选、批量导出多天数据 |
| **仪表盘** | `dashboard.js` | 30 天趋势图、库存 Top-10、过期预警一览 |
| **数据导入导出** | `data-io.js` | 全量导出/导入、Excel 列映射导入（兼容自定义格式历史数据） |
| **产品管理** | `products.js` | 品名/规格/单位/保质期管理、批量删除、导入/导出 |
| **设置中心** | `settings.js` | 分页标签、30+ 可配置项、主题切换、食堂模式切换 |

---

## 三种食堂模式

```
模式 1：默认 ─── 食堂A + 食堂B
                 每个食堂独立：厨房 tab + 面点房 tab + 联华超市 tab
                 适合 2 个大型食堂

模式 2：多食堂 ── 食堂C、食堂D、食堂E
                 3 个独立标签页，每个含厨房 + 联华
                 导出时合并为一张 Sheet

模式 3：小所 ─── 食堂F1 ~ F7（7 个卫星食堂）
                 ├── 逐所输入：分页切换，每个食堂独立录入
                 └── 矩阵输入：品名 × 所名 网格，一次性填完
```

---

## 输入体验亮点

### 品名自动补全

输入首字即弹出匹配列表，完全匹配优先排序（完全匹配 > 开头匹配 > 包含匹配）。
选中后自动填入规格、单位、折扣后单价。可通过设置关闭"选中后跳转到数量栏"。

### Excel 兼容输入

- **单列粘贴**：选中一列数据复制 → 在表格中粘贴，自动向下填充
- **多列粘贴**：从 Excel 复制多列 → TSV 格式解析，匹配对应字段
- **Ctrl+D**：将当前格的值向下填充到整列（覆盖所有行，对齐 Excel 行为）
- **Enter 导航**：回车跳到下一行同列，Ctrl+Enter 切换横/纵导航模式
- **📋 列复制**：入库/出库表表头点击复制按钮，一键复制整列数据到剪贴板

### 数据安全机制

- **事务保护**：所有批量写操作 BEGIN → 批量执行 → COMMIT → save，失败自动 ROLLBACK
- **离开确认**：采购页有未保存修改时切页弹窗提醒（保存 / 不保存 / 取消）
- **退出检测**：关闭窗口时通过 IPC 询问是否有未保存数据，3 秒超时自动 forceQuit
- **数据库校验**：每次 save 后验证文件完整性
- **自动备份**：启动时保留最近 3 天备份，可手动触发

---

## 采购单导出

- 嵌入产品实物照片（从配置的图片文件夹自动匹配文件名）
- 厨房 Sheet + 联华 Sheet，多食堂模式合并导出
- 导出后页面自动清空（导出 = 归档），支持从 DB 调取历史数据再编辑
- 文件被占用时自动追加序号重试（`采购单.xlsx` → `采购单_1.xlsx` → ...）
- 列宽自适应，品名/规格/备注不遮挡

---

## 设置中心

分 4 个标签页，30+ 个可配置项：

| 分组 | 配置项 |
|------|--------|
| **通用** | 录入行数（10-100行）、回车导航模式（下一行 / 下一列）、选中品名后跳转到数量 |
| **数据** | 历史记录天数、采购单保留天数（1-365天）、过期预警天数、数据库路径 |
| **业务** | 盛销折扣率、优宏折扣率、食堂模式（默认/多食堂/小所）、小所列表面板、实物图片文件夹 |
| **外观** | 主题（默认 / Biophilic）、字体、字号、主色调（自动生成配色方案）、产品图尺寸 |

---

## 技术栈

| 层级 | 技术 | 理由 |
|------|------|------|
| 桌面框架 | Electron 42 (x64) | 表单密集型应用，Web 技术栈开发效率高 |
| 数据库 | sql.js 1.14 (WASM) | 纯前端 SQLite，零依赖安装，单文件.db 便于备份迁移 |
| Excel 读写 | ExcelJS 4.4 | 支持嵌入图片、样式控制、合并单元格 |
| Excel 解析 | SheetJS 0.18 | 读取历史 Excel 格式，列映射导入、含文字数量容错 |
| 图表 | Chart.js 4.5 | 仪表盘 30 天趋势图、Top-10 排行 |
| 样式 | 纯 CSS + CSS 变量 | 无框架依赖，主题系统原生支持，2 套主题（默认 + Biophilic） |
| 构建 | electron-builder 26 | NSIS 安装包，一键 `npm run build` |
| 打包 | @electron/asar 4.2 | asar 归档，后续增量更新通道 |

---

## 架构

```
main.js                         主进程：窗口管理、IPC 路由、文件对话框、导出逻辑
├── preload.js                  预加载：安全的 IPC 桥接、关闭检测回调注册
├── db.js                       数据层：sql.js WASM 引擎、9 张表 CRUD、事务封装
│   ├── products                产品主数据
│   ├── inbound_records         入库流水
│   ├── outbound_records        出库流水
│   ├── recipients              领取人
│   ├── purchase_orders         采购单明细
│   ├── inquiry_items           询价鉴证
│   ├── lianhua_items           联华商品库
│   ├── lianhua_orders          联华订单
│   └── remark_memory           备注记忆（按品名+来源）
├── date-util.js                日期工具：营业日期计算、跨月/跨年边界
└── renderer/                   渲染进程（15 个业务模块）
    ├── app.js                  全局初始化、设置加载、导航、toast、关闭检测
    ├── purchase.js             采购单：三种模式、粘贴、导出、调取、copyKitchenData
    ├── inbound.js              入库登记：补全、保质期计算、Ctrl+D
    ├── outbound.js             出库登记：库存校验、领取人、Ctrl+D
    ├── lianhua.js              联华超市：商品管理、拆分单件计算
    ├── inventory.js            库存查询、过期预警
    ├── ledger.js               月度台账：按日汇总、导出
    ├── inquiry.js              询价管理：双折扣率、月份动态选择
    ├── history.js              历史采购：批量选择、批量导出
    ├── dashboard.js            仪表盘：趋势图、Top-10、预警一览
    ├── data-io.js              数据导入导出：全量、列映射导入
    ├── products.js             产品管理：批量增删改查
    ├── settings.js             设置中心：分页标签、30+ 配置项持久化
    ├── utils.js                公共逻辑：自动补全排序、Excel 粘贴解析、Ctrl+D 填充、键盘导航
    ├── tour.js                 新手引导：分步指引
    ├── styles.css              默认主题：CSS 变量、响应式布局
    └── theme-biophilic.css     Biophilic 主题：有机自然风格、深色模式
```

---

## 项目规模

| 指标 | 数值 |
|------|------|
| 总代码行数 | ~9,700 行（不含 node_modules 和第三方库） |
| 渲染进程模块 | 15 个业务模块 + 2 套主题 CSS |
| 数据库表 | 9 张 |
| 可配置项 | 30+ 个 |
| 主题 | 2 套（默认 + Organic Biophilic） |
| 食堂模式 | 3 种架构（默认 / 多食堂 / 小所） |
| 版本迭代 | 8 个版本，从 v1.1.1 到 v2.2.2 |

---

## 版本演进

| 版本 | 日期 | 关键里程碑 |
|------|------|-----------|
| v1.1.1 | 2025-06 | 事务保护、面点房数据修复、多食堂合并导出、折扣价联动 |
| v1.1.2 | 2025-06 | 0 点历史记录丢失修复、矩阵模式数据守卫、联华日期修复 |
| v2.0.0 | 2025-06 | 小所矩阵模式、Biophilic 主题、新手引导 Tour |
| v2.1.0 | 2025-06 | clearAllData 完整性、保质期时区修复、Excel 列映射导入 |
| v2.2.0 | 2026-06 | x64 迁移、采购页离开确认、导出后清空+调取、auto_focus_qty、IPC 关闭检测、Ctrl+D 增强 |
| v2.2.2 | 2026-06 | 开源发布：地名脱敏、敏感数据清理、.gitignore 覆盖 |

完整变更记录见 [`changelog/`](changelog/)。

---

## 安装

```bash
git clone https://github.com/YourLanternFestival/StockPot.git
cd StockPot
npm install
npm start        # 开发运行
npm run build    # 打包 NSIS 安装包（输出到 dist/）
```

---

## 设计规格

项目规格文档在 [`openspec/specs/`](openspec/specs/)：

- [核心架构](openspec/specs/core/spec.md) — 数据模型、表结构、命名约定
- [设置系统](openspec/specs/settings/spec.md) — 配置项定义、分页布局、持久化策略
- [采购单](openspec/specs/purchase/spec.md) — 三种模式、输入行为、粘贴逻辑、导出格式
- [采购历史](openspec/specs/purchase-history/spec.md) — 数据生命周期、保留策略、批量导出
- [数据导入导出](openspec/specs/data-io/spec.md) — Excel 格式适配、列映射、文件占用重试
- [库存管理](openspec/specs/inventory/spec.md) — 入出库流程、Ctrl+D 填充、过期预警

---

## 许可证

ISC
