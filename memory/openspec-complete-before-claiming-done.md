---
name: openspec-complete-before-claiming-done
description: 交付前必须 spec + code + test 三件套完整，不等用户提醒
metadata:
  type: feedback
---

实现 openspec change 时，proposal 中声明的 spec 更新和测试必须和代码一起交付，不能等用户提醒才补。

**Why:** 用户多次发现我报"完成"但实际上 spec 没写、测试不够。openspec 流程本身就是 spec → code → test 闭环，proposal 里列了就要做。

**How to apply:**
1. 读完 proposal.md 的 Scope 段，确认涉及哪些 spec 文件
2. 实现代码的同时更新对应 spec
3. tasks.md 里的测试任务必须写完并通过
4. 全部完成后再报"完成"，不要分两次
5. 如果某个 spec 更新或测试确实应该推迟，在 proposal 里明确标 Out of Scope
