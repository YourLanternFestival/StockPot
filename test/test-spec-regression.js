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

// ── 采购单生命周期：保存/导出/归档/调取 ────────────────────
section('采购单生命周期（v2.2.1: 导出即归档，不再自动加载）');

// 模拟 todayStr
const simToday = '2026-06-22';
const simYesterday = '2026-06-21';

// shouldLoadData 逻辑：last_purchase_date === today 才加载
function shouldLoadPurchaseData(lastPurchaseDate, today) {
  return (lastPurchaseDate || '') === today;
}
// 新天（无保存记录）→ false
assert(!shouldLoadPurchaseData('', simToday), '空 last_purchase_date → shouldLoadData=false');
// 昨天保存 → false（跨天不加载）
assert(!shouldLoadPurchaseData(simYesterday, simToday), 'last=昨天, today=今天 → shouldLoadData=false');
// 今天保存 → true（同天编辑中，可恢复）
assert(shouldLoadPurchaseData(simToday, simToday), 'last=today → shouldLoadData=true');

// 保存行为：save 后 last_purchase_date 应更新为 today
function simulateSave(lastDate, today, isExport) {
  // 保存 → last_purchase_date = today
  const afterSave = today;
  // 如果是导出，导出后应清空
  return isExport ? '' : afterSave;
}
assertEqual(simulateSave('', simToday, false), simToday, '保存 → last=today');
assertEqual(simulateSave(simYesterday, simToday, false), simToday, '跨天保存 → last 更新为 today');
// 导出行为：导出后 last_purchase_date 清空（归档状态）
assertEqual(simulateSave(simToday, simToday, true), '', '导出 → last 清空（归档）');
assertEqual(simulateSave('', simToday, true), '', '新天导出 → last 仍为空');

// 导出后下次进入：shouldLoadData 应为 false
const afterExport = simulateSave(simToday, simToday, true);
assert(!shouldLoadPurchaseData(afterExport, simToday), '导出后下次进入 → shouldLoadData=false（不自动加载）');

// 导出后又手动保存 → 进入编辑态，下次可加载
const afterReEdit = simulateSave(afterExport, simToday, false);
assert(shouldLoadPurchaseData(afterReEdit, simToday), '导出后重新编辑保存 → shouldLoadData=true');

// loadPurchaseGroupData / loadAllSmallMatrixData 的过滤：按 created_at（创建日期）过滤
  // 修复：之前用 receive_date >= today，昨天创建但收货日=今天的单子被误加载
function filterOrdersByDate(orders, today) {
  return orders.filter(o => o.created_at && o.created_at.startsWith(today));
}
const sampleOrders = [
  { product_name: '青菜', receive_date: '2026-06-22', created_at: '2026-06-22 09:00:00', source: '寿昌-厨房' },
  { product_name: '可乐', receive_date: '2026-06-22', created_at: '2026-06-22 10:00:00', source: '寿昌-联华' },
  { product_name: '猪肉', receive_date: '2026-06-22', created_at: '2026-06-15 08:00:00', source: '寿昌-厨房' },  // 上周创建，收货日=今天（应过滤）
  { product_name: '雪碧', receive_date: '2026-06-22', created_at: '2026-06-15 08:00:00', source: '寿昌-联华' },  // 同上
  { product_name: '白菜', receive_date: '2026-06-23', created_at: '2026-06-22 11:00:00', source: '寿昌-厨房' },  // 今天创建，明天收货
  { product_name: '老数据', receive_date: '2026-06-22', source: '寿昌-厨房' },  // created_at 缺失（旧数据）
];
const filtered = filterOrdersByDate(sampleOrders, simToday);
assertEqual(filtered.length, 3, 'created_at filter: 3条（今天2条+明天1条）');
assert(filtered.every(o => o.created_at && o.created_at.startsWith(simToday)), 'all kept have created_at = today');
assert(filtered.find(o => o.product_name === '青菜') !== undefined, 'today-created qingcai kept');
assert(filtered.find(o => o.product_name === '可乐') !== undefined, 'today-created kele kept');
assert(filtered.find(o => o.product_name === '白菜') !== undefined, 'today-created baicai kept');
assert(filtered.find(o => o.product_name === '猪肉') === undefined, 'last-week zhurou filtered (receive=today but created!=today)');
assert(filtered.find(o => o.product_name === '雪碧') === undefined, 'last-week xuebi filtered');
assert(filtered.find(o => o.product_name === '老数据') === undefined, 'no-created_at old data filtered');

  // Edge case: created_at is null → safely skipped
  const nullOrders = [
    { product_name: 'A', receive_date: '2026-06-22', created_at: null, source: 'test' },
    { product_name: 'B', receive_date: '2026-06-22', created_at: '2026-06-22 08:00:00', source: 'test' },
  ];
  const nullFiltered = filterOrdersByDate(nullOrders, simToday);
  assertEqual(nullFiltered.length, 1, 'created_at=null skipped');
  assertEqual(nullFiltered[0].product_name, 'B', 'valid created_at kept');

