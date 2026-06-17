# 设置

## 概述
键值配置存储（settings 表），约 30 个配置项。设置页面提供分页修改界面。

## 设置页面布局

### 需求：分页标签导航
设置页面应使用标签页（Tab）组织配置项，而非单一长列表。

#### 场景：标签页结构
- 假设 用户进入设置页面
- 当 页面渲染
- 那么 顶部显示 4 个标签页：通用、数据、业务、外观
- 且 默认选中"通用"标签页
- 且 切换标签页时仅显示对应分组的配置卡片

#### 场景：标签页分组
- **通用**：录入表格配置、键盘导航
- **数据**：历史记录显示、采购单数据保留、过期预警、库存查询
- **业务**：询价配置、食堂模式、实物图片
- **外观**：界面主题

#### 场景：标签页视觉
- 当 标签页被选中
- 那么 底部显示主色调指示线
- 且 文字颜色变为主色调
- 且 未选中的标签使用次要文字颜色

#### 场景：生物亲和主题适配
- 假设 当前主题为生物亲和（biophilic）
- 当 设置页面渲染
- 那么 标签页使用圆角、半透明背景
- 且 字体使用主题字体

## 配置分类

### 录入表格配置
- `inbound_rows` — 入库录入表空行数（默认：5，**不在设置页暴露**，回车追加行已满足需求）
- `outbound_rows` — 出库录入表空行数（默认：5，同上）
- `purchase_rows` — 采购单录入表空行数（默认：10，同上）

### 历史记录显示
- `inbound_history` — 是否显示入库历史
- `outbound_history` — 是否显示出库历史
- `inbound_history_days` — 入库历史显示天数
- `outbound_history_days` — 出库历史显示天数

### 采购单数据
- `purchase_retention_days` — 采购单历史数据保留天数（默认：31，范围：1-365）

### 询价配置
- `discount1_name` — 第一折扣名称（默认："盛销"）
- `discount1_rate` — 第一折扣率（默认：0.9008）
- `discount2_name` — 第二折扣名称（默认："优宏"）
- `discount2_rate` — 第二折扣率（默认：0.9058）
- `price_decimals` — 价格小数精度

### 食堂模式
- `canteen_mode` — "default"、"multi" 或 "small"（注：持久化的 `canteen_mode` 设置使用旧地名 `'洋安'`、`'下涯'`、`'small'`，下拉框值映射到内部 `xiaosuo_mode` 设置）
- `small_canteen_list` — 小所名称 JSON 数组（支持拖拽排序）
- `small_display_style` — "groups" 或 "matrix"

#### 模式映射
- HTML 下拉框 `"default"` → `xiaosuo_mode='off'`, `show_pastry='on'`
- HTML 下拉框 `"multi"` → `canteen_mode='下涯'`, `xiaosuo_mode='on'`, `show_pastry='off'`
- HTML 下拉框 `"small"` → `xiaosuo_mode='small'`, `show_pastry='off'`

### 图片配置
- `photo_folder` — 产品图片文件夹路径

### 过期预警
- `alert_short_days` — 短期预警天数（默认：30）
- `alert_long_days` — 长期预警天数（默认：60）

### 键盘导航
- `enter_mode` — "next-row"（下一行同列）或 "next-cell"（下一行首列）

## 需求

### 需求：设置持久化
所有设置应持久化到 settings 表，在应用重启后保留。

### 需求：实时生效
设置更改应尽可能立即生效（无需重启）。

### 需求：样式切换警告
更改 small_display_style 时，下拉框 `onchange` 事件应立即显示确认对话框警告数据丢失（在保存之前触发，而非保存流程中）。

### 需求：小所列表管理
系统应支持小所列表的拖拽排序。

### 需求：默认值
所有设置应在应用中定义合理的默认值。

### 需求：采购单保留天数可配置
系统应允许用户自定义采购单历史数据的保留天数。

#### 场景：默认值
- 假设 用户从未修改过保留天数设置
- 当 应用启动清理旧数据
- 那么 使用默认值 31 天

#### 场景：自定义保留天数
- 假设 用户将保留天数设为 7
- 当 应用启动
- 那么 清理 7 天前的采购单数据
- 且 历史采购页面最多显示 7 天的日期标签

#### 场景：设置范围
- 假设 用户输入保留天数
- 当 输入值 < 1 或 > 365
- 那么 输入框限制在 1-365 范围内

### auto_focus_qty 设置项
- `auto_focus_qty` — 自动聚焦数量输入框（默认：`"on"`，storage：settings 表）
- 当值为 `"on"`：选择自动补全项后，焦点自动跳转到数量输入框
- 当值为 `"off"`：选择后不自动跳转
- 设置 UI 使用 id `setting-auto-focus-qty`，遵循 `setting-{key}` 命名约定
- `saveSettings()` 循环自动检测该设置
- 应用于 5 处：inbound.js、outbound.js、purchase.js、lianhua.js、inquiry.js

#### 场景：auto_focus_qty 开启
- 假设 auto_focus_qty 设置值为 "on"
- 当 用户从自动补全列表中选择一个项目
- 那么 焦点自动跳转到数量输入框

#### 场景：auto_focus_qty 关闭
- 假设 auto_focus_qty 设置值为 "off"
- 当 用户从自动补全列表中选择一个项目
- 那么 焦点保持不动（不跳转）

#### 场景：默认值
- 假设 用户从未修改过 auto_focus_qty 设置
- 那么 默认值为 "on"
