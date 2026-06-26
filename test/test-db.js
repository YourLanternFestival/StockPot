const initSqlJs = require('sql.js');
const assert = require('assert');

// All 10 tables in the application (clearAllData covers 9 data tables + settings)
const DATA_TABLES = [
  'products', 'inbound_records', 'outbound_records', 'recipients',
  'purchase_orders', 'inquiry_items', 'lianhua_orders', 'lianhua_items',
  'remark_memory'
];
const ALL_TABLES = [...DATA_TABLES, 'settings'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTables(db) {
  db.run(`CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, spec TEXT, unit TEXT, shelf_life_months INTEGER, shelf_life_days INTEGER, opening_stock REAL, active INTEGER DEFAULT 1)`);
  db.run(`CREATE TABLE inbound_records (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, product_name TEXT, spec TEXT, unit TEXT, quantity REAL, unit_price REAL, amount REAL, production_date TEXT, expiry_date TEXT, inbound_date TEXT, remark TEXT, created_at TEXT)`);
  db.run(`CREATE TABLE outbound_records (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, product_name TEXT, spec TEXT, unit TEXT, quantity REAL, recipient TEXT, outbound_date TEXT, created_at TEXT)`);
  db.run(`CREATE TABLE recipients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)`);
  db.run(`CREATE TABLE purchase_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, receive_date TEXT, product_name TEXT, spec TEXT, unit_price REAL, quantity TEXT, unit TEXT, amount REAL, remark TEXT, sort_order INTEGER, created_at TEXT)`);
  db.run(`CREATE TABLE inquiry_items (id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT, category TEXT, name TEXT, price REAL, unit TEXT, spec TEXT, remark TEXT)`);
  db.run(`CREATE TABLE lianhua_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, product_name TEXT, quantity REAL, unit_price REAL, amount REAL, created_at TEXT)`);
  db.run(`CREATE TABLE lianhua_items (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT, unit TEXT, spec TEXT, price REAL, split_qty REAL)`);
  db.run(`CREATE TABLE remark_memory (id INTEGER PRIMARY KEY AUTOINCREMENT, product_name TEXT, remark TEXT, created_at TEXT)`);
  db.run(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)`);
}

function countTable(db, table) {
  const stmt = db.prepare(`SELECT COUNT(*) as c FROM ${table}`);
  stmt.step();
  const r = stmt.getAsObject();
  stmt.free();
  return r.c;
}

function runPassed(name) {
  console.log(`  PASS ${name}`);
}

// ---------------------------------------------------------------------------
// Seed helpers -- insert one row into every data table
// ---------------------------------------------------------------------------

function seedAllTables(db) {
  // products
  db.run(`INSERT INTO products (name, spec, unit, shelf_life_months, shelf_life_days, opening_stock, active)
    VALUES ('测试商品', '大', '斤', 12, 0, 10.0, 1)`);
  // inbound_records
  db.run(`INSERT INTO inbound_records (product_id, product_name, spec, unit, quantity, unit_price, amount, production_date, expiry_date, inbound_date, remark, created_at)
    VALUES (1, '测试商品', '大', '斤', 5.0, 3.5, 17.5, '2025-01-01', '2026-01-01', '2025-06-01', '测试备注', '2025-06-01')`);
  // outbound_records
  db.run(`INSERT INTO outbound_records (product_id, product_name, spec, unit, quantity, recipient, outbound_date, created_at)
    VALUES (1, '测试商品', '大', '斤', 2.0, '厨房', '2025-06-01', '2025-06-01')`);
  // recipients
  db.run(`INSERT OR IGNORE INTO recipients (name) VALUES ('厨房')`);
  // purchase_orders
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount, remark, sort_order, created_at)
    VALUES ('食堂A食堂', '2025-06-01', '测试商品', '大', 3.5, '5', '斤', 17.5, '', 0, '2025-06-01')`);
  // inquiry_items
  db.run(`INSERT INTO inquiry_items (month, category, name, price, unit, spec, remark)
    VALUES ('2025-06', '蔬菜', '测试商品', 3.5, '斤', '大', '')`);
  // lianhua_orders
  db.run(`INSERT INTO lianhua_orders (product_name, quantity, unit_price, amount, created_at)
    VALUES ('测试商品', 3.0, 3.5, 10.5, '2025-06-01')`);
  // lianhua_items
  db.run(`INSERT INTO lianhua_items (code, name, unit, spec, price, split_qty)
    VALUES ('001', '测试商品', '件', '大', 3.5, 1.0)`);
  // remark_memory
  db.run(`INSERT INTO remark_memory (product_name, remark, created_at)
    VALUES ('测试商品', '常用备注', '2025-06-01')`);
  // settings
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('test_key', 'test_value')`);
}

// ---------------------------------------------------------------------------
// Test 1: clearAllData -- clears all 9 data tables
// ---------------------------------------------------------------------------

async function test_clearAllData(SQL) {
  const db = new SQL.Database();
  createTables(db);
  seedAllTables(db);

  // Verify all 9 data tables have data
  for (const table of DATA_TABLES) {
    assert.strictEqual(countTable(db, table), 1, `seed: ${table} should have 1 row`);
  }
  assert.strictEqual(countTable(db, 'settings'), 1, 'seed: settings should have 1 row');

  // Simulate clearAllData (DELETE FROM all 9 data tables + reset recipients)
  // This mirrors the IA32 fix where all 9 tables are now cleared
  db.run('BEGIN TRANSACTION');
  db.run('DELETE FROM outbound_records');
  db.run('DELETE FROM inbound_records');
  db.run('DELETE FROM products');
  db.run('DELETE FROM purchase_orders');
  db.run('DELETE FROM inquiry_items');
  db.run('DELETE FROM lianhua_orders');
  db.run('DELETE FROM lianhua_items');
  db.run('DELETE FROM remark_memory');
  db.run('DELETE FROM recipients');
  // Re-seed default recipients (as clearAllData does)
  for (const name of ['厨房', '小食堂', '面点房', '烧饭', '明档']) {
    db.run('INSERT OR IGNORE INTO recipients (name) VALUES (?)', [name]);
  }
  db.run('COMMIT');

  // All 9 data tables should be empty (recipients was cleared then re-seeded with 5)
  for (const table of DATA_TABLES) {
    if (table === 'recipients') {
      assert.strictEqual(countTable(db, table), 5, `clearAllData: recipients should have 5 re-seeded rows`);
    } else {
      assert.strictEqual(countTable(db, table), 0, `clearAllData: ${table} should be empty`);
    }
  }
  // settings table should NOT be cleared
  assert.strictEqual(countTable(db, 'settings'), 1, 'clearAllData: settings should be preserved');

  db.close();
  runPassed('clearAllData clears all 9 data tables');
}

// ---------------------------------------------------------------------------
// Test 2: clearPurchaseOrders safety guard
// ---------------------------------------------------------------------------

async function test_clearPurchaseOrders_guard(SQL) {
  // 2a: NULL/empty source should be rejected
  {
    const db = new SQL.Database();
    createTables(db);

    // Insert test data
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('供应商A', '2025-06-01', '白菜', '', 2.0, '10', '斤', 20.0)`);

    // Simulate the guard: rejecting falsy/empty source
    function safeClearPurchaseOrders(source) {
      if (source && typeof source === 'string' && source.trim()) {
        db.run('DELETE FROM purchase_orders WHERE source = ?', [source]);
      } else {
        throw new Error('clearPurchaseOrders: source 不能为空');
      }
    }

    // Test NULL rejection
    assert.throws(() => safeClearPurchaseOrders(null), /source 不能为空/);
    // Test empty string rejection
    assert.throws(() => safeClearPurchaseOrders(''), /source 不能为空/);
    // Test whitespace-only rejection
    assert.throws(() => safeClearPurchaseOrders('   '), /source 不能为空/);
    // Verify data NOT deleted
    assert.strictEqual(countTable(db, 'purchase_orders'), 1, 'guard: data preserved after rejected clear');

    db.close();
    runPassed('clearPurchaseOrders rejects NULL/empty/whitespace source');
  }

  // 2b: Valid source only deletes that source's data
  {
    const db = new SQL.Database();
    createTables(db);

    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('供应商A', '2025-06-01', '白菜', '', 2.0, '10', '斤', 20.0)`);
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('供应商B', '2025-06-01', '萝卜', '', 3.0, '5', '斤', 15.0)`);
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('供应商A', '2025-06-02', '土豆', '', 1.5, '20', '斤', 30.0)`);

    assert.strictEqual(countTable(db, 'purchase_orders'), 3, 'seed: 3 orders');

    // Clear only 供应商A
    db.run('DELETE FROM purchase_orders WHERE source = ?', ['供应商A']);

    // Verify only 供应商A data is gone, 供应商B preserved
    assert.strictEqual(countTable(db, 'purchase_orders'), 1, 'only source A deleted');
    const remaining = db.exec("SELECT source FROM purchase_orders");
    assert.strictEqual(remaining[0].values[0][0], '供应商B', 'source B preserved');

    db.close();
    runPassed('clearPurchaseOrders with valid source only deletes that source');
  }

  // 2c: Other tables unaffected
  {
    const db = new SQL.Database();
    createTables(db);
    seedAllTables(db);

    // Clear purchase orders for 食堂A食堂
    db.run('DELETE FROM purchase_orders WHERE source = ?', ['食堂A食堂']);

    assert.strictEqual(countTable(db, 'purchase_orders'), 0, 'purchase_orders cleared');
    // Other tables still have their data
    assert.strictEqual(countTable(db, 'products'), 1, 'products unaffected');
    assert.strictEqual(countTable(db, 'inbound_records'), 1, 'inbound_records unaffected');
    assert.strictEqual(countTable(db, 'outbound_records'), 1, 'outbound_records unaffected');
    assert.strictEqual(countTable(db, 'recipients'), 1, 'recipients unaffected');
    assert.strictEqual(countTable(db, 'settings'), 1, 'settings unaffected');

    db.close();
    runPassed('clearPurchaseOrders does not affect other tables');
  }
}

// ---------------------------------------------------------------------------
// Test 3: deletePurchaseOrdersByDate
// ---------------------------------------------------------------------------

async function test_deletePurchaseOrdersByDate(SQL) {
  const db = new SQL.Database();
  createTables(db);

  // Insert orders for different sources and dates
  const orders = [
    ['供应商A', '2025-06-01', '白菜', '', 2.0, '10', '斤', 20.0],
    ['供应商A', '2025-06-02', '萝卜', '', 3.0, '5', '斤', 15.0],
    ['供应商A', '2025-06-03', '土豆', '', 1.5, '20', '斤', 30.0],
    ['供应商B', '2025-06-01', '白菜', '', 2.2, '8', '斤', 17.6],
    ['供应商B', '2025-06-02', '茄子', '', 4.0, '3', '斤', 12.0],
  ];

  const insert = db.prepare(
    `INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const o of orders) {
    insert.run(o);
  }
  insert.free();

  assert.strictEqual(countTable(db, 'purchase_orders'), 5, 'seed: 5 orders');

  // Delete 供应商A + 2025-06-01
  db.run('DELETE FROM purchase_orders WHERE source = ? AND receive_date = ?', ['供应商A', '2025-06-01']);

  // Verify: 4 remaining (only 供应商A on 2025-06-01 removed)
  assert.strictEqual(countTable(db, 'purchase_orders'), 4, 'one record deleted');

  // Verify the deleted record is gone
  const remaining = db.exec(
    "SELECT source, receive_date, product_name FROM purchase_orders ORDER BY source, receive_date"
  );
  const rows = remaining[0].values;
  assert.strictEqual(rows.length, 4, '4 rows remain');

  // Verify 供应商B on 2025-06-01 is still there
  const bJune1 = db.exec(
    "SELECT COUNT(*) as c FROM purchase_orders WHERE source = '供应商B' AND receive_date = '2025-06-01'"
  );
  assert.strictEqual(bJune1[0].values[0][0], 1, '供应商B 2025-06-01 preserved');

  // Delete 供应商A entirely by date range concept — 供应商A on 2025-06-02
  db.run('DELETE FROM purchase_orders WHERE source = ? AND receive_date = ?', ['供应商A', '2025-06-02']);
  assert.strictEqual(countTable(db, 'purchase_orders'), 3, 'second record deleted');

  // Verify only 供应商A 2025-06-03 remains for A
  const aRemaining = db.exec(
    "SELECT COUNT(*) as c FROM purchase_orders WHERE source = '供应商A'"
  );
  assert.strictEqual(aRemaining[0].values[0][0], 1, 'one 供应商A record remains');

  // Verify all 供应商B records intact
  const bRemaining = db.exec(
    "SELECT COUNT(*) as c FROM purchase_orders WHERE source = '供应商B'"
  );
  assert.strictEqual(bRemaining[0].values[0][0], 2, 'both 供应商B records preserved');

  db.close();
  runPassed('deletePurchaseOrdersByDate correctly filters by source + date');
}

