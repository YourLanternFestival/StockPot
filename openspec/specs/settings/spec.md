# 设置

## 概述
键值配置存储（settings 表），约 25 个配置项。设置页面提供修改界面。

## 配置分类

### 录入表格配置
- `inbound_rows` — 入库录入表空行数（默认：5，**不在设置页暴露**，回车追加行已满足需求）
- `outbound_rows` — 出库录入表空行数（默认：5，同上）
- `purchase_rows` — 采购单录入表空行数（默认：10，同上）

### 历史记录显示
- `show_inbound_history` — 是否显示入库历史
- `show_outbound_history` — 是否显示出库历史
- `inbound_history_days` — 入库历史显示天数
- `outbound_history_days` — 出库历史显示天数

### 询价配置
- `discount_name_1` — 第一折扣名称（默认："盛销"）
- `discount_rate_1` — 第一折扣率（默认：0.92）
- `discount_name_2` — 第二折扣名称（默认："优宏"）
- `discount_rate_2` — 第二折扣率（默认：0.90）
- `price_decimals` — 价格小数精度

### 食堂模式
- `canteen_mode` — "default"、"multi-canteen" 或 "small-canteen"
- `small_canteen_list` — 小所名称 JSON 数组（支持拖拽排序）
- `small_display_style` — "groups" 或 "matrix"

### 图片配置
- `photo_folder` — 产品图片文件夹路径

### 过期预警
- `alert_short_days` — 短期预警天数（默认：30）
- `alert_long_days` — 长期预警天数（默认：60）

### 键盘导航
- `enter_navigation_mode` — "same-column"（下一行同列）或 "first-column"（下一行首列）

## 需求

### 需求：设置持久化
所有设置应持久化到 settings 表，在应用重启后保留。

### 需求：实时生效
设置更改应尽可能立即生效（无需重启）。

### 需求：样式切换警告
更改 small_display_style 时，系统应显示确认对话框警告数据丢失。

### 需求：小所列表管理
系统应支持小所列表的拖拽排序。

### 需求：默认值
所有设置应在应用中定义合理的默认值。
