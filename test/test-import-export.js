/**
 * 导入导出集成测试 — 测试真实 db.js 函数
 *
 * 通过 mock electron 依赖，直接 require('../db.js')，
 * 走真实的 importProducts / importInbound / importOutbound /
 * clearProducts / clearInbound / clearOutbound 代码路径。
 *
 * 用法：node test/test-import-export.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  else { failed++; console.log(`  \x1b[31m✗ FAIL:\x1b[0m ${label}`); failures.push(label); }
}

function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (ok) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${label} (${JSON.stringify(actual)})`); }
  else { failed++; console.log(`  \x1b[31m✗ FAIL:\x1b[0m ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); failures.push(label); }
}

function assertDeepEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  else { failed++; console.log(`  \x1b[31m✗ FAIL:\x1b[0m ${label}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}`); failures.push(label); }
}

function section(title) { console.log(`\n\x1b[36m── ${title} ──\x1b[0m`); }

// ── Mock electron 然后 require 真实 db.js ──────────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inout-test-'));
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return { app: { getPath: () => tmpDir } };
  }
  return originalLoad.apply(this, arguments);
};

const db = require('../db');

async function main() {
  console.log('Import/Export Integration Tests\n');

  await db.init();

  // ── 1. 清空环境 ─────────────────────────────────────────────
  section('环境初始化');
  db.clearAllData();
  assertEqual(db.getProducts().length, 0, '初始：0 个产品');
  assertEqual(db.getInboundRecords({}).length, 0, '初始：0 条入库');
  assertEqual(db.getOutboundRecords({}).length, 0, '初始：0 条出库');

  // ── 2. 导入产品 ─────────────────────────────────────────────
  section('导入产品（真实 db.importProducts）');
  const products = [
    { name: '白菜', spec: '散装', unit: '斤', shelfMonths: 12, shelfDays: 0, openingStock: 10 },
    { name: '萝卜', spec: '散装', unit: '斤', shelfMonths: 6, shelfDays: 0, openingStock: 5 },
    { name: '黄瓜', spec: '', unit: '斤', shelfMonths: 3, shelfDays: 0, openingStock: 0 },
  ];
  const pResult = db.importProducts(products);
  assertEqual(pResult.imported, 3, '导入 3 个产品');
  assertEqual(pResult.skipped, 0, '跳过 0 个');

  const allProducts = db.getProducts();
  assertEqual(allProducts.length, 3, 'DB 中有 3 个产品');
  assertEqual(allProducts[0].name, '白菜', '第1个产品：白菜');
  assertEqual(allProducts[0].opening_stock, 10, '白菜期初库存 = 10');
  assertEqual(allProducts[1].name, '萝卜', '第2个产品：萝卜');

  // ── 3. 追加导入产品（去重） ──────────────────────────────────
  section('追加导入产品 — 去重');
  const moreProducts = [
    { name: '白菜', spec: '新规格', unit: '斤', shelfMonths: 6, shelfDays: 0, openingStock: 0 },
    { name: '西红柿', spec: '', unit: '个', shelfMonths: 7, shelfDays: 0, openingStock: 0 },
    { name: '萝卜', spec: '新', unit: '斤', shelfMonths: 0, shelfDays: 0, openingStock: 0 },
  ];
  const pResult2 = db.importProducts(moreProducts);
  assertEqual(pResult2.imported, 1, '追加导入：1 条新（西红柿）');
  assertEqual(pResult2.skipped, 2, '追加导入：2 条跳过（白菜+萝卜已存在）');
  assertEqual(db.getProducts().length, 4, '追加后：共 4 个产品');
  // 白菜规格应保持原样（去重时不更新）
  const baicai = db.getProducts().find(p => p.name === '白菜');
  assertEqual(baicai.spec, '散装', '白菜规格保持原样（未覆盖）');

  // ── 4. 导入入库记录 ─────────────────────────────────────────
  section('导入入库记录（真实 db.importInbound）');
  const inbound = [
    { name: '白菜', date: '2026-07-01', quantity: 20, remark: '第一批', productionDate: '2026-06-28', expiryDate: '2027-06-28' },
    { name: '萝卜', date: '2026-07-01', quantity: 15, remark: '', productionDate: null, expiryDate: null },
    { name: '不存在产品', date: '2026-07-01', quantity: 5, remark: '', productionDate: null, expiryDate: null },
  ];
  const iResult = db.importInbound(inbound);
  assertEqual(iResult.imported, 2, '入库导入 2 条（跳过不存在产品）');
  assertEqual(iResult.skipped, 1, '入库跳过 1 条');
  const allInbound = db.getInboundRecords({});
  assertEqual(allInbound.length, 2, 'DB 中有 2 条入库');

  // ── 5. 导入出库记录 ─────────────────────────────────────────
  section('导入出库记录（真实 db.importOutbound）');
  const outbound = [
    { name: '白菜', date: '2026-07-02', quantity: 5, recipient: '厨房' },
    { name: '黄瓜', date: '2026-07-02', quantity: 3, recipient: '面点房' },
  ];
  const oResult = db.importOutbound(outbound);
  assertEqual(oResult.imported, 2, '出库导入 2 条');
  assertEqual(oResult.skipped, 0, '出库跳过 0 条');
  assertEqual(db.getOutboundRecords({}).length, 2, 'DB 中有 2 条出库');

  // ── 6. clearInbound — 仅清空入库，不动产品/出库 ─────────────
  section('clearInbound 独立清空');
  db.clearInbound();
  assertEqual(db.getInboundRecords({}).length, 0, 'clearInbound: 入库清空');
  assertEqual(db.getProducts().length, 4, 'clearInbound: 产品未受影响');
  assertEqual(db.getOutboundRecords({}).length, 2, 'clearInbound: 出库未受影响');

  // ── 7. clearOutbound — 仅清空出库 ────────────────────────────
  section('clearOutbound 独立清空');
  db.clearOutbound();
  assertEqual(db.getOutboundRecords({}).length, 0, 'clearOutbound: 出库清空');
  assertEqual(db.getProducts().length, 4, 'clearOutbound: 产品未受影响');

  // ── 8. clearProducts — 仅清空产品 ────────────────────────────
  section('clearProducts 独立清空');
  db.clearProducts();
  assertEqual(db.getProducts().length, 0, 'clearProducts: 产品清空');

  // ── 9. 覆盖模式全流程：导入 → 清空 → 再导入 ──────────────────
  section('覆盖模式全流程');
  // 先导入一些数据
  db.importProducts([
    { name: '青椒', spec: '', unit: '斤', shelfMonths: 0, shelfDays: 7, openingStock: 0 },
  ]);
  db.importInbound([
    { name: '青椒', date: '2026-07-03', quantity: 10, remark: '', productionDate: null, expiryDate: null },
  ]);
  assertEqual(db.getProducts().length, 1, '覆盖前：1 产品');
  assertEqual(db.getInboundRecords({}).length, 1, '覆盖前：1 入库');

  // 覆盖产品（先清空再导入）
  db.clearProducts();
  assertEqual(db.getProducts().length, 0, 'clearProducts 后：0 产品');
  db.importProducts([
    { name: '土豆', spec: '散装', unit: '斤', shelfMonths: 12, shelfDays: 0, openingStock: 0 },
    { name: '茄子', spec: '', unit: '斤', shelfMonths: 5, shelfDays: 0, openingStock: 0 },
  ]);
  const allP = db.getProducts();
  assertEqual(allP.length, 2, '覆盖导入后：2 产品（旧数据已清）');
  assert(allP.every(p => p.name === '土豆' || p.name === '茄子'), '仅含新产品，无旧数据');

  // ── 10. importOpeningStock — 期初库存批量更新 ────────────────
  section('importOpeningStock 期初库存');
  db.importOpeningStock({ '土豆': 100, '茄子': 50 });
  const potato = db.getProducts().find(p => p.name === '土豆');
  const eggplant = db.getProducts().find(p => p.name === '茄子');
  assertEqual(potato.opening_stock, 100, '土豆期初库存 = 100');
  assertEqual(eggplant.opening_stock, 50, '茄子期初库存 = 50');

  // 不存在的产品不影响
  db.importOpeningStock({ '不存在产品': 999 });
  assertEqual(db.getProducts().length, 2, 'importOpeningStock 不增产品');

  // ── 11. 库存计算验证（入库-出库+期初） ────────────────────────
  section('库存计算');
  db.importInbound([
    { name: '土豆', date: '2026-07-03', quantity: 30, remark: '', productionDate: null, expiryDate: null },
    { name: '土豆', date: '2026-07-04', quantity: 20, remark: '', productionDate: null, expiryDate: null },
  ]);
  db.importOutbound([
    { name: '土豆', date: '2026-07-05', quantity: 40, recipient: '厨房' },
  ]);
  const inventory = db.getInventory();
  const potatoInv = inventory.find(p => p.name === '土豆');
  assert(potatoInv !== undefined, '土豆在库存中');
  assertEqual(potatoInv.total_in, 50, '土豆累计入库 = 30+20 = 50');
  assertEqual(potatoInv.total_out, 40, '土豆累计出库 = 40');
  assertEqual(potatoInv.stock, 110, '土豆当前库存 = 100(期初) + 50 - 40 = 110');

  // ── 12. 产品去重大小写 ───────────────────────────────────────
  section('产品名大小写去重');
  db.clearAllData();
  db.importProducts([
    { name: 'TestItem', spec: '', unit: '', shelfMonths: 0, shelfDays: 0, openingStock: 0 },
  ]);
  const r1 = db.importProducts([
    { name: 'testitem', spec: '', unit: '', shelfMonths: 0, shelfDays: 0, openingStock: 0 },
  ]);
  // SQLite 默认大小写敏感，testitem ≠ TestItem。验证当前行为。
  assertEqual(r1.skipped, 0, '大小写不同 → 不视为重复（SQLite 默认）');

  // ── 结果汇总 ────────────────────────────────────────────────
  db.clearAllData(); // 清理测试数据

  // Restore Module._load
  Module._load = originalLoad;

  // Cleanup tmp dir
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }

  const total = passed + failed;
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  导入导出集成测试: ${passed}/${total} 通过`);
  if (failed > 0) {
    console.log(`\n  ${failed} 项失败:`);
    failures.forEach(f => console.log(`    - ${f}`));
    console.log(`\n  ⚠ 请检查失败项并修复。`);
  } else {
    console.log(`  \x1b[32m✓ 全部通过！\x1b[0m`);
  }
  console.log(`═══════════════════════════════════════`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nTEST FAILURE:', err);
  process.exit(1);
});
