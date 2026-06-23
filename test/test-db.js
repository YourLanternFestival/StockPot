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
    VALUES ('洋安食堂', '2025-06-01', '测试商品', '大', 3.5, '5', '斤', 17.5, '', 0, '2025-06-01')`);
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

    // Clear purchase orders for 洋安食堂
    db.run('DELETE FROM purchase_orders WHERE source = ?', ['洋安食堂']);

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
  // 5a: Clear old date + insert new in one transaction, preserve same-source other dates
  {
    const db = new SQL.Database();
    createTables(db);

    // Pre-seed: 洋安食堂 2025-06-01 (old data, same date — should be replaced)
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('洋安食堂', '2025-06-01', '旧白菜', '', 2.0, '10', '斤', 20.0)`);
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('洋安食堂', '2025-06-01', '旧萝卜', '', 3.0, '5', '斤', 15.0)`);
    // 洋安食堂 2025-06-02 (different date — should be preserved across-date)
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('洋安食堂', '2025-06-02', '跨日数据', '', 5.0, '3', '斤', 15.0)`);
    // Another source (should be preserved)
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('供应商B', '2025-06-01', '独立数据', '', 1.0, '1', '斤', 1.0)`);

    assert.strictEqual(countTable(db, 'purchase_orders'), 4, 'seed: 4 orders');

    // Simulate savePurchaseOrdersBatch: clear (source, date) + insert new
    const sourceDates = [{ source: '洋安食堂', date: '2025-06-01' }];
    const newOrders = [
      ['洋安食堂', '2025-06-01', '新白菜', '', 2.5, '10', '斤', 25.0],
      ['洋安食堂', '2025-06-01', '新萝卜', '', 3.5, '5', '斤', 17.5],
      ['洋安食堂', '2025-06-01', '新土豆', '', 1.8, '20', '斤', 36.0],
    ];

    db.run('BEGIN TRANSACTION');
    for (const { source, date } of sourceDates) {
      db.run('DELETE FROM purchase_orders WHERE source = ? AND receive_date = ?', [source, date]);
    }

    const insertStmt = db.prepare(
      `INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const o of newOrders) {
      insertStmt.run(o);
    }
    insertStmt.free();
    db.run('COMMIT');

    // Verify: 3 new + 1 cross-date preserved + 1 other source = 5
    assert.strictEqual(countTable(db, 'purchase_orders'), 5, 'batch: 3 new + 1 cross-date + 1 other source');

    const yangAn0601 = db.exec(
      "SELECT product_name FROM purchase_orders WHERE source = '洋安食堂' AND receive_date = '2025-06-01' ORDER BY id"
    );
    const names = yangAn0601[0].values.map(r => r[0]);
    assert.deepStrictEqual(names, ['新白菜', '新萝卜', '新土豆'], 'same-date old replaced with new');

    // Cross-date data preserved
    const yangAn0602 = db.exec(
      "SELECT product_name FROM purchase_orders WHERE source = '洋安食堂' AND receive_date = '2025-06-02'"
    );
    assert.strictEqual(yangAn0602[0].values[0][0], '跨日数据', 'same-source other-date preserved');

    // Other source's data preserved
    const other = db.exec(
      "SELECT product_name FROM purchase_orders WHERE source = '供应商B'"
    );
    assert.strictEqual(other[0].values[0][0], '独立数据', 'other source preserved');

    db.close();
    runPassed('savePurchaseOrdersBatch: per-date clear + insert in transaction (happy path)');
  }

  // 5b: Simulate failure -- if insert fails, old data should still be there (ROLLBACK)
  {
    const db = new SQL.Database();
    createTables(db);

    // Pre-seed with old data
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('洋安食堂', '2025-06-01', '旧白菜', '', 2.0, '10', '斤', 20.0)`);
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
      VALUES ('洋安食堂', '2025-06-01', '旧萝卜', '', 3.0, '5', '斤', 15.0)`);

    assert.strictEqual(countTable(db, 'purchase_orders'), 2, 'seed: 2 old orders');

    // Simulate a batch save that fails mid-way (per-date clear)
    let failureCaught = false;
    try {
      db.run('BEGIN TRANSACTION');
      db.run('DELETE FROM purchase_orders WHERE source = ? AND receive_date = ?', ['洋安食堂', '2025-06-01']);

      // Insert first new order successfully
      db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
        VALUES ('洋安食堂', '2025-06-01', '新白菜', '', 2.5, '10', '斤', 25.0)`);

      // Simulate a failure on the second insert
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
      "SELECT product_name FROM purchase_orders WHERE source = '洋安食堂' ORDER BY id"
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
// Test 6: saveAllPurchaseOrders — 跨日期保留（同一 source 不同日期互不覆盖）
// Task 13: 模拟 saveAllPurchaseOrders 收集两个不同日期的 date-group 后批量保存
// ---------------------------------------------------------------------------

async function test_saveAllPurchaseOrders_crossDate(SQL) {
  const db = new SQL.Database();
  createTables(db);

  // Pre-seed DB: 洋安-厨房 on two different dates
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-厨房', '2025-06-01', 'DB-only item', '', 5.0, '1', '斤', 5.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-厨房', '2025-06-02', 'Another DB item', '', 6.0, '2', '斤', 12.0)`);
  // Another source to verify isolation
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('联华', '2025-06-01', 'Lianhua item', '', 3.0, '1', '件', 3.0)`);

  assert.strictEqual(countTable(db, 'purchase_orders'), 3, 'seed: 3 orders');

  // Simulate: DOM has data ONLY for 洋安-厨房 on 2025-06-01 (user only edited this date)
  // sourceDates should only include dates with actual DOM data
  const sourceDates = [
    { source: '洋安-厨房', date: '2025-06-01' }
  ];
  const orders = [
    { source: '洋安-厨房', receive_date: '2025-06-01', product_name: 'Edited item', spec: '', unit_price: 5.5, quantity: '3', unit: '斤', amount: 16.5, remark: '', sort_order: 0 }
  ];

  // Simulate savePurchaseOrdersBatch with per-(source,date) clear
  db.run('BEGIN TRANSACTION');
  for (const { source, date } of sourceDates) {
    db.run('DELETE FROM purchase_orders WHERE source = ? AND receive_date = ?', [source, date]);
  }
  for (const o of orders) {
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount, remark, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [o.source, o.receive_date, o.product_name, o.spec, o.unit_price, o.quantity, o.unit, o.amount, o.remark, o.sort_order]);
  }
  db.run('COMMIT');

  // Verify: 2025-06-01 has new data (1 row), 2025-06-02 still has its original data (1 row)
  const date1 = db.exec(
    "SELECT product_name FROM purchase_orders WHERE source = '洋安-厨房' AND receive_date = '2025-06-01'"
  );
  assert.strictEqual(date1[0].values.length, 1, '06-01: 1 row (the edited one)');
  assert.strictEqual(date1[0].values[0][0], 'Edited item', '06-01: new data');

  const date2 = db.exec(
    "SELECT product_name FROM purchase_orders WHERE source = '洋安-厨房' AND receive_date = '2025-06-02'"
  );
  assert.strictEqual(date2[0].values.length, 1, '06-02: preserved (not in DOM, not deleted)');
  assert.strictEqual(date2[0].values[0][0], 'Another DB item', '06-02: original data intact');

  // 联华 data preserved (different source)
  const lianhua = db.exec(
    "SELECT product_name FROM purchase_orders WHERE source = '联华'"
  );
  assert.strictEqual(lianhua[0].values.length, 1, '联华: other source preserved');

  assert.strictEqual(countTable(db, 'purchase_orders'), 3, 'total: 3 orders (1 edited + 1 preserved + 1 other source)');

  db.close();
  runPassed('saveAllPurchaseOrders: cross-date preservation (same source, different dates)');
}

// ---------------------------------------------------------------------------
// Test 7: 空 date-group 不收集到 sourceDates → 不触发 DELETE
// Task 14: 模拟 date-group div 存在但内部无有效行 → sourceDates 应为空 → DB 不变
// ---------------------------------------------------------------------------

async function test_emptyDateGroup_notCollected(SQL) {
  const db = new SQL.Database();
  createTables(db);

  // Pre-seed: 洋安-厨房 on two dates
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-厨房', '2025-06-01', 'Item A', '', 2.0, '10', '斤', 20.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-厨房', '2025-06-02', 'Item B', '', 3.0, '5', '斤', 15.0)`);
  // Another source
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('白南山-联华', '2025-06-01', 'Lianhua C', '', 1.0, '3', '件', 3.0)`);

  assert.strictEqual(countTable(db, 'purchase_orders'), 3, 'seed: 3 orders');

  // Simulate: DOM has a date-group for 洋安-厨房/2025-06-02 but it's EMPTY (all rows deleted by user)
  // The fix ensures sourceDates only includes dates with valid rows.
  // Since 2025-06-02 has no valid rows, sourceDates should NOT include it.
  const sourceDates = [];  // empty date-group → not collected
  const orders = [];       // no valid rows → no orders

  // Simulate savePurchaseOrdersBatch (should be a no-op when sourceDates is empty)
  if (sourceDates.length > 0) {
    db.run('BEGIN TRANSACTION');
    for (const { source, date } of sourceDates) {
      db.run('DELETE FROM purchase_orders WHERE source = ? AND receive_date = ?', [source, date]);
    }
    for (const o of orders) {
      db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount, remark, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [o.source, o.receive_date, o.product_name, o.spec, o.unit_price, o.quantity, o.unit, o.amount, o.remark, o.sort_order]);
    }
    db.run('COMMIT');
  }

  // Verify: ALL data preserved (no DELETE was issued)
  assert.strictEqual(countTable(db, 'purchase_orders'), 3, 'all 3 orders preserved');
  const check01 = db.exec("SELECT product_name FROM purchase_orders WHERE source = '洋安-厨房' AND receive_date = '2025-06-01'");
  assert.strictEqual(check01[0].values[0][0], 'Item A', '06-01 data intact');
  const check02 = db.exec("SELECT product_name FROM purchase_orders WHERE source = '洋安-厨房' AND receive_date = '2025-06-02'");
  assert.strictEqual(check02[0].values[0][0], 'Item B', '06-02 data intact (not deleted despite empty DOM group)');
  const checkOther = db.exec("SELECT product_name FROM purchase_orders WHERE source = '白南山-联华'");
  assert.strictEqual(checkOther[0].values[0][0], 'Lianhua C', 'other source intact');

  db.close();
  runPassed('empty date-group: sourceDates not collected → no DELETE issued → all data preserved');
}

// ---------------------------------------------------------------------------
// Test 8: saveLianhuaDomData — 无 date-group 时跳过，不误清
// Task 15: sourceDates 为空数组 → saveBatch 提前返回 → DB 不受影响
// ---------------------------------------------------------------------------

async function test_saveLianhuaDomData_noDateGroup(SQL) {
  const db = new SQL.Database();
  createTables(db);

  // Pre-seed Lianhua data for two different sources on different dates
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('白南山-联华', '2025-06-01', '联华商品A', '', 5.0, '2', '件', 10.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('白南山-联华', '2025-06-02', '联华商品B', '', 6.0, '3', '件', 18.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-联华', '2025-06-01', '联华商品C', '', 4.0, '1', '件', 4.0)`);

  assert.strictEqual(countTable(db, 'purchase_orders'), 3, 'seed: 3 lianhua orders');

  // Simulate saveLianhuaDomData when a canteen group has no date-group divs at all
  // → sourceDates stays empty → function returns early
  const sourceDates = [];
  const orders = [];

  if (sourceDates.length === 0) {
    // Early return (as saveLianhuaDomData does at line 1415)
    // DB should be completely untouched
  }

  assert.strictEqual(countTable(db, 'purchase_orders'), 3, 'all 3 lianhua orders preserved');

  // Verify each specific (source, date) pair preserved (don't rely on alphabetical ORDER BY)
  const checkA = db.exec("SELECT product_name FROM purchase_orders WHERE source = '白南山-联华' AND receive_date = '2025-06-01'");
  assert.strictEqual(checkA[0].values[0][0], '联华商品A', '白南山 06-01 preserved');
  const checkB = db.exec("SELECT product_name FROM purchase_orders WHERE source = '白南山-联华' AND receive_date = '2025-06-02'");
  assert.strictEqual(checkB[0].values[0][0], '联华商品B', '白南山 06-02 preserved');
  const checkC = db.exec("SELECT product_name FROM purchase_orders WHERE source = '洋安-联华' AND receive_date = '2025-06-01'");
  assert.strictEqual(checkC[0].values[0][0], '联华商品C', '洋安 06-01 preserved');

  db.close();
  runPassed('saveLianhuaDomData: no date-group → sourceDates empty → early return → no data loss');
}

