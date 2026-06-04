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
  } else {
    db = new SQL.Database();
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
      name TEXT NOT NULL UNIQUE
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
      quantity INTEGER DEFAULT 0,
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
  const buffer = Buffer.from(data);
  fs.writeFileSync(getDbPath(), buffer);
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
  db.run(sql, params);
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
  run('DELETE FROM products WHERE id = ?', [id]);
  save();
}

function batchDeleteProducts(ids) {
  for (const id of ids) {
    run('DELETE FROM products WHERE id = ?', [id]);
  }
  save();
}

// ===== Inbound =====
function getInboundRecords({ startDate, endDate, productId } = {}) {
  let sql = `
    SELECT r.*, p.name as product_name, p.spec, p.unit
    FROM inbound_records r
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
function getOutboundRecords({ startDate, endDate, productId } = {}) {
  let sql = `
    SELECT r.*, p.name as product_name, p.spec, p.unit
    FROM outbound_records r
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
  return queryAll('SELECT * FROM recipients ORDER BY id');
}

function addRecipient(name) {
  run('INSERT OR IGNORE INTO recipients (name) VALUES (?)', [name]);
  save();
}

// ===== Inventory =====
function getInventory() {
  return queryAll(`
    SELECT
      p.id, p.name, p.spec, p.unit, p.shelf_months, p.shelf_days, p.unit_price,
      p.opening_stock,
      COALESCE(SUM(i.quantity), 0) as total_in,
      COALESCE(SUM(o.quantity), 0) as total_out,
      p.opening_stock + COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(o.quantity), 0) as stock
    FROM products p
    LEFT JOIN inbound_records i ON i.product_id = p.id
    LEFT JOIN outbound_records o ON o.product_id = p.id
    WHERE p.active = 1
    GROUP BY p.id
    ORDER BY p.id
  `);
}