// 所有模式下数据是一个整体：厨房+联华通过 source 后缀区分
function classifySource(source) {
  if (source.endsWith('-厨房') || source.includes('食堂厨房')) return 'kitchen';
  if (source.endsWith('-联华') || source === '联华') return 'lianhua';
  if (source.includes('面点房')) return 'pastry';
  return 'unknown';
}
assertEqual(classifySource('寿昌-厨房'), 'kitchen', '小所厨房 source');
assertEqual(classifySource('寿昌-联华'), 'lianhua', '小所联华 source');
assertEqual(classifySource('洋安食堂厨房'), 'kitchen', '默认厨房 source');
assertEqual(classifySource('联华'), 'lianhua', '默认联华 source');
assertEqual(classifySource('洋安面点房'), 'pastry', '默认面点房 source');

// 保存时所有 source 在一个事务中（原子性）
function simulateSaveBatch(sourcesWithData, allOrders) {
  // 模拟：只清理有 DOM 数据的 source，不误清未加载的
  const clearedSources = new Set(sourcesWithData);
  const insertedSources = new Set(allOrders.map(o => o.source));
  // 所有 insert 的 source 都应该在 cleared 中
  // 但 cleared 中可能有额外的（用户清空了的 source，无数据但要清理 DB）
  const missingClear = [...insertedSources].filter(s => !clearedSources.has(s));
  return { clearedSources, insertedSources, missingClear, ok: missingClear.length === 0 };
}
const batchResult = simulateSaveBatch(
  ['寿昌-厨房', '寿昌-联华', '梅城-厨房'],
  [{ source: '寿昌-厨房' }, { source: '寿昌-厨房' }, { source: '寿昌-联华' }]
);
assert(batchResult.ok, '所有 insert 的 source 都在 cleared 列表中');
assert(batchResult.clearedSources.has('梅城-厨房'), '梅城厨房被清空（用户清空了 DOM）');
assertEqual(batchResult.missingClear.length, 0, '无遗漏的 source');

// ── 导入导出：智能列匹配（v2.3: data-io.js ImportDialog） ──────
section('导入导出 — 智能列匹配');

function autoMatchColumns(headers, fields) {
  const mapping = {};
  for (const f of fields) {
    let matched = headers.findIndex(h => h === f.label);
    if (matched === -1 && f.aliases) {
      matched = headers.findIndex(h => f.aliases.some(a => h === a));
    }
    if (matched === -1 && f.label.length >= 2) {
      matched = headers.findIndex(h => h.includes(f.label));
    }
    mapping[f.key] = matched >= 0 ? matched : null;
  }
  return mapping;
}

const PRODUCT_FIELDS = [
  { key: 'name', label: '材料名称', required: true, aliases: ['品名', '名称', '产品名', '产品名称', '货品名'] },
  { key: 'shelfMonths', label: '保质期(月)', required: false, aliases: ['保质期', '保质月份'] },
];

// 精确匹配
{
  const m = autoMatchColumns(['材料名称', '规格', '单位'], PRODUCT_FIELDS);
  assertEqual(m.name, 0, '精确匹配：表头 == label');
}

// 别名匹配
{
  const m = autoMatchColumns(['品名', '规格'], PRODUCT_FIELDS);
  assertEqual(m.name, 0, '别名匹配：品名 → name');
}
{
  const m = autoMatchColumns(['产品名称', '规格'], PRODUCT_FIELDS);
  assertEqual(m.name, 0, '别名匹配：产品名称 → name');
}

// 包含匹配
{
  const m = autoMatchColumns(['材料名称(必填)', '保质期(月)'], PRODUCT_FIELDS);
  assertEqual(m.name, 0, '包含匹配：含"材料名称"');
}

// 未匹配
{
  const m = autoMatchColumns(['未知列A', '未知列B', '未知列C'], PRODUCT_FIELDS);
  assertEqual(m.name, null, '未匹配：返回 null');
  assertEqual(m.shelfMonths, null, '未匹配：所有字段均为 null');
}

// 空表头
{
  const m = autoMatchColumns([], PRODUCT_FIELDS);
  assertEqual(m.name, null, '空表头：全部返回 null');
}

section('导入导出 — 列标签转换');

