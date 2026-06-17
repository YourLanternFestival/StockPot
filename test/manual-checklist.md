# Manual Test Checklist — IA32 to 64-bit Feature Port

> These are manual verification steps for the IA32 to 64-bit feature port. Each item requires a human to observe behaviour in the running Electron app. Automated tests (see `test/test-inquiry-months.js`) cover the logic-only portions.

---

## A. 离开确认 (Leave Confirmation Guard)

- [ ] 1. 采购页有未保存修改 -- 切页弹出确认弹窗（保存 / 不保存 / 取消）
- [ ] 2. 点"保存" -- 数据写入 DB -- 成功切页
- [ ] 3. 点"不保存" -- 丢弃修改 -- 切页（回到采购页时从 DB 加载旧数据）
- [ ] 4. 点"取消" -- 留在采购页
- [ ] 5. 无修改时切页 -- 不弹窗，直接切页
- [ ] 6. 空页面（导出后清空）切页 -- 不弹窗，直接切页（`hasPurchasePageData` 守卫）
- [ ] 7. 保存失败 -- toast 报错 -- 留在采购页

## B. 导出增强 (Export)

- [ ] 8. 导出全部 -- 成功后页面 DOM 清空（所有 tbody 空白）
- [ ] 9. 导出时若有未保存修改 -- 先静默保存再导出
- [ ] 10. 隔天打开采购页 -- 导出全部仍包含所有历史数据（非空）
- [ ] 11. 导出后 dirty flag 重置 -- 直接切页不弹窗

## C. 调取按钮 (Recall)

- [ ] 12. 点"调取" -- 弹窗选日期范围
- [ ] 13. 选日期范围加载 -- 数据按 source + date 分组渲染
- [ ] 14. 调取后的数据可编辑、可再导出
- [ ] 15. 调取后的 dirty flag 为 false

## D. 自动补全 (Autocomplete)

- [ ] 16. 输入品名 -- 完全匹配项排在最前面
- [ ] 17. 开头匹配项排在包含匹配项之前
- [ ] 18. 下拉项支持键盘 ↑ ↓ Enter Escape

## E. 数量输入校验 (Quantity Input)

- [ ] 19. 输入 "1.0" -- 正确计算金额（不会当作非纯数字）
- [ ] 20. 输入 "11条" -- 不从数量字段解析数字，金额来自之前保存的值
- [ ] 21. 输入 "01" -- 正确识别为数字 1

## F. 询价导入 (Inquiry Import)

- [ ] 22. 6 月打开导入弹窗 -- 下拉显示 5 月、6 月、7 月（倒序）
- [ ] 23. 1 月打开 -- 显示上年 12 月、1 月、2 月
- [ ] 24. 已有导入月份（如 3 月）也出现在下拉中
- [ ] 25. 选文件后预览显示条目数 -- 按钮启用

## G. 折扣 (Discount)

- [ ] 26. 全新安装未保存设置 -- 盛销折扣默认 0.9008（不是 0.92）
- [ ] 27. 采购页选品名 -- 单价 = 评估价 x 0.9008（2 位小数舍入）

## H. auto_focus_qty

- [ ] 28. 设置 `auto_focus_qty = on` -- 选品名后焦点自动跳到数量
- [ ] 29. 设置 `auto_focus_qty = off` -- 选品名后焦点不跳转

## I. deleteDateGroup

- [ ] 30. 删除最后一个 date group -- DB 中该 source + date 数据被清理
- [ ] 31. 删除非最后一个 -- 仅删该组数据，其他组保留
- [ ] 32. 联华 date group 删除 -- 数据同步从 DB 删除

## J. clearAllData

- [ ] 33. 清空所有数据 -- 9 张表全部清空（产品、入库、出库、领取人、采购单、询价、联华订单、联华商品、备注记忆）

## K. clearPurchaseOrders 安全

- [ ] 34. 删除 source 为空的采购单 -- 报错，不执行全表删除
