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
-- unit = unidad base en la que se cuenta el stock y se escriben las recetas (tallo, kg, metro...).
-- decimals = si la unidad base admite fracciones (kg, metro). price = venta, cost = costo por unidad base.
CREATE TABLE items(id INTEGER PRIMARY KEY, sku TEXT UNIQUE, name TEXT, kind TEXT, unit TEXT, decimals INTEGER DEFAULT 0, price REAL DEFAULT 0, cost REAL DEFAULT 0, stock REAL DEFAULT 0, min_stock REAL DEFAULT 0, photo TEXT, created_by INTEGER);
-- Presentaciones de compra: "Paquete x25" = 25 unidades base.
CREATE TABLE packagings(id INTEGER PRIMARY KEY, item_id INTEGER, name TEXT, factor REAL);
CREATE TABLE sheets(id INTEGER PRIMARY KEY, kind TEXT, note TEXT, lines INTEGER, value REAL, user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE recipe_lines(product_id INTEGER, supply_id INTEGER, qty REAL);
CREATE TABLE movements(id INTEGER PRIMARY KEY, item_id INTEGER, qty REAL, type TEXT, ref TEXT, user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sales(id INTEGER PRIMARY KEY, source TEXT, seller_id INTEGER, customer TEXT, total REAL, status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sale_lines(sale_id INTEGER, item_id INTEGER, qty REAL, price REAL);
CREATE TABLE payments(id INTEGER PRIMARY KEY, sale_id INTEGER, method TEXT, amount REAL, reference TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE production_orders(id INTEGER PRIMARY KEY, sale_id INTEGER, product_id INTEGER, qty REAL, status TEXT DEFAULT 'PENDING', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE waste(id INTEGER PRIMARY KEY, sheet_id INTEGER, item_id INTEGER, qty REAL, reason TEXT, value REAL, user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
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
// [sku, nombre, tipo, unidad base, decimales, precio venta, costo por unidad base, stock, minimo, [presentacion, factor]]
const seedItems = [
  ['ROSA-R', 'Rosa roja', 'SUPPLY', 'tallo', 0, 0, 0.8, 300, 60, ['Paquete x25', 25]],
  ['ROSA-B', 'Rosa blanca', 'SUPPLY', 'tallo', 0, 0, 0.8, 120, 40, ['Paquete x25', 25]],
  ['GIRA', 'Girasol', 'SUPPLY', 'tallo', 0, 0, 1.5, 90, 30, ['Paquete x10', 10]],
  ['LIRIO', 'Lirio', 'SUPPLY', 'tallo', 0, 0, 1.8, 60, 20, ['Paquete x10', 10]],
  ['FOLL', 'Follaje', 'SUPPLY', 'rama', 0, 0, 0.3, 200, 50, ['Atado x20', 20]],
  ['MUSGO', 'Musgo preservado', 'SUPPLY', 'kg', 1, 0, 12, 4.5, 1, ['Saco 5 kg', 5]],
  ['PAPEL', 'Papel kraft', 'SUPPLY', 'pliego', 0, 0, 0.5, 100, 30, ['Resma x50', 50]],
  ['LISTON', 'Liston', 'SUPPLY', 'metro', 1, 0, 0.4, 150, 40, ['Rollo 50 m', 50]],
  ['CAJA', 'Caja de regalo', 'SUPPLY', 'unidad', 0, 0, 4, 25, 10, ['Bulto x12', 12]],
  ['PELUCHE', 'Peluche oso', 'RESALE', 'unidad', 0, 25, 12, 15, 5, ['Caja x6', 6]],
  ['CHOCO', 'Caja de chocolates', 'RESALE', 'unidad', 0, 18, 9, 20, 5, ['Caja x12', 12]],
  ['CHOCO-KG', 'Chocolates a granel', 'RESALE', 'kg', 1, 60, 32, 3, 0.5, ['Bolsa 1 kg', 1]],
];
seedItems.forEach(([s, n, k, u, d, p, c, st, m, pk]) => {
  const id = run('INSERT INTO items(sku,name,kind,unit,decimals,price,cost,stock,min_stock) VALUES(?,?,?,?,?,?,?,?,?)', s, n, k, u, d, p, c, st, m).lastInsertRowid;
  run('INSERT INTO packagings(item_id,name,factor) VALUES(?,?,?)', id, pk[0], pk[1]);
});
const supId = (sku) => one('SELECT id FROM items WHERE sku=?', sku).id;
const addProduct = (sku, name, price, lines, by = 1) => {
  const id = Number(run("INSERT INTO items(sku,name,kind,unit,price,created_by) VALUES(?,?,'PRODUCT','unidad',?,?)", sku, name, price, by).lastInsertRowid);
  lines.forEach(([s, qty]) => run('INSERT INTO recipe_lines VALUES(?,?,?)', id, typeof s === 'number' ? s : supId(s), qty));
  return id;
};
addProduct('RAMO-12R', 'Ramo 12 rosas rojas', 85, [['ROSA-R', 12], ['FOLL', 3], ['PAPEL', 1], ['LISTON', 1]]);
addProduct('RAMO-GIRA', 'Ramo girasoles x6', 70, [['GIRA', 6], ['FOLL', 2], ['PAPEL', 1], ['LISTON', 1]]);
addProduct('CAJA-ROSAS', 'Caja de rosas blancas', 120, [['ROSA-B', 18], ['CAJA', 1], ['FOLL', 2]]);
addProduct('LIRIOS', 'Arreglo de lirios', 95, [['LIRIO', 8], ['FOLL', 4], ['PAPEL', 1], ['LISTON', 1.5]]);
addProduct('CAJA-MUSGO', 'Caja con musgo y rosas', 110, [['ROSA-R', 9], ['MUSGO', 0.25], ['CAJA', 1]]);
db.exec("INSERT INTO movements(item_id,qty,type,ref,user_id) SELECT id, stock, 'PURCHASE_IN', 'Stock inicial', 1 FROM items WHERE kind<>'PRODUCT'");
run('INSERT INTO goals(seller_id,period,target) VALUES(2,?,3000)', month());
run('INSERT INTO goals(seller_id,period,target) VALUES(3,?,2500)', month());
run('INSERT INTO cash_sessions(opened_by,opening_float) VALUES(2,200)');

// ---------- dominio ----------
const stockMove = (itemId, qty, type, ref, userId) => {
  const it = one('SELECT name,stock FROM items WHERE id=?', itemId);
  if (!it) fail(404, 'Item no existe');
  if (it.stock + qty < 0) fail(409, `Stock insuficiente de "${it.name}" (hay ${it.stock}, se necesitan ${-qty})`);
  run('UPDATE items SET stock=round(stock+?,3) WHERE id=?', qty, itemId);
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

// ---------- catalogo y planillas ----------
const KINDS = ['SUPPLY', 'PRODUCT', 'RESALE'];
const qtyOk = (it, qty) => it.decimals || Math.abs(qty - Math.round(qty)) < 1e-9;
const saveCatalogRow = (r, u) => {
  const name = String(r.name || '').trim();
  if (!name) fail(400, 'Cada fila necesita nombre');
  if (!KINDS.includes(r.kind)) fail(400, `Tipo invalido en "${name}"`);
  const unit = r.kind === 'PRODUCT' ? 'unidad' : String(r.unit || '').trim();
  if (!unit) fail(400, `Falta la unidad base de "${name}"`);
  for (const f of ['price', 'cost', 'min_stock']) if (!(+r[f] >= 0)) fail(400, `Valor invalido (${f}) en "${name}"`);
  if (r.kind !== 'SUPPLY' && !(+r.price > 0)) fail(400, `"${name}" se vende: necesita precio de venta`);
  const packs = (r.packagings || []).filter((p) => String(p.name || '').trim());
  if (packs.some((p) => !(+p.factor > 0))) fail(400, `Factor de presentacion invalido en "${name}"`);
  const sku = String(r.sku || '').trim().toUpperCase() || name.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]+/g, '-').slice(0, 12) + '-' + Date.now().toString(36).slice(-3).toUpperCase();
  const dup = one('SELECT id FROM items WHERE sku=? AND id<>?', sku, r.id || 0);
  if (dup) fail(400, `El SKU ${sku} ya existe`);
  const vals = [sku, name, r.kind, unit, r.decimals ? 1 : 0, +r.price, +r.cost, +r.min_stock];
  let id = r.id;
  if (id) {
    const cur = one('SELECT kind, stock FROM items WHERE id=?', id);
    if (!cur) fail(404, 'Item no existe');
    if (cur.kind !== r.kind && cur.stock) fail(400, `No se puede cambiar el tipo de "${name}" con stock`);
    run('UPDATE items SET sku=?,name=?,kind=?,unit=?,decimals=?,price=?,cost=?,min_stock=? WHERE id=?', ...vals, id);
  } else {
    id = Number(run('INSERT INTO items(sku,name,kind,unit,decimals,price,cost,min_stock,created_by) VALUES(?,?,?,?,?,?,?,?,?)', ...vals, u.id).lastInsertRowid);
  }
  run('DELETE FROM packagings WHERE item_id=?', id);
  packs.forEach((p) => run('INSERT INTO packagings(item_id,name,factor) VALUES(?,?,?)', id, String(p.name).trim(), +p.factor));
  // Foto: imagen ya reducida en el navegador (en la app final: archivo en /media).
  if (r.photo !== undefined) {
    if (r.photo && (!/^data:image\/(jpeg|png|webp);base64,/.test(r.photo) || r.photo.length > 1_500_000)) fail(400, `Foto invalida o muy pesada en "${name}"`);
    run('UPDATE items SET photo=? WHERE id=?', r.photo || null, id);
  }
  // Materiales (receta) solo para arreglos; se reemplaza completa.
  if (r.recipe !== undefined) {
    if (r.kind !== 'PRODUCT') fail(400, 'Solo los arreglos llevan materiales');
    if (!r.recipe.length) fail(400, `"${name}" necesita al menos un material`);
    if (new Set(r.recipe.map((x) => +x.supply_id)).size !== r.recipe.length) fail(400, `Material repetido en "${name}"`);
    run('DELETE FROM recipe_lines WHERE product_id=?', id);
    for (const x of r.recipe) {
      const s = one("SELECT * FROM items WHERE id=? AND kind='SUPPLY'", x.supply_id);
      if (!s || !(+x.qty > 0)) fail(400, `Material invalido en "${name}"`);
      if (!qtyOk(s, +x.qty)) fail(400, `"${s.name}" se usa en ${s.unit} enteros`);
      run('INSERT INTO recipe_lines VALUES(?,?,?)', id, s.id, +x.qty);
    }
  } else if (r.kind === 'PRODUCT' && !one('SELECT 1 FROM recipe_lines WHERE product_id=?', id)) {
    fail(400, `"${name}" necesita al menos un material`);
  }
  return id;
};
// Planillas: todas las lineas se validan y registran en una sola transaccion.
const SHEETS = {
  PURCHASE: { roles: ['ADMIN'], label: 'Ingreso de mercaderia' },
  WASTE: { roles: ['ADMIN', 'PRODUCTION'], label: 'Mermas' },
  COUNT: { roles: ['ADMIN'], label: 'Conteo fisico' },
};
const REASONS = ['MARCHITA', 'DANADA', 'VENCIDA', 'ERROR_PRODUCCION', 'OTRO'];
const postSheet = (b, u) => {
  const cfg = SHEETS[b.kind];
  if (!cfg) fail(400, 'Tipo de planilla invalido');
  can(u, ...cfg.roles);
  const lines = (b.lines || []).filter((l) => (b.kind === 'COUNT' ? l.counted !== '' && l.counted != null : +l.qty));
  if (!lines.length) fail(400, 'La planilla no tiene cantidades');
  return tx(() => {
    const sheetId = Number(run('INSERT INTO sheets(kind,note,user_id) VALUES(?,?,?)', b.kind, b.note || null, u.id).lastInsertRowid);
    const ref = `${cfg.label} #${sheetId}`;
    let value = 0, count = 0;
    for (const l of lines) {
      const it = one("SELECT * FROM items WHERE id=? AND kind<>'PRODUCT'", l.item_id);
      if (!it) fail(400, 'Item invalido en la planilla');
      if (b.kind === 'PURCHASE') {
        const pk = l.packaging_id ? one('SELECT * FROM packagings WHERE id=? AND item_id=?', l.packaging_id, it.id) : { factor: 1 };
        if (!pk) fail(400, `Presentacion invalida en "${it.name}"`);
        if (!(+l.qty > 0)) fail(400, `Cantidad invalida en "${it.name}"`);
        const base = +l.qty * pk.factor;
        if (!qtyOk(it, base)) fail(400, `"${it.name}" se cuenta en ${it.unit} enteros`);
        const unitCost = +l.pack_cost > 0 ? +l.pack_cost / pk.factor : it.cost;
        // Costo promedio ponderado por unidad base.
        const newCost = it.stock + base > 0 ? (it.stock * it.cost + base * unitCost) / (it.stock + base) : unitCost;
        run('UPDATE items SET cost=round(?,4) WHERE id=?', newCost, it.id);
        stockMove(it.id, base, 'PURCHASE_IN', ref, u.id);
        value += base * unitCost;
      } else if (b.kind === 'WASTE') {
        if (!REASONS.includes(l.reason)) fail(400, 'Motivo invalido');
        if (!(+l.qty > 0) || !qtyOk(it, +l.qty)) fail(400, `Cantidad invalida en "${it.name}"`);
        stockMove(it.id, -l.qty, 'WASTE', `${ref} · ${l.reason}`, u.id);
        run('INSERT INTO waste(sheet_id,item_id,qty,reason,value,user_id) VALUES(?,?,?,?,?,?)', sheetId, it.id, +l.qty, l.reason, +l.qty * it.cost, u.id);
        value += +l.qty * it.cost;
      } else {
        const counted = +l.counted;
        if (!(counted >= 0) || !qtyOk(it, counted)) fail(400, `Conteo invalido en "${it.name}"`);
        const diff = Math.round((counted - it.stock) * 1000) / 1000;
        if (!diff) continue;
        stockMove(it.id, diff, 'COUNT_ADJUST', ref, u.id);
        value += diff * it.cost;
      }
      count++;
    }
    run('UPDATE sheets SET lines=?, value=round(?,2) WHERE id=?', count, value, sheetId);
    return { id: sheetId, lines: count, value };
  });
};

// ---------- rutas ----------
const routes = {
  'GET /api/users': () => q('SELECT * FROM users'),
  'GET /api/items': () => q(`SELECT i.*,
    (SELECT group_concat(s.name||' x'||printf('%g',r.qty)||' '||s.unit, ', ') FROM recipe_lines r JOIN items s ON s.id=r.supply_id WHERE r.product_id=i.id) recipe,
    (SELECT round(SUM(r.qty*s.cost),2) FROM recipe_lines r JOIN items s ON s.id=r.supply_id WHERE r.product_id=i.id) recipe_cost,
    (SELECT json_group_array(json_object('id',p.id,'name',p.name,'factor',p.factor)) FROM packagings p WHERE p.item_id=i.id) packs,
    (SELECT json_group_array(json_object('supply_id',r.supply_id,'qty',r.qty)) FROM recipe_lines r WHERE r.product_id=i.id) rl
    FROM items i ORDER BY kind, name`).map(({ packs, rl, ...i }) => ({ ...i, packagings: JSON.parse(packs || '[]'), recipe_lines: JSON.parse(rl || '[]') })),
  'GET /api/movements': () => q('SELECT m.*, i.name item, i.unit, u.name user FROM movements m JOIN items i ON i.id=m.item_id LEFT JOIN users u ON u.id=m.user_id ORDER BY m.id DESC LIMIT 60'),
  'POST /api/catalog': (b, u) => {
    can(u, 'ADMIN', 'SALES');
    if (!b.rows?.length) fail(400, 'No hay cambios');
    // Ventas solo puede crear arreglos nuevos; administracion edita todo.
    if (u.role === 'SALES' && b.rows.some((r) => r.id || r.kind !== 'PRODUCT')) fail(403, 'Ventas solo puede crear arreglos nuevos');
    return tx(() => {
      const ids = b.rows.map((r) => saveCatalogRow(r, u));
      run('INSERT INTO audit_log(user_id,action,detail) VALUES(?,?,?)', u.id, 'CATALOG_SAVE', `${ids.length} filas`);
      return { saved: ids.length };
    });
  },
  'POST /api/sheets': postSheet,
  'GET /api/sheets': () => q('SELECT s.*, u.name user FROM sheets s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.id DESC LIMIT 20'),
  'POST /api/sales': (b, u) => { // venta POS
    can(u, 'ADMIN', 'SALES');
    if (!one('SELECT id FROM cash_sessions WHERE closed_at IS NULL')) fail(409, 'La caja esta cerrada. Abrela primero.');
    // El precio sale de la base, nunca del cliente.
    const lines = (b.lines || []).map((l) => {
      const it = one("SELECT id, name, price, decimals FROM items WHERE id=? AND kind<>'SUPPLY'", l.item_id);
      if (!it) fail(400, 'Producto invalido');
      if (!(l.qty > 0) || !qtyOk(it, l.qty)) fail(400, `Cantidad invalida en "${it.name}"`);
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
  'GET /api/waste': () => q('SELECT w.*, i.name item, i.unit, u.name user FROM waste w JOIN items i ON i.id=w.item_id LEFT JOIN users u ON u.id=w.user_id ORDER BY w.id DESC LIMIT 100'),
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
