# Delta Spec: 采购单三模式解耦

## 移除的需求

### ~~需求：小所分组样式~~
~~删除。业务已定只用矩阵样式。~~

### ~~需求：小所显示样式切换~~
~~删除 `small_display_style` 设置项。~~

## 修改的需求

### 需求：文件拆分（修改）

原来所有模式代码在 `purchase.js`（~2266 行）。

改为：
- `purchase-core.js`：共享工具（HTML builder、行操作、自动补全、询价查询、调取、导出 helper）
- `purchase-default.js`：默认模式
- `purchase-multi.js`：多食堂模式
- `purchase-small.js`：小所矩阵模式
- `purchase.js`：调度器 + save/export 入口

#### 场景：加载顺序
- 假设 `index.html` 加载脚本
- 那么 顺序为 `purchase-core.js` → `purchase-default.js` → `purchase-multi.js` → `purchase-small.js` → `purchase.js`
- 且 所有模式文件在 `lianhua.js` 之前加载

#### 场景：模式切换互不干扰
- 假设 用户从默认模式切换到小所模式
- 当 `applyCanteenMode()` 执行
- 那么 上一个模式的 DOM 被清空，新模式重新创建 DOM
- 且 `saveAllPurchaseOrders` 只收集当前活动模式的数据

#### 场景：跨文件函数可用
- 假设 `purchase-core.js` 定义了 `buildDateGroupHTML`
- 那么 所有模式文件和 `lianhua.js` 可以直接调用

---

### 需求：多食堂模式（修改）

多食堂列表从硬编码 `['下涯', '制杆厂', '白南山']` 改为可配置。

#### 场景：多食堂可配置
- 假设 用户在设置页修改多食堂列表
- 当 用户保存设置
- 那么 `multi_canteens` 存入数据库，JSON 数组，上限 4 个
- 且 默认值为 `["下涯","制杆厂","白南山"]`

#### 场景：多食堂 tabs 动态渲染
- 假设 多食堂模式激活，配置了 N 个食堂
- 当 `initMultiCanteenMode()` 执行
- 那么 tabs 按钮由 JS 动态生成（不再写死在 HTML）
- 且 `#multi-canteen-area` 中的 `purchase-group` 按食堂动态创建

#### 场景：多食堂上限
- 假设 用户尝试添加第 5 个食堂
- 那么 显示错误提示"最多 4 个食堂"
- 且 建议"超过 4 个请转用小所模式"

#### 场景：多食堂改名
- 假设 用户将一个食堂从"下涯"改名为"下涯园区"
- 当 采购页加载多食堂模式
- 那么 source 变为 `下涯园区-厨房` / `下涯园区-联华`
- 且 历史数据不受影响（新旧 source 各自存在）

---

### 需求：小所模式（修改）

小所模式只保留矩阵输入（matrix），删除分组输入（groups）。

#### 场景：小所矩阵为唯一样式
- 假设 小所模式激活
- 当 `initSmallCanteenMode()` 执行
- 那么 直接渲染矩阵表格（品名 × 小所）
- 且 不再显示 groups/矩阵切换按钮

#### 场景：小所联华加购
- 假设 小所矩阵模式激活
- 当 用户点击"联华加购"下拉
- 那么 选择小所后弹出联华日期组编辑弹窗
- 且 联华数据保存到对应小所的联华 source

#### 场景：小所复制/同步
- 假设 矩阵模式激活
- 当 用户点击"复用单个小所"或"一键同步"
- 那么 功能保持可用（从矩阵数据中复制数量到目标所）

---

### 需求：多食堂历史记录

现有 `renderMultiCanteenHistory` 期待固定的 3 个食堂名。需改为动态读取 `APP_SETTINGS.multi_canteens`。

#### 场景：历史页匹配多食堂配置
- 假设 多食堂列表被修改
- 当 历史页渲染多食堂模式
- 那么 按当前配置的食堂列表聚合展示
