# 核心架构

## 概述
食堂出入库管理系统是面向食堂/餐饮运营的桌面库存管理应用。基于 Electron + sql.js 构建，管理入库/出库、跨多食堂采购单、询价和月度台账。

## 技术栈
- **运行时**: Electron v42.3.1, CommonJS 模块
- **数据库**: sql.js v1.14.1 (SQLite WASM, 进程内)
- **前端**: 原生 JS（无框架、无构建工具），单页导航
- **图表**: Chart.js v4.4.0 (CDN)
- **Excel 导入**: xlsx v0.18.5 (SheetJS)
- **Excel 导出**: ExcelJS v4.4.0（支持图片嵌入）

## 架构模式

### IPC 模型
- `main.js` 通过 `ipcMain.handle()` 注册约 60 个 IPC 处理器
- `preload.js` 通过 `contextBridge.exposeInMainWorld()` 暴露 `window.api`
- 渲染进程调用 `window.api.*` 方法触发 IPC
- 严格上下文隔离（`contextIsolation: true`, `nodeIntegration: false`）

### 数据库层
- `db.js` 管理 sql.js 实例
- 数据库文件存储在 `{userData}/inventory.db`
- sql.js 将整个数据库加载到内存
- 每次写操作调用 `save()` 通过 `fs.writeFileSync()` 导出到磁盘
- 无连接池，无 WAL 模式 — 单文件原子写入

### 渲染进程架构
- `index.html` 是单页外壳
- `app.js` 通过切换可见区域实现导航
- 13 个 JS 文件通过 `<script>` 标签直接加载
- `utils.js` 提供共享工具（自动补全、键盘导航、粘贴处理）

## 数据库表结构（9 张表）

### products — 产品主数据
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT | 产品名称 |
| spec | TEXT | 规格（如"大包"、"散装"） |
| unit | TEXT | 计量单位 |
| shelf_months | INTEGER | 保质期（月） |
| shelf_days | INTEGER | 保质期（天，额外天数） |
| unit_price | REAL | 单价 |
| opening_stock | REAL | 期初库存 |
| active | INTEGER | 软删除标记（1=有效, 0=已删除） |
| created_at | TEXT | 创建时间 ISO 格式 |

### inbound_records — 入库记录
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| product_id | INTEGER → products.id | |
| date | TEXT | 入库日期 (YYYY-MM-DD) |
| quantity | REAL | 数量 |
| remark | TEXT | 备注 |
| production_date | TEXT | 生产日期 |
| expiry_date | TEXT | 由 production_date + shelf_days 计算 |
| created_at | TEXT | |
| 索引: product_id, date | | |

### outbound_records — 出库记录
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| product_id | INTEGER → products.id | |
| date | TEXT | 出库日期 |
| quantity | REAL | 数量 |
| recipient | TEXT | 领用方 |
| created_at | TEXT | |
| 索引: product_id, date | | |

### recipients — 领用方列表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| name | TEXT UNIQUE | 名称 |
| 默认数据: 厨房, 小食堂, 面点房, 烧饭, 明档 | | |

### purchase_orders — 采购单
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| source | TEXT | 食堂标识（如"食堂A厨房"、"联华"、"食堂C-厨房"） |
| receive_date | TEXT | 收货日期 |
| product_name | TEXT | 产品名称 |
| spec | TEXT | 规格 |
| unit_price | REAL | 单价 |
| quantity | TEXT | 数量（TEXT 类型，保留用户输入格式） |
| unit | TEXT | 单位 |
| amount | REAL | 金额 |
| remark | TEXT | 备注 |
| sort_order | INTEGER | 排序 |
| created_at | TEXT | |

### inquiry_items — 询价数据
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| month | TEXT | 月份（如"2026-06"） |
| category | TEXT | 分类（7 类食品之一） |
| name | TEXT | 名称 |
| price | REAL | 价格 |
| unit | TEXT | 单位 |
| spec | TEXT | 规格 |
| remark | TEXT | 备注 |
| created_at | TEXT | |

### settings — 键值配置
| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT PK | 配置键 |
| value | TEXT | 配置值 |
| 约 25 个配置项 | | |

### lianhua_items — 联华商品目录
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| code | TEXT | 商品编码 |
| name | TEXT | 名称 |
| unit | TEXT | 单位 |
| spec | TEXT | 规格 |
| price | REAL | 价格 |
| split_qty | INTEGER | 每箱数量 |
| remark | TEXT | 备注 |
| created_at | TEXT | |

### lianhua_orders — 联华订单
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| item_id | INTEGER → lianhua_items.id | |
| order_date | TEXT | 订货日期 |
| quantity | REAL | 数量 |
| amount | REAL | 金额 |
| remark | TEXT | 备注 |
| created_at | TEXT | |

## 数据备份
- 每次应用启动时自动备份数据库文件，保留最近 3 天的备份
- 备份文件存储在 `{userData}/backups/` 目录下，命名含日期
- 超过 3 天的旧备份自动清理

## 版本与数据迁移
- 当前版本：V3
- 数据迁移策略：通过覆盖导入（xlsx 全量导入）完成
- 后续计划：增量更新功能（预计半个月后）
- 暂无 schema 版本号机制，schema 变更直接修改 CREATE TABLE

## 单实例限制
- 系统只允许运行一个实例，不允许同时打开多个窗口
- 尝试启动第二个实例时应提示已有实例在运行

## 错误处理
- 写入失败时根据错误类型向用户展示中文错误提醒
- 导入文件格式不对时提示格式要求
- 所有面向用户的错误信息必须是中文

## 新手引导系统
- 首次打开应用时强制弹出分步引导教程，覆盖各页面核心操作
- 引导可跳过，但建议走完全流程
- 设置页提供"重新查看教程"入口，方便后续回顾
- 重要功能按钮和操作区域加鼠标悬浮 tooltip 提示
- 目标：用户无需外部指导即可独立完成基本操作

## 窗口关闭处理
关闭窗口时检查入库/出库录入表是否有未保存数据，提供三个选项：保存后退出、直接退出、取消。

## 文件结构
```
main.js          — Electron 主进程、IPC 处理器
preload.js       — contextBridge API 暴露
db.js            — SQLite 数据库层
date-util.js     — 日期工具函数
renderer/
  index.html     — 单页 HTML 外壳
  styles.css     — 全部 CSS 样式
  app.js         — 导航、全局状态、初始化
  utils.js       — 共享工具（自动补全、键盘导航、粘贴）
  dashboard.js   — 总览页
  products.js    — 产品 CRUD
  inbound.js     — 入库批量录入
  outbound.js    — 出库批量录入
  inventory.js   — 库存查询 + 过期预警
  ledger.js      — 月度台账
  purchase.js    — 采购单（多模式）
  lianhua.js     — 联华订单
  inquiry.js     — 询价管理
  data-io.js     — 数据导入导出
  settings.js    — 设置页
photo/           — 产品参考图片
```
