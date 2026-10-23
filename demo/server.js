// Demo local del ERP Floreria. Sin dependencias: Node 22+ (node:sqlite) y node:http.
// Uso: node server.js  ->  http://localhost:3000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const db = new DatabaseSync(process.env.DB_FILE || ':memory:');

db.exec(`
CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT, role TEXT);
CREATE TABLE items(id INTEGER PRIMARY KEY, sku TEXT UNIQUE, name TEXT, kind TEXT, unit TEXT, price REAL DEFAULT 0, stock REAL DEFAULT 0, min_stock REAL DEFAULT 0, created_by INTEGER);
CREATE TABLE recipe_lines(product_id INTEGER, supply_id INTEGER, qty REAL);
CREATE TABLE movements(id INTEGER PRIMARY KEY, item_id INTEGER, qty REAL, type TEXT, ref TEXT, user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sales(id INTEGER PRIMARY KEY, source TEXT, seller_id INTEGER, customer TEXT, total REAL, status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sale_lines(sale_id INTEGER, item_id INTEGER, qty REAL, price REAL);
CREATE TABLE payments(id INTEGER PRIMARY KEY, sale_id INTEGER, method TEXT, amount REAL, reference TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE production_orders(id INTEGER PRIMARY KEY, sale_id INTEGER, product_id INTEGER, qty REAL, status TEXT DEFAULT 'PENDING', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE waste(id INTEGER PRIMARY KEY, item_id INTEGER, qty REAL, reason TEXT, user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE goals(id INTEGER PRIMARY KEY, seller_id INTEGER, period TEXT, target REAL);
CREATE TABLE cash_sessions(id INTEGER PRIMARY KEY, opened_by INTEGER, opening_float REAL, opened_at TEXT DEFAULT CURRENT_TIMESTAMP, closed_at TEXT, counted REAL, expected REAL);
CREATE TABLE shopify_events(webhook_id TEXT PRIMARY KEY, topic TEXT, status TEXT, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE audit_log(id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

const q = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const tx = (fn) => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const month = () => new Date().toISOString().slice(0, 7);

// ---------- seed ----------
[['Ana (Administracion)', 'ADMIN'], ['Luis (Ventas)', 'SALES'], ['Marta (Ventas)', 'SALES'], ['Carlos (Produccion)', 'PRODUCTION']]
  .forEach(([n, r]) => run('INSERT INTO users(name,role) VALUES(?,?)', n, r));
const supplies = [
  ['ROSA-R', 'Rosa roja', 'tallo', 0.8, 300, 60], ['ROSA-B', 'Rosa blanca', 'tallo', 0.8, 120, 40],
  ['GIRA', 'Girasol', 'tallo', 1.5, 90, 30], ['LIRIO', 'Lirio', 'tallo', 1.8, 60, 20],
  ['FOLL', 'Follaje', 'rama', 0.3, 200, 50], ['PAPEL', 'Papel kraft', 'pliego', 0.5, 100, 30],
  ['LISTON', 'Liston', 'metro', 0.4, 150, 40], ['CAJA', 'Caja de regalo', 'unidad', 4, 25, 10],
];
supplies.forEach(([s, n, u, p, st, m]) => run("INSERT INTO items(sku,name,kind,unit,price,stock,min_stock) VALUES(?,?,'SUPPLY',?,?,?,?)", s, n, u, p, st, m));
[['PELUCHE', 'Peluche oso', 25, 15], ['CHOCO', 'Caja de chocolates', 18, 20]]
  .forEach(([s, n, p, st]) => run("INSERT INTO items(sku,name,kind,unit,price,stock,min_stock) VALUES(?,?,'RESALE','unidad',?,?,5)", s, n, p, st));
const supId = (sku) => one('SELECT id FROM items WHERE sku=?', sku).id;
const addProduct = (sku, name, price, lines, by = 1) => {
  const id = Number(run("INSERT INTO items(sku,name,kind,unit,price,created_by) VALUES(?,?,'PRODUCT','unidad',?,?)", sku, name, price, by).lastInsertRowid);
  lines.forEach(([s, qty]) => run('INSERT INTO recipe_lines VALUES(?,?,?)', id, typeof s === 'number' ? s : supId(s), qty));
  return id;
};
addProduct('RAMO-12R', 'Ramo 12 rosas rojas', 85, [['ROSA-R', 12], ['FOLL', 3], ['PAPEL', 1], ['LISTON', 1]]);
addProduct('RAMO-GIRA', 'Ramo girasoles x6', 70, [['GIRA', 6], ['FOLL', 2], ['PAPEL', 1], ['LISTON', 1]]);
addProduct('CAJA-ROSAS', 'Caja de rosas blancas', 120, [['ROSA-B', 18], ['CAJA', 1], ['FOLL', 2]]);
addProduct('LIRIOS', 'Arreglo de lirios', 95, [['LIRIO', 8], ['FOLL', 4], ['PAPEL', 1], ['LISTON', 2]]);
db.exec("INSERT INTO movements(item_id,qty,type,ref,user_id) SELECT id, stock, 'PURCHASE_IN', 'Stock inicial', 1 FROM items WHERE kind<>'PRODUCT'");
run('INSERT INTO goals(seller_id,period,target) VALUES(2,?,3000)', month());
run('INSERT INTO goals(seller_id,period,target) VALUES(3,?,2500)', month());
run('INSERT INTO cash_sessions(opened_by,opening_float) VALUES(2,200)');

// ---------- dominio ----------
const stockMove = (itemId, qty, type, ref, userId) => {
  const it = one('SELECT name,stock FROM items WHERE id=?', itemId);
  if (!it) fail(404, 'Item no existe');
  if (it.stock + qty < 0) fail(409, `Stock insuficiente de "${it.name}" (hay ${it.stock}, se necesitan ${-qty})`);
  run('UPDATE items SET stock=stock+? WHERE id=?', qty, itemId);
  run('INSERT INTO movements(item_id,qty,type,ref,user_id) VALUES(?,?,?,?,?)', itemId, qty, type, ref, userId);
};
const paidOf = (saleId) => one('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE sale_id=?', saleId).s;
const refreshStatus = (saleId) => {
  const s = one('SELECT total,status FROM sales WHERE id=?', saleId);
  if (s.status === 'CANCELLED' || s.status === 'PENDING_PAYMENT') return;
  const p = paidOf(saleId);
  run('UPDATE sales SET status=? WHERE id=?', p >= s.total ? 'PAID' : p > 0 ? 'PARTIAL' : 'UNPAID', saleId);
};
// Descuenta reventa / crea comandas de produccion de una venta.
const fulfill = (saleId, userId, type) => {
  for (const l of q('SELECT l.*, i.kind, i.name FROM sale_lines l JOIN items i ON i.id=l.item_id WHERE sale_id=?', saleId)) {
    if (l.kind === 'RESALE') stockMove(l.item_id, -l.qty, type, `Venta #${saleId}`, userId);
    if (l.kind === 'PRODUCT') run('INSERT INTO production_orders(sale_id,product_id,qty) VALUES(?,?,?)', saleId, l.item_id, l.qty);
  }
};
const createSale = ({ source, sellerId, customer, lines, payments, status, userId }) => {
  if (!lines?.length) fail(400, 'La venta no tiene lineas');
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
  const id = Number(run('INSERT INTO sales(source,seller_id,customer,total,status) VALUES(?,?,?,?,?)', source, sellerId, customer || 'Mostrador', total, status || 'UNPAID').lastInsertRowid);
  lines.forEach((l) => run('INSERT INTO sale_lines VALUES(?,?,?,?)', id, l.item_id, l.qty, l.price));
  (payments || []).filter((p) => p.amount > 0).forEach((p) => run('INSERT INTO payments(sale_id,method,amount,reference) VALUES(?,?,?,?)', id, p.method, p.amount, p.reference || null));
  return id;
};

