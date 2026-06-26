# 食堂出入库管理系统

<p align="center">
  <img src="assets/img/icon-128.png" alt="icon" width="96">
</p>

<p align="center">
  专为食堂仓储管理设计的桌面应用，覆盖入库、出库、采购、库存、台账全流程。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/平台-Windows-blue" alt="platform">
  <img src="https://img.shields.io/badge/Electron-42-blue" alt="electron">
  <img src="https://img.shields.io/badge/版本-1.1.2-green" alt="version">
  <img src="https://img.shields.io/badge/许可证-ISC-blue" alt="license">
</p>

---

## 为什么做这个

食堂每天要做三件事：**收货入库、领料出库、编制采购单**。

原来的做法是 Excel 表格 + 微信发照片。问题：

- 采购单没有自动补全，每次都要手敲品名和规格
- 库存靠人工算，经常算错
- 月底台账要手动汇总 30 天的数据
- 想加产品实物图？Excel 嵌图太麻烦

这个系统把所有流程搬到一个桌面应用里，**输入效率比 Excel 快 3 倍以上**。

## 功能概览

| 模块 | 核心能力 |
|------|---------|
| **入库登记** | 品名自动补全、批量录入、生产日期自动计算过期日 |
| **出库登记** | 库存校验（防超领）、领取人管理、Ctrl+D 向下填充 |
| **采购单** | 三种食堂模式、厨房/联华双区域、Excel 粘贴、带图导出 |
| **库存查询** | 实时库存、出入库流水、过期预警（可配置天数） |
| **月度台账** | 按日查看出入库明细、导出 Excel |
| **询价管理** | 导入鉴证表、双折扣率计算、价格涨跌对比 |
| **历史采购** | 按日查看历史记录、批量导出多天数据 |
| **设置中心** | 分页标签导航、30+ 可配置项、主题切换 |

## 亮点功能

### 极致的输入体验

- **品名自动补全**：输入一个字就弹出匹配列表，选中后自动填入规格、单位、单价
- **Excel 粘贴**：支持单列粘贴（向下填充）和多列粘贴（TSV 格式），超出行数自动追加行
- **Ctrl+D 填充**：出库表中将当前值向下填充到所有空行
- **回车导航**：回车跳到下一行同列，Ctrl+Enter 快速切换导航模式
- **文件占用重试**：导出 Excel 时文件被占用，自动加后缀重试，无需手动关闭

### 三种食堂模式

```
默认模式 ─── 食堂A/食堂B，厨房 + 面点房 + 联华超市
多食堂模式 ── 食堂C/食堂D/食堂E，每个食堂独立的厨房和联华
小所模式 ─── 食堂F 系列 7 个卫星食堂
              ├── 逐所输入（分页切换）
              └── 矩阵输入（品名 × 所名 网格）
```

### 可配置的设置中心

设置页使用标签页分组，30+ 个配置项：

| 分组 | 配置项 |
|------|--------|
| 通用 | 录入行数、回车导航模式 |
| 数据 | 历史记录天数、采购单保留天数（1-365天）、过期预警天数 |
| 业务 | 折扣率、食堂模式、小所列表、实物图片路径 |
| 外观 | 主题风格、字体、字号、主色调（自动生成配色方案） |

### 采购单导出

- 嵌入产品实物图（从配置的文件夹自动匹配）
- 按食堂分 Sheet，厨房和联华分开
- 文件被占用时自动重试

## 技术栈

| 层级 | 技术 | 选型理由 |
|------|------|---------|
| 桌面框架 | Electron 42 | 跨平台、Web 技术栈、适合表单密集型应用 |
| 数据库 | sql.js (WASM) | 纯 JS、无需安装数据库服务、单文件存储 |
| Excel 处理 | ExcelJS | 支持嵌入图片、样式控制、流式写入 |
| 图表 | Chart.js | 轻量、响应式、动画流畅 |
| 样式 | 纯 CSS + CSS 变量 | 无框架依赖、主题系统原生支持 |
| 构建 | electron-builder | 一键打包 NSIS 安装包 |

## 架构

```
main.js (主进程)
├── 窗口管理、IPC 处理、文件对话框
├── db.js (数据层)
│   ├── sql.js WASM 引擎
│   ├── SQLite 单文件数据库
│   └── 事务保护的批量操作
└── renderer/ (渲染进程)
    ├── app.js ──────── 全局初始化、设置加载
    ├── purchase.js ─── 采购单（三种模式、粘贴、导出）
    ├── inbound.js ──── 入库登记
    ├── outbound.js ─── 出库登记
    ├── inventory.js ── 库存查询、过期预警
    ├── ledger.js ───── 月度台账
    ├── inquiry.js ──── 询价管理
    ├── history.js ──── 历史采购（含批量导出）
    ├── settings.js ─── 设置中心（分页标签）
    ├── products.js ─── 产品管理
    ├── utils.js ────── 公共逻辑（粘贴、自动补全、键盘导航）
    ├── tour.js ─────── 新手引导
    └── styles.css ──── 主题系统（默认 + Biophilic）
```

## 项目规模

- **~8400 行** JavaScript（不含依赖和第三方库）
- **16 个**渲染进程模块
- **30+ 个**可配置设置项
- **2 套**主题（默认风格 + 有机自然 Biophilic）
- **9 个**数据库表

## 设计决策

项目的设计决策记录在 [`openspec/decisions/`](openspec/decisions/) 目录。完整的功能规格在 [`openspec/specs/`](openspec/specs/) 目录，覆盖：

- [设置系统](openspec/specs/settings/spec.md) — 配置项定义、分页布局、持久化策略
- [采购单](openspec/specs/purchase/spec.md) — 三种模式、输入行为、粘贴逻辑、导出格式
- [采购历史](openspec/specs/purchase-history/spec.md) — 数据生命周期、保留策略、批量导出
- [数据导入导出](openspec/specs/data-io/spec.md) — Excel 格式适配、文件占用重试
- [库存管理](openspec/specs/inventory/spec.md) — 入库出库流程、Ctrl+D 填充、过期预警

## 安装

```bash
# 克隆项目
git clone <repo-url>
cd in-out

# 安装依赖
npm install

# 开发运行
npm start

# 打包
npm run build
```

## 许可证

ISC
