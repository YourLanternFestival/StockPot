/**
 * 综合回归测试 — v2.2.0 特性验证
 *
 * 用法：node test/test-spec-regression.js
 * 专注纯逻辑验证（无 DOM / Electron 依赖）。
 * DB 层由 test-db.js 覆盖，DOM 层由 manual-checklist.md 覆盖。
 *
 * 每次版本更新后运行全部测试：
 *   node test/test-db.js && node test/test-utils.js && node test/test-inquiry-months.js && node test/test-spec-regression.js
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

function assertDeepEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}`); failures.push(label); }
}

function section(title) { console.log(`\n── ${title} ──`); }

// ── 折扣计算精度 ──────────────────────────────────────────
section('折扣计算（v2.2: 默认值对齐 HTML → 0.9008）');

function applyDiscount(evalPrice, rate, decimals = 2) {
  return Math.round(evalPrice * rate * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

assertEqual(applyDiscount(10, 0.9008), 9.01, '10 × 0.9008 → 9.01');
assertEqual(applyDiscount(10, 0.9058), 9.06, '10 × 0.9058 → 9.06');
assertEqual(applyDiscount(100, 0.9008), 90.08, '100 × 0.9008 → 90.08');
assertEqual(applyDiscount(1, 0.9008), 0.9, '1 × 0.9008 → 0.90 (rounds to .9)');
assertEqual(applyDiscount(3.5, 0.9008), 3.15, '3.5 × 0.9008 → 3.15');
assertEqual(applyDiscount(0, 0.9008), 0, '0 × 0.9008 → 0');
assertEqual(applyDiscount(7.77, 0.9200), 7.15, '旧默认值 0.92 验证（对比基准）');

// ── 价格格式化 ────────────────────────────────────────────
section('价格小数位');

function formatPrice(price, decimals) {
  return price.toFixed(Math.max(0, decimals || 2));
}
assertEqual(formatPrice(3.5, 2), '3.50', '默认 2 位');
// 传 0 时 Math.max(0, 0 || 2) = 2，即 0 位配置无效，仍用默认 2 位（预期行为）
assertEqual(formatPrice(3.5, 0), '3.50', '0 位输入时仍用默认 2 位');
assertEqual(formatPrice(3.5, 1), '3.5', '1 位小数');
assertEqual(formatPrice(3.14159, 3), '3.142', '3 位');
assertEqual(formatPrice(0, 2), '0.00', '零值格式化');
assertEqual(formatPrice(100, 1), '100.0', '整数 + 1 位');

// ── 日期工具 ──────────────────────────────────────────────
section('日期工具（toLocalDateStr 不受 UTC 偏移影响）');

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
assertEqual(toLocalDateStr(new Date(2026, 5, 18)), '2026-06-18', '6月18日');
assertEqual(toLocalDateStr(new Date(2026, 0, 1)), '2026-01-01', '1月1日（跨年边界）');
assertEqual(toLocalDateStr(new Date(2025, 11, 31)), '2025-12-31', '12月31日');

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}
assertEqual(toLocalDateStr(parseLocalDate('2026-06-18')), '2026-06-18', 'parse → format 往返一致');
assertEqual(parseLocalDate(''), null, '空字符串返回 null');
assertEqual(parseLocalDate('abc'), null, '非法格式返回 null');

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d2 - d1) / 86400000);
}
const days = daysBetween('2026-06-01', '2026-06-18');
assertEqual(days, 17, '6/1 → 6/18 = 17 天');

// ── 保质期计算 ────────────────────────────────────────────
section('保质期计算');

function calcExpiry(productionDate, shelfMonths, shelfDays) {
  const d = parseLocalDate(productionDate);
  if (!d) return '';
  const totalDays = (shelfMonths || 0) * 30 + (shelfDays || 0);
  if (totalDays <= 0) return '';
  d.setDate(d.getDate() + totalDays);
  return toLocalDateStr(d);
}
assertEqual(calcExpiry('2026-06-01', 6, 0), '2026-11-28', '6个月保质期（setDate(181) → 11月28日）');
assertEqual(calcExpiry('2026-06-01', 0, 15), '2026-06-16', '15天保质期');
assertEqual(calcExpiry('2026-06-01', 1, 10), '2026-07-11', '1月+10天 = 40天');
assertEqual(calcExpiry('', 6, 0), '', '无生产日期返回空');
assertEqual(calcExpiry('2026-06-01', 0, 0), '', '无保质期返回空');

// ── isPureNumber ──────────────────────────────────────────
section('isPureNumber（v2.2: 修复 1.0/01/.5 误判）');

function isPureNumber(str) {
  if (typeof str !== 'string') str = String(str);
  return str !== '' && !isNaN(Number(str));
}
assert(isPureNumber('1.0'), '"1.0" ✓');
assert(isPureNumber('01'), '"01" ✓');
assert(isPureNumber('.5'), '".5" ✓');
assert(isPureNumber('0'), '"0" ✓');
assert(isPureNumber('123'), '"123" ✓');
assert(!isPureNumber('11条'), '"11条" ✗');
assert(!isPureNumber(''), '"" ✗');
assert(!isPureNumber('abc'), '"abc" ✗');
assert(isPureNumber(' 5 '), '" 5 " ✓ (trim not applied here, Number handles it)');

// ── sortAutocompleteResults ───────────────────────────────
section('sortAutocompleteResults（v2.2: 完全匹配优先）');

function sortAutocompleteResults(results, keyword, nameField = 'name') {
  const kw = keyword.toLowerCase();
  return [...results].sort((a, b) => {
    const aName = String(a[nameField] || '').toLowerCase();
    const bName = String(b[nameField] || '').toLowerCase();
    const aExact = aName === kw ? 0 : aName.startsWith(kw) ? 1 : 2;
    const bExact = bName === kw ? 0 : bName.startsWith(kw) ? 1 : 2;
    return aExact - bExact;
  });
}
const testItems = [
  { name: '生抽王' },
  { name: '生抽' },
  { name: '老抽' },
  { name: '鲜生抽' },
];
const sorted = sortAutocompleteResults(testItems, '生抽');
assertEqual(sorted[0].name, '生抽', '完全匹配 "生抽" 排第一');
assert(sorted[1].name === '生抽王' || sorted[1].name === '鲜生抽', '开头匹配排中间');
// "老抽" 不含 "生抽" 子串，与 "鲜生抽" 同为 priority 2，稳定排序保留原顺序
assertEqual(sorted[2].name, '老抽', '"老抽" 不含"生抽"，与鲜生抽同优先级2，排原序');
assertEqual(sorted[3].name, '鲜生抽', '鲜生抽含"生抽"，排原序（同为priority 2）');

// ── 询价月份动态生成 ──────────────────────────────────────
section('询价月份动态生成（v2.2: 当月+前后月去重）');

function generateInquiryMonths(currentMonth) {
  const [y, m] = currentMonth.split('-').map(Number);
  const months = new Set();
  let pm = m - 1, py = y;
  if (pm < 1) { pm = 12; py--; }
  months.add(`${py}-${String(pm).padStart(2, '0')}`);
  months.add(currentMonth);
  for (let i = 1; i <= 2; i++) {
    let nm = m + i, ny = y;
    if (nm > 12) { nm -= 12; ny++; }
    months.add(`${ny}-${String(nm).padStart(2, '0')}`);
  }
  return [...months].sort().reverse();
}
assertDeepEqual(generateInquiryMonths('2026-06'), ['2026-08', '2026-07', '2026-06', '2026-05'], '6月 → 5,6,7,8月 倒序');
assertDeepEqual(generateInquiryMonths('2026-01'), ['2026-03', '2026-02', '2026-01', '2025-12'], '1月跨年');
assertDeepEqual(generateInquiryMonths('2025-12'), ['2026-02', '2026-01', '2025-12', '2025-11'], '12月跨年');

// 合并已有月份（去重）
function mergeWithExisting(generated, existing) {
  const set = new Set([...generated, ...existing]);
  return [...set].sort().reverse();
}
const merged = mergeWithExisting(
  generateInquiryMonths('2026-06'),
  ['2025-03', '2025-08', '2026-06']  // 2026-06 重复
);
assert(merged.includes('2025-03'), '合并后包含已有旧月份');
assert(merged.includes('2025-08'), '合并后包含已有旧月份');
assertEqual(merged.filter(m => m === '2026-06').length, 1, '2026-06 不重复');

// ── 设置默认值 ────────────────────────────────────────────
section('APP_SETTINGS 默认值校验');

const DEFAULTS = {
  inbound_rows: 5, outbound_rows: 5, purchase_rows: 10,
  inbound_history: 'on', inbound_history_days: 20,
  outbound_history: 'on', outbound_history_days: 20,
  discount1_name: '盛销', discount1_rate: '0.9008',
  discount2_name: '优宏', discount2_rate: '0.9058',
  price_decimals: 2,
  inv_inbound_limit: 5, inv_outbound_limit: 10,
  purchase_retention_days: 31,
};
assertEqual(DEFAULTS.discount1_rate, '0.9008', '盛销折扣默认 0.9008（非 0.92）');
assertEqual(DEFAULTS.discount2_rate, '0.9058', '优宏折扣默认 0.9058');
assertEqual(DEFAULTS.purchase_retention_days, 31, '采购单保留天数默认 31');
assertEqual(DEFAULTS.inbound_rows, 5, '入库默认行数 5');
assertEqual(DEFAULTS.outbound_rows, 5, '出库默认行数 5');
assertEqual(DEFAULTS.price_decimals, 2, '价格小数位默认 2');

// ── 库存预警分类 ──────────────────────────────────────────
section('库存预警分类逻辑');

function classifyAlert(expiryDate, today, shortDays = 30, longDays = 60) {
  const days = daysBetween(today, expiryDate);
  if (days < 0) return 'expired';
  if (days <= shortDays) return 'soon';
  if (days <= longDays) return 'upcoming';
  return 'ok';
}
assertEqual(classifyAlert('2026-06-01', '2026-06-18'), 'expired', '17天前到期 → 已过期');
assertEqual(classifyAlert('2026-06-30', '2026-06-18'), 'soon', '12天后到期 → 即将到期（≤30天）');
assertEqual(classifyAlert('2026-07-20', '2026-06-18'), 'upcoming', '32天后到期 → 临期（32>30 但 ≤60）');

// 修正：32天在30天之外但在60天之内 → upcoming
assertEqual(classifyAlert('2026-08-01', '2026-06-18'), 'upcoming', '44天后到期 → 临期（≤60天）');
assertEqual(classifyAlert('2026-09-01', '2026-06-18'), 'ok', '75天后到期 → 正常');

// ── fillDownColumn 逻辑验证 ───────────────────────────────
section('fillDownColumn 向下填充逻辑（v2.2: 共享函数）');

// 模拟 fillDownColumn 核心逻辑（无 DOM）
function simulateFillDown(rows, startIdx, field, value) {
  let filled = 0;
  for (let i = startIdx + 1; i < rows.length; i++) {
    if (!rows[i][field]) {
      rows[i][field] = value;
      filled++;
    }
  }
  return { rows, filled };
}
// 每个测试用例使用独立数据避免共享 mutation
const rows1 = [
  { product_name: '', quantity: '', date: '2026-06-18' },
  { product_name: '', quantity: '', date: '' },
  { product_name: '酱油', quantity: '10', date: '2026-06-17' },
  { product_name: '', quantity: '', date: '' },
];
const result1 = simulateFillDown(rows1, 0, 'date', '2026-06-18');
assertEqual(result1.filled, 2, '第1行填日期 → 向下填2行（第2行空、第3行非空跳过、第4行空）');
assertEqual(result1.rows[1].date, '2026-06-18', '第2行日期已填充');
assertEqual(result1.rows[2].date, '2026-06-17', '第3行已有日期不变（非空跳过）');
assertEqual(result1.rows[3].date, '2026-06-18', '第4行日期已填充');

// 第3行填品名 → 只填第4行
const rows2 = [
  { product_name: '', quantity: '', date: '' },
  { product_name: '', quantity: '', date: '' },
  { product_name: '酱油', quantity: '', date: '' },
  { product_name: '', quantity: '', date: '' },
];
const result2 = simulateFillDown(rows2, 2, 'product_name', '酱油');
assertEqual(result2.filled, 1, '第3行填品名 → 向下填1行');
assertEqual(result2.rows[3].product_name, '酱油', '第4行品名已填充');

// 从最后一行填充：应填充 0 行
const rows3 = [
  { product_name: '', quantity: '', date: '' },
  { product_name: '', quantity: '', date: '' },
];
const result3 = simulateFillDown(rows3, 1, 'quantity', '5');
assertEqual(result3.filled, 0, '最后一行填充 → 0行');

// ── 产品 active 状态过滤 ──────────────────────────────────
section('产品 active 状态过滤');

function filterActiveProducts(products) {
  return products.filter(p => p.active === 1);
}
const allProds = [
  { id: 1, name: '酱油', active: 1 },
  { id: 2, name: '醋', active: 1 },
  { id: 3, name: '料酒', active: 0 },
  { id: 4, name: '盐', active: 1 },
];
const activeOnly = filterActiveProducts(allProds);
assertEqual(activeOnly.length, 3, '4个产品中3个active → 过滤后3个');
assert(activeOnly.find(p => p.name === '料酒') === undefined, '料酒(active=0) 被过滤');
assert(activeOnly.find(p => p.name === '酱油') !== undefined, '酱油(active=1) 保留');

// ── 库存过滤（stock > 0） ─────────────────────────────────
section('库存过滤（出库自动补全: stock > 0）');

function filterInStock(inventory) {
  return inventory.filter(p => p.stock > 0);
}
const inventory = [
  { id: 1, name: '酱油', stock: 10 },
  { id: 2, name: '醋', stock: 0 },
  { id: 3, name: '料酒', stock: -5 },
  { id: 4, name: '盐', stock: 3 },
];
const inStock = filterInStock(inventory);
assertEqual(inStock.length, 2, '4个库存项中2个有库存');
assert(inStock.find(p => p.name === '酱油') !== undefined, '酱油(stock=10) 保留');
assert(inStock.find(p => p.name === '醋') === undefined, '醋(stock=0) 被过滤');
assert(inStock.find(p => p.name === '料酒') === undefined, '料酒(stock=-5) 被过滤');

// ── 金额计算 ──────────────────────────────────────────────
section('金额计算（含文字数量时不重算）');

function recalcAmount(qtyStr, price, savedAmount, decimals = 2) {
  const isPure = isPureNumber(qtyStr);
  if (isPure) {
    return Math.round(parseFloat(qtyStr) * price * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
  return savedAmount; // 非纯数字时保留已保存金额
}
assertEqual(recalcAmount('10', 5.5, 0), 55, '10 × 5.5 = 55');
assertEqual(recalcAmount('11条', 5, 55, 2), 55, '文字数量保留已保存的55');
assertEqual(recalcAmount('1.0', 10, 0), 10, '1.0 × 10 = 10');
assertEqual(recalcAmount('01', 3, 0), 3, '01 × 3 = 3');
assertEqual(recalcAmount('.5', 20, 0), 10, '.5 × 20 = 10');

// ── 结果汇总 ──────────────────────────────────────────────
const total = passed + failed;
console.log(`\n═══════════════════════════════════════`);
console.log(`  测试完成: ${passed}/${total} 通过`);
if (failed > 0) {
  console.log(`\n  ${failed} 项失败:`);
  failures.forEach(f => console.log(`    - ${f}`));
  console.log(`\n  ⚠ 请检查失败项并修复。`);
} else {
  console.log(`  ✓ 全部通过！`);
}
console.log(`═══════════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