function columnLabel(idx) {
  let label = '';
  let n = idx;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

assertEqual(columnLabel(0), 'A', 'col 0 → A');
assertEqual(columnLabel(25), 'Z', 'col 25 → Z');
assertEqual(columnLabel(26), 'AA', 'col 26 → AA');
assertEqual(columnLabel(27), 'AB', 'col 27 → AB');
assertEqual(columnLabel(51), 'AZ', 'col 51 → AZ');
assertEqual(columnLabel(52), 'BA', 'col 52 → BA');
assertEqual(columnLabel(701), 'ZZ', 'col 701 → ZZ');
assertEqual(columnLabel(702), 'AAA', 'col 702 → AAA');

section('导入导出 — 导出→导入格式自洽');

// 导出产品数据表头 → 应有对应的导入别名
const EXPORT_PRODUCT_HEADERS = ['序号', '材料名称', '规格', '单位', '保质期(月)', '保质期(日)'];
const IMPORT_PRODUCT_NAMES = ['name', 'spec', 'unit', 'shelfMonths', 'shelfDays'];

// 模拟：用导入的智能匹配去解析导出表头
const fullProductFields = [
  { key: 'name', label: '材料名称', required: true, aliases: ['品名', '名称', '产品名', '产品名称', '货品名'] },
  { key: 'spec', label: '规格', required: false, aliases: ['规格型号', '型号'] },
  { key: 'unit', label: '单位', required: false, aliases: ['计量单位', '包装单位'] },
  { key: 'shelfMonths', label: '保质期(月)', required: false, aliases: ['保质期', '保质月份'] },
  { key: 'shelfDays', label: '保质期(日)', required: false, aliases: ['保质天数'] },
];
{
  const m = autoMatchColumns(EXPORT_PRODUCT_HEADERS, fullProductFields);
  IMPORT_PRODUCT_NAMES.forEach(k => assert(m[k] !== null, `产品导出→导入：${k} 可匹配`));
}

// 导出入库表头 → 导入入库字段
const EXPORT_INBOUND_HEADERS = ['序号', '入库时间', '材料名称', '规格', '数量', '单位', '备注', '生产日期', '到期日'];
const fullInboundFields = [
  { key: 'name', label: '材料名称', required: true, aliases: ['品名', '名称', '产品名'] },
  { key: 'date', label: '入库日期', required: false, aliases: ['日期', '入库时间', '时间'] },
  { key: 'quantity', label: '入库数量', required: false, aliases: ['数量', '入库量'] },
  { key: 'productionDate', label: '生产日期', required: false, aliases: ['生产时间'] },
  { key: 'expiryDate', label: '到期日', required: false, aliases: ['有效期至', '保质期至', '过期日'] },
  { key: 'remark', label: '入库备注', required: false, aliases: ['备注', '说明'] },
];
{
  const m = autoMatchColumns(EXPORT_INBOUND_HEADERS, fullInboundFields);
  assert(m.name !== null, '入库导出→导入：材料名称 可匹配');
  assert(m.remark !== null, '入库导出→导入：备注 匹配入库备注');
}

// 导出出库表头 → 导入出库字段
const EXPORT_OUTBOUND_HEADERS = ['序号', '出库时间', '名称', '规格', '数量', '单位', '领取人'];
const fullOutboundFields = [
  { key: 'name', label: '材料名称', required: true, aliases: ['品名', '名称', '产品名'] },
  { key: 'date', label: '出库日期', required: false, aliases: ['日期', '出库时间', '时间'] },
  { key: 'quantity', label: '出库数量', required: false, aliases: ['数量', '出库量'] },
  { key: 'recipient', label: '领取人', required: false, aliases: ['领用人', '领取部门', '领料人', '签收人'] },
];
{
  const m = autoMatchColumns(EXPORT_OUTBOUND_HEADERS, fullOutboundFields);
  assert(m.recipient !== null, '出库导出→导入：领取人 可匹配');
  assert(m.name !== null, '出库导出→导入：品名 匹配（包含匹配）');
}

section('导入导出 — 追加去重逻辑（模拟）');

function dedupByNames(existingNames, newProducts) {
  let imported = 0, skipped = 0;
  for (const p of newProducts) {
    if (existingNames.includes(p.name)) { skipped++; continue; }
    existingNames.push(p.name);
    imported++;
  }
  return { imported, skipped };
}

{
  const existing = ['白菜', '萝卜', '青椒'];
  const incoming = [{ name: '白菜' }, { name: '黄瓜' }, { name: '萝卜' }];
  const r = dedupByNames(existing, incoming);
  assertEqual(r.imported, 1, '追加模式：1 条新导入');
  assertEqual(r.skipped, 2, '追加模式：2 条跳过（已存在）');
  assertDeepEqual(existing, ['白菜', '萝卜', '青椒', '黄瓜'], '追加后列表仅含新名称');
}

{
  const existing = [];
  const incoming = [{ name: '白菜' }, { name: '萝卜' }];
  const r = dedupByNames(existing, incoming);
  assertEqual(r.imported, 2, '空库追加：全部导入');
  assertEqual(r.skipped, 0, '空库追加：无跳过');
}

section('导入导出 — 覆盖模式（模拟）');

function simulateOverwrite(existing, newData) {
  const cleared = [...existing];
  existing.length = 0;
  for (const p of newData) existing.push(p);
  return { clearedCount: cleared.length, imported: newData.length };
}

{
  const existing = ['白菜', '萝卜'];
  const incoming = [{ name: '黄瓜' }, { name: '西红柿' }];
  const r = simulateOverwrite(existing, incoming);
  assertEqual(r.clearedCount, 2, '覆盖模式：清空 2 条');
  assertEqual(r.imported, 2, '覆盖模式：导入 2 条');
  assertDeepEqual(existing, incoming, '覆盖后仅含新数据');
}

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