function getInventoryByMonth(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const products = queryAll('SELECT * FROM products WHERE active = 1 ORDER BY id');

  return products.map(p => {
    const prevIn = queryOne(
      "SELECT COALESCE(SUM(quantity), 0) as v FROM inbound_records WHERE product_id = ? AND date < ?",
      [p.id, startDate]
    ).v;
    const prevOut = queryOne(
      "SELECT COALESCE(SUM(quantity), 0) as v FROM outbound_records WHERE product_id = ? AND date < ?",
      [p.id, startDate]
    ).v;
    const prevStock = (p.opening_stock || 0) + prevIn - prevOut;

    const monthIn = queryOne(
      "SELECT COALESCE(SUM(quantity), 0) as v FROM inbound_records WHERE product_id = ? AND date >= ? AND date <= ?",
      [p.id, startDate, endDate]
    ).v;
    const monthOut = queryOne(
      "SELECT COALESCE(SUM(quantity), 0) as v FROM outbound_records WHERE product_id = ? AND date >= ? AND date <= ?",
      [p.id, startDate, endDate]
    ).v;

    const dailyIn = queryAll(`
      SELECT substr(date, 9, 2) as day, SUM(quantity) as qty
      FROM inbound_records
      WHERE product_id = ? AND date >= ? AND date <= ?
      GROUP BY substr(date, 9, 2)
    `, [p.id, startDate, endDate]);

    const dailyOut = queryAll(`
      SELECT substr(date, 9, 2) as day, SUM(quantity) as qty
      FROM outbound_records
      WHERE product_id = ? AND date >= ? AND date <= ?
      GROUP BY substr(date, 9, 2)
    `, [p.id, startDate, endDate]);

    const daily = {};
    for (const r of dailyIn) {
      const day = parseInt(r.day);
      if (!daily[day]) daily[day] = { in: 0, out: 0 };
      daily[day].in = r.qty;
    }
    for (const r of dailyOut) {
      const day = parseInt(r.day);
      if (!daily[day]) daily[day] = { in: 0, out: 0 };
      daily[day].out = r.qty;
    }

    const currentStock = prevStock + monthIn - monthOut;

    return {
      ...p,
      prevStock,
      monthIn,
      monthOut,
      currentStock,
      daily,
      hasActivity: monthIn > 0 || monthOut > 0 || currentStock > 0,
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
    WHERE r.expiry_date IS NOT NULL AND r.expiry_date <= ?
      AND p.id IN (
        SELECT p2.id FROM products p2
        LEFT JOIN inbound_records i2 ON i2.product_id = p2.id
        LEFT JOIN outbound_records o2 ON o2.product_id = p2.id
        WHERE p2.active = 1
        GROUP BY p2.id
        HAVING p2.opening_stock + COALESCE(SUM(i2.quantity), 0) - COALESCE(SUM(o2.quantity), 0) > 0
      )
    ORDER BY r.expiry_date ASC
  `, [future]);
}

// ===== Import =====
function importProducts(products) {
  const existing = queryAll('SELECT name FROM products').map(r => r.name);
  let imported = 0, skipped = 0;
  for (const p of products) {
    if (existing.includes(p.name)) { skipped++; continue; }
    run('INSERT INTO products (name, spec, unit, shelf_months, shelf_days, opening_stock) VALUES (?, ?, ?, ?, ?, ?)',
      [p.name, p.spec || '', p.unit || '', p.shelfMonths || 0, p.shelfDays || 0, p.openingStock || 0]);
    imported++;
  }
  save();
  return { imported, skipped };
}

function importOpeningStock(openingStockMap) {
  // openingStockMap: { productName: number }
  for (const [name, stock] of Object.entries(openingStockMap)) {
    run('UPDATE products SET opening_stock = ? WHERE name = ?', [stock, name]);
  }
  save();
}

function importInbound(records) {
  const productMap = {};
  queryAll('SELECT id, name FROM products').forEach(p => { productMap[p.name] = p.id; });
  let imported = 0, skipped = 0;
  for (const r of records) {
    const pid = productMap[r.name];
    if (!pid) { skipped++; continue; }
    run('INSERT INTO inbound_records (product_id, date, quantity, remark, production_date, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
      [pid, r.date, r.quantity, r.remark || '', r.productionDate || null, r.expiryDate || null]);
    imported++;
  }
  save();
  return { imported, skipped };
}

function importOutbound(records) {
  const productMap = {};
  queryAll('SELECT id, name FROM products').forEach(p => { productMap[p.name] = p.id; });
  let imported = 0, skipped = 0;
  for (const r of records) {
    const pid = productMap[r.name];
    if (!pid) { skipped++; continue; }
    run('INSERT INTO outbound_records (product_id, date, quantity, recipient) VALUES (?, ?, ?, ?)',
      [pid, r.date, r.quantity, r.recipient || '']);
    imported++;
  }
  save();
  return { imported, skipped };
}

function clearAllData() {
  run('DELETE FROM outbound_records');
  run('DELETE FROM inbound_records');
  run('DELETE FROM products');
  // Also clear recipients to reset
  run('DELETE FROM recipients');
  // Re-seed default recipients
  for (const name of ['厨房', '小食堂', '面点房', '烧饭', '明档']) {
    run('INSERT OR IGNORE INTO recipients (name) VALUES (?)', [name]);
  }
  save();
}

// ===== Stats =====
function getDashboardStats() {
  const productCount = queryOne('SELECT COUNT(*) as c FROM products WHERE active = 1').c;
  const totalIn = queryOne('SELECT COUNT(*) as c FROM inbound_records').c;
  const totalOut = queryOne('SELECT COUNT(*) as c FROM outbound_records').c;

  const today = new Date();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toLocalDateStr(d);
    const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    const inQty = queryOne("SELECT COALESCE(SUM(quantity), 0) as v FROM inbound_records WHERE date = ?", [dateStr]).v;
    const outQty = queryOne("SELECT COALESCE(SUM(quantity), 0) as v FROM outbound_records WHERE date = ?", [dateStr]).v;
    days.push({ label: dayLabel, inQty, outQty });
  }

  const top10 = queryAll(`
    SELECT p.name,
      p.opening_stock + COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(o.quantity), 0) as stock
    FROM products p
    LEFT JOIN inbound_records i ON i.product_id = p.id
    LEFT JOIN outbound_records o ON o.product_id = p.id
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
  save();
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
  if (source) {
    run('DELETE FROM purchase_orders WHERE source = ?', [source]);
  } else {
    run('DELETE FROM purchase_orders');
  }
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
  run('DELETE FROM inquiry_items WHERE month = ?', [month]);
  let imported = 0;
  for (const item of items) {
    run(`INSERT INTO inquiry_items (month, category, name, price, unit, spec, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [month, item.category, item.name, item.price || null, item.unit || '', item.spec || '', item.remark || '']);
    imported++;
  }
  save();
  return { imported };
}

function getInquiryMonths() {
  return queryAll('SELECT DISTINCT month FROM inquiry_items ORDER BY month DESC');
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
  run('DELETE FROM lianhua_items');
  let imported = 0;
  for (const item of items) {
    run(`INSERT INTO lianhua_items (code, name, unit, spec, price, split_qty, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.code || '', item.name, item.unit || '件', item.spec || '', item.price || 0, item.split_qty || 1, item.remark || '']);
    imported++;
  }
  save();
  return { imported };
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

function clearLianhuaOrders(orderDate) {
  if (orderDate) {
    run('DELETE FROM lianhua_orders WHERE order_date = ?', [orderDate]);
  } else {
    run('DELETE FROM lianhua_orders');
  }
  save();
}

module.exports = {
  init, save, getDb: () => db,
  getProducts, getAllProducts, addProduct, updateProduct, deleteProduct, batchDeleteProducts,
  getInboundRecords, addInbound, updateInbound, deleteInbound,
  getOutboundRecords, addOutbound, updateOutbound, deleteOutbound,
  getRecipients, addRecipient,
  getInventory, getInventoryByMonth,
  getExpiryAlerts,
  importProducts, importInbound, importOutbound, importOpeningStock, clearAllData,
  getDashboardStats,
  // Purchase Orders
  getPurchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, clearPurchaseOrders,
  // Inquiry Items
  getInquiryItems, searchInquiryItems, addInquiryItem, importInquiryItems, getInquiryMonths,
  // Settings
  getSetting, setSetting, getAllSettings,
  // Lianhua
  getLianhuaItems, addLianhuaItem, updateLianhuaItem, deleteLianhuaItem, importLianhuaItems,
  getLianhuaOrders, addLianhuaOrder, updateLianhuaOrder, deleteLianhuaOrder, clearLianhuaOrders,
};
