const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { toLocalDateStr } = require('./date-util');

let db;
let dbPath;

function getDbPath() {
  if (!dbPath) {
    dbPath = path.join(app.getPath('userData'), 'inventory.db');
  }
  return dbPath;
}

async function init() {
  const SQL = await initSqlJs();
  const filePath = getDbPath();

  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    db = new SQL.Database(buffer);
    console.log('[db] Loaded database:', filePath, `(${buffer.length} bytes)`);
  } else {
    db = new SQL.Database();
    console.log('[db] Created new database:', filePath);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      spec TEXT DEFAULT '',
      unit TEXT NOT NULL,
      shelf_months INTEGER DEFAULT 0,
      shelf_days INTEGER DEFAULT 0,
      unit_price REAL DEFAULT NULL,
      opening_stock REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS inbound_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      quantity REAL NOT NULL,
      remark TEXT DEFAULT '',
      production_date TEXT DEFAULT NULL,
      expiry_date TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS outbound_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      quantity REAL NOT NULL,
      recipient TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT DEFAULT '洋安食堂',
      receive_date TEXT,
      product_name TEXT NOT NULL,
      spec TEXT DEFAULT '',
      unit_price REAL DEFAULT 0,
      quantity TEXT DEFAULT '',
      unit TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      remark TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS inquiry_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL,
      unit TEXT DEFAULT '',
      spec TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lianhua_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      name TEXT NOT NULL,
      unit TEXT DEFAULT '件',
      spec TEXT DEFAULT '',
      price REAL DEFAULT 0,
      split_qty INTEGER DEFAULT 1,
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS lianhua_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      order_date TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Create indexes
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_inbound_product ON inbound_records(product_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_inbound_date ON inbound_records(date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_outbound_product ON outbound_records(product_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_outbound_date ON outbound_records(date)');
  } catch (e) { /* indexes may already exist */ }

  // Migration: add opening_stock column if missing
  try {
    db.run('ALTER TABLE products ADD COLUMN opening_stock REAL DEFAULT 0');
  } catch (e) { /* column already exists */ }

  // Migration: add sort_order column to recipients if missing
  try {
    db.run('ALTER TABLE recipients ADD COLUMN sort_order INTEGER DEFAULT 0');
  } catch (e) { /* column already exists */ }

  // Create remark_memory table for 备注记忆
  db.run(`
    CREATE TABLE IF NOT EXISTS remark_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      remark TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_remark_name ON remark_memory(product_name)');
  } catch (e) { /* index may already exist */ }

  // Seed default recipients
  const count = queryOne('SELECT COUNT(*) as c FROM recipients').c;
  if (count === 0) {
    for (const name of ['厨房', '小食堂', '面点房', '烧饭', '明档']) {
      db.run('INSERT OR IGNORE INTO recipients (name) VALUES (?)', [name]);
    }
  }

  save();
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  if (!data || data.length === 0) {
    throw new Error('数据库导出异常：数据为空');
  }
  const buffer = Buffer.from(data);
  const path = getDbPath();
  fs.writeFileSync(path, buffer);
  // Verify the write actually persisted (catches silent 0-byte writes)
  const stat = fs.statSync(path);
  if (stat.size === 0) {
    throw new Error('数据库写入异常：文件大小为0');
  }
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
  } catch (err) {
    console.error('SQL run error:', sql, params, err);
    throw err;
  }
}

let inTransaction = false;
function beginTransaction() {
  if (!inTransaction) {
    db.run('BEGIN TRANSACTION');
    inTransaction = true;
  }
}
function commit() {
  if (inTransaction) {
    db.run('COMMIT');
    inTransaction = false;
    save();
  }
}
function rollback() {
  if (inTransaction) {
    try { db.run('ROLLBACK'); } catch(e) {}
    inTransaction = false;
    save();
  }
}

// ===== Products =====
function getProducts() {
  return queryAll('SELECT * FROM products WHERE active = 1 ORDER BY id');
}

function getAllProducts() {
  return queryAll('SELECT * FROM products ORDER BY id');
}

function addProduct({ name, spec, unit, shelf_months, shelf_days, unit_price }) {
  run('INSERT INTO products (name, spec, unit, shelf_months, shelf_days, unit_price) VALUES (?, ?, ?, ?, ?, ?)',
    [name, spec || '', unit, shelf_months || 0, shelf_days || 0, unit_price || null]);
  save();
}

function updateProduct(id, { name, spec, unit, shelf_months, shelf_days, unit_price }) {
  run('UPDATE products SET name=?, spec=?, unit=?, shelf_months=?, shelf_days=?, unit_price=? WHERE id=?',
    [name, spec || '', unit, shelf_months || 0, shelf_days || 0, unit_price || null, id]);
  save();
}

function deleteProduct(id) {
  run('UPDATE products SET active = 0 WHERE id = ?', [id]);
  save();
}

function batchDeleteProducts(ids) {
  beginTransaction();
  try {
    for (const id of ids) {
      run('UPDATE products SET active = 0 WHERE id = ?', [id]);
    }
    commit();
  } catch (e) {
    rollback();
    throw e;
  }
}

function restoreProduct(id) {
  run('UPDATE products SET active = 1 WHERE id = ?', [id]);
  save();
}

function updateInquiryItem(id, data) {
  run(`UPDATE inquiry_items SET category=?, name=?, price=?, unit=?, spec=?, remark=? WHERE id=?`,
    [data.category, data.name, data.price || null, data.unit || '', data.spec || '', data.remark || '', id]);
  save();
}

// ===== Records (shared) =====
function getRecords(table, { startDate, endDate, productId } = {}) {
  let sql = `
    SELECT r.*, p.name as product_name, p.spec, p.unit
    FROM ${table} r
    JOIN products p ON r.product_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (startDate) { sql += ' AND r.date >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND r.date <= ?'; params.push(endDate); }
  if (productId) { sql += ' AND r.product_id = ?'; params.push(productId); }
  sql += ' ORDER BY r.date DESC, r.id DESC';
  return queryAll(sql, params);
}

// ===== Inbound =====
function getInboundRecords(filters) {
  return getRecords('inbound_records', filters);
}

function addInbound({ product_id, date, quantity, remark, production_date, expiry_date }) {
  run('INSERT INTO inbound_records (product_id, date, quantity, remark, production_date, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
    [product_id, date, quantity, remark || '', production_date || null, expiry_date || null]);
  save();
}

function updateInbound(id, { date, quantity, remark, production_date, expiry_date }) {
  run('UPDATE inbound_records SET date=?, quantity=?, remark=?, production_date=?, expiry_date=? WHERE id=?',
    [date, quantity, remark || '', production_date || null, expiry_date || null, id]);
  save();
}

function deleteInbound(id) {
  run('DELETE FROM inbound_records WHERE id = ?', [id]);
  save();
}

// ===== Outbound =====
function getOutboundRecords(filters) {
  return getRecords('outbound_records', filters);
}

function addOutbound({ product_id, date, quantity, recipient }) {
  run('INSERT INTO outbound_records (product_id, date, quantity, recipient) VALUES (?, ?, ?, ?)',
    [product_id, date, quantity, recipient || '']);
  save();
}

function updateOutbound(id, { date, quantity, recipient }) {
  run('UPDATE outbound_records SET date=?, quantity=?, recipient=? WHERE id=?',
    [date, quantity, recipient || '', id]);
  save();
}

function deleteOutbound(id) {
  run('DELETE FROM outbound_records WHERE id = ?', [id]);
  save();
}

// ===== Recipients =====
function getRecipients() {
  return queryAll('SELECT * FROM recipients ORDER BY sort_order, id');
}

function addRecipient(name) {
  // 获取当前最大的sort_order
  const maxOrder = queryOne('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM recipients').max_order;
  run('INSERT INTO recipients (name, sort_order) VALUES (?, ?)', [name, maxOrder + 1]);
  save();
}

function updateRecipient(id, name) {
  run('UPDATE recipients SET name = ? WHERE id = ?', [name, id]);
  save();
}

function deleteRecipient(id) {
  run('DELETE FROM recipients WHERE id = ?', [id]);
  save();
}

function updateRecipientOrder(orderedNames) {
  run('BEGIN');
  try {
    for (let i = 0; i < orderedNames.length; i++) {
      run('UPDATE recipients SET sort_order = ? WHERE name = ?', [i, orderedNames[i]]);
    }
    run('COMMIT');
    save();
  } catch (e) {
    run('ROLLBACK');
    throw e;
  }
}

// ===== Inventory =====
function getInventory() {
  return queryAll(`
    SELECT
      p.id, p.name, p.spec, p.unit, p.shelf_months, p.shelf_days, p.unit_price,
      p.opening_stock,
      COALESCE(i.total_in, 0) as total_in,
      COALESCE(o.total_out, 0) as total_out,
      p.opening_stock + COALESCE(i.total_in, 0) - COALESCE(o.total_out, 0) as stock
    FROM products p
    LEFT JOIN (SELECT product_id, SUM(quantity) as total_in FROM inbound_records GROUP BY product_id) i ON i.product_id = p.id
    LEFT JOIN (SELECT product_id, SUM(quantity) as total_out FROM outbound_records GROUP BY product_id) o ON o.product_id = p.id
    WHERE p.active = 1
    ORDER BY p.id
  `);
}

function getProductStockDetail(productId, inboundLimit = 5, outboundLimit = 10) {
  const product = queryOne('SELECT * FROM products WHERE id = ? AND active = 1', [productId]);
  if (!product) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = toLocalDateStr(now);

  // 上月结存 = opening_stock + 本月前累计入库 - 本月前累计出库
  const prevIn = queryOne(
    "SELECT COALESCE(SUM(quantity), 0) as v FROM inbound_records WHERE product_id = ? AND date < ?",
    [productId, monthStart]
  ).v;
  const prevOut = queryOne(
    "SELECT COALESCE(SUM(quantity), 0) as v FROM outbound_records WHERE product_id = ? AND date < ?",
    [productId, monthStart]
  ).v;
  const prevStock = (product.opening_stock || 0) + prevIn - prevOut;

  // 本月入库/出库
  const monthIn = queryOne(
    "SELECT COALESCE(SUM(quantity), 0) as v FROM inbound_records WHERE product_id = ? AND date >= ? AND date <= ?",
    [productId, monthStart, monthEnd]
  ).v;
  const monthOut = queryOne(
    "SELECT COALESCE(SUM(quantity), 0) as v FROM outbound_records WHERE product_id = ? AND date >= ? AND date <= ?",
    [productId, monthStart, monthEnd]
  ).v;

  const stock = prevStock + monthIn - monthOut;

  // 累计入库/出库（全量）
  const totalIn = queryOne(
    "SELECT COALESCE(SUM(quantity), 0) as v FROM inbound_records WHERE product_id = ?",
    [productId]
  ).v;
  const totalOut = queryOne(
    "SELECT COALESCE(SUM(quantity), 0) as v FROM outbound_records WHERE product_id = ?",
    [productId]
  ).v;

  const recentInbound = queryAll(
    "SELECT * FROM inbound_records WHERE product_id = ? ORDER BY date DESC, id DESC LIMIT ?",
    [productId, inboundLimit]
  );
  const recentOutbound = queryAll(
    "SELECT * FROM outbound_records WHERE product_id = ? ORDER BY date DESC, id DESC LIMIT ?",
    [productId, outboundLimit]
  );

  return {
    product,
    stock,
    prevStock,
    totalIn,
    totalOut,
    monthIn,
    monthOut,
    recentInbound,
    recentOutbound,
  };
}

function getInventoryByMonth(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  // Single query: products + previous balance + monthly totals (was 6N+1 queries)
  const products = queryAll(`
    SELECT p.*,
      COALESCE(pi.prev_in, 0) as prev_in,
      COALESCE(po.prev_out, 0) as prev_out,
      COALESCE(mi.month_in, 0) as month_in,
      COALESCE(mo.month_out, 0) as month_out
    FROM products p
    LEFT JOIN (SELECT product_id, SUM(quantity) as prev_in FROM inbound_records WHERE date < ? GROUP BY product_id) pi ON pi.product_id = p.id
    LEFT JOIN (SELECT product_id, SUM(quantity) as prev_out FROM outbound_records WHERE date < ? GROUP BY product_id) po ON po.product_id = p.id
    LEFT JOIN (SELECT product_id, SUM(quantity) as month_in FROM inbound_records WHERE date >= ? AND date <= ? GROUP BY product_id) mi ON mi.product_id = p.id
    LEFT JOIN (SELECT product_id, SUM(quantity) as month_out FROM outbound_records WHERE date >= ? AND date <= ? GROUP BY product_id) mo ON mo.product_id = p.id
    WHERE p.active = 1
    ORDER BY p.id
  `, [startDate, startDate, startDate, endDate, startDate, endDate]);

  // Single query for all daily breakdowns (was 2N queries)
  const dailyRows = queryAll(`
    SELECT product_id, substr(date, 9, 2) as day, SUM(quantity) as qty, 'in' as direction
    FROM inbound_records WHERE date >= ? AND date <= ?
    GROUP BY product_id, substr(date, 9, 2)
    UNION ALL
    SELECT product_id, substr(date, 9, 2) as day, SUM(quantity) as qty, 'out' as direction
    FROM outbound_records WHERE date >= ? AND date <= ?
    GROUP BY product_id, substr(date, 9, 2)
  `, [startDate, endDate, startDate, endDate]);

  // Group daily data by product_id
  const dailyByProduct = {};
  for (const r of dailyRows) {
    if (!dailyByProduct[r.product_id]) dailyByProduct[r.product_id] = {};
    const day = parseInt(r.day);
    if (!dailyByProduct[r.product_id][day]) dailyByProduct[r.product_id][day] = { in: 0, out: 0 };
    if (r.direction === 'in') dailyByProduct[r.product_id][day].in = r.qty;
    else dailyByProduct[r.product_id][day].out = r.qty;
  }

  return products.map(p => {
    const prevStock = (p.opening_stock || 0) + p.prev_in - p.prev_out;
    const currentStock = prevStock + p.month_in - p.month_out;
    const daily = dailyByProduct[p.id] || {};

    return {
      ...p,
      prevStock,
      monthIn: p.month_in,
      monthOut: p.month_out,
      currentStock,
      daily,
      hasActivity: p.month_in > 0 || p.month_out > 0 || currentStock > 0,
    };
  });
}

// ===== Alerts =====
function getExpiryAlerts(daysAhead = 60) {
  const today = toLocalDateStr(new Date());
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const future = toLocalDateStr(futureDate);

  // Only alert for products with current stock > 0
  return queryAll(`
    SELECT r.*, p.name as product_name, p.spec, p.unit
    FROM inbound_records r
    JOIN products p ON r.product_id = p.id
    JOIN (
      SELECT p2.id,
        p2.opening_stock + COALESCE(i2.s, 0) - COALESCE(o2.s, 0) as stock
      FROM products p2
      LEFT JOIN (SELECT product_id, SUM(quantity) as s FROM inbound_records GROUP BY product_id) i2 ON i2.product_id = p2.id
      LEFT JOIN (SELECT product_id, SUM(quantity) as s FROM outbound_records GROUP BY product_id) o2 ON o2.product_id = p2.id
      WHERE p2.active = 1
    ) s ON s.id = p.id AND s.stock > 0
    WHERE r.expiry_date IS NOT NULL AND r.expiry_date <= ?
    ORDER BY r.expiry_date ASC
  `, [future]);
}

// ===== Import =====
function importProducts(products) {
  const existing = queryAll('SELECT name FROM products').map(r => r.name);
  let imported = 0, skipped = 0;
  run('BEGIN');
  try {
    for (const p of products) {
      if (existing.includes(p.name)) { skipped++; continue; }
      run('INSERT INTO products (name, spec, unit, shelf_months, shelf_days, opening_stock) VALUES (?, ?, ?, ?, ?, ?)',
        [p.name, p.spec || '', p.unit || '', p.shelfMonths || 0, p.shelfDays || 0, p.openingStock || 0]);
      imported++;
    }
    run('COMMIT');
    save();
  } catch (e) {
    run('ROLLBACK');
    throw e;
  }
  return { imported, skipped };
}

function importOpeningStock(openingStockMap) {
  // openingStockMap: { productName: number }
  run('BEGIN');
  try {
    for (const [name, stock] of Object.entries(openingStockMap)) {
      run('UPDATE products SET opening_stock = ? WHERE name = ?', [stock, name]);
    }
    run('COMMIT');
    save();
  } catch (e) {
    run('ROLLBACK');
    throw e;
  }
}

function importRecords(sqlFn, records) {
  const productMap = {};
  queryAll('SELECT id, name FROM products').forEach(p => { productMap[p.name] = p.id; });
  let imported = 0, skipped = 0;
  run('BEGIN');
  try {
    for (const r of records) {
      const pid = productMap[r.name];
      if (!pid) { skipped++; continue; }
      const [sql, params] = sqlFn(r, pid);
      run(sql, params);
      imported++;
    }
    run('COMMIT');
    save();
  } catch (e) {
    run('ROLLBACK');
    throw e;
  }
  return { imported, skipped };
}

function importInbound(records) {
  return importRecords((r, pid) => [
    'INSERT INTO inbound_records (product_id, date, quantity, remark, production_date, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
    [pid, r.date, r.quantity, r.remark || '', r.productionDate || null, r.expiryDate || null]
  ], records);
}

function importOutbound(records) {
  return importRecords((r, pid) => [
    'INSERT INTO outbound_records (product_id, date, quantity, recipient) VALUES (?, ?, ?, ?)',
    [pid, r.date, r.quantity, r.recipient || '']
  ], records);
}

function clearAllData() {
  run('BEGIN');
  try {
    run('DELETE FROM outbound_records');
    run('DELETE FROM inbound_records');
    run('DELETE FROM products');
    run('DELETE FROM purchase_orders');
    run('DELETE FROM inquiry_items');
    run('DELETE FROM lianhua_orders');
    run('DELETE FROM lianhua_items');
    run('DELETE FROM remark_memory');
    // Also clear recipients to reset
    run('DELETE FROM recipients');
    // Re-seed default recipients
    for (const name of ['厨房', '小食堂', '面点房', '烧饭', '明档']) {
      run('INSERT OR IGNORE INTO recipients (name) VALUES (?)', [name]);
    }
    run('COMMIT');
    save();
  } catch (e) {
    run('ROLLBACK');
    throw e;
  }
}

// ===== Stats =====
function getDashboardStats() {
  const productCount = queryOne('SELECT COUNT(*) as c FROM products WHERE active = 1').c;
  const totalIn = queryOne('SELECT COUNT(*) as c FROM inbound_records').c;
  const totalOut = queryOne('SELECT COUNT(*) as c FROM outbound_records').c;

  // 30-day trend: single query instead of 60
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 29);
  const startStr = toLocalDateStr(startDate);
  const endStr = toLocalDateStr(today);

  const dailyRows = queryAll(`
    SELECT date, SUM(quantity) as qty, 'in' as direction
    FROM inbound_records WHERE date >= ? AND date <= ?
    GROUP BY date
    UNION ALL
    SELECT date, SUM(quantity) as qty, 'out' as direction
    FROM outbound_records WHERE date >= ? AND date <= ?
    GROUP BY date
  `, [startStr, endStr, startStr, endStr]);

  const dailyMap = {};
  for (const r of dailyRows) {
    if (!dailyMap[r.date]) dailyMap[r.date] = { inQty: 0, outQty: 0 };
    if (r.direction === 'in') dailyMap[r.date].inQty = r.qty;
    else dailyMap[r.date].outQty = r.qty;
  }

  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toLocalDateStr(d);
    const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    const data = dailyMap[dateStr] || { inQty: 0, outQty: 0 };
    days.push({ label: dayLabel, inQty: data.inQty, outQty: data.outQty });
  }

  const top10 = queryAll(`
    SELECT p.name,
      p.opening_stock + COALESCE(i.total_in, 0) - COALESCE(o.total_out, 0) as stock
    FROM products p
    LEFT JOIN (SELECT product_id, SUM(quantity) as total_in FROM inbound_records GROUP BY product_id) i ON i.product_id = p.id
    LEFT JOIN (SELECT product_id, SUM(quantity) as total_out FROM outbound_records GROUP BY product_id) o ON o.product_id = p.id
    WHERE p.active = 1
    GROUP BY p.id
    HAVING stock > 0
    ORDER BY stock DESC
    LIMIT 10
  `);

  return { productCount, totalIn, totalOut, days, top10 };
}

// ===== Purchase Orders =====
function getPurchaseOrders(source) {
  let sql = 'SELECT * FROM purchase_orders WHERE 1=1';
  const params = [];
  if (source) {
    sql += ' AND source = ?';
    params.push(source);
  }
  sql += ' ORDER BY sort_order, id';
  return queryAll(sql, params);
}

function addPurchaseOrder(data) {
  run(`INSERT INTO purchase_orders (source, receive_date, product_name, spec, unit_price, quantity, unit, amount, remark, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.source || '洋安食堂', data.receive_date || '', data.product_name, data.spec || '',
     data.unit_price || 0, data.quantity || '', data.unit || '', data.amount || 0, data.remark || '', data.sort_order || 0]);
  if (!inTransaction) save();
}

function updatePurchaseOrder(id, data) {
  run(`UPDATE purchase_orders SET source=?, receive_date=?, product_name=?, spec=?, unit_price=?, quantity=?, unit=?, amount=?, remark=?
    WHERE id=?`,
    [data.source, data.receive_date, data.product_name, data.spec, data.unit_price, data.quantity, data.unit, data.amount, data.remark, id]);
  save();
}

function deletePurchaseOrder(id) {
  run('DELETE FROM purchase_orders WHERE id = ?', [id]);
  save();
}

function clearPurchaseOrders(source) {
  if (source && typeof source === 'string' && source.trim()) {
    run('DELETE FROM purchase_orders WHERE source = ?', [source]);
  } else {
    // 拒绝 falsy/空字符串，防止全表误删
    throw new Error('clearPurchaseOrders: source 不能为空');
  }
  if (!inTransaction) save();
}

function deletePurchaseOrdersByDate(source, date) {
  run('DELETE FROM purchase_orders WHERE source = ? AND receive_date = ?', [source, date]);
  if (!inTransaction) save();
}

function getPurchaseOrdersByDate(date) {
  return queryAll(
    `SELECT * FROM purchase_orders WHERE receive_date = ? ORDER BY source, sort_order, id`,
    [date]
  );
}

function getPurchaseHistoryDates(days = 31, sources, excludeSources) {
  let sql = 'SELECT DISTINCT receive_date as date FROM purchase_orders WHERE receive_date IS NOT NULL AND receive_date != \'\'';
  const params = [];
  if (sources && sources.length > 0) {
    sql += ` AND source IN (${sources.map(() => '?').join(',')})`;
    params.push(...sources);
  }
  if (excludeSources && excludeSources.length > 0) {
    sql += ` AND source NOT IN (${excludeSources.map(() => '?').join(',')})`;
    params.push(...excludeSources);
  }
  sql += ' ORDER BY date DESC LIMIT ?';
  params.push(days);
  return queryAll(sql, params);
}

function getLatestReceiveDate() {
  const row = queryOne('SELECT MAX(receive_date) as max_date FROM purchase_orders WHERE receive_date IS NOT NULL AND receive_date != \'\'');
  return row ? row.max_date : null;
}

function cleanOldPurchaseOrders(daysToKeep = 31) {
  const now = new Date();
  // 用本地日期，不用 toISOString（UTC 会差 8 小时）
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToKeep);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`;
  run('DELETE FROM purchase_orders WHERE receive_date < ?', [cutoffStr]);
  save();
}

// ===== Inquiry Items =====
function getInquiryItems(month, category) {
  let sql = 'SELECT * FROM inquiry_items WHERE 1=1';
  const params = [];
  if (month) {
    sql += ' AND month = ?';
    params.push(month);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY category, name';
  return queryAll(sql, params);
}

function searchInquiryItems(keyword, month) {
  let sql = 'SELECT * FROM inquiry_items WHERE name LIKE ?';
  const params = [`%${keyword}%`];
  if (month) {
    sql += ' AND month = ?';
    params.push(month);
  }
  sql += ' ORDER BY category, name, spec LIMIT 100';
  return queryAll(sql, params);
}

function addInquiryItem(data) {
  run(`INSERT INTO inquiry_items (month, category, name, price, unit, spec, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.month, data.category, data.name, data.price || null, data.unit || '', data.spec || '', data.remark || '']);
  save();
}

function importInquiryItems(month, items) {
  // 覆盖式导入：先删除同月份数据
  run('BEGIN');
  try {
    run('DELETE FROM inquiry_items WHERE month = ?', [month]);
    let imported = 0;
    for (const item of items) {
      run(`INSERT INTO inquiry_items (month, category, name, price, unit, spec, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [month, item.category, item.name, item.price || null, item.unit || '', item.spec || '', item.remark || '']);
      imported++;
    }
    run('COMMIT');
    save();
    return { imported };
  } catch (e) {
    run('ROLLBACK');
    throw e;
  }
}

function getInquiryMonths() {
  return queryAll('SELECT DISTINCT month FROM inquiry_items ORDER BY month DESC');
}

function getLatestCategoryForName(name) {
  const row = queryOne(
    'SELECT category FROM inquiry_items WHERE name = ? ORDER BY month DESC LIMIT 1',
    [name]
  );
  return row ? row.category : null;
}

function deleteInquiryItem(id) {
  run('DELETE FROM inquiry_items WHERE id = ?', [id]);
  save();
}

// ===== Remark Memory =====
function getRemarksByName(productName) {
  return queryAll('SELECT DISTINCT remark FROM remark_memory WHERE product_name = ? ORDER BY id DESC LIMIT 10', [productName]);
}

function addRemarkMemory(productName, remark) {
  if (!remark || !remark.trim()) return;
  // Avoid exact duplicates
  const existing = queryOne('SELECT id FROM remark_memory WHERE product_name = ? AND remark = ?', [productName, remark.trim()]);
  if (existing) return;
  run('INSERT INTO remark_memory (product_name, remark) VALUES (?, ?)', [productName, remark.trim()]);
  save();
}

// ===== Settings =====
function getSetting(key) {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
  save();
}

function getAllSettings() {
  const rows = queryAll('SELECT * FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

// ===== Lianhua Items =====
function getLianhuaItems() {
  return queryAll('SELECT * FROM lianhua_items ORDER BY id');
}

function addLianhuaItem(data) {
  run(`INSERT INTO lianhua_items (code, name, unit, spec, price, split_qty, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.code || '', data.name, data.unit || '件', data.spec || '', data.price || 0, data.split_qty || 1, data.remark || '']);
  save();
}

function updateLianhuaItem(id, data) {
  run(`UPDATE lianhua_items SET code=?, name=?, unit=?, spec=?, price=?, split_qty=?, remark=?
    WHERE id=?`,
    [data.code, data.name, data.unit, data.spec, data.price, data.split_qty, data.remark, id]);
  save();
}

function deleteLianhuaItem(id) {
  run('DELETE FROM lianhua_items WHERE id = ?', [id]);
  save();
}

function importLianhuaItems(items) {
  // Clear existing and import
  run('BEGIN');
  try {
    run('DELETE FROM lianhua_items');
    let imported = 0;
    for (const item of items) {
      run(`INSERT INTO lianhua_items (code, name, unit, spec, price, split_qty, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.code || '', item.name, item.unit || '件', item.spec || '', item.price || 0, item.split_qty || 1, item.remark || '']);
      imported++;
    }
    run('COMMIT');
    save();
    return { imported };
  } catch (e) {
    run('ROLLBACK');
    throw e;
  }
}

// ===== Lianhua Orders =====
function getLianhuaOrders(orderDate) {
  let sql = `
    SELECT o.*, i.name, i.code, i.unit, i.spec, i.price, i.split_qty
    FROM lianhua_orders o
    JOIN lianhua_items i ON o.item_id = i.id
    WHERE 1=1
  `;
  const params = [];
  if (orderDate) {
    sql += ' AND o.order_date = ?';
    params.push(orderDate);
  }
  sql += ' ORDER BY o.id';
  return queryAll(sql, params);
}

function addLianhuaOrder(data) {
  run(`INSERT INTO lianhua_orders (item_id, order_date, quantity, amount, remark)
    VALUES (?, ?, ?, ?, ?)`,
    [data.item_id, data.order_date, data.quantity || 0, data.amount || 0, data.remark || '']);
  save();
}

function updateLianhuaOrder(id, data) {
  run(`UPDATE lianhua_orders SET quantity=?, amount=?, remark=? WHERE id=?`,
    [data.quantity, data.amount, data.remark, id]);
  save();
}

function deleteLianhuaOrder(id) {
  run('DELETE FROM lianhua_orders WHERE id = ?', [id]);
  save();
}

// ===== Diagnostics: verify record deletion =====
function recordExists(table, id) {
  const row = queryOne(`SELECT id FROM ${table} WHERE id = ?`, [id]);
  return !!row;
}

function clearLianhuaOrders(orderDate) {
  if (orderDate) {
    run('DELETE FROM lianhua_orders WHERE order_date = ?', [orderDate]);
  } else {
    run('DELETE FROM lianhua_orders');
  }
  save();
}

module.exports = {
  init, save, getDb: () => db, beginTransaction, commit, rollback,
  getProducts, getAllProducts, addProduct, updateProduct, deleteProduct, batchDeleteProducts, restoreProduct,
  getInboundRecords, addInbound, updateInbound, deleteInbound,
  getOutboundRecords, addOutbound, updateOutbound, deleteOutbound,
  getRecipients, addRecipient, updateRecipient, deleteRecipient, updateRecipientOrder,
  getInventory, getProductStockDetail, getInventoryByMonth,
  getExpiryAlerts,
  importProducts, importInbound, importOutbound, importOpeningStock, clearAllData,
  getDashboardStats,
  // Purchase Orders
  getPurchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, clearPurchaseOrders,
  deletePurchaseOrdersByDate, getPurchaseOrdersByDate, getPurchaseHistoryDates, getLatestReceiveDate, cleanOldPurchaseOrders,
  // Inquiry Items
  getInquiryItems, searchInquiryItems, addInquiryItem, updateInquiryItem, importInquiryItems, getInquiryMonths, getLatestCategoryForName, deleteInquiryItem,
  // Remark Memory
  getRemarksByName, addRemarkMemory,
  // Settings
  getSetting, setSetting, getAllSettings,
  // Lianhua
  getLianhuaItems, addLianhuaItem, updateLianhuaItem, deleteLianhuaItem, importLianhuaItems,
  getLianhuaOrders, addLianhuaOrder, updateLianhuaOrder, deleteLianhuaOrder, clearLianhuaOrders,
  // Diagnostic
  recordExists,
};
