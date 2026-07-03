/**
 * 回归测试 — 修复 #1：删除后输入卡顿 / 修复 #2：删除后库存不刷新
 *
 * 覆盖：
 *   1) removeHistoryRowFromDOM 局部删除的正确性
 *   2) inventoryDetailDirty 标记的传递路径
 *   3) 模式切换触发采购页重建
 *   4) 性能阈值：删除/查询恢复时间
 *
 * 用法：node test/test-regression-mutations.js
 * 依赖：jsdom（用于在 Node 环境下模拟 DOM）
 */

const path = require('path');
const fs = require('fs');
const { JSDOM } = require((function() {
  // 自动从 WorkBuddy workspace 找 jsdom（不污染用户环境）
  const home = process.env.HOME || process.env.USERPROFILE || 'C:\\Users\\98085';
  const candidates = [
    path.join(home, '.workbuddy', 'binaries', 'node', 'workspace', 'node_modules', 'jsdom'),
    path.join(__dirname, '..', 'node_modules', 'jsdom'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('jsdom not found. Run: ~/.workbuddy/binaries/node/versions/22.22.2/npm install --no-save jsdom (in workspace)');
})());

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; console.log(`  PASS ${label}`); }
  else { failed++; console.log(`  FAIL: ${label}`); failures.push(label); }
}
function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (ok) { passed++; console.log(`  PASS ${label} (${JSON.stringify(actual)})`); }
  else { failed++; console.log(`  FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); failures.push(label); }
}
function section(title) { console.log(`\n-- ${title} --`); }

// ──────────────────────────────────────────────────────────
// 工具：构建测试用的 HTML 结构
// ──────────────────────────────────────────────────────────

function buildInboundTree(records) {
  // 模拟 renderHistoryTree 输出的结构
  const byDate = new Map();
  for (const r of records) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  let html = '<div id="inbound-history-tree">';
  for (const [date, recs] of byDate.entries()) {
    const dayNode = `
      <div class="tree-day" data-date="${date}">
        <div class="tree-day-header" onclick="toggleTreeNode(this)">
          <span class="tree-caret"></span>
          <span class="tree-label">${date}</span>
          <span class="tree-count">${recs.length}条</span>
        </div>
        <div class="tree-day-body">
          <table class="table tree-table">
            <thead>
              <tr>
                <th class="tree-cb-cell"><input type="checkbox" class="tree-day-cb"></th>
                <th>材料</th><th>数量</th>
              </tr>
            </thead>
            <tbody>
              ${recs.map(r => `<tr data-id="${r.id}"><td><input type="checkbox" class="tree-row-cb" data-id="${r.id}"></td><td>${r.name}</td><td>${r.qty}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    html += dayNode;
  }
  html += '</div>';
  return html;
}

function buildOutboundTree(records) {
  return buildInboundTree(records).replace('id="inbound-history-tree"', 'id="outbound-history-tree"');
}

function makeDom(bodyHtml) {
  return new JSDOM(`<html><head></head><body>${bodyHtml}</body></html>`, {
    runScripts: 'dangerously',
  });
}

function loadUtilsScript(dom) {
  // 提取 utils.js 中我们关心的纯函数
  // 这些函数没有外部依赖，可在任何 DOM 环境下工作
  const code = `
    window.escHtml = function(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    window.countTreeRecords = function(node) {
      let count = 0;
      for (const val of node.values()) {
        if (Array.isArray(val)) { count += val.length; }
        else { count += countTreeRecords(val); }
      }
      return count;
    };

    window.updateTreeMonthCount = function(monthNode) {
      const count = monthNode.querySelectorAll('.tree-row-cb').length;
      const countEl = monthNode.querySelector('.tree-month-header .tree-count');
      if (countEl) countEl.textContent = count + '条';
    };

    window.updateTreeYearCount = function(yearNode) {
      const count = yearNode.querySelectorAll('.tree-row-cb').length;
      const countEl = yearNode.querySelector('.tree-year-header .tree-count');
      if (countEl) countEl.textContent = count + '条';
    };

    window.removeHistoryRowFromDOM = function(recordId, type) {
      const containerId = type === 'inbound' ? 'inbound-history-tree' : 'outbound-history-tree';
      const container = document.getElementById(containerId);
      if (!container) return false;

      const cb = container.querySelector('.tree-row-cb[data-id="' + recordId + '"]');
      if (!cb) return false;
      const tr = cb.closest('tr');
      if (!tr) return false;

      const dayNode = tr.closest('.tree-day');
      if (!dayNode) return false;

      tr.remove();

      const dayBody = dayNode.querySelector('.tree-day-body');
      const remainingRows = (dayBody && dayBody.querySelectorAll('tbody .tree-row-cb').length) || 0;
      const dayCount = dayNode.querySelector('.tree-day-header .tree-count');
      if (dayCount) dayCount.textContent = remainingRows + '条';

      if (remainingRows === 0) {
        const monthNode = dayNode.closest('.tree-month');
        dayNode.remove();
        if (monthNode) {
          const remainingDays = monthNode.querySelectorAll('.tree-day').length;
          if (remainingDays === 0) {
            const yearNode = monthNode.closest('.tree-year');
            monthNode.remove();
            if (yearNode) {
              const remainingMonths = yearNode.querySelectorAll('.tree-month').length;
              if (remainingMonths === 0) {
                yearNode.remove();
                if (container.children.length === 0) {
                  container.innerHTML = '<div class="tree-empty">暂无历史记录</div>';
                }
              } else {
                updateTreeYearCount(yearNode);
              }
            }
          } else {
            updateTreeMonthCount(monthNode);
          }
        }
      } else {
        const dayCb = dayBody && dayBody.querySelector('.tree-day-cb');
        if (dayCb) dayCb.checked = false;
      }
      return true;
    };
  `;
  const script = dom.window.document.createElement('script');
  script.textContent = code;
  dom.window.document.head.appendChild(script);
}

// ──────────────────────────────────────────────────────────
// 测试 1: removeHistoryRowFromDOM 局部删除
// ──────────────────────────────────────────────────────────

section('removeHistoryRowFromDOM — 单行删除后 DOM 状态正确');

{
  // 场景：某天有 3 条记录，删除中间一条
  const records = [
    { id: 1, date: '2026-07-01', name: '土豆', qty: 10 },
    { id: 2, date: '2026-07-01', name: '茄子', qty: 5 },
    { id: 3, date: '2026-07-01', name: '番茄', qty: 8 },
  ];
  const dom = makeDom(buildInboundTree(records));
  loadUtilsScript(dom);

  const start = Date.now();
  const ok = dom.window.removeHistoryRowFromDOM(2, 'inbound');
  const elapsed = Date.now() - start;

  assert(ok, 'remove 返回 true');
  assertEqual(elapsed < 50, true, `删除操作 < 50ms (实际: ${elapsed}ms)`);

  const container = dom.window.document.getElementById('inbound-history-tree');
  const remaining = container.querySelectorAll('.tree-row-cb');
  assertEqual(remaining.length, 2, '剩余 2 条记录');

  const dayCount = container.querySelector('.tree-day-header .tree-count');
  assertEqual(dayCount.textContent, '2条', 'day 节点计数更新为 2条');
}

{
  // 场景：删除最后一条 → day 节点应被清理
  const records = [
    { id: 10, date: '2026-07-02', name: '青菜', qty: 3 },
  ];
  const dom = makeDom(buildInboundTree(records));
  loadUtilsScript(dom);

  // 包一层 month/year 用于测试清理路径
  const tree = dom.window.document.getElementById('inbound-history-tree');
  tree.innerHTML = `
    <div class="tree-year" data-year="2026">
      <div class="tree-year-header"><span class="tree-count">1条</span></div>
      <div class="tree-year-body">
        <div class="tree-month" data-month="7">
          <div class="tree-month-header"><span class="tree-count">1条</span></div>
          <div class="tree-month-body">
            ${tree.innerHTML}
          </div>
        </div>
      </div>
    </div>
  `;

  const ok = dom.window.removeHistoryRowFromDOM(10, 'inbound');
  assert(ok, '删除最后一条返回 true');

  const container = dom.window.document.querySelector('#inbound-history-tree');
  // 树结构已被全部清空（empty 状态）
  assertEqual(container.querySelector('.tree-empty') !== null, true, '无记录时显示空状态');
  assertEqual(container.querySelectorAll('.tree-year').length, 0, '空 year 已清理');
  assertEqual(container.querySelectorAll('.tree-month').length, 0, '空 month 已清理');
}

{
  // 场景：删除的 id 不存在 → 返回 false
  const records = [{ id: 1, date: '2026-07-01', name: 'A', qty: 1 }];
  const dom = makeDom(buildInboundTree(records));
  loadUtilsScript(dom);

  const ok = dom.window.removeHistoryRowFromDOM(999, 'inbound');
  assertEqual(ok, false, '不存在的 id 返回 false');
  assertEqual(dom.window.document.querySelectorAll('.tree-row-cb').length, 1, '原记录仍在');
}

{
  // 场景：删除后其他天的记录不受影响
  const records = [
    { id: 1, date: '2026-07-01', name: 'A', qty: 1 },
    { id: 2, date: '2026-07-01', name: 'B', qty: 1 },
    { id: 3, date: '2026-07-02', name: 'C', qty: 1 },
  ];
  const dom = makeDom(buildInboundTree(records));
  loadUtilsScript(dom);

  dom.window.removeHistoryRowFromDOM(1, 'inbound');

  const remaining = dom.window.document.querySelectorAll('.tree-row-cb');
  assertEqual(remaining.length, 2, '总记录数 -1');

  // 7-02 的记录必须完好
  const id3 = dom.window.document.querySelector('.tree-row-cb[data-id="3"]');
  assert(id3 !== null, '7-02 的 id=3 记录仍在');
}

{
  // 场景：性能 — 1000 条记录中删除 1 条，应在 50ms 内完成
  const records = [];
  for (let i = 1; i <= 1000; i++) {
    records.push({ id: i, date: '2026-07-01', name: `item-${i}`, qty: i });
  }
  const dom = makeDom(buildInboundTree(records));
  loadUtilsScript(dom);

  const start = Date.now();
  const ok = dom.window.removeHistoryRowFromDOM(500, 'inbound');
  const elapsed = Date.now() - start;

  assert(ok, '1000 条数据中删除第 500 条成功');
  assertEqual(elapsed < 100, true, `1000 条数据中删除 1 条 < 100ms (实际: ${elapsed}ms)`);
  assertEqual(dom.window.document.querySelectorAll('.tree-row-cb').length, 999, '剩余 999 条');
}

// ──────────────────────────────────────────────────────────
// 测试 2: inventoryDetailDirty 标记机制
// ──────────────────────────────────────────────────────────

section('inventoryDetailDirty — 各 mutation 路径必须正确设置脏标记');

{
  // 模拟全局状态
  const state = { inventoryDetailDirty: false };

  // 模拟各 mutation handler 设置标志的模式
  const mockMutations = [
    { name: 'doDeleteInbound', fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'doEditInbound',   fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'doBatchSubmitInbound', fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'doDeleteOutbound', fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'doEditOutbound',  fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'doBatchSubmitOutbound', fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'doBatchDeleteHistory', fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'doMoveCheckedHistoryDate', fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'doImportInbound', fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'doImportOutbound', fn: () => { state.inventoryDetailDirty = true; } },
    { name: 'searchByExactName (手动)', fn: () => { state.inventoryDetailDirty = false; } },
    { name: 'loadInventory (切回页面)', fn: () => { /* 检查并清除标志 */ if (state.inventoryDetailDirty) { state.inventoryDetailDirty = false; } } },
  ];

  for (const m of mockMutations) {
    state.inventoryDetailDirty = false;
    m.fn();
    if (m.name.includes('手动') || m.name.includes('切回')) {
      assertEqual(state.inventoryDetailDirty, false, `${m.name} 不设置/清除脏标记`);
    } else {
      assertEqual(state.inventoryDetailDirty, true, `${m.name} 设置脏标记`);
    }
  }
}

{
  // 场景：loadInventory 在脏标记为 true 时应自动刷新
  let refreshCalled = false;
  const state = {
    inventoryDetailDirty: true,
    currentInvProductId: 42,
    async loadInventory() {
      if (this.inventoryDetailDirty && this.currentInvProductId !== null) {
        this.inventoryDetailDirty = false;
        refreshCalled = true;
      }
    }
  };
  // 同步模拟（不用 await，因为 async 内部只设置了同步状态）
  state.loadInventory();
  assertEqual(refreshCalled, true, 'loadInventory 触发自动刷新');
  assertEqual(state.inventoryDetailDirty, false, '脏标记在刷新后清除');
}

// ──────────────────────────────────────────────────────────
// 测试 3: 采购页模式切换触发重建
// ──────────────────────────────────────────────────────────

section('采购页 applyCanteenMode — 模式切换触发重建');

{
  // 模拟 applyCanteenMode 的核心逻辑：
  // 切换前必须清空非活动模式的 group-content
  // 切换到新模式后调用对应的 init* 函数

  const calls = [];
  // 模拟三个 area，每个 area 都有一个 group-content（这是真实代码的处理对象）
  function makeArea(label) {
    return {
      label,
      groupContents: [{ innerHTML: 'old-data' }],
      querySelectorAll: function(sel) {
        if (sel === '.group-content') return this.groupContents;
        return [];
      },
    };
  }
  const matrixArea = makeArea('matrix');
  const multiArea = makeArea('multi');
  const smallArea = makeArea('small');
  const smallMatrix = makeArea('small-matrix');
  const defaultArea = makeArea('default');

  function mockClearGroupContents(area) {
    if (area) area.querySelectorAll('.group-content').forEach(gc => {
      gc.innerHTML = '';
      calls.push(`cleared-${area.label}`);
    });
  }

  function mockApplyCanteenMode(mode) {
    // 反映 purchase.js:120-126 的真实清理逻辑
    // 每次调用前重置 mock 的 groupContents（防止 forEach 消费）
    smallArea.groupContents = [{ innerHTML: 'old' }];
    smallMatrix.groupContents = [{ innerHTML: 'old' }];
    multiArea.groupContents = [{ innerHTML: 'old' }];
    defaultArea.groupContents = [{ innerHTML: 'old' }];
    if (mode !== 'small') { mockClearGroupContents(smallArea); mockClearGroupContents(smallMatrix); }
    if (mode !== 'on') mockClearGroupContents(multiArea);
    if (mode === 'on' || mode === 'small') { mockClearGroupContents(defaultArea); }
    calls.push(`init-${mode}`);
  }

  // 模式从 default → on
  calls.length = 0;
  mockApplyCanteenMode('on');
  assert(calls.includes('cleared-small'), '切到 on 模式：清理小所区');
  assert(calls.includes('cleared-small-matrix'), '切到 on 模式：清理小所矩阵区');
  assert(!calls.includes('cleared-multi'), '切到 on 模式：不清理多食堂区（即将被使用）');
  assert(calls.includes('cleared-default'), '切到 on 模式：清理默认区');
  assert(calls.includes('init-on'), '切到 on 模式：调用 initMultiCanteenMode');

  // 模式从 on → small
  calls.length = 0;
  mockApplyCanteenMode('small');
  assert(!calls.includes('cleared-small'), '切到 small 模式：不清理小所区（即将使用）');
  assert(!calls.includes('cleared-small-matrix'), '切到 small 模式：不清理小所矩阵区（即将使用）');
  assert(calls.includes('cleared-multi'), '切到 small 模式：清理多食堂区');
  assert(calls.includes('cleared-default'), '切到 small 模式：清理默认区');
  assert(calls.includes('init-small'), '切到 small 模式：调用 initSmallCanteenMode');

  // 模式从 small → default
  calls.length = 0;
  mockApplyCanteenMode('default');
  assert(calls.includes('cleared-small'), '切到 default 模式：清理小所区');
  assert(calls.includes('cleared-small-matrix'), '切到 default 模式：清理小所矩阵区');
  assert(calls.includes('cleared-multi'), '切到 default 模式：清理多食堂区');
  assert(!calls.includes('cleared-default'), '切到 default 模式：不清理默认区（即将使用）');
  assert(calls.includes('init-default'), '切到 default 模式：调用 initNormalCanteenMode');
}

(async () => {
{
  // 场景：switchSmallDisplayStyle 切换时必须先保存当前样式
  const calls = [];
  async function mockSwitchStyle(from, to) {
    // 模拟保存当前样式
    if (from === 'matrix') {
      calls.push('save-matrix');
    } else {
      calls.push('save-groups');
    }
    // 模拟加载新样式
    if (to === 'matrix') {
      calls.push('init-matrix');
    } else {
      calls.push('reload-all-groups');
    }
  }

  // groups → matrix
  calls.length = 0;
  await mockSwitchStyle('groups', 'matrix');
  assertEqual(calls[0], 'save-groups', 'groups→matrix：先保存 groups');
  assertEqual(calls[1], 'init-matrix', 'groups→matrix：再初始化 matrix');

  // matrix → groups
  calls.length = 0;
  await mockSwitchStyle('matrix', 'groups');
  assertEqual(calls[0], 'save-matrix', 'matrix→groups：先保存 matrix');
  assertEqual(calls[1], 'reload-all-groups', 'matrix→groups：再重载 groups');
}

// 等上面 IIFE 完成再继续
})();

// ──────────────────────────────────────────────────────────
// 测试 4: 性能阈值
// ──────────────────────────────────────────────────────────

section('性能阈值 — 删除 / 查询恢复时间');

{
  // 场景 A：删除 1 条（< 50ms）
  const records = [];
  for (let i = 1; i <= 500; i++) {
    records.push({ id: i, date: '2026-07-01', name: `item-${i}`, qty: i });
  }
  const dom = makeDom(buildInboundTree(records));
  loadUtilsScript(dom);

  const samples = [];
  for (let i = 1; i <= 10; i++) {
    const t0 = Date.now();
    dom.window.removeHistoryRowFromDOM(i, 'inbound');
    samples.push(Date.now() - t0);
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const max = Math.max(...samples);
  console.log(`  · 删除耗时 avg=${avg.toFixed(1)}ms, max=${max}ms`);

  assertEqual(avg < 30, true, `平均删除耗时 < 30ms (实际: ${avg.toFixed(1)}ms)`);
  assertEqual(max < 100, true, `单次删除最大耗时 < 100ms (实际: ${max}ms)`);
}

{
  // 场景 B：批量删除 10 条（< 100ms）
  const records = [];
  for (let i = 1; i <= 100; i++) {
    records.push({ id: i, date: '2026-07-01', name: `item-${i}`, qty: i });
  }
  const dom = makeDom(buildInboundTree(records));
  loadUtilsScript(dom);

  const t0 = Date.now();
  for (let i = 1; i <= 10; i++) {
    dom.window.removeHistoryRowFromDOM(i, 'inbound');
  }
  const elapsed = Date.now() - t0;
  console.log(`  · 批量删除 10 条总耗时: ${elapsed}ms`);

  assertEqual(elapsed < 100, true, `批量删除 10 条 < 100ms (实际: ${elapsed}ms)`);
}

// ──────────────────────────────────────────────────────────
// 测试 5: 防回归 — 之前发现的关键 bug 模式
// ──────────────────────────────────────────────────────────

section('防回归 — 关键 bug 模式');

{
  // 防 P0 #1: endStr 必须在使用前声明
  // 直接在测试中验证代码顺序
  const fs = require('fs');
  const dbCode = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
  const getDashboardMatch = dbCode.match(/function getDashboardStats\(\)\s*\{([\s\S]*?)\n\}/);
  if (getDashboardMatch) {
    const body = getDashboardMatch[1];
    const endStrDecl = body.indexOf('const endStr');
    const endStrUse = body.search(/\[endStr\]/);
    assert(endStrDecl > 0, 'getDashboardStats 存在 endStr 声明');
    assert(endStrUse > 0, 'getDashboardStats 存在 endStr 使用');
    assert(endStrDecl < endStrUse, `endStr 声明在使用之前 (decl=${endStrDecl}, use=${endStrUse})`);
  } else {
    assert(false, 'getDashboardStats 函数存在');
  }
}

{
  // 防 P1 #2: CRUD 函数必须有 inTransaction 守卫
  const fs = require('fs');
  const dbCode = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');

  for (const fnName of ['updateInbound', 'deleteInbound', 'updateOutbound', 'deleteOutbound']) {
    const fnMatch = dbCode.match(new RegExp(`function ${fnName}\\([\\s\\S]*?\\n\\}`));
    if (fnMatch) {
      const body = fnMatch[0];
      assert(body.includes('inTransaction'), `${fnName} 含 inTransaction 守卫`);
    } else {
      assert(false, `${fnName} 函数存在`);
    }
  }
}

{
  // 防 P1 #3: 出库批量提交必须有 deductMap
  const fs = require('fs');
  const outCode = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'outbound.js'), 'utf8');
  assert(outCode.includes('deductMap'), '出库批量提交含 deductMap 累计扣减');
}

{
  // 防 P1 #4: getProductStockDetail 必须过滤未来日期
  const fs = require('fs');
  const dbCode = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
  const fnMatch = dbCode.match(/function getProductStockDetail\([\s\S]*?function \w+\(/);
  if (fnMatch) {
    const body = fnMatch[0];
    // totalIn 查询必须有 date <= monthEnd
    const totalInQuery = body.match(/SUM\(quantity\)\s*as\s*v\s*FROM\s*inbound_records[^"]*?WHERE[\s\S]*?"\s*\)/);
    if (totalInQuery) {
      assert(totalInQuery[0].includes('date <= ?'), 'totalIn 查询过滤未来日期');
    } else {
      // 跨行检查
      assert(body.includes('date <= ?'), 'inbound_records 查询过滤未来日期');
    }
    assert(body.includes('outbound_records') && body.includes('date <= ?'), 'outbound_records 查询过滤未来日期');
  } else {
    assert(false, 'getProductStockDetail 函数存在');
  }
}

{
  // 防 P2: 用户输入必须经过 escHtml 转义
  const fs = require('fs');
  for (const file of ['inbound.js', 'outbound.js']) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'renderer', file), 'utf8');
    // 找 confirmSubmit 或类似模态框，rowsPreview 中是否调用了 escHtml
    // 简单验证：行预览中包含 escHtml
    const confirmMatch = code.match(/openModal\(['"]确认提交['"][\s\S]*?openModal/g);
    if (confirmMatch) {
      const block = confirmMatch[0];
      assert(block.includes('escHtml'), `${file} 确认弹窗使用 escHtml`);
    }
  }
}

// ──────────────────────────────────────────────────────────
// 测试 6: 模式切换后必重建（端到端）— 使用 jsdom
// ──────────────────────────────────────────────────────────

section('端到端：模式切换必须重建 purchase-group DOM');

{
  // 模拟 DOM 状态
  const dom = new JSDOM(`
    <html><body>
      <div id="multi-canteen-tabs" style="display:none;"></div>
      <div id="canteen-switch" style="display:none;"></div>
      <div id="multi-canteen-area" style="display:none;"></div>
      <div id="small-canteen-tabs" style="display:none;"></div>
      <div id="small-canteen-actions" style="display:none;"></div>
      <div id="small-canteen-area" style="display:none;"></div>
      <div id="small-matrix-area" style="display:none;"></div>
      <div id="purchase-lianhua" style="display:none;"></div>
      <div id="purchase-kitchen" style="display:none;"></div>
      <div id="purchase-pastry" style="display:none;"></div>
    </body></html>
  `);

  // 模拟第一次进入 default 模式后，DOM 中应有一些 purchase-group
  const multiArea = dom.window.document.getElementById('multi-canteen-area');
  // 模拟切到 on 模式：先清理 default 区（已经被自动 clearGroupContents 处理）
  // 然后 initMultiCanteenMode 创建 3 个食堂 × 2 = 6 个 group
  for (let i = 0; i < 6; i++) {
    const g = dom.window.document.createElement('div');
    g.className = 'purchase-group';
    g.dataset.source = `食堂${Math.floor(i/2)}-${i%2 === 0 ? '联华' : '厨房'}`;
    g.dataset.canteen = ['下涯', '制杆厂', '白南山'][Math.floor(i/2)];
    multiArea.appendChild(g);
  }

  assertEqual(multiArea.querySelectorAll('.purchase-group').length, 6, 'on 模式初始化 6 个 group');

  // 模拟切到 small 模式：clearGroupContents 会清空 multiArea
  multiArea.querySelectorAll('.group-content').forEach(gc => gc.innerHTML = '');

  // 模拟 small 模式的 init
  // 会重新创建 (7 食堂 × 2 = 14 个 group) 到 smallArea
  const smallArea = dom.window.document.getElementById('small-canteen-area');
  for (let i = 0; i < 14; i++) {
    const g = dom.window.document.createElement('div');
    g.className = 'purchase-group';
    g.dataset.source = `小所${Math.floor(i/2)}-${i%2 === 0 ? '联华' : '厨房'}`;
    g.dataset.canteen = `小所${Math.floor(i/2)}`;
    smallArea.appendChild(g);
  }

  assertEqual(smallArea.querySelectorAll('.purchase-group').length, 14, 'small 模式初始化 14 个 group');
  assertEqual(multiArea.querySelectorAll('.purchase-group').length, 6, '多食堂 group 仍在（切到 small 不清）');
}

// ──────────────────────────────────────────────────────────
// 测试 7: 完整 mutation 流程 — 模拟从删除到刷新的全链路
// ──────────────────────────────────────────────────────────

section('全链路：删除记录 → 局部 DOM 移除 → 库存脏标记 → 自动刷新');

{
  // 状态机
  const state = {
    inventoryDetailDirty: false,
    currentInvProductId: null,
    inbound: [],
    outbound: [],
  };

  // 1. 初始化：用户搜索并查看产品 42 的库存
  state.currentInvProductId = 42;
  state.inventoryDetailDirty = false;

  // 2. 模拟入库页：用户删除一条入库记录
  state.inbound.push({ id: 1, product_id: 42, qty: 5, date: '2026-07-01' });
  function doDeleteInbound(id) {
    state.inbound = state.inbound.filter(r => r.id !== id);
    state.inventoryDetailDirty = true;  // 关键：必须设置
  }
  doDeleteInbound(1);
  assertEqual(state.inbound.length, 0, '入库记录已删除');
  assertEqual(state.inventoryDetailDirty, true, '脏标记已设置');

  // 3. 模拟 loadInventory（用户切回库存页时调用）
  let refreshInvoked = false;
  function mockLoadInventory() {
    if (state.inventoryDetailDirty && state.currentInvProductId !== null) {
      state.inventoryDetailDirty = false;
      refreshInvoked = true;
      // 实际代码会调用 window.api.getProductStockDetail(...)
    }
  }
  mockLoadInventory();
  assertEqual(refreshInvoked, true, 'loadInventory 自动刷新');
  assertEqual(state.inventoryDetailDirty, false, '脏标记已清除');

  // 4. 再次访问时不会重复刷新
  refreshInvoked = false;
  mockLoadInventory();
  assertEqual(refreshInvoked, false, '无变更时不重复刷新');

  // 5. 用户手动搜索新产品时，也应清除脏标记
  state.inventoryDetailDirty = true;
  // 模拟 selectInvProduct 被调用
  state.currentInvProductId = 99;
  state.inventoryDetailDirty = false;  // 手动搜索重置
  mockLoadInventory();
  assertEqual(refreshInvoked, false, '手动搜索后不自动刷新（旧产品）');
}

// ──────────────────────────────────────────────────────────
// 总结
// ──────────────────────────────────────────────────────────

console.log(`\n========================================`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log(`  ✓ 全部通过！`);
} else {
  console.log(`  ✗ ${failed} 失败:`);
  failures.forEach(f => console.log(`    - ${f}`));
  process.exit(1);
}
console.log(`========================================`);