// ---------- permisos ----------
const can = (u, ...roles) => { if (!roles.includes(u.role)) fail(403, `El rol ${u.role} no tiene permiso`); };

// ---------- rutas ----------
const routes = {
  'GET /api/users': () => q('SELECT * FROM users'),
  'GET /api/items': () => q(`SELECT i.*, (SELECT group_concat(s.name||' x'||printf('%g',r.qty), ', ') FROM recipe_lines r JOIN items s ON s.id=r.supply_id WHERE r.product_id=i.id) recipe FROM items i ORDER BY kind, name`),
  'GET /api/movements': () => q('SELECT m.*, i.name item, u.name user FROM movements m JOIN items i ON i.id=m.item_id LEFT JOIN users u ON u.id=m.user_id ORDER BY m.id DESC LIMIT 60'),
  'POST /api/purchase': (b, u) => { can(u, 'ADMIN'); if (!(b.qty > 0)) fail(400, 'Cantidad invalida'); return tx(() => { stockMove(b.item_id, +b.qty, 'PURCHASE_IN', b.ref || 'Compra', u.id); return { ok: true }; }); },
  'POST /api/products': (b, u) => { // arreglo nuevo al vuelo
    can(u, 'ADMIN', 'SALES');
    if (!b.name?.trim() || !(b.price > 0) || !b.recipe?.length) fail(400, 'Nombre, precio y receta son obligatorios');
    if (b.recipe.some((r) => !(r.qty > 0) || !one("SELECT 1 FROM items WHERE id=? AND kind='SUPPLY'", r.supply_id))) fail(400, 'Receta invalida');
    return tx(() => {
      const sku = 'ARR-' + Date.now().toString(36).toUpperCase();
      const id = addProduct(sku, b.name, +b.price, b.recipe.map((r) => [+r.supply_id, +r.qty]), u.id);
      run('INSERT INTO audit_log(user_id,action,detail) VALUES(?,?,?)', u.id, 'CREATE_PRODUCT', b.name);
      return { id };
    });
  },
  'POST /api/sales': (b, u) => { // venta POS
    can(u, 'ADMIN', 'SALES');
    if (!one('SELECT id FROM cash_sessions WHERE closed_at IS NULL')) fail(409, 'La caja esta cerrada. Abrela primero.');
    // El precio sale de la base, nunca del cliente.
    const lines = (b.lines || []).map((l) => {
      const it = one("SELECT id, price FROM items WHERE id=? AND kind<>'SUPPLY'", l.item_id);
      if (!it) fail(400, 'Producto invalido');
      if (!(l.qty > 0) || !Number.isInteger(l.qty)) fail(400, 'Cantidad invalida');
      return { item_id: it.id, qty: l.qty, price: it.price };
    });
    const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
    const paying = (b.payments || []).reduce((a, p) => a + (+p.amount || 0), 0);
    if (paying < 0 || paying > total + 0.001) fail(400, 'El pago no puede superar el total');
    if (total - paying > 0.001 && !b.customer?.trim()) fail(400, 'Indica el cliente: la venta queda con saldo pendiente');
    return tx(() => {
      const id = createSale({ source: 'POS', sellerId: u.id, customer: b.customer?.trim(), lines, payments: b.payments, userId: u.id });
      refreshStatus(id);
      fulfill(id, u.id, 'SALE_OUT');
      return { id, status: one('SELECT status FROM sales WHERE id=?', id).status };
    });
  },
  'GET /api/sales': () => q(`SELECT s.*, u.name seller, COALESCE((SELECT SUM(amount) FROM payments WHERE sale_id=s.id),0) paid,
    (SELECT group_concat(i.name||' x'||printf('%g',l.qty), ', ') FROM sale_lines l JOIN items i ON i.id=l.item_id WHERE l.sale_id=s.id) detail
    FROM sales s LEFT JOIN users u ON u.id=s.seller_id ORDER BY s.id DESC LIMIT 50`),
  'POST /api/payments': (b, u) => { // cobranza
    can(u, 'ADMIN', 'SALES');
    return tx(() => {
      const s = one('SELECT * FROM sales WHERE id=?', b.sale_id);
      if (!s) fail(404, 'Venta no existe');
      if (!(b.amount > 0)) fail(400, 'Monto invalido');
      const pending = s.total - paidOf(s.id);
      if (b.amount > pending + 0.001) fail(400, `El saldo pendiente es ${pending.toFixed(2)}`);
      run('INSERT INTO payments(sale_id,method,amount,reference) VALUES(?,?,?,?)', s.id, b.method, b.amount, b.reference || null);
      refreshStatus(s.id);
      return { ok: true };
    });
  },
  'GET /api/receivables': () => q(`SELECT s.id, s.customer, s.total, s.created_at, s.total-COALESCE((SELECT SUM(amount) FROM payments WHERE sale_id=s.id),0) pending
    FROM sales s WHERE s.status IN ('UNPAID','PARTIAL') ORDER BY s.id`),
  'GET /api/production': () => q(`SELECT o.*, i.name product, s.customer,
    (SELECT group_concat(x.name||' x'||printf('%g',r.qty*o.qty), ', ') FROM recipe_lines r JOIN items x ON x.id=r.supply_id WHERE r.product_id=o.product_id) needs
    FROM production_orders o JOIN items i ON i.id=o.product_id JOIN sales s ON s.id=o.sale_id ORDER BY o.id DESC`),
  'POST /api/production/status': (b, u) => {
    can(u, 'ADMIN', 'PRODUCTION');
    return tx(() => {
      const o = one('SELECT * FROM production_orders WHERE id=?', b.id);
      if (!o) fail(404, 'Orden no existe');
      const next = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'DONE' }[o.status];
      if (b.status !== next) fail(409, 'La comanda ya cambio de estado. Actualiza la pantalla.');
      if (b.status === 'DONE' && o.status !== 'DONE')
        for (const r of q('SELECT * FROM recipe_lines WHERE product_id=?', o.product_id)) stockMove(r.supply_id, -r.qty * o.qty, 'PRODUCTION_CONSUME', `Comanda #${o.id}`, u.id);
      run('UPDATE production_orders SET status=? WHERE id=?', b.status, o.id);
      return { ok: true };
    });
  },
  'POST /api/waste': (b, u) => {
    can(u, 'ADMIN', 'PRODUCTION');
    if (!(b.qty > 0)) fail(400, 'Cantidad invalida');
    return tx(() => {
      stockMove(b.item_id, -b.qty, 'WASTE', b.reason, u.id);
      run('INSERT INTO waste(item_id,qty,reason,user_id) VALUES(?,?,?,?)', b.item_id, b.qty, b.reason, u.id);
      return { ok: true };
    });
  },
  'GET /api/waste': () => q('SELECT w.*, i.name item, u.name user FROM waste w JOIN items i ON i.id=w.item_id LEFT JOIN users u ON u.id=w.user_id ORDER BY w.id DESC'),
  'GET /api/cash': () => {
    const s = one('SELECT * FROM cash_sessions ORDER BY id DESC LIMIT 1');
    const cash = s ? one(`SELECT COALESCE(SUM(amount),0) v FROM payments WHERE method='EFECTIVO' AND created_at>=?`, s.opened_at).v : 0;
    return { session: s, cash_in: cash, expected: s ? s.opening_float + cash : 0 };
  },
  'POST /api/cash/open': (b, u) => {
    can(u, 'ADMIN', 'SALES');
    if (one('SELECT id FROM cash_sessions WHERE closed_at IS NULL')) fail(409, 'Ya hay una caja abierta');
    run('INSERT INTO cash_sessions(opened_by,opening_float) VALUES(?,?)', u.id, +b.opening_float || 0);
    return { ok: true };
  },
  'POST /api/cash/close': (b, u) => {
    can(u, 'ADMIN', 'SALES');
    const s = one('SELECT * FROM cash_sessions WHERE closed_at IS NULL');
    if (!s) fail(409, 'No hay caja abierta');
    const cash = one(`SELECT COALESCE(SUM(amount),0) v FROM payments WHERE method='EFECTIVO' AND created_at>=?`, s.opened_at).v;
    const expected = s.opening_float + cash;
    run('UPDATE cash_sessions SET closed_at=CURRENT_TIMESTAMP, counted=?, expected=? WHERE id=?', +b.counted, expected, s.id);
    return { expected, counted: +b.counted, difference: +b.counted - expected };
  },
  'GET /api/reports': () => {
    const ok = "s.status IN ('PAID','PARTIAL','UNPAID')";
    return {
      top_products: q(`SELECT i.name, SUM(l.qty) qty, SUM(l.qty*l.price) revenue FROM sale_lines l JOIN sales s ON s.id=l.sale_id JOIN items i ON i.id=l.item_id WHERE ${ok} GROUP BY i.id ORDER BY qty DESC LIMIT 8`),
      by_seller: q(`SELECT u.name, COUNT(*) sales, SUM(s.total) total FROM sales s JOIN users u ON u.id=s.seller_id WHERE ${ok} GROUP BY u.id ORDER BY total DESC`),
      goals: q(`SELECT u.name, g.target, g.period, COALESCE((SELECT SUM(total) FROM sales WHERE seller_id=g.seller_id AND status IN ('PAID','PARTIAL','UNPAID') AND substr(created_at,1,7)=g.period),0) sold FROM goals g JOIN users u ON u.id=g.seller_id`),
      by_source: q(`SELECT s.source, COUNT(*) sales, SUM(s.total) total FROM sales s WHERE ${ok} GROUP BY s.source`),
      income: one(`SELECT COALESCE(SUM(amount),0) collected, (SELECT COALESCE(SUM(total),0) FROM sales WHERE status IN ('UNPAID','PARTIAL')) - (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN sales s ON s.id=p.sale_id WHERE s.status IN ('UNPAID','PARTIAL')) receivable FROM payments`),
      low_stock: q("SELECT name, stock, min_stock, unit FROM items WHERE kind<>'PRODUCT' AND stock<=min_stock ORDER BY stock"),
    };
  },
  'POST /api/goals': (b, u) => {
    can(u, 'ADMIN');
    if (!(b.target > 0)) fail(400, 'Monto invalido');
    run('DELETE FROM goals WHERE seller_id=? AND period=?', b.seller_id, b.period || month());
    run('INSERT INTO goals(seller_id,period,target) VALUES(?,?,?)', b.seller_id, b.period || month(), +b.target);
    return { ok: true };
  },
  // Simulador de webhooks de Shopify: orders/create registra; orders/paid descuenta stock. Idempotente por webhook_id.
  'POST /api/shopify/webhook': (b) => {
    if (one('SELECT 1 FROM shopify_events WHERE webhook_id=?', b.webhook_id)) return { duplicated: true };
    return tx(() => {
      const note = (st, n) => run('INSERT INTO shopify_events(webhook_id,topic,status,note) VALUES(?,?,?,?)', b.webhook_id, b.topic, st, n);
      const find = (sku) => one('SELECT * FROM items WHERE sku=?', sku);
      if (b.topic === 'orders/create') {
        const unmapped = b.line_items.find((l) => !find(l.sku));
        if (unmapped) { note('NEEDS_ATTENTION', `SKU sin mapeo: ${unmapped.sku}`); return { status: 'NEEDS_ATTENTION' }; }
        const id = createSale({ source: 'SHOPIFY', sellerId: null, customer: b.customer, status: 'PENDING_PAYMENT', lines: b.line_items.map((l) => ({ item_id: find(l.sku).id, qty: l.qty, price: find(l.sku).price })), userId: 1 });
        run('UPDATE sales SET customer=? WHERE id=?', `${b.customer} (Shopify ${b.shopify_order})`, id);
        note('OK', `Pedido ${b.shopify_order} -> venta #${id} (pendiente de pago, sin tocar stock)`);
        return { sale_id: id };
      }
      if (b.topic === 'orders/paid') {
        const s = one("SELECT * FROM sales WHERE source='SHOPIFY' AND customer LIKE ? AND status='PENDING_PAYMENT'", `%${b.shopify_order})`);
        if (!s) { note('NEEDS_ATTENTION', `orders/paid sin pedido previo: ${b.shopify_order}`); return { status: 'NEEDS_ATTENTION' }; }
        run('INSERT INTO payments(sale_id,method,amount,reference) VALUES(?,?,?,?)', s.id, 'SHOPIFY', s.total, b.shopify_order);
        run("UPDATE sales SET status='PAID' WHERE id=?", s.id);
        fulfill(s.id, 1, 'SHOPIFY_OUT');
        note('OK', `Pedido ${b.shopify_order} pagado: stock descontado / comandas creadas`);
        return { sale_id: s.id, status: 'PAID' };
      }
      fail(400, 'Topic no soportado');
    });
  },
  'GET /api/shopify/events': () => q('SELECT * FROM shopify_events ORDER BY created_at DESC, rowid DESC LIMIT 30'),
};

// ---------- servidor ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
  if (url.pathname.startsWith('/api/')) {
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return send(404, { error: 'No encontrado' });
    try {
      let body = {};
      if (req.method === 'POST') { let raw = ''; for await (const c of req) raw += c; body = raw ? JSON.parse(raw) : {}; }
      const user = one('SELECT * FROM users WHERE id=?', Number(req.headers['x-user'])) || one('SELECT * FROM users WHERE id=1');
      return send(200, handler(body, user));
    } catch (e) {
      return send(e.status || 500, { error: e.message });
    }
  }
  const file = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) return send(404, 'No encontrado', 'text/plain');
  send(200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
}).listen(PORT, () => console.log(`ERP Floreria (demo) en http://localhost:${PORT}`));