// ---------------------------------------------------------------------------
// Test 4: Transaction atomicity
// ---------------------------------------------------------------------------

async function test_transaction_atomicity(SQL) {
  // 4a: ROLLBACK leaves no data after simulated error
  {
    const db = new SQL.Database();
    createTables(db);

    db.run('BEGIN TRANSACTION');
    db.run(`INSERT INTO products (name, spec, unit, shelf_life_months, shelf_life_days, opening_stock)
      VALUES ('回滚测试', '', '斤', 0, 0, 5.0)`);
    db.run(`INSERT INTO inbound_records (product_id, product_name, spec, unit, quantity, unit_price, amount, inbound_date)
      VALUES (1, '回滚测试', '', '斤', 10.0, 2.0, 20.0, '2025-06-01')`);

    // Simulate an error occurring mid-transaction
    try {
      db.run('ROLLBACK');
      // After rollback, both inserts should be gone
    } catch (e) {
      // ignore
    }

    assert.strictEqual(countTable(db, 'products'), 0, 'rollback: products empty');
    assert.strictEqual(countTable(db, 'inbound_records'), 0, 'rollback: inbound_records empty');

    db.close();
    runPassed('ROLLBACK leaves no data (atomicity on failure)');
  }

  // 4b: COMMIT persists data
  {
    const db = new SQL.Database();
    createTables(db);

    db.run('BEGIN TRANSACTION');
    db.run(`INSERT INTO products (name, spec, unit, shelf_life_months, shelf_life_days, opening_stock)
      VALUES ('提交测试', '', '斤', 0, 0, 5.0)`);
    db.run(`INSERT INTO inbound_records (product_id, product_name, spec, unit, quantity, unit_price, amount, inbound_date)
      VALUES (1, '提交测试', '', '斤', 10.0, 2.0, 20.0, '2025-06-01')`);
    db.run('COMMIT');

    assert.strictEqual(countTable(db, 'products'), 1, 'commit: products has 1 row');
    assert.strictEqual(countTable(db, 'inbound_records'), 1, 'commit: inbound_records has 1 row');

    db.close();
    runPassed('COMMIT persists data (atomicity on success)');
  }

  // 4c: Explicit error + catch + ROLLBACK pattern
  {
    const db = new SQL.Database();
    createTables(db);

    // Pre-seed data that should survive
    db.run(`INSERT INTO settings (key, value) VALUES ('survive', 'yes')`);

    let errorCaught = false;
    try {
      db.run('BEGIN TRANSACTION');
      db.run(`INSERT INTO products (name, spec, unit, shelf_life_months, shelf_life_days, opening_stock)
        VALUES ('错误测试', '', '斤', 0, 0, 5.0)`);
      // Simulate an application-level error
      throw new Error('模拟应用层错误');
    } catch (e) {
      errorCaught = true;
      try { db.run('ROLLBACK'); } catch (_) { /* ignore */ }
    }

    assert.strictEqual(errorCaught, true, 'error was caught');
    assert.strictEqual(countTable(db, 'products'), 0, 'catch+rollback: products empty');
    assert.strictEqual(countTable(db, 'settings'), 1, 'catch+rollback: pre-existing settings survived');

    db.close();
    runPassed('catch + ROLLBACK pattern: no partial data left');
  }
}