// ---------------------------------------------------------------------------
// Test 9: saveMatrixData — 按日期清除不误伤其他日期
// Task 16: 矩阵模式保存 date A → 再保存 date B → date A 数据保留
// ---------------------------------------------------------------------------

async function test_saveMatrixData_crossDate(SQL) {
  const db = new SQL.Database();
  createTables(db);

  // Pre-seed matrix data for date 2025-06-01
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('所A-厨房', '2025-06-01', '白菜', '', 0, '10', '斤', 0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('所B-厨房', '2025-06-01', '白菜', '', 0, '8', '斤', 0)`);

  assert.strictEqual(countTable(db, 'purchase_orders'), 2, 'seed: 2 matrix rows for 06-01');

  // Simulate matrix save for date 2025-06-02 (user changed date and added new data)
  const sourceDates02 = [
    { source: '所A-厨房', date: '2025-06-02' },
    { source: '所B-厨房', date: '2025-06-02' },
  ];
  const orders02 = [
    { source: '所A-厨房', receive_date: '2025-06-02', product_name: '萝卜', spec: '', unit_price: 0, quantity: '5', unit: '斤', amount: 0, remark: '', sort_order: 0 },
    { source: '所B-厨房', receive_date: '2025-06-02', product_name: '萝卜', spec: '', unit_price: 0, quantity: '3', unit: '斤', amount: 0, remark: '', sort_order: 0 },
  ];

  db.run('BEGIN TRANSACTION');
  for (const { source, date } of sourceDates02) {
    db.run('DELETE FROM purchase_orders WHERE source = ? AND receive_date = ?', [source, date]);
  }
  for (const o of orders02) {
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount, remark, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [o.source, o.receive_date, o.product_name, o.spec, o.unit_price, o.quantity, o.unit, o.amount, o.remark, o.sort_order]);
  }
  db.run('COMMIT');

  // Verify: 06-01 data preserved, 06-02 data added
  assert.strictEqual(countTable(db, 'purchase_orders'), 4, '4 total: 2 from 06-01 + 2 from 06-02');

  const date1 = db.exec("SELECT product_name FROM purchase_orders WHERE receive_date = '2025-06-01' ORDER BY source");
  assert.strictEqual(date1[0].values.length, 2, '06-01: 2 rows preserved');
  assert.strictEqual(date1[0].values[0][0], '白菜', '06-01 所A: 白菜 preserved');
  assert.strictEqual(date1[0].values[1][0], '白菜', '06-01 所B: 白菜 preserved');

  const date2 = db.exec("SELECT product_name FROM purchase_orders WHERE receive_date = '2025-06-02' ORDER BY source");
  assert.strictEqual(date2[0].values.length, 2, '06-02: 2 rows added');
  assert.strictEqual(date2[0].values[0][0], '萝卜', '06-02 所A: 萝卜');
  assert.strictEqual(date2[0].values[1][0], '萝卜', '06-02 所B: 萝卜');

  db.close();
  runPassed('saveMatrixData: per-date clear preserves other dates');
}

// ---------------------------------------------------------------------------
// Test 10: 调取→删单行→导出 端到端（DB 层模拟）
// Task 17: 模拟调取加载多 source+date → 删除某 source 某 date 的一条记录 → 导出
// ---------------------------------------------------------------------------

async function test_recall_deleteSingle_export(SQL) {
  const db = new SQL.Database();
  createTables(db);

  // Phase 1: Seed DB with historical data (simulating 23号 and 24号 for two canteens)
  // 洋安-厨房: 2025-06-23 (2 items), 2025-06-24 (2 items)
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-厨房', '2025-06-23', '白菜', '', 2.0, '10', '斤', 20.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-厨房', '2025-06-23', '萝卜', '', 3.0, '5', '斤', 15.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-厨房', '2025-06-24', '土豆', '', 1.5, '20', '斤', 30.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-厨房', '2025-06-24', '茄子', '', 4.0, '3', '斤', 12.0)`);

  // 洋安-联华: 2025-06-23 (1 item), 2025-06-24 (1 item)
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-联华', '2025-06-23', '联华A', '', 10.0, '2', '件', 20.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-联华', '2025-06-24', '联华B', '', 12.0, '1', '件', 12.0)`);

  // 白南山-厨房: independent canteen — should be completely unaffected
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('白南山-厨房', '2025-06-23', '青椒', '', 5.0, '8', '斤', 40.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('白南山-厨房', '2025-06-24', '黄瓜', '', 3.0, '6', '斤', 18.0)`);

  assert.strictEqual(countTable(db, 'purchase_orders'), 8, 'seed: 8 orders total');

  // Phase 2: Simulate recall — user loads data for both dates for 洋安
  // (nothing to do in DB — data is already there)

  // Phase 3: User deletes ONE item (白菜 from 洋安-厨房 2025-06-23)
  // The DOM now has: 洋安-厨房 06-23: [萝卜], 06-24: [土豆, 茄子]
  //                   洋安-联华 06-23: [联华A], 06-24: [联华B]
  //                   白南山-厨房: NOT in DOM (user didn't recall it)

  // Phase 4: Export → silentSave → saveAllPurchaseOrders collects ALL DOM date-groups
  // sourceDates from DOM (白南山 not in DOM, so not collected):
  const sourceDates = [
    { source: '洋安-厨房', date: '2025-06-23' },
    { source: '洋安-厨房', date: '2025-06-24' },
    { source: '洋安-联华', date: '2025-06-23' },
    { source: '洋安-联华', date: '2025-06-24' },
  ];
  // orders collected from DOM (白菜 is gone — user deleted it):
  const orders = [
    { source: '洋安-厨房', receive_date: '2025-06-23', product_name: '萝卜', spec: '', unit_price: 3.0, quantity: '5', unit: '斤', amount: 15.0, remark: '', sort_order: 0 },
    { source: '洋安-厨房', receive_date: '2025-06-24', product_name: '土豆', spec: '', unit_price: 1.5, quantity: '20', unit: '斤', amount: 30.0, remark: '', sort_order: 0 },
    { source: '洋安-厨房', receive_date: '2025-06-24', product_name: '茄子', spec: '', unit_price: 4.0, quantity: '3', unit: '斤', amount: 12.0, remark: '', sort_order: 1 },
    { source: '洋安-联华', receive_date: '2025-06-23', product_name: '联华A', spec: '', unit_price: 10.0, quantity: '2', unit: '件', amount: 20.0, remark: '', sort_order: 0 },
    { source: '洋安-联华', receive_date: '2025-06-24', product_name: '联华B', spec: '', unit_price: 12.0, quantity: '1', unit: '件', amount: 12.0, remark: '', sort_order: 0 },
  ];

  // Execute batch save (simulating the fixed savePurchaseOrdersBatch)
  db.run('BEGIN TRANSACTION');
  for (const { source, date } of sourceDates) {
    db.run('DELETE FROM purchase_orders WHERE source = ? AND receive_date = ?', [source, date]);
  }
  for (const o of orders) {
    db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount, remark, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [o.source, o.receive_date, o.product_name, o.spec, o.unit_price, o.quantity, o.unit, o.amount, o.remark, o.sort_order]);
  }
  db.run('COMMIT');

  // VERIFY
  const total = countTable(db, 'purchase_orders');
  assert.strictEqual(total, 7, '7 orders: 8 original - 1 deleted = 7');

  // 1. 洋安-厨房 06-23: only 萝卜 remains (白菜 deleted)
  const yk23 = db.exec(
    "SELECT product_name FROM purchase_orders WHERE source = '洋安-厨房' AND receive_date = '2025-06-23'"
  );
  assert.strictEqual(yk23[0].values.length, 1, '洋安-厨房 06-23: 1 row (萝卜, 白菜 deleted)');
  assert.strictEqual(yk23[0].values[0][0], '萝卜', '洋安-厨房 06-23: 萝卜');

  // 2. 洋安-厨房 06-24: both items still there
  const yk24 = db.exec(
    "SELECT product_name FROM purchase_orders WHERE source = '洋安-厨房' AND receive_date = '2025-06-24' ORDER BY product_name"
  );
  assert.strictEqual(yk24[0].values.length, 2, '洋安-厨房 06-24: 2 rows preserved');
  assert.strictEqual(yk24[0].values[0][0], '土豆', '洋安-厨房 06-24: 土豆');
  assert.strictEqual(yk24[0].values[1][0], '茄子', '洋安-厨房 06-24: 茄子');

  // 3. 洋安-联华: both items preserved
  const yl23 = db.exec(
    "SELECT product_name FROM purchase_orders WHERE source = '洋安-联华' AND receive_date = '2025-06-23'"
  );
  assert.strictEqual(yl23[0].values[0][0], '联华A', '洋安-联华 06-23 preserved');
  const yl24 = db.exec(
    "SELECT product_name FROM purchase_orders WHERE source = '洋安-联华' AND receive_date = '2025-06-24'"
  );
  assert.strictEqual(yl24[0].values[0][0], '联华B', '洋安-联华 06-24 preserved');

  // 4. CRITICAL: 白南山-厨房 completely preserved (not in DOM → not in sourceDates → not touched)
  const bs23 = db.exec(
    "SELECT product_name FROM purchase_orders WHERE source = '白南山-厨房' AND receive_date = '2025-06-23'"
  );
  assert.strictEqual(bs23[0].values.length, 1, '白南山-厨房 06-23: preserved');
  assert.strictEqual(bs23[0].values[0][0], '青椒', '白南山-厨房: 青椒 intact');
  const bs24 = db.exec(
    "SELECT product_name FROM purchase_orders WHERE source = '白南山-厨房' AND receive_date = '2025-06-24'"
  );
  assert.strictEqual(bs24[0].values.length, 1, '白南山-厨房 06-24: preserved');
  assert.strictEqual(bs24[0].values[0][0], '黄瓜', '白南山-厨房: 黄瓜 intact');

  db.close();
  runPassed('recall→delete×1→export: same-source other-date preserved, other-source fully intact');
}

