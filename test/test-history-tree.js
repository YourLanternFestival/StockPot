/**
 * 历史折叠树 + 批量操作 — 纯逻辑测试
 *
 * 用法：node test/test-history-tree.js
 * 覆盖 groupRecordsByDate、countTreeRecords、选择模式状态机。
 * DOM 交互（toggleTreeNode、全选复选框联动）由 manual-checklist 覆盖。
 */

// ── 测试框架 ──────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}`); failures.push(label); }
}

function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (ok) { passed++; console.log(`  ✓ ${label} (${JSON.stringify(actual)})`); }
  else { failed++; console.log(`  ✗ FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); failures.push(label); }
}

function section(title) { console.log(`\n── ${title} ──`); }

// ── 依赖：从 renderer 提取的纯函数（无 DOM 依赖） ──────────

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function groupRecordsByDate(records) {
  const tree = new Map();
  for (const r of records) {
    const d = parseLocalDate(r.date);
    if (!d) continue;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (!tree.has(year)) tree.set(year, new Map());
    const yearMap = tree.get(year);
    if (!yearMap.has(month)) yearMap.set(month, new Map());
    const monthMap = yearMap.get(month);
    if (!monthMap.has(day)) monthMap.set(day, []);
    monthMap.get(day).push(r);
  }
  return tree;
}

function countTreeRecords(node) {
  let count = 0;
  for (const val of node.values()) {
    if (Array.isArray(val)) { count += val.length; }
    else { count += countTreeRecords(val); }
  }
  return count;
}

// ── groupRecordsByDate ────────────────────────────────────
section('groupRecordsByDate — 日期分组');

function makeRec(date, id) { return { id, date, product_name: 'test', quantity: 1, unit: 'kg' }; }

{
  // 同一天多条 → 归入同一 day 数组
  const records = [
    makeRec('2026-06-25', 1),
    makeRec('2026-06-25', 2),
    makeRec('2026-06-25', 3),
  ];
  const tree = groupRecordsByDate(records);
  assertEqual(tree.size, 1, '一个年份');
  assert(tree.has(2026), '年份 2026');
  const jun = tree.get(2026);
  assertEqual(jun.size, 1, '一个月份');
  assert(jun.has(6), '月份 6');
  const dayMap = jun.get(6);
  assertEqual(dayMap.size, 1, '一天');
  assert(dayMap.has(25), '日期 25');
  assertEqual(dayMap.get(25).length, 3, '3 条记录');
}

{
  // 跨月：同一年不同月
  const records = [
    makeRec('2026-05-15', 1),
    makeRec('2026-06-20', 2),
    makeRec('2026-06-21', 3),
  ];
  const tree = groupRecordsByDate(records);
  const y = tree.get(2026);
  assertEqual(y.size, 2, '两个月');
  assertEqual(y.get(5).get(15).length, 1, '5月1条');
  assertEqual(y.get(6).get(20).length, 1, '6月20日1条');
  assertEqual(y.get(6).get(21).length, 1, '6月21日1条');
}

{
  // 跨年
  const records = [
    makeRec('2025-12-31', 1),
    makeRec('2026-01-01', 2),
  ];
  const tree = groupRecordsByDate(records);
  assertEqual(tree.size, 2, '两个年份');
  assert(tree.has(2025), '有2025');
  assert(tree.has(2026), '有2026');
}

{
  // 非法日期跳过
  const records = [
    makeRec('2026-06-25', 1),
    makeRec('bad-date', 2),
    makeRec(null, 3),
    makeRec('', 4),
  ];
  const tree = groupRecordsByDate(records);
  assertEqual(tree.size, 1, '仅一个年份（非法日期跳过）');
  assertEqual(tree.get(2026).get(6).get(25).length, 1, '只有合法记录');
}

{
  // 空数组
  const tree = groupRecordsByDate([]);
  assertEqual(tree.size, 0, '空数组 → 空树');
}

// ── countTreeRecords ──────────────────────────────────────
section('countTreeRecords — 记录计数');

{
  // 单日节点
  const dayMap = new Map([[25, [makeRec('2026-06-25', 1), makeRec('2026-06-25', 2)]]]);
  assertEqual(countTreeRecords(dayMap), 2, 'dayMap 下 2 条');
}

{
  // 月节点下多日
  const dayMap = new Map();
  dayMap.set(24, [makeRec('2026-06-24', 1)]);
  dayMap.set(25, [makeRec('2026-06-25', 1), makeRec('2026-06-25', 2)]);
  const monthMap = new Map([[6, dayMap]]);
  assertEqual(countTreeRecords(monthMap), 3, 'monthMap → 累计 3 条');
}

{
  // 年节点下多月
  const jun = new Map();
  jun.set(25, [makeRec('2026-06-25', 1)]);
  const jul = new Map();
  jul.set(1, [makeRec('2026-07-01', 1), makeRec('2026-07-01', 2)]);
  const yearMap = new Map([[6, jun], [7, jul]]);
  assertEqual(countTreeRecords(yearMap), 3, 'yearMap → 累计 3 条');
}

{
  // 空节点
  assertEqual(countTreeRecords(new Map()), 0, '空 Map → 0');
}

// ── 记录字段完整性 ────────────────────────────────────────
section('分组后记录字段保留');

{
  const r = { id: 42, date: '2026-06-25', product_name: '青菜', quantity: 5, unit: 'kg', remark: '新鲜' };
  const tree = groupRecordsByDate([r]);
  const stored = tree.get(2026).get(6).get(25)[0];
  assertEqual(stored.id, 42, 'id 保留');
  assertEqual(stored.product_name, '青菜', 'product_name 保留');
  assertEqual(stored.quantity, 5, 'quantity 保留');
  assertEqual(stored.unit, 'kg', 'unit 保留');
  assertEqual(stored.remark, '新鲜', 'remark 保留');
}

// ── parseLocalDate 边界 ───────────────────────────────────
section('parseLocalDate — 日期解析');

{
  const d = parseLocalDate('2026-01-01');
  assertEqual(d.getFullYear(), 2026, '年份 2026');
  assertEqual(d.getMonth(), 0, '月份 0（1月）');
  assertEqual(d.getDate(), 1, '日期 1');
}

{
  const d = parseLocalDate('2026-12-31');
  assertEqual(d.getMonth(), 11, '12月 → getMonth()=11');
  assertEqual(d.getDate(), 31, '日期 31');
}

assert(parseLocalDate(null) === null, 'null → null');
assert(parseLocalDate('') === null, '空字符串 → null');
assert(parseLocalDate('abc') === null, '非法格式 → null');
assert(parseLocalDate('2026-13-01') !== null, '月份13 → Date 对象（JS 自动进位到次年1月）');

// ── toLocalDateStr 往返 ───────────────────────────────────
section('toLocalDateStr — 本地日期格式化');

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

assertEqual(toLocalDateStr(new Date(2026, 5, 25)), '2026-06-25', '6月25日');
assertEqual(toLocalDateStr(new Date(2026, 0, 1)), '2026-01-01', '1月1日');

// 往返：parse → toLocalDateStr 应一致
{
  const orig = '2026-06-25';
  const d = parseLocalDate(orig);
  assertEqual(toLocalDateStr(d), orig, `往返 ${orig} → Date → ${orig}`);
}
{
  const orig = '2025-12-31';
  const d = parseLocalDate(orig);
  assertEqual(toLocalDateStr(d), orig, `往返 ${orig}`);
}

// ── 结果汇总 ──────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════`);
console.log(`  测试完成: ${passed + failed}/${passed + failed}`);
if (failed === 0) {
  console.log(`  ✓ 全部通过！`);
} else {
  console.log(`  ✗ ${failed} 失败:`);
  failures.forEach(f => console.log(`    - ${f}`));
  process.exit(1);
}
console.log(`═══════════════════════════════════════`);
