/**
 * 实验：验证采购页 loading 从 receive_date 改为 created_at 后，跨天数据不再误加载
 *
 * 场景：昨天(7/1)有人录入了采购单，收货日 = 今天(7/2)。
 *       今天用户打开采购页，不应看到这些"昨天创建"的单子。
 *       旧逻辑按 receive_date >= today 会误加载，新逻辑按 created_at 只加载今天。
 *
 * 用法：
 *   1. 关闭 App
 *   2. node test/experiment-cross-day-load.js inject
 *   3. 启动 App → 采购单页 → 看是否出现「实验-」品名 → 不应出现
 *   4. 手动创建今天的采购单 → 切走再回来 → 仍不应出现实验数据
 *   5. 历史采购页按 7/2 收货日可查到实验数据 ← 这是正确的
 *   6. node test/experiment-cross-day-load.js clean
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.env.APPDATA, 'in-out', 'inventory.db');
const RECEIVE_DATE = '2026-07-02';   // 收货日 = 今天
const CREATED_AT   = '2026-07-01 15:30:00'; // 创建时间 = 昨天

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildOrders() {
  const orders = [];

  // ═══ 默认模式：洋安食堂 ═══
  orders.push(
    { source: '洋安食堂厨房', product_name: '实验-猪肉', spec: '斤', unit_price: 15, quantity: '10', unit: '斤', amount: 150 },
    { source: '洋安食堂厨房', product_name: '实验-白菜', spec: '斤', unit_price: 2,  quantity: '20', unit: '斤', amount: 40 },
    { source: '洋安面点房',   product_name: '实验-面粉', spec: '斤', unit_price: 5,  quantity: '30', unit: '斤', amount: 150 },
    { source: '联华',         product_name: '实验-可乐', spec: '500ml', unit_price: 3, quantity: '24', unit: '瓶', amount: 72 },
    { source: '联华',         product_name: '实验-雪碧', spec: '500ml', unit_price: 3, quantity: '24', unit: '瓶', amount: 72 },
  );

  // ═══ 多食堂模式：下涯 / 制杆厂 / 白南山 ═══
  const multi = [
    { c: '下涯',   k: ['实验-鸡蛋', '个', 1, '50', '个', 50], l: ['实验-生抽', '500ml', 8, '5', '瓶', 40] },
    { c: '制杆厂', k: ['实验-土豆', '斤', 2, '30', '斤', 60], l: ['实验-老抽', '500ml', 8, '5', '瓶', 40] },
    { c: '白南山', k: ['实验-豆腐', '斤', 3, '20', '斤', 60], l: ['实验-料酒', '500ml', 6, '5', '瓶', 30] },
  ];
  multi.forEach(({c, k, l}) => {
    orders.push({ source: `${c}-厨房`, product_name: k[0], spec: k[1], unit_price: k[2], quantity: k[3], unit: k[4], amount: k[5] });
    orders.push({ source: `${c}-联华`, product_name: l[0], spec: l[1], unit_price: l[2], quantity: l[3], unit: l[4], amount: l[5] });
  });

  // ═══ 小所模式：7 所 × 厨房 2 样 + 随机 3 所 × 联华 ═══
  const smallCanteens = ['寿昌', '梅城', '大同', '大洋', '洋溪', '三都', '乾潭'];
  const kitchenItems = [
    ['实验-青椒','斤',4], ['实验-红椒','斤',5], ['实验-黄瓜','斤',3], ['实验-番茄','斤',4],
    ['实验-茄子','斤',3], ['实验-豆角','斤',5], ['实验-花菜','斤',4], ['实验-芹菜','斤',3],
    ['实验-韭菜','斤',4], ['实验-菠菜','斤',5], ['实验-萝卜','斤',2], ['实验-冬瓜','斤',2],
    ['实验-南瓜','斤',2], ['实验-苦瓜','斤',3],
  ];
  // 随机 3 所带联华
  const lianhuaSet = new Set();
  while (lianhuaSet.size < 3) lianhuaSet.add(smallCanteens[Math.floor(Math.random() * smallCanteens.length)]);
  const lhItems = [['实验-味精','500g',5], ['实验-鸡精','500g',6], ['实验-盐','500g',2]];

  smallCanteens.forEach((c, ci) => {
    const qty1 = Math.floor(Math.random() * 11);
    const qty2 = Math.floor(Math.random() * 11);
    const it1 = kitchenItems[ci*2], it2 = kitchenItems[ci*2+1];
    orders.push({ source: `${c}-厨房`, product_name: it1[0], spec: it1[1], unit_price: it1[2], quantity: qty1||'', unit: it1[1], amount: qty1 ? Math.round(it1[2]*qty1*100)/100 : 0 });
    orders.push({ source: `${c}-厨房`, product_name: it2[0], spec: it2[1], unit_price: it2[2], quantity: qty2||'', unit: it2[1], amount: qty2 ? Math.round(it2[2]*qty2*100)/100 : 0 });
    if (lianhuaSet.has(c)) {
      const li = [...lianhuaSet].indexOf(c) % lhItems.length;
      const lh = lhItems[li];
      const lhQty = Math.floor(Math.random()*10)+1;
      orders.push({ source: `${c}-联华`, product_name: lh[0], spec: lh[1], unit_price: lh[2], quantity: String(lhQty), unit: lh[1], amount: Math.round(lh[2]*lhQty*100)/100 });
    }
  });

  return orders.map((o, i) => ({
    ...o, receive_date: RECEIVE_DATE, created_at: CREATED_AT,
    remark: `实验-${o.source}`, sort_order: i,
  }));
}

// ═══════════════════════════════════════════════════════════
async function main() {
  const cmd = process.argv[2];
  if (!fs.existsSync(DB_PATH)) { console.error('❌ DB 不存在:', DB_PATH); process.exit(1); }

  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  if (cmd === 'inject') {
    const orders = buildOrders();
    console.log(`📦 ${orders.length} 条 | created_at: ${CREATED_AT} | receive_date: ${RECEIVE_DATE}\n`);

    // 写入
    const stmt = db.prepare(`INSERT INTO purchase_orders (source,receive_date,product_name,spec,unit_price,quantity,unit,amount,remark,sort_order,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    orders.forEach(o => stmt.run([o.source,o.receive_date,o.product_name,o.spec,o.unit_price,o.quantity,o.unit,o.amount,o.remark,o.sort_order,o.created_at]));
    stmt.free();

    // 设 last_purchase_date = 今天，触发采购页 shouldLoadData=true
    const today = todayStr();
    const hasSetting = db.exec("SELECT value FROM settings WHERE key='last_purchase_date'");
    if (hasSetting.length && hasSetting[0].values.length)
      db.run("UPDATE settings SET value=? WHERE key='last_purchase_date'", [today]);
    else
      db.run("INSERT OR REPLACE INTO settings (key,value) VALUES ('last_purchase_date',?)", [today]);

    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
    db.close();

    // 分组统计
    const byMode = { '默认': [], '多食堂': [], '小所': [] };
    orders.forEach(o => {
      if (['洋安食堂厨房','洋安面点房','联华'].includes(o.source)) byMode['默认'].push(`${o.source}:${o.product_name}`);
      else if (['下涯-厨房','下涯-联华','制杆厂-厨房','制杆厂-联华','白南山-厨房','白南山-联华'].includes(o.source)) byMode['多食堂'].push(`${o.source}:${o.product_name}`);
      else byMode['小所'].push(`${o.source}:${o.product_name}`);
    });
    Object.entries(byMode).forEach(([m, items]) => { if (items.length) console.log(`${m}: ${items.join(', ')}`); });

    console.log(`\n✅ 已注入。last_purchase_date = ${today}`);
    console.log('\n🧪 验证：');
    console.log('  1. 启动 App → 采购单页 → 不应出现「实验-」前缀的品名');
    console.log('  2. 手动创建今天的采购单 → 切走再回来 → 仍无实验数据');
    console.log('  3. 历史采购页 → 按 7/2 收货日应能查到实验数据（这是对的）');
    console.log('\n🧹 node test/experiment-cross-day-load.js clean');

  } else if (cmd === 'clean') {
    db.run("DELETE FROM purchase_orders WHERE product_name LIKE '实验-%'");
    // 恢复 last_purchase_date 为今天（用户可能在测试中导出重置了它）
    const today = todayStr();
    db.run("INSERT OR REPLACE INTO settings (key,value) VALUES ('last_purchase_date',?)", [today]);
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
    const remaining = db.exec("SELECT COUNT(*) as c FROM purchase_orders WHERE product_name LIKE '实验-%'");
    db.close();
    console.log(`✅ 清理完毕，残留 ${remaining[0].values[0][0]} 条`);

  } else if (cmd === 'check') {
    const rows = db.exec("SELECT source,product_name,receive_date,created_at FROM purchase_orders WHERE product_name LIKE '实验-%' ORDER BY source,sort_order");
    db.close();
    if (rows.length && rows[0].values.length) {
      const map = {};
      rows[0].values.forEach(r => { if(!map[r[0]])map[r[0]]=[]; map[r[0]].push(`${r[1]} (recv=${r[2]} created=${r[3]})`); });
      Object.entries(map).forEach(([s,items]) => { console.log(`${s}:`); items.forEach(i=>console.log(`  ${i}`)); });
      console.log(`\n共 ${rows[0].values.length} 条`);
    } else console.log('无实验数据');
  } else {
    console.log('用法: node test/experiment-cross-day-load.js inject|clean|check');
    db.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
