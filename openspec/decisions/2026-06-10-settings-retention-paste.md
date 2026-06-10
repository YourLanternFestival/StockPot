# 变更记录：采购单保留天数 + 设置分页 + 粘贴序号修复

日期：2026-06-10

## 变更概要

| 变更 | 类型 | 涉及文件 |
|------|------|----------|
| 采购单保留天数可配置（默认31天） | 功能新增 | settings.js, app.js, db.js, main.js, preload.js, history.js, index.html |
| 设置面板分页（通用/数据/业务/外观） | 功能新增 | index.html, settings.js, styles.css, theme-biophilic.css |
| 粘贴后序号重排 | Bug修复 | utils.js |

## Spec 审查结果

### C层（5项）— 已修正 spec 对齐实现

| # | 问题 | 决策 |
|---|------|------|
| C1 | `canteen_mode` 值：spec 用 `"multi-canteen"`，实现用 `"multi"` | 修正 spec，新增模式映射文档 |
| C2 | `enter_navigation_mode` vs `enter_mode` | 修正 spec 键名和值 |
| C3 | `show_inbound_history` vs `inbound_history` | 修正 spec 键名 |
| C4 | `discount_name_1` vs `discount1_name` | 修正 spec 键名 |
| C5 | `small_display_style` 确认时机 | 修正 spec 描述为 onchange 触发 |

原因：spec 是后编的文档，实现是先有的代码。命名偏差不影响运行，以实现为准。

### W层（9项）— 逐条决策

#### W1: `purchase_retention_days` 范围校验仅在 HTML 层

- **决策**：暂不处理
- **原因**：HTML `min="1" max="365"` 已拦截用户输入。只有直接编辑 DB 才能写入超范围值，此场景极低频。`parseInt(...) || 31` 已覆盖 NaN 场景。投入产出比不值得加 JS clamp。

#### W2: 小所列表标注"可拖拽排序"但实际用箭头按钮

- **决策**：✅ 已修正文案为"可排序"
- **原因**：功能正常（箭头按钮可排序），纯文案不准确。拖拽排序需引入额外库，对 7 项列表不值得。

#### W3: `||` 回退将 `"0"` 视为 falsy

- **决策**：暂不处理
- **原因**：所有数值设置 `min≥1`，`"0"` 不会通过 UI 写入。如改 `??` 需改动 30+ 处，引入风险大于收益。若后续有 `min="0"` 的设置项，再针对性改 `??`。

#### W4: `typeof reindexPurchaseRows` 守卫

- **决策**：✅ 保留守卫，补充注释
- **原因**：审查代理误判。`utils.js` 是入库/出库/采购单/联华共用模块，非采购单页面不加载 `purchase.js`，直接调用会 ReferenceError。守卫是必要的。

#### W5: `_appendRowFn` 死代码

- **决策**：✅ 已删除
- **原因**：`_appendRowFn` 从未被赋值，grep 全局仅一处引用（读取处）。删除不影响功能，减少阅读负担。

#### W6: fallback `appendPurchaseRow` 在联华上下文语义错误

- **决策**：暂不处理
- **原因**：当前不可达——所有调用 `bindTableRowEvents` 的地方都传了 `onAppendRow`。作为安全网可接受。后续重构时考虑将 `onAppendRow` 改为必传参数。

#### W7: 粘贴每行触发 blur，并发 N 次自动匹配 API

- **决策**：暂不处理
- **原因**：sql.js 是同步 WASM 引擎，N 次调用在主线程排队执行，20 行粘贴实际耗时 < 50ms。若未来切换异步 DB 引擎或用户反馈卡顿，再用批量触发方案优化。

#### W8: `history.js` 中 `typeof APP_SETTINGS` 冗余守卫

- **决策**：✅ 已简化为直接访问
- **原因**：`APP_SETTINGS` 在 `app.js:76` 全局定义，永远存在。`typeof` 守卫是死代码。

#### W9: `app.js` 依赖执行顺序

- **决策**：暂不处理
- **原因**：`await loadAppSettings()` 显式保证执行顺序，`|| 31` 覆盖异常场景。当前双重保障已足够。

## 后续发现的 Bug

### 按钮泄漏到所有页面（Critical）

- **现象**：设置页底部的"查看新手引导"、"恢复默认主题"、"保存设置"按钮出现在所有页面
- **根因**：设置分页重构时，按钮 `<div>` 被放在了 `#page-settings` 的 `</div>` 之外，导致按钮成为页面顶层元素（不在任何 `.page` 容器内）
- **修复**：减少一个 `</div>`，使按钮位于 `#page-settings` 内部
- **为什么 4 个审查代理都没发现**：所有代理都聚焦于 spec 合规性和逻辑正确性，没有人检查 DOM 嵌套结构的正确性。CSS 规则 `.page { display: none }` + `.page.active { display: block }` 依赖正确的 DOM 包裹关系，这属于"结构正确性"维度，不在 spec 对照审查范围内