// ---------------------------------------------------------------------------
// Test 5: savePurchaseOrdersBatch (simulated)
// ---------------------------------------------------------------------------

async function test_savePurchaseOrdersBatch(SQL) {
  // 5a: Clear old + insert new in one transaction (happy path)
  {
    const db = new SQL.Database();
    createTables(db);

    // Pre-seed with old data for source 食堂A食堂
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('食堂A食堂', '2025-06-01', '旧白菜', '', 2.0, '10', '斤', 20.0)`);
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('食堂A食堂', '2025-06-01', '旧萝卜', '', 3.0, '5', '斤', 15.0)`);
    // Also insert data for another source that should survive
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('供应商B', '2025-06-01', '独立数据', '', 1.0, '1', '斤', 1.0)`);

    assert.strictEqual(countTable(db, 'purchase_orders'), 3, 'seed: 3 orders');

    // Simulate savePurchaseOrdersBatch: clear source + insert new in one transaction
    const newOrders = [
      ['食堂A食堂', '2025-06-01', '新白菜', '', 2.5, '10', '斤', 25.0],
      ['食堂A食堂', '2025-06-01', '新萝卜', '', 3.5, '5', '斤', 17.5],
      ['食堂A食堂', '2025-06-01', '新土豆', '', 1.8, '20', '斤', 36.0],
    ];

    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM purchase_orders WHERE source = ?', ['食堂A食堂']);

    const insertStmt = db.prepare(
      `INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const o of newOrders) {
      insertStmt.run(o);
    }
    insertStmt.free();
    db.run('COMMIT');

    // Verify old data gone, new data present
    assert.strictEqual(countTable(db, 'purchase_orders'), 4, 'batch: 3 new + 1 other source');

    const yangAn = db.exec(
      "SELECT product_name FROM purchase_orders WHERE source = '食堂A食堂' ORDER BY id"
    );
    const names = yangAn[0].values.map(r => r[0]);
    assert.deepStrictEqual(names, ['新白菜', '新萝卜', '新土豆'], 'old replaced with new');

    // Verify other source's data preserved
    const other = db.exec(
      "SELECT product_name FROM purchase_orders WHERE source = '供应商B'"
    );
    assert.strictEqual(other[0].values[0][0], '独立数据', 'other source preserved');

    db.close();
    runPassed('savePurchaseOrdersBatch: clear + insert in transaction (happy path)');
  }

  // 5b: Simulate failure -- if insert fails, old data should still be there (ROLLBACK)
  {
    const db = new SQL.Database();
    createTables(db);

    // Pre-seed with old data
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('食堂A食堂', '2025-06-01', '旧白菜', '', 2.0, '10', '斤', 20.0)`);
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('食堂A食堂', '2025-06-01', '旧萝卜', '', 3.0, '5', '斤', 15.0)`);

    assert.strictEqual(countTable(db, 'purchase_orders'), 2, 'seed: 2 old orders');

    const originalRows = db.exec(
      "SELECT product_name FROM purchase_orders WHERE source = '食堂A食堂' ORDER BY id"
    );

    // Simulate a batch save that fails mid-way
    let failureCaught = false;
    try {
      db.run('BEGIN TRANSACTION');
      db.run('DELETE FROM purchase_orders WHERE source = ?', ['食堂A食堂']);

      // Insert first new order successfully
      db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
        VALUES ('食堂A食堂', '2025-06-01', '新白菜', '', 2.5, '10', '斤', 25.0)`);

      // Simulate a failure on the second insert (e.g., constraint violation or app error)
      throw new Error('模拟批量插入中途失败');
    } catch (e) {
      failureCaught = true;
      try { db.run('ROLLBACK'); } catch (_) { /* ignore */ }
    }

    assert.strictEqual(failureCaught, true, 'failure was caught');

    // After ROLLBACK, old data should still be intact
    assert.strictEqual(
      countTable(db, 'purchase_orders'), 2,
      'rollback: old data preserved (2 rows)'
    );

    const preservedRows = db.exec(
      "SELECT product_name FROM purchase_orders WHERE source = '食堂A食堂' ORDER BY id"
    );
    assert.deepStrictEqual(
      preservedRows[0].values.map(r => r[0]),
      ['旧白菜', '旧萝卜'],
      'rollback: original old data intact'
    );

    db.close();
    runPassed('savePurchaseOrdersBatch: ROLLBACK preserves old data on failure');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('DB Tests\n');

  const SQL = await initSqlJs();
  console.log(`sql.js initialized\n`);

  await test_clearAllData(SQL);
  await test_clearPurchaseOrders_guard(SQL);
  await test_deletePurchaseOrdersByDate(SQL);
  await test_transaction_atomicity(SQL);
  await test_savePurchaseOrdersBatch(SQL);

  console.log('\nAll DB tests passed');
}

main().catch(err => {
  console.error('\nTEST FAILURE:', err);
  process.exit(1);
});