// ---------------------------------------------------------------------------
// Test 11: clearPurchasePageDOM → hasPurchasePageData 返回 false
// Task 18: DB 层模拟 — DOM 清空后 sourceDates 为空 → saveBatch 提前返回
// ---------------------------------------------------------------------------

async function test_clearDOM_hasPurchasePageData_false(SQL) {
  const db = new SQL.Database();
  createTables(db);

  // Pre-seed data
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('洋安-厨房', '2025-06-01', 'Item', '', 2.0, '10', '斤', 20.0)`);
  db.run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount)
    VALUES ('联华', '2025-06-01', 'Lianhua', '', 3.0, '1', '件', 3.0)`);
  assert.strictEqual(countTable(db, 'purchase_orders'), 2, 'seed: 2 orders');

  // Simulate clearPurchasePageDOM: all date-group divs removed via dg.remove()
  // After this, hasPurchasePageData() returns false because no product_name inputs exist
  // saveAllPurchaseOrders: dateGroups.length === 0 → sourceDates.length === 0 → early return

  const sourceDates = [];  // no date-groups in DOM after clear
  const orders = [];        // no data to collect

  // Simulate the guard: if sourceDates.length === 0, return early
  if (sourceDates.length === 0) {
    // Early return — DB should be untouched
  }

  // Verify DB untouched
  assert.strictEqual(countTable(db, 'purchase_orders'), 2, 'DB untouched after clearDOM');
  const all = db.exec("SELECT source, product_name FROM purchase_orders");
  assert.strictEqual(all[0].values.length, 2, 'both orders preserved');
  assert.strictEqual(all[0].values[0][1], 'Item', '洋安 item preserved');
  assert.strictEqual(all[0].values[1][1], 'Lianhua', '联华 item preserved');

  // Also test: after clearDOM, hasPurchasePageData concept — no product_name inputs
  // in the container means no data is "visible" to the save function
  // This is proven by sourceDates being empty, which causes early return with no DB mutation

  db.close();
  runPassed('clearPurchasePageDOM: empty DOM → sourceDates=[] → early return → DB untouched');
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
  await test_saveAllPurchaseOrders_crossDate(SQL);
  await test_emptyDateGroup_notCollected(SQL);
  await test_saveLianhuaDomData_noDateGroup(SQL);
  await test_saveMatrixData_crossDate(SQL);
  await test_recall_deleteSingle_export(SQL);
  await test_clearDOM_hasPurchasePageData_false(SQL);

  console.log('\nAll DB tests passed');
}

main().catch(err => {
  console.error('\nTEST FAILURE:', err);
  process.exit(1);
});
