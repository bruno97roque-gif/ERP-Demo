// UI de la demo. Vanilla JS, sin build.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = (n) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => Number(n || 0).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const ICONS = {
  pos: '<path d="M3 7h18l-2 10H5L3 7Z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
  production: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/>',
  inventory: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  sheets: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  catalog: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  finance: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  shopify: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
const art = (name) => { const n = name.toLowerCase(); return n.includes('girasol') ? '🌻' : n.includes('lirio') ? '🌷' : n.includes('rosa') ? '🌹' : n.includes('peluche') ? '🧸' : n.includes('choco') ? '🍫' : '💐'; };

const TABS = {
  pos: { label: 'Punto de venta', sub: 'Busca, agrega y cobra. Atajos: / buscar · Enter agregar · F9 cobrar', roles: ['ADMIN', 'SALES'] },
  production: { label: 'Produccion', sub: 'Comandas digitales. Al marcar "Lista" se descuentan los insumos de la receta.', roles: ['ADMIN', 'PRODUCTION', 'SALES'] },
  inventory: { label: 'Inventario', sub: 'Stock en tiempo real y libro de movimientos.', roles: ['ADMIN', 'SALES', 'PRODUCTION'] },
  sheets: { label: 'Planillas', sub: 'Registro en lote, como en Excel: Tab/Enter/flechas para moverte, pega bloques copiados de Excel, Esc deshace la celda.', roles: ['ADMIN', 'PRODUCTION'] },
  catalog: { label: 'Catalogo', sub: 'Productos, insumos, unidades de medida, presentaciones de compra, fotos y materiales.', roles: ['ADMIN', 'SALES'] },
  finance: { label: 'Cobranza', sub: 'Cuentas por cobrar y ventas recientes.', roles: ['ADMIN', 'SALES'] },
  reports: { label: 'Reportes', sub: 'Ventas, vendedores, metas e inventario.', roles: ['ADMIN'] },
  shopify: { label: 'Shopify', sub: 'Simulador de pedidos de la tienda online.', roles: ['ADMIN'] },
};
const METHODS = [['EFECTIVO', 'Efectivo'], ['TARJETA', 'Tarjeta'], ['YAPE_PLIN', 'Yape / Plin'], ['TRANSFERENCIA', 'Transferencia'], ['CULQI', 'Culqi']];
const S = { me: null, users: [], items: [], cash: null, tab: 'pos', cart: [], filter: 'ALL', search: '', method: 'EFECTIVO', pending: 0, seenOrders: new Set(), busy: false, dirty: () => 0, sheetKind: null, catFilter: 'ALL' };
const UNITS = [['unidad', 'unidad', 0], ['tallo', 'tallo', 0], ['rama', 'rama', 0], ['pliego', 'pliego', 0], ['atado', 'atado', 0], ['kg', 'kilogramo (kg)', 1], ['g', 'gramo (g)', 0], ['metro', 'metro (m)', 1], ['litro', 'litro (L)', 1]];
const KIND_LABEL = { SUPPLY: 'Insumo', PRODUCT: 'Arreglo', RESALE: 'Reventa' };
const qtyStr = (n, unit) => `${num(n)} ${esc(unit || '')}`;
const thumb = (i, size = 34) => i.photo ? `<img class="thumb" src="${i.photo}" alt="" style="width:${size}px;height:${size}px">` : `<span class="thumb ph" style="width:${size}px;height:${size}px;font-size:${size * 0.5}px">${art(i.name)}</span>`;
function confirmModal(title, html, okLabel = 'Confirmar', danger) {
  return new Promise((res) => openModal(`<div class="dialog-h"><h2>${title}</h2></div><div class="dialog-b">${html}</div>
    <div class="dialog-f"><button class="btn ghost" id="cNo">Cancelar</button><button class="btn ${danger ? 'accent' : 'primary'}" id="cOk">${okLabel}</button></div>`, (m) => {
    $('#cNo', m).onclick = () => { closeModal(); res(false); };
    $('#cOk', m).onclick = () => { closeModal(); res(true); };
    $('#cOk', m).focus();
  }));
}

// ---------- infra ----------
async function api(path, body) {
  const r = await fetch('/api' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-user': S.me?.id || 1 }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error de conexion');
  return j;
}
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.innerHTML = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), kind === 'bad' ? 5000 : 3200);
}
// Evita dobles clics: bloquea mientras la accion esta en curso.
const act = (fn) => async (...a) => {
  if (S.busy) return; S.busy = true;
  try { await fn(...a); } catch (e) { toast(esc(e.message), 'bad'); } finally { S.busy = false; }
};
function openModal(html, onMount) {
  const m = $('#modal'); m.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false;
  m.onclick = (e) => { if (e.target === m) closeModal(); };
  onMount?.(m); $('input,select', m)?.focus();
}
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
const empty = (title, text) => `<div class="empty"><b>${title}</b>${text || ''}</div>`;

// ---------- shell ----------
async function boot() {
  S.users = await api('/users');
  S.me = S.users[0];
  $('#user').innerHTML = S.users.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  $('#user').onchange = async () => {
    if (!(await leaveOk())) { $('#user').value = S.me.id; return; }
    S.me = S.users.find((u) => u.id == $('#user').value); S.cart = []; S.sheetKind = null; go(S.tab, true);
  };
  window.addEventListener('beforeunload', (e) => { if (S.dirty()) e.preventDefault(); });
  document.addEventListener('keydown', onKey);
  setInterval(poll, 5000);
  go('pos');
}
async function refresh() {
  const [items, cash, prod] = await Promise.all([api('/items'), api('/cash'), api('/production')]);
  S.items = items; S.cash = cash;
  S.pending = prod.filter((o) => o.status !== 'DONE').length;
  return prod;
}
function shell() {
  const allowed = Object.entries(TABS).filter(([, t]) => t.roles.includes(S.me.role));
  if (!allowed.some(([k]) => k === S.tab)) S.tab = allowed[0][0];
  $('#nav').innerHTML = allowed.map(([k, t]) => `<button class="${k === S.tab ? 'on' : ''}" data-tab="${k}">${icon(k)}<span class="lbl">${t.label}</span>${k === 'production' && S.pending ? `<span class="count">${S.pending}</span>` : ''}</button>`).join('');
  $$('#nav button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
  $('#avatar').textContent = S.me.name[0];
  const open = isOpen();
  $('#cashBox').innerHTML = `<div class="cash-box ${open ? 'open' : ''}"><span class="dot"></span><b>Caja ${open ? 'abierta' : 'cerrada'}</b><div style="color:var(--mute);font-size:12px;margin-top:2px">${open ? 'Esperado ' + money(S.cash.expected) : 'Abrela para vender'}</div></div>`;
  $('#title').textContent = TABS[S.tab].label;
  $('#subtitle').textContent = TABS[S.tab].sub;
}
const isOpen = () => S.cash?.session && !S.cash.session.closed_at;
// Evita perder una planilla a medio llenar al cambiar de pantalla.
async function leaveOk() {
  const n = S.dirty();
  if (!n) return true;
  const ok = await confirmModal('Cambios sin guardar', `<div class="notice warn">Tienes <b>&nbsp;${n} fila(s)&nbsp;</b> modificadas que no se han registrado.</div>`, 'Descartar y salir', true);
  if (ok) S.dirty = () => 0;
  return ok;
}
async function go(tab, skipGuard) {
  if (!skipGuard && tab && tab !== S.tab && !(await leaveOk())) return;
  if (tab && tab !== S.tab) S.dirty = () => 0;
  S.tab = tab || S.tab;
  const prod = await refresh();
  shell();
  $('#topActions').innerHTML = '';
  await VIEWS[S.tab](prod);
}
async function poll() {
  if (!$('#modal').hidden || document.activeElement?.matches('input,select')) return;
  if (S.tab === 'production') await go('production');
  else { await refresh(); shell(); if (S.tab === 'pos') { renderCatalog(); renderTicket(); } }
}
function onKey(e) {
  if (e.key === 'Escape' && !$('#modal').hidden) return closeModal();
  if (S.tab !== 'pos' || !$('#modal').hidden) return;
  if (e.key === '/' && document.activeElement?.id !== 'q') { e.preventDefault(); $('#q')?.focus(); }
  if (e.key === 'F9') { e.preventDefault(); checkout(); }
}

// ---------- POS ----------
const sellable = () => S.items.filter((i) => i.kind !== 'SUPPLY');
const cartTotal = () => S.cart.reduce((a, l) => a + l.qty * l.price, 0);
function filtered() {
  const q = S.search.trim().toLowerCase();
  return sellable().filter((i) => (S.filter === 'ALL' || i.kind === S.filter) && (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)));
}
function renderCatalog() {
  const list = filtered();
  $('#products').innerHTML = list.map((i) => {
    const inCart = S.cart.find((l) => l.item_id === i.id)?.qty;
    const out = i.kind === 'RESALE' && i.stock <= (inCart || 0);
    return `<button class="p-card ${out ? 'out' : ''}" data-id="${i.id}">
      <div class="p-art">${i.photo ? `<img src="${i.photo}" alt="">` : art(i.name)}${inCart ? `<span class="qty">${num(inCart)}</span>` : ''}</div>
      <div class="p-body"><b>${esc(i.name)}</b><small>${i.kind === 'PRODUCT' ? 'Arreglo · se produce' : `Reventa · stock ${qtyStr(i.stock, i.unit)}`}</small><span class="p-price">${money(i.price)}${i.unit !== 'unidad' ? ` <small>/ ${esc(i.unit)}</small>` : ''}</span></div></button>`;
  }).join('') || `<div class="card" style="grid-column:1/-1">${empty('Sin resultados', 'Prueba otra busqueda o crea un arreglo nuevo.')}</div>`;
  $$('#products .p-card').forEach((b) => (b.onclick = () => addCart(+b.dataset.id)));
}
function addCart(id, qty) {
  const i = S.items.find((x) => x.id === id);
  if (i.decimals && qty == null) return weightModal(i); // productos por peso o medida: se pide la cantidad
  const l = S.cart.find((x) => x.item_id === id);
  const add = qty ?? 1;
  if (i.kind === 'RESALE' && (l?.qty || 0) + add > i.stock + 1e-9) return toast(`No hay suficiente stock de ${esc(i.name)} (quedan ${qtyStr(i.stock, i.unit)})`, 'bad');
  l ? (l.qty = Math.round((l.qty + add) * 1000) / 1000) : S.cart.push({ item_id: id, name: i.name, kind: i.kind, unit: i.unit, decimals: i.decimals, qty: add, price: i.price });
  renderCatalog(); renderTicket();
}
function weightModal(i) {
  openModal(`<div class="dialog-h"><h2>${esc(i.name)}</h2></div><div class="dialog-b">
    <label class="field"><span>Cantidad en ${esc(i.unit)} · ${money(i.price)} por ${esc(i.unit)} · stock ${qtyStr(i.stock, i.unit)}</span><input class="input" id="wq" inputmode="decimal" placeholder="Ej. 0.25"></label>
    <div class="seg">${[0.1, 0.25, 0.5, 1].map((v) => `<button data-v="${v}">${v} ${esc(i.unit)}</button>`).join('')}</div><div id="wtot"></div></div>
    <div class="dialog-f"><button class="btn ghost" id="cancel">Cancelar</button><button class="btn primary" id="ok">Agregar</button></div>`, (m) => {
    const inp = $('#wq', m);
    const upd = () => { const v = +inp.value.replace(',', '.'); $('#wtot', m).innerHTML = v > 0 ? `<div class="notice ok">Total: <b>&nbsp;${money(v * i.price)}</b></div>` : ''; };
    $$('[data-v]', m).forEach((b) => (b.onclick = () => { inp.value = b.dataset.v; upd(); }));
    inp.oninput = upd;
    const ok = () => { const v = Math.round(+inp.value.replace(',', '.') * 1000) / 1000; if (!(v > 0)) return toast('Indica una cantidad', 'bad'); closeModal(); addCart(i.id, v); };
    inp.onkeydown = (e) => e.key === 'Enter' && ok();
    $('#ok', m).onclick = ok; $('#cancel', m).onclick = closeModal;
  });
}
function setQty(id, d) {
  const l = S.cart.find((x) => x.item_id === id); if (!l) return;
  const i = S.items.find((x) => x.id === id);
  if (i.decimals) { S.cart = S.cart.filter((x) => x !== l); if (d > 0) return weightModal(i); return renderCatalog(), renderTicket(); }
  if (d > 0 && i.kind === 'RESALE' && l.qty + 1 > i.stock) return toast('Stock insuficiente', 'bad');
  l.qty += d; if (l.qty <= 0) S.cart = S.cart.filter((x) => x !== l);
  renderCatalog(); renderTicket();
}
function renderTicket() {
  const total = cartTotal();
  const open = isOpen();
  const prev = { pay: $('#pay')?.value, recv: $('#recv')?.value, cust: $('#cust')?.value, payTouched: $('#pay')?.dataset.touched };
  $('#ticket').innerHTML = `
    <div class="card-h"><h3>Venta actual</h3>${S.cart.length ? '<button class="btn ghost sm" id="clear">Vaciar</button>' : ''}</div>
    ${!open ? `<div style="padding:12px 16px 0"><div class="notice bad"><span class="grow">La caja esta cerrada.</span><button class="btn sm" id="openCash">Abrir caja</button></div></div>` : ''}
    <div class="ticket-lines">${S.cart.map((l) => `<div class="t-line"><div><b>${esc(l.name)}</b><small>${money(l.price)} ${l.unit && l.unit !== 'unidad' ? 'por ' + esc(l.unit) : 'c/u'}${l.kind === 'PRODUCT' ? ' · genera comanda' : ''}</small></div>
      ${l.decimals ? `<div class="stepper"><button data-q="${l.item_id}" data-d="-1" aria-label="Quitar">×</button><span style="padding:0 6px">${qtyStr(l.qty, l.unit)}</span><button data-q="${l.item_id}" data-d="1" aria-label="Cambiar cantidad">✎</button></div>` : `<div class="stepper"><button data-q="${l.item_id}" data-d="-1" aria-label="Quitar uno">−</button><span>${l.qty}</span><button data-q="${l.item_id}" data-d="1" aria-label="Agregar uno">+</button></div>`}
      <b style="min-width:76px;text-align:right">${money(l.qty * l.price)}</b></div>`).join('') || empty('Ticket vacio', 'Toca un producto o busca con <kbd>/</kbd>')}</div>
    <div class="t-total"><span>Total</span><b>${money(total)}</b></div>
    <div class="t-pay">
      <div class="field"><span>Metodo de pago</span><div class="seg" id="methods">${METHODS.map(([k, n]) => `<button data-m="${k}" class="${S.method === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="row">
        <label class="field grow"><span>Cobrar ahora</span><input class="input" id="pay" type="number" min="0" step="0.1"></label>
        ${S.method === 'EFECTIVO' ? '<label class="field grow"><span>Recibe</span><input class="input" id="recv" type="number" min="0" step="0.1" placeholder="Opcional"></label>' : ''}
      </div>
      <label class="field"><span>Cliente <small id="custReq" style="color:var(--accent)"></small></span><input class="input" id="cust" placeholder="Nombre o telefono"></label>
      <div id="payInfo"></div>
      <button class="btn primary lg" id="charge" ${open && S.cart.length ? '' : 'disabled'}>Cobrar ${money(total)} <kbd style="background:transparent;color:inherit;border-color:currentColor;opacity:.7">F9</kbd></button>
    </div>`;
  const pay = $('#pay');
  pay.value = prev.payTouched ? Math.min(+prev.pay || 0, total) : total ? total.toFixed(2) : '';
  if (prev.payTouched) pay.dataset.touched = 1;
  if ($('#recv') && prev.recv) $('#recv').value = prev.recv;
  if (prev.cust) $('#cust').value = prev.cust;
  const info = () => {
    const p = +pay.value || 0, r = +$('#recv')?.value || 0, debt = total - p;
    $('#custReq').textContent = debt > 0.001 ? '(obligatorio: queda saldo)' : '';
    $('#payInfo').innerHTML = [
      debt > 0.001 && S.cart.length ? `<div class="notice warn">Quedara un saldo de <b>&nbsp;${money(debt)}&nbsp;</b> en cobranza.</div>` : '',
      r > 0 && r >= p ? `<div class="notice ok">Vuelto: <b>&nbsp;${money(r - p)}</b></div>` : '',
      r > 0 && r < p ? `<div class="notice bad">Lo recibido es menor al monto a cobrar.</div>` : '',
    ].join('');
  };
  pay.oninput = () => { pay.dataset.touched = 1; info(); };
  $('#recv') && ($('#recv').oninput = info);
  info();
  $$('#ticket [data-q]').forEach((b) => (b.onclick = () => setQty(+b.dataset.q, +b.dataset.d)));
  $$('#methods button').forEach((b) => (b.onclick = () => { S.method = b.dataset.m; renderTicket(); }));
  $('#clear') && ($('#clear').onclick = () => { S.cart = []; renderCatalog(); renderTicket(); });
  $('#openCash') && ($('#openCash').onclick = openCashModal);
  $('#charge').onclick = checkout;
}
const checkout = act(async () => {
  if (S.tab !== 'pos' || !S.cart.length || !isOpen()) return;
  const total = cartTotal();
  const amount = Math.min(Math.max(+$('#pay').value || 0, 0), total);
  const customer = $('#cust').value.trim();
  const recv = +$('#recv')?.value || 0;
  if (total - amount > 0.001 && !customer) { $('#cust').focus(); throw new Error('Indica el cliente: la venta queda con saldo pendiente.'); }
  if (recv && recv < amount) throw new Error('Lo recibido es menor al monto a cobrar.');
  const r = await api('/sales', { customer, lines: S.cart.map(({ item_id, qty, price }) => ({ item_id, qty, price })), payments: [{ method: S.method, amount }] });
  const comandas = S.cart.filter((l) => l.kind === 'PRODUCT').length;
  S.cart = [];
  toast(`${icon('check')}<span>Venta <b>#${r.id}</b> registrada${r.status === 'PAID' ? '' : ' con saldo pendiente'}${comandas ? ` · ${comandas} comanda(s) enviadas a produccion` : ''}${recv > amount ? ` · Vuelto ${money(recv - amount)}` : ''}</span>`, 'ok');
  await refresh(); shell(); renderCatalog(); renderTicket(); $('#q').focus();
});
function openCashModal() {
  openModal(`<div class="dialog-h"><h2>Abrir caja</h2></div><div class="dialog-b"><label class="field"><span>Fondo inicial en efectivo</span><input class="input" id="float" type="number" value="200" min="0"></label></div>
    <div class="dialog-f"><button class="btn ghost" id="cancel">Cancelar</button><button class="btn primary" id="ok">Abrir caja</button></div>`, (m) => {
    $('#cancel', m).onclick = closeModal;
    $('#ok', m).onclick = act(async () => { await api('/cash/open', { opening_float: +$('#float').value || 0 }); closeModal(); toast('Caja abierta', 'ok'); go(); });
  });
}
function closeCashModal() {
  const exp = S.cash.expected;
  openModal(`<div class="dialog-h"><h2>Cierre de caja</h2></div><div class="dialog-b">
    <div class="grid g2"><div class="kpi card"><small>Fondo inicial</small><b>${money(S.cash.session.opening_float)}</b></div><div class="kpi card"><small>Efectivo cobrado</small><b>${money(S.cash.cash_in)}</b></div></div>
    <label class="field"><span>Efectivo contado en caja (esperado ${money(exp)})</span><input class="input" id="counted" type="number" min="0" step="0.1"></label><div id="diff"></div></div>
    <div class="dialog-f"><button class="btn ghost" id="cancel">Cancelar</button><button class="btn primary" id="ok" disabled>Cerrar caja</button></div>`, (m) => {
    $('#cancel', m).onclick = closeModal;
    $('#counted', m).oninput = (e) => {
      const v = e.target.value; $('#ok', m).disabled = v === '';
      const d = +v - exp;
      $('#diff', m).innerHTML = v === '' ? '' : `<div class="notice ${Math.abs(d) < 0.01 ? 'ok' : 'warn'}">${Math.abs(d) < 0.01 ? 'Cuadra exacto.' : `Diferencia: <b>&nbsp;${money(d)}</b>&nbsp;(${d > 0 ? 'sobrante' : 'faltante'})`}</div>`;
    };
    $('#ok', m).onclick = act(async () => { const r = await api('/cash/close', { counted: +$('#counted').value }); closeModal(); toast(`Caja cerrada · diferencia ${money(r.difference)}`, Math.abs(r.difference) < 0.01 ? 'ok' : ''); go(); });
  });
}
// Ficha de producto: alta y edicion de arreglos, insumos y reventa, con foto,
// unidad de medida, presentaciones de compra y materiales.
function productEditor(item, done) {
  const isNew = !item.id;
  const sales = S.me.role === 'SALES';
  const f = {
    id: item.id, sku: item.sku || '', name: item.name || '', kind: item.kind || 'PRODUCT', unit: item.unit || 'unidad',
    decimals: !!item.decimals, price: item.price ?? '', cost: item.cost ?? '', min_stock: item.min_stock ?? 0, photo: item.photo || '',
    packagings: (item.packagings || []).map((p) => ({ ...p })), recipe: (item.recipe_lines || []).map((r) => ({ ...r })),
  };
  const supplies = S.items.filter((i) => i.kind === 'SUPPLY' && i.id !== item.id);
  const sup = (id) => supplies.find((s) => s.id == id);
  openModal(`<div class="dialog-h"><h2>${isNew ? 'Nuevo producto' : 'Editar ' + esc(item.name)}</h2><button class="btn ghost sm" id="x">${icon('x')}</button></div>
    <div class="dialog-b editor">
      <div class="photo-col">
        <label class="photo-drop" id="drop" tabindex="0"><input type="file" id="file" accept="image/*" hidden><div id="photoView"></div></label>
        <button class="btn ghost sm" id="rmPhoto">Quitar foto</button>
        <small class="mute-s">JPG o PNG. Se reduce automaticamente a 600 px.</small>
      </div>
      <div class="form-col">
        <div class="field"><span>Tipo</span><div class="seg" id="kind">${Object.entries(KIND_LABEL).map(([k, n]) => `<button data-k="${k}" ${sales && k !== 'PRODUCT' ? 'disabled' : ''} ${!isNew && item.stock && k !== item.kind ? 'disabled' : ''}>${n}</button>`).join('')}</div>
          <small class="mute-s" id="kindHelp"></small></div>
        <div class="row"><label class="field grow"><span>Nombre</span><input class="input" id="fName" placeholder="Ej. Ramo primavera"></label>
          <label class="field" style="width:150px"><span>SKU (opcional)</span><input class="input" id="fSku" placeholder="Automatico"></label></div>
        <div id="kindFields"></div>
      </div>
    </div>
    <div class="dialog-f"><span id="summary" class="grow mute-s"></span><button class="btn ghost" id="cancel">Cancelar</button><button class="btn primary" id="save">${isNew ? 'Crear producto' : 'Guardar cambios'}</button></div>`, (m) => {
    $('.dialog', m).classList.add('wide');
    $('#fName', m).value = f.name; $('#fSku', m).value = f.sku;
    $('#fName', m).oninput = (e) => (f.name = e.target.value);
    $('#fSku', m).oninput = (e) => (f.sku = e.target.value);

    const renderPhoto = () => { $('#photoView', m).innerHTML = f.photo ? `<img src="${f.photo}" alt="Foto del producto">` : `<div class="photo-empty">${icon('camera')}<b>Subir foto</b><small>Clic o arrastra una imagen</small></div>`; $('#rmPhoto', m).hidden = !f.photo; };
    const loadFile = (file) => {
      if (!file || !file.type.startsWith('image/')) return toast('Elige una imagen', 'bad');
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        f.photo = c.toDataURL('image/jpeg', 0.82); URL.revokeObjectURL(img.src); renderPhoto();
      };
      img.onerror = () => toast('No se pudo leer la imagen', 'bad');
      img.src = URL.createObjectURL(file);
    };
    $('#file', m).onchange = (e) => loadFile(e.target.files[0]);
    const drop = $('#drop', m);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); loadFile(e.dataTransfer.files[0]); };
    drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file', m).click(); } };
    $('#rmPhoto', m).onclick = () => { f.photo = ''; renderPhoto(); };

    const HELP = {
      PRODUCT: 'Se arma con materiales del inventario. Al venderlo se crea una comanda; al terminarla se descuentan los materiales.',
      SUPPLY: 'Material que se compra y se usa en los arreglos (flores, papel, cintas). No se vende suelto.',
      RESALE: 'Se compra y se vende tal cual (peluches, chocolates). Descuenta stock al venderse.',
    };
    const recipeCost = () => f.recipe.reduce((a, r) => a + (sup(r.supply_id)?.cost || 0) * (+r.qty || 0), 0);
    const summary = () => {
      const cost = f.kind === 'PRODUCT' ? recipeCost() : +f.cost || 0;
      const price = +f.price || 0;
      $('#summary', m).innerHTML = f.kind === 'SUPPLY' ? '' : price ? `Costo ${money(cost)} · Margen <b>${money(price - cost)}</b> (${price ? ((1 - cost / price) * 100).toFixed(0) : 0}%)` : '';
      if ($('#rcost', m)) $('#rcost', m).textContent = money(recipeCost());
    };

    const renderKind = () => {
      $$('#kind button', m).forEach((b) => b.classList.toggle('on', b.dataset.k === f.kind));
      $('#kindHelp', m).textContent = HELP[f.kind];
      const box = $('#kindFields', m);
      if (f.kind === 'PRODUCT') {
        box.innerHTML = `<label class="field" style="width:180px"><span>Precio de venta (S/)</span><input class="input" id="fPrice" inputmode="decimal"></label>
          <div class="field"><span>Materiales por unidad</span>
            <div class="recipe-head"><span>Material</span><span>Cantidad</span><span class="n">Costo</span><span></span></div>
            <div id="rows" class="recipe-list"></div>
            <div class="row" style="justify-content:space-between;align-items:center"><button class="btn ghost sm" id="addRow">${icon('plus')} Agregar material</button><span class="mute-s">Costo de materiales: <b id="rcost"></b></span></div></div>`;
        $('#fPrice', m).value = f.price; $('#fPrice', m).oninput = (e) => { f.price = e.target.value.replace(',', '.'); summary(); };
        const rows = () => {
          $('#rows', m).innerHTML = f.recipe.map((r, i) => { const s = sup(r.supply_id); return `<div class="recipe-row" data-i="${i}">
            <select class="input r-sup">${supplies.map((x) => `<option value="${x.id}" ${x.id == r.supply_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
            <div class="with-unit"><input class="input r-qty" inputmode="decimal" value="${r.qty}"><span>${esc(s?.unit || '')}</span></div>
            <span class="n r-cost">${money((s?.cost || 0) * (+r.qty || 0))}</span>
            <button class="btn ghost sm r-del" aria-label="Quitar material">${icon('x')}</button></div>`; }).join('') || '<div class="mute-s" style="padding:8px 0">Aun no tiene materiales.</div>';
          $$('.recipe-row', m).forEach((row) => {
            const r = f.recipe[+row.dataset.i];
            $('.r-sup', row).onchange = (e) => { r.supply_id = +e.target.value; rows(); };
            $('.r-qty', row).oninput = (e) => { r.qty = e.target.value.replace(',', '.'); $('.r-cost', row).textContent = money((sup(r.supply_id)?.cost || 0) * (+r.qty || 0)); summary(); };
            $('.r-del', row).onclick = () => { f.recipe.splice(+row.dataset.i, 1); rows(); };
          });
          summary();
        };
        $('#addRow', m).onclick = () => { const used = new Set(f.recipe.map((r) => +r.supply_id)); const next = supplies.find((s) => !used.has(s.id)); if (!next) return toast('Ya agregaste todos los materiales'); f.recipe.push({ supply_id: next.id, qty: 1 }); rows(); $$('.r-qty', m).pop()?.select(); };
        rows();
      } else {
        box.innerHTML = `<div class="unit-box">
            <div class="row"><label class="field grow"><span>Unidad base (como se cuenta el stock${f.kind === 'SUPPLY' ? ' y se usa en recetas' : ' y se vende'})</span>
              <select class="input" id="fUnit">${UNITS.map(([v, l]) => `<option value="${v}" ${v === f.unit ? 'selected' : ''}>${l}</option>`).join('')}${UNITS.some(([v]) => v === f.unit) ? '' : `<option selected>${esc(f.unit)}</option>`}</select></label>
              <label class="check"><input type="checkbox" id="fDec" ${f.decimals ? 'checked' : ''}> Permite decimales<small>Ej. 0.25 kg, 1.5 m</small></label></div>
            <div class="row"><label class="field grow"><span>Costo por <b class="u"></b> (S/)</span><input class="input" id="fCost" inputmode="decimal"></label>
              ${f.kind === 'RESALE' ? '<label class="field grow"><span>Precio de venta por <b class="u"></b> (S/)</span><input class="input" id="fPrice" inputmode="decimal"></label>' : ''}
              <label class="field grow"><span>Stock minimo (<b class="u"></b>)</span><input class="input" id="fMin" inputmode="decimal"></label></div>
          </div>
          <div class="field"><span>Presentaciones de compra</span>
            <div id="packs" class="recipe-list"></div>
            <button class="btn ghost sm" id="addPack" style="align-self:flex-start">${icon('plus')} Agregar presentacion</button>
            <div class="notice" style="background:var(--surface-2);color:var(--ink-2);display:block" id="packHelp"></div></div>`;
        const units = () => { $$('.u', m).forEach((e) => (e.textContent = f.unit)); packs(); };
        $('#fUnit', m).onchange = (e) => { f.unit = e.target.value; const u = UNITS.find(([v]) => v === f.unit); if (u) { f.decimals = !!u[2]; $('#fDec', m).checked = f.decimals; } units(); };
        $('#fDec', m).onchange = (e) => (f.decimals = e.target.checked);
        $('#fCost', m).value = f.cost; $('#fCost', m).oninput = (e) => { f.cost = e.target.value.replace(',', '.'); packs(); summary(); };
        $('#fMin', m).value = f.min_stock; $('#fMin', m).oninput = (e) => (f.min_stock = e.target.value.replace(',', '.'));
        if ($('#fPrice', m)) { $('#fPrice', m).value = f.price; $('#fPrice', m).oninput = (e) => { f.price = e.target.value.replace(',', '.'); summary(); }; }
        const packs = () => {
          $('#packs', m).innerHTML = f.packagings.map((p, i) => `<div class="pack-row" data-i="${i}">
            <input class="input p-name" placeholder="Ej. Paquete x6" value="${esc(p.name)}">
            <span class="mute-s">=</span><div class="with-unit"><input class="input p-fac" inputmode="decimal" value="${p.factor ?? ''}"><span>${esc(f.unit)}</span></div>
            <span class="mute-s p-cost">${+f.cost && +p.factor ? '≈ ' + money(f.cost * p.factor) : ''}</span>
            <button class="btn ghost sm p-del" aria-label="Quitar presentacion">${icon('x')}</button></div>`).join('') || '<div class="mute-s" style="padding:4px 0">Sin presentaciones: se ingresa por ' + esc(f.unit) + '.</div>';
          $$('.pack-row', m).forEach((row) => {
            const p = f.packagings[+row.dataset.i];
            $('.p-name', row).oninput = (e) => { p.name = e.target.value; const mt = e.target.value.match(/x\s*(\d+(?:[.,]\d+)?)/i); if (mt && !row.dataset.manual) { p.factor = +mt[1].replace(',', '.'); $('.p-fac', row).value = p.factor; } help(); };
            $('.p-fac', row).oninput = (e) => { row.dataset.manual = 1; p.factor = e.target.value.replace(',', '.'); $('.p-cost', row).textContent = +f.cost && +p.factor ? '≈ ' + money(f.cost * p.factor) : ''; help(); };
            $('.p-del', row).onclick = () => { f.packagings.splice(+row.dataset.i, 1); packs(); };
          });
          help();
        };
        const help = () => {
          const ex = f.packagings.find((p) => p.name && +p.factor);
          $('#packHelp', m).innerHTML = `<b>Como funciona:</b> el stock siempre se lleva en <b>${esc(f.unit)}</b>. ` + (ex ? `Si ingresas 2 × "${esc(ex.name)}", se suman ${num(2 * ex.factor)} ${esc(f.unit)} al stock.` : 'Si compras por paquete, agrega una presentacion (ej. "Paquete x6" = 6) y al ingresar mercaderia elige esa presentacion.') + (f.decimals ? ` Como admite decimales, puedes registrar fracciones (ej. 0.25 ${esc(f.unit)}).` : '');
        };
        $('#addPack', m).onclick = () => { f.packagings.push({ name: '', factor: '' }); packs(); $$('.p-name', m).pop()?.focus(); };
        units();
      }
      summary();
    };
    $$('#kind button', m).forEach((b) => (b.onclick = () => { if (b.disabled) return; f.kind = b.dataset.k; if (f.kind === 'PRODUCT') { f.unit = 'unidad'; f.decimals = false; } renderKind(); }));
    $('#x', m).onclick = $('#cancel', m).onclick = closeModal;
    $('#save', m).onclick = act(async () => {
      if (!f.name.trim()) { $('#fName', m).focus(); throw new Error('Ponle un nombre al producto.'); }
      if (f.kind !== 'SUPPLY' && !(+f.price > 0)) throw new Error('Indica el precio de venta.');
      const row = { id: f.id, sku: f.sku, name: f.name.trim(), kind: f.kind, unit: f.kind === 'PRODUCT' ? 'unidad' : f.unit, decimals: f.kind === 'PRODUCT' ? false : f.decimals,
        price: f.kind === 'SUPPLY' ? 0 : +f.price, cost: f.kind === 'PRODUCT' ? 0 : +f.cost || 0, min_stock: +f.min_stock || 0, photo: f.photo || null };
      if (f.kind === 'PRODUCT') {
        if (!f.recipe.length) throw new Error('Agrega al menos un material.');
        if (f.recipe.some((r) => !(+r.qty > 0))) throw new Error('Revisa las cantidades de los materiales.');
        row.recipe = f.recipe.map((r) => ({ supply_id: +r.supply_id, qty: +r.qty }));
      } else {
        const packs = f.packagings.filter((p) => p.name.trim() || p.factor);
        if (packs.some((p) => !p.name.trim() || !(+p.factor > 0))) throw new Error('Cada presentacion necesita nombre y cantidad.');
        row.packagings = packs.map((p) => ({ name: p.name.trim(), factor: +p.factor }));
      }
      await api('/catalog', { rows: [row] });
      closeModal(); toast(`<b>${esc(row.name)}</b> ${isNew ? 'creado' : 'actualizado'}${row.kind !== 'SUPPLY' ? ' y disponible en el POS' : ''}`, 'ok');
      done?.();
    });
    renderPhoto(); renderKind();
  });
}

// ---------- vistas ----------
const VIEWS = {
  async pos() {
    $('#topActions').innerHTML = `<button class="btn" id="newP">${icon('plus')} Nuevo arreglo</button>${isOpen() ? '<button class="btn" id="closeC">Cerrar caja</button>' : '<button class="btn primary" id="openC">Abrir caja</button>'}`;
    $('#newP').onclick = () => productEditor({ kind: 'PRODUCT' }, () => go('pos'));
    $('#closeC') && ($('#closeC').onclick = closeCashModal);
    $('#openC') && ($('#openC').onclick = openCashModal);
    $('#view').innerHTML = `<div class="pos-layout"><div>
      <div class="toolbar"><div class="search">${icon('search')}<input class="input" id="q" placeholder="Buscar producto o SKU" autocomplete="off" value="${esc(S.search)}"><kbd>/</kbd></div>
        <div class="seg" id="filters">${[['ALL', 'Todo'], ['PRODUCT', 'Arreglos'], ['RESALE', 'Reventa']].map(([k, n]) => `<button data-f="${k}" class="${S.filter === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="products" id="products"></div></div>
      <div class="card ticket" id="ticket"></div></div>`;
    const q = $('#q');
    q.oninput = () => { S.search = q.value; renderCatalog(); };
    q.onkeydown = (e) => { if (e.key === 'Enter') { const f = filtered()[0]; if (f) { addCart(f.id); if (!f.decimals) q.select(); } } };
    $$('#filters button').forEach((b) => (b.onclick = () => { S.filter = b.dataset.f; $$('#filters button').forEach((x) => x.classList.toggle('on', x === b)); renderCatalog(); }));
    renderCatalog(); renderTicket(); q.focus();
  },

  async production(list) {
    const canMove = ['ADMIN', 'PRODUCTION'].includes(S.me.role);
    const COLS = [['PENDING', 'Pendientes', 'var(--accent)', 'IN_PROGRESS', 'Empezar'], ['IN_PROGRESS', 'En proceso', 'var(--warn)', 'DONE', 'Marcar lista'], ['DONE', 'Listas', 'var(--ok)']];
    $('#view').innerHTML = `${!canMove ? '<div class="notice warn" style="margin-bottom:14px">Solo lectura: produccion y administracion mueven las comandas.</div>' : ''}<div class="board">${COLS.map(([st, title, color, next, label]) => {
      const os = list.filter((o) => o.status === st).slice(0, st === 'DONE' ? 8 : 99);
      return `<div class="col"><div class="col-h"><span><span class="dot" style="background:${color}"></span>${title}</span><span class="tag mute">${list.filter((o) => o.status === st).length}</span></div>
        ${os.map((o) => { const isNew = st === 'PENDING' && S.seenOrders.size && !S.seenOrders.has(o.id); return `<div class="order ${isNew ? 'new' : ''}"><div class="o-top"><div><b>${art(o.product)} ${esc(o.product)}</b><div class="meta">Comanda #${o.id} · Venta #${o.sale_id} · ${esc(o.customer)} · ${time(o.created_at)}</div></div><span class="tag">x${num(o.qty)}</span></div>
          <div class="chips">${(o.needs || '').split(', ').map((n) => `<span class="chip">${esc(n)}</span>`).join('')}</div>
          ${next && canMove ? `<button class="btn ${st === 'PENDING' ? '' : 'primary'} sm" style="width:100%" data-o="${o.id}" data-s="${next}">${label}</button>` : ''}</div>`; }).join('') || `<div class="empty">Sin comandas</div>`}</div>`;
    }).join('')}</div>`;
    list.forEach((o) => S.seenOrders.add(o.id));
    $$('[data-o]').forEach((b) => (b.onclick = act(async () => {
      await api('/production/status', { id: +b.dataset.o, status: b.dataset.s });
      if (b.dataset.s === 'DONE') toast('Comanda lista · insumos descontados del inventario', 'ok');
      go('production');
    })));
  },

  async inventory() {
    const mv = await api('/movements');
    const stockItems = S.items.filter((i) => i.kind !== 'PRODUCT');
    const low = stockItems.filter((i) => i.stock <= i.min_stock);
    const value = stockItems.reduce((a, i) => a + i.stock * i.cost, 0);
    if (S.me.role === 'ADMIN') { $('#topActions').innerHTML = `<button class="btn primary" id="buy">${icon('plus')} Ingreso de mercaderia</button><button class="btn" id="cnt">Conteo fisico</button>`; $('#buy').onclick = () => { S.sheetKind = 'PURCHASE'; go('sheets'); }; $('#cnt').onclick = () => { S.sheetKind = 'COUNT'; go('sheets'); }; }
    const TYPE = { PURCHASE_IN: ['Ingreso', 'ok'], SALE_OUT: ['Venta', ''], SHOPIFY_OUT: ['Shopify', ''], PRODUCTION_CONSUME: ['Produccion', 'warn'], WASTE: ['Merma', 'bad'] };
    $('#view').innerHTML = `<div class="grid g4" style="margin-bottom:16px">
      <div class="card kpi"><small>Items con stock</small><b>${stockItems.length}</b></div>
      <div class="card kpi"><small>Stock bajo</small><b style="color:${low.length ? 'var(--bad)' : 'inherit'}">${low.length}</b><span class="hint">${low.map((i) => esc(i.name)).join(', ') || 'Todo en orden'}</span></div>
      <div class="card kpi"><small>Valor a costo</small><b>${money(value)}</b></div>
      <div class="card kpi"><small>Movimientos registrados</small><b>${mv.length}</b></div></div>
      <div class="grid g2"><div class="card"><div class="card-h"><h3>Stock actual</h3></div><div class="card-b" style="padding:0"><div class="table-wrap"><table class="table"><tr><th>Item</th><th class="n">Stock</th><th style="width:30%">Nivel</th></tr>
      ${stockItems.map((i) => { const pct = Math.min(100, i.stock / Math.max(1, i.min_stock * 3) * 100); const st = i.stock <= i.min_stock ? 'bad' : i.stock <= i.min_stock * 1.5 ? 'accent' : 'ok'; return `<tr><td><b>${esc(i.name)}</b><div style="color:var(--mute);font-size:12px">${esc(i.sku)} · ${i.kind === 'SUPPLY' ? 'Insumo' : 'Reventa'} · min ${num(i.min_stock)}</div></td><td class="n"><b>${num(i.stock)}</b> <small style="color:var(--mute)">${esc(i.unit)}</small></td><td><div class="bar ${st}"><i style="width:${pct}%"></i></div></td></tr>`; }).join('')}</table></div></div></div>
      <div class="card"><div class="card-h"><h3>Libro de movimientos</h3><span class="tag mute">ultimos 60</span></div><div class="card-b" style="padding:0"><div class="table-wrap" style="max-height:560px;overflow:auto"><table class="table"><tr><th>Cuando</th><th>Item</th><th>Tipo</th><th class="n">Cant.</th></tr>
      ${mv.map((m) => { const [n, c] = TYPE[m.type] || [m.type, 'mute']; return `<tr><td style="white-space:nowrap;color:var(--mute)">${time(m.created_at)}</td><td>${esc(m.item)}<div style="color:var(--mute);font-size:12px">${esc(m.ref)} · ${esc(m.user || '')}</div></td><td><span class="tag ${c}">${n}</span></td><td class="n ${m.qty > 0 ? 'pos' : 'neg'}">${m.qty > 0 ? '+' : ''}${num(m.qty)}</td></tr>`; }).join('')}</table></div></div></div></div>`;
  },

  async sheets() {
    const KINDS = [['PURCHASE', 'Ingreso de mercaderia', ['ADMIN']], ['WASTE', 'Mermas', ['ADMIN', 'PRODUCTION']], ['COUNT', 'Conteo fisico', ['ADMIN']]].filter(([, , r]) => r.includes(S.me.role));
    if (!KINDS.some(([k]) => k === S.sheetKind)) S.sheetKind = KINDS.find(([k]) => k === 'WASTE')?.[0] || KINDS[0][0];
    const kind = S.sheetKind;
    const [hist, waste] = await Promise.all([api('/sheets'), kind === 'WASTE' ? api('/waste') : []]);
    const stockItems = S.items.filter((i) => i.kind !== 'PRODUCT').sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'SUPPLY' ? -1 : 1));
    const unitOf = (r) => esc(r.unit);
    const intErr = (r, v) => (v !== '' && v != null && (isNaN(v) || v < 0) ? 'Numero invalido' : v && !r.decimals && !Number.isInteger(+v) ? `Solo ${r.unit} enteros` : '');
    const itemCol = { key: 'name', label: 'Item', type: 'static', sticky: true, width: '220px', get: (r) => `<div class="cell-item">${thumb(r, 28)}<div><b>${esc(r.name)}</b><small>${esc(r.sku)} · ${KIND_LABEL[r.kind]}</small></div></div>` };
    const stockCol = { key: 'stock', label: 'Stock', type: 'static', align: 'right', get: (r) => qtyStr(r.stock, r.unit) };
    const sum = (rows, f) => rows.reduce((a, r) => a + (f(r) || 0), 0);
    let cfg;
    const REASONS = [['MARCHITA', 'Marchita'], ['DANADA', 'Danada'], ['VENCIDA', 'Vencida'], ['ERROR_PRODUCCION', 'Error prod.'], ['OTRO', 'Otro']];
    if (kind === 'WASTE') {
      const total = (r) => REASONS.reduce((a, [k]) => a + (+r[k] || 0), 0);
      const rows = stockItems.map((i) => ({ ...i, ...Object.fromEntries(REASONS.map(([k]) => [k, ''])) }));
      cfg = {
        rows,
        columns: [itemCol, stockCol,
          ...REASONS.map(([k, n]) => ({ key: k, label: n, type: 'num', align: 'right', width: '92px', validate: (r) => intErr(r, r[k]) || (total(r) > r.stock + 1e-9 && r[k] ? 'Supera el stock' : '') })),
          { key: 'total', label: 'Total', type: 'calc', align: 'right', get: (r) => (total(r) ? `<b>${qtyStr(total(r), r.unit)}</b>` : '') },
          { key: 'value', label: 'Perdida S/', type: 'calc', align: 'right', get: (r) => (total(r) ? `<span class="neg">${money(total(r) * r.cost)}</span>` : '') },
          { key: 'final', label: 'Stock final', type: 'calc', align: 'right', get: (r) => (total(r) ? qtyStr(r.stock - total(r), unitOf(r)) : '') }],
        footer: { name: () => '<b>Totales</b>', ...Object.fromEntries(REASONS.map(([k]) => [k, (rows) => num(sum(rows, (r) => +r[k]))])), value: (rows) => `<b class="neg">${money(sum(rows, (r) => total(r) * r.cost))}</b>` },
        lines: (rows) => rows.flatMap((r) => REASONS.filter(([k]) => +r[k] > 0).map(([k]) => ({ item_id: r.id, reason: k, qty: +r[k] }))),
        value: (rows) => sum(rows, (r) => total(r) * r.cost),
        verb: 'mermas',
      };
    } else if (kind === 'PURCHASE') {
      const fac = (r) => (r.packaging_id ? r.packagings.find((p) => p.id == r.packaging_id)?.factor || 1 : 1);
      const base = (r) => (+r.qty || 0) * fac(r);
      const rows = stockItems.map((i) => ({ ...i, packaging_id: i.packagings[0]?.id || '', qty: '', pack_cost: '' }));
      cfg = {
        rows,
        columns: [itemCol, stockCol,
          { key: 'packaging_id', label: 'Presentacion', type: 'select', width: '170px', options: (r) => [...r.packagings.map((p) => [p.id, `${p.name} (${num(p.factor)} ${r.unit})`]), ['', `Suelto (${r.unit})`]] },
          { key: 'qty', label: 'Cantidad', type: 'num', align: 'right', width: '90px', validate: (r) => (r.qty !== '' && (isNaN(r.qty) || r.qty < 0) ? 'Numero invalido' : base(r) && !r.decimals && !Number.isInteger(Math.round(base(r) * 1000) / 1000) ? `Da ${num(base(r))} ${r.unit}: deben ser enteros` : '') },
          { key: 'pack_cost', label: 'Costo x present.', type: 'num', align: 'right', width: '110px', placeholder: (r) => (r.cost * fac(r)).toFixed(2), validate: (r) => (r.pack_cost !== '' && (isNaN(r.pack_cost) || r.pack_cost < 0) ? 'Numero invalido' : '') },
          { key: 'base', label: 'Entra al stock', type: 'calc', align: 'right', get: (r) => (base(r) ? `<span class="pos">+${qtyStr(base(r), r.unit)}</span>` : '') },
          { key: 'sub', label: 'Subtotal', type: 'calc', align: 'right', get: (r) => (base(r) ? money((+r.qty || 0) * (r.pack_cost === '' ? r.cost * fac(r) : +r.pack_cost)) : '') },
          { key: 'final', label: 'Stock final', type: 'calc', align: 'right', get: (r) => (base(r) ? qtyStr(r.stock + base(r), r.unit) : '') }],
        footer: { name: () => '<b>Total compra</b>', sub: (rows) => `<b>${money(sum(rows, (r) => (+r.qty || 0) * (r.pack_cost === '' ? r.cost * fac(r) : +r.pack_cost)))}</b>` },
        dirtyRows: (rows) => rows.filter((r) => +r.qty > 0),
        lines: (rows) => rows.filter((r) => +r.qty > 0).map((r) => ({ item_id: r.id, packaging_id: r.packaging_id || null, qty: +r.qty, pack_cost: r.pack_cost === '' ? null : +r.pack_cost })),
        value: (rows) => sum(rows, (r) => (+r.qty || 0) * (r.pack_cost === '' ? r.cost * fac(r) : +r.pack_cost)),
        verb: 'ingresos',
      };
    } else {
      const diff = (r) => (r.counted === '' ? 0 : Math.round((+r.counted - r.stock) * 1000) / 1000);
      const rows = stockItems.map((i) => ({ ...i, counted: '' }));
      cfg = {
        rows,
        columns: [itemCol, { ...stockCol, label: 'Segun sistema' },
          { key: 'counted', label: 'Contado', type: 'num', align: 'right', width: '100px', placeholder: (r) => num(r.stock), validate: (r) => intErr(r, r.counted) },
          { key: 'diff', label: 'Diferencia', type: 'calc', align: 'right', get: (r) => (diff(r) ? `<span class="${diff(r) > 0 ? 'pos' : 'neg'}">${diff(r) > 0 ? '+' : ''}${qtyStr(diff(r), r.unit)}</span>` : r.counted !== '' ? '<span class="tag ok">Cuadra</span>' : '') },
          { key: 'dval', label: 'Valor S/', type: 'calc', align: 'right', get: (r) => (diff(r) ? money(diff(r) * r.cost) : '') }],
        footer: { name: () => '<b>Ajuste neto</b>', dval: (rows) => `<b>${money(sum(rows, (r) => diff(r) * r.cost))}</b>` },
        lines: (rows) => rows.filter((r) => r.counted !== '').map((r) => ({ item_id: r.id, counted: +r.counted })),
        value: (rows) => sum(rows, (r) => diff(r) * r.cost),
        verb: 'conteos',
      };
    }
    const KLABEL = { PURCHASE: 'Ingreso', WASTE: 'Mermas', COUNT: 'Conteo' };
    const byReason = REASONS.map(([k, n]) => [n, waste.filter((w) => w.reason === k).reduce((a, w) => a + w.value, 0)]);
    const maxR = Math.max(1, ...byReason.map((r) => r[1]));
    $('#view').innerHTML = `
      <div class="sheet-tabs seg">${KINDS.map(([k, n]) => `<button data-sk="${k}" class="${k === kind ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="card">
        <div class="sheet-bar">
          <div class="search">${icon('search')}<input class="input" id="sq" placeholder="Filtrar items"></div>
          <label class="check inline"><input type="checkbox" id="onlyCh"> Solo con datos</label>
          <input class="input" id="note" placeholder="Nota (opcional)${kind === 'PURCHASE' ? ': proveedor, guia' : ''}" style="max-width:260px">
          <span class="grow"></span>
          <span id="sheetStat" class="mute-s"></span>
          <button class="btn ghost" id="discard">Descartar</button>
          <button class="btn primary" id="post" disabled>Registrar</button>
        </div>
        <div id="grid"></div>
        <div class="sheet-help">${kind === 'PURCHASE' ? 'Elige la presentacion (ej. Paquete x25) y cuantas llegaron: el sistema convierte a la unidad base. El costo vacio usa el costo actual; si lo llenas, se recalcula el costo promedio.' : kind === 'WASTE' ? 'Una columna por motivo. Escribe cuanto se perdio de cada insumo; la perdida se valoriza al costo. No permite mas que el stock.' : 'Escribe lo que contaste fisicamente. Las filas vacias no se tocan; las diferencias ajustan el stock.'}</div>
      </div>
      <div class="grid ${kind === 'WASTE' ? 'g2' : ''}" style="margin-top:16px">
        ${kind === 'WASTE' ? `<div class="card"><div class="card-h"><h3>Perdida por motivo (S/)</h3></div><div class="card-b">${byReason.map(([n, v]) => `<div class="hbar"><span>${n}</span><b>${money(v)}</b><div class="bar bad"><i style="width:${(v / maxR) * 100}%"></i></div></div>`).join('')}</div></div>` : ''}
        <div class="card"><div class="card-h"><h3>Planillas registradas</h3></div><div class="card-b" style="padding:0">${hist.filter((h) => h.kind === kind).length ? `<table class="table"><tr><th>#</th><th>Cuando</th><th>Usuario</th><th class="n">Lineas</th><th class="n">Valor</th></tr>${hist.filter((h) => h.kind === kind).map((h) => `<tr><td>${KLABEL[h.kind]} #${h.id}${h.note ? `<div class="mute-s">${esc(h.note)}</div>` : ''}</td><td>${time(h.created_at)}</td><td>${esc(h.user)}</td><td class="n">${h.lines}</td><td class="n">${money(h.value)}</td></tr>`).join('')}</table>` : empty('Aun no hay planillas de este tipo')}</div></div>
      </div>`;
    $$('[data-sk]').forEach((b) => (b.onclick = async () => { if (!(await leaveOk())) return; S.sheetKind = b.dataset.sk; S.dirty = () => 0; go('sheets'); }));
    const touched = (r) => (cfg.dirtyRows ? cfg.dirtyRows([r]).length : cfg.lines([r]).length);
    const sheet = createSheet($('#grid'), {
      columns: cfg.columns, rows: cfg.rows, footer: cfg.footer,
      onChange: () => {
        const n = cfg.rows.filter(touched).length, errs = sheet.errors().length;
        $('#sheetStat').innerHTML = n ? `${n} fila(s) · ${money(cfg.value(cfg.rows))}${errs ? ` · <span class="neg">${errs} error(es)</span>` : ''}` : '';
        $('#post').disabled = !n || errs > 0;
        $('#post').textContent = n ? `Registrar ${n} fila(s)` : 'Registrar';
      },
    });
    S.dirty = () => cfg.rows.filter(touched).length;
    const applyFilter = () => { const t = $('#sq').value.toLowerCase(), only = $('#onlyCh').checked; sheet.filter((r) => (!t || r.name.toLowerCase().includes(t) || r.sku.toLowerCase().includes(t)) && (!only || touched(r))); };
    $('#sq').oninput = applyFilter; $('#onlyCh').onchange = applyFilter;
    $('#discard').onclick = async () => { if (S.dirty() && !(await leaveOk())) return; S.dirty = () => 0; go('sheets'); };
    $('#post').onclick = act(async () => {
      const lines = cfg.lines(cfg.rows);
      const errs = sheet.errors(); if (errs.length) throw new Error(errs[0]);
      const preview = cfg.rows.filter(touched).slice(0, 6).map((r) => `<li>${esc(r.name)}</li>`).join('');
      const ok = await confirmModal(`Registrar ${KINDS.find(([k]) => k === kind)[1].toLowerCase()}`,
        `<p>Se registraran <b>${lines.length} ${cfg.verb}</b> en ${cfg.rows.filter(touched).length} item(s) por <b>${money(cfg.value(cfg.rows))}</b>.</p><ul class="mute-s">${preview}${cfg.rows.filter(touched).length > 6 ? '<li>…</li>' : ''}</ul><div class="notice warn">Se registra todo junto. Si una linea falla, no se guarda nada.</div>`, 'Registrar');
      if (!ok) return;
      const r = await api('/sheets', { kind, note: $('#note').value.trim(), lines });
      S.dirty = () => 0;
      toast(`Planilla #${r.id} registrada · ${r.lines} linea(s) · ${money(r.value)}`, 'ok');
      go('sheets');
    });
    sheet.focusFirst();
  },

  async catalog() {
    const admin = S.me.role === 'ADMIN';
    $('#topActions').innerHTML = `<button class="btn ${admin ? '' : 'primary'}" id="newItem">${icon('plus')} ${admin ? 'Nuevo producto' : 'Nuevo arreglo'}</button>${admin ? '<button class="btn primary" id="saveCat" disabled>Guardar cambios</button>' : ''}`;
    $('#newItem').onclick = () => productEditor({ kind: 'PRODUCT' }, () => { S.dirty = () => 0; go('catalog'); });
    const items = S.items.map((i) => ({ ...i }));
    const margin = (r) => { const c = r.kind === 'PRODUCT' ? r.recipe_cost || 0 : +r.cost || 0; return r.kind === 'SUPPLY' || !(+r.price > 0) ? '' : `${((1 - c / r.price) * 100).toFixed(0)}%`; };
    const nonNeg = (k) => (r) => (r[k] === '' || isNaN(r[k]) || r[k] < 0 ? 'Numero invalido' : '');
    const columns = [
      { key: 'photo', label: '', type: 'static', width: '46px', get: (r) => thumb(r, 32) },
      { key: 'name', label: 'Nombre', type: admin ? 'text' : 'static', sticky: true, width: '200px', validate: (r) => (String(r.name || '').trim() ? '' : 'Falta nombre') },
      { key: 'sku', label: 'SKU', type: 'static', get: (r) => `<span class="mute-s">${esc(r.sku)}</span>` },
      { key: 'kind', label: 'Tipo', type: 'static', get: (r) => `<span class="tag ${r.kind === 'PRODUCT' ? '' : r.kind === 'RESALE' ? 'warn' : 'mute'}">${KIND_LABEL[r.kind]}</span>` },
      { key: 'unit', label: 'Unidad base', type: 'static', get: (r) => `${esc(r.unit)}${r.decimals ? ' <small class="mute-s">(dec.)</small>' : ''}` },
      { key: 'packs', label: 'Presentaciones', type: 'static', get: (r) => (r.kind === 'PRODUCT' ? `<small class="mute-s">${esc(r.recipe || '')}</small>` : r.packagings.map((p) => `<span class="chip">${esc(p.name)} = ${num(p.factor)}</span>`).join(' ') || '<span class="mute-s">—</span>') },
      { key: 'cost', label: 'Costo / u. base', type: admin ? 'num' : 'static', align: 'right', width: '110px', get: (r) => money(r.kind === 'PRODUCT' ? r.recipe_cost : r.cost), validate: (r) => (r.kind === 'PRODUCT' ? '' : nonNeg('cost')(r)) },
      { key: 'price', label: 'Precio venta', type: admin ? 'num' : 'static', align: 'right', width: '110px', get: (r) => (r.kind === 'SUPPLY' ? '<span class="mute-s">—</span>' : money(r.price)), validate: (r) => (r.kind === 'SUPPLY' ? '' : !(+r.price > 0) ? 'Requiere precio' : '') },
      { key: 'margin', label: 'Margen', type: 'calc', align: 'right', get: margin },
      { key: 'min_stock', label: 'Stock min.', type: admin ? 'num' : 'static', align: 'right', width: '90px', get: (r) => (r.kind === 'PRODUCT' ? '<span class="mute-s">—</span>' : num(r.min_stock)), validate: (r) => (r.kind === 'PRODUCT' ? '' : nonNeg('min_stock')(r)) },
      { key: 'stock', label: 'Stock', type: 'static', align: 'right', get: (r) => (r.kind === 'PRODUCT' ? '<span class="mute-s">se produce</span>' : qtyStr(r.stock, r.unit)) },
      ...(admin ? [{ key: 'edit', label: '', type: 'button', get: () => 'Ficha', onClick: async (r) => { if (S.dirty() && !(await leaveOk())) return; productEditor(S.items.find((i) => i.id === r.id), () => { S.dirty = () => 0; go('catalog'); }); } }] : []),
    ];
    $('#view').innerHTML = `
      <details class="card help" ${localStorage.getItem('unitsHelp') ? '' : 'open'}><summary>Como se miden los productos</summary><div class="card-b help-grid">
        <div><b>Unidad base</b><p>En que se cuenta el stock y se escriben las recetas: <i>tallo</i>, <i>kg</i>, <i>metro</i>, <i>unidad</i>. Un ramo de 12 rosas usa 12 tallos.</p></div>
        <div><b>Presentacion de compra</b><p>Como lo vende el proveedor. "Paquete x25" = 25 tallos. Al ingresar 2 paquetes, el stock sube 50 tallos y el costo por tallo se recalcula.</p></div>
        <div><b>Por peso o medida</b><p>Unidad <i>kg</i> o <i>metro</i> con decimales: la receta puede usar 0.25 kg de musgo y en el POS se pide el peso al vender a granel.</p></div>
      </div></details>
      <div class="toolbar" style="margin-top:14px"><div class="search">${icon('search')}<input class="input" id="cq" placeholder="Buscar por nombre o SKU"></div>
        <div class="seg" id="cf">${[['ALL', 'Todo'], ['PRODUCT', 'Arreglos'], ['SUPPLY', 'Insumos'], ['RESALE', 'Reventa']].map(([k, n]) => `<button data-f="${k}" class="${S.catFilter === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <span class="grow"></span><span id="catStat" class="mute-s"></span></div>
      <div class="card"><div id="cgrid"></div>${admin ? '<div class="sheet-help">Edita precios, costos y minimos directo en la tabla (como en Shopify) y guarda todo junto. Para foto, materiales, unidad y presentaciones abre la <b>Ficha</b>.</div>' : '<div class="sheet-help">Ventas puede crear arreglos nuevos. Los precios los edita administracion.</div>'}</div>`;
    $('details.help').ontoggle = (e) => { try { e.target.open ? localStorage.removeItem('unitsHelp') : localStorage.setItem('unitsHelp', 1); } catch {} };
    const sheet = createSheet($('#cgrid'), {
      columns, rows: items,
      onChange: () => {
        const n = sheet.changed().length, errs = sheet.errors().length;
        $('#catStat').innerHTML = n ? `${n} cambio(s) sin guardar${errs ? ` · <span class="neg">${errs} error(es)</span>` : ''}` : '';
        if ($('#saveCat')) { $('#saveCat').disabled = !n || errs > 0; $('#saveCat').textContent = n ? `Guardar ${n} cambio(s)` : 'Guardar cambios'; }
      },
    });
    S.dirty = () => sheet.changed().length;
    const applyFilter = () => { const t = $('#cq').value.toLowerCase(); sheet.filter((r) => (S.catFilter === 'ALL' || r.kind === S.catFilter) && (!t || r.name.toLowerCase().includes(t) || r.sku.toLowerCase().includes(t))); };
    $('#cq').oninput = applyFilter;
    $$('#cf button').forEach((b) => (b.onclick = () => { S.catFilter = b.dataset.f; $$('#cf button').forEach((x) => x.classList.toggle('on', x === b)); applyFilter(); }));
    applyFilter();
    if ($('#saveCat')) $('#saveCat').onclick = act(async () => {
      const errs = sheet.errors(); if (errs.length) throw new Error(errs[0]);
      const rows = sheet.changed().map((r) => ({ id: r.id, sku: r.sku, name: r.name, kind: r.kind, unit: r.unit, decimals: !!r.decimals, price: +r.price || 0, cost: +r.cost || 0, min_stock: +r.min_stock || 0, packagings: r.packagings }));
      const r = await api('/catalog', { rows });
      S.dirty = () => 0; toast(`${r.saved} producto(s) actualizados`, 'ok'); go('catalog');
    });
  },

  async finance() {
    const [rc, sales] = await Promise.all([api('/receivables'), api('/sales')]);
    const ST = { PAID: ['Pagada', 'ok'], PARTIAL: ['Parcial', 'warn'], UNPAID: ['Sin pagar', 'bad'], PENDING_PAYMENT: ['Esperando pago', 'mute'] };
    const pend = rc.reduce((a, r) => a + r.pending, 0);
    $('#view').innerHTML = `<div class="grid g3" style="margin-bottom:16px">
      <div class="card kpi"><small>Por cobrar</small><b style="color:${pend ? 'var(--warn)' : 'inherit'}">${money(pend)}</b><span class="hint">${rc.length} venta(s)</span></div>
      <div class="card kpi"><small>Ventas registradas</small><b>${sales.length}</b></div>
      <div class="card kpi"><small>Monto vendido</small><b>${money(sales.filter((s) => s.status !== 'PENDING_PAYMENT').reduce((a, s) => a + s.total, 0))}</b></div></div>
      <div class="grid"><div class="card"><div class="card-h"><h3>Cuentas por cobrar</h3></div><div class="card-b" style="padding:0">${rc.length ? `<div class="table-wrap"><table class="table"><tr><th>Venta</th><th>Cliente</th><th class="n">Total</th><th class="n">Saldo</th><th></th></tr>
        ${rc.map((r) => `<tr><td>#${r.id}<div style="color:var(--mute);font-size:12px">${time(r.created_at)}</div></td><td><b>${esc(r.customer)}</b></td><td class="n">${money(r.total)}</td><td class="n"><b>${money(r.pending)}</b></td><td class="n"><button class="btn primary sm" data-c="${r.id}" data-p="${r.pending}">Registrar pago</button></td></tr>`).join('')}</table></div>` : empty('Todo cobrado', 'No hay saldos pendientes.')}</div></div>
      <div class="card"><div class="card-h"><h3>Ventas recientes</h3></div><div class="card-b" style="padding:0"><div class="table-wrap"><table class="table"><tr><th>#</th><th>Origen</th><th>Cliente</th><th>Detalle</th><th>Vendedor</th><th class="n">Total</th><th class="n">Pagado</th><th>Estado</th></tr>
        ${sales.map((s) => { const [n, c] = ST[s.status] || [s.status, 'mute']; return `<tr><td>${s.id}</td><td><span class="tag ${s.source === 'SHOPIFY' ? 'mute' : ''}">${s.source}</span></td><td>${esc(s.customer)}</td><td style="color:var(--ink-2)">${esc(s.detail)}</td><td>${esc(s.seller || '—')}</td><td class="n">${money(s.total)}</td><td class="n">${money(s.paid)}</td><td><span class="tag ${c}">${n}</span></td></tr>`; }).join('') || `<tr><td colspan="8">${empty('Aun no hay ventas')}</td></tr>`}</table></div></div></div></div>`;
    $$('[data-c]').forEach((b) => (b.onclick = () => payModal(+b.dataset.c, +b.dataset.p)));
  },

  async reports() {
    const r = await api('/reports');
    const maxP = Math.max(1, ...r.top_products.map((p) => p.revenue));
    const maxS = Math.max(1, ...r.by_seller.map((p) => p.total));
    const sold = r.by_source.reduce((a, s) => a + s.total, 0);
    $('#view').innerHTML = `<div class="grid g4" style="margin-bottom:16px">
      <div class="card kpi"><small>Vendido</small><b>${money(sold)}</b><span class="hint">${r.by_source.map((s) => `${s.source} ${money(s.total)}`).join(' · ') || 'Sin ventas'}</span></div>
      <div class="card kpi"><small>Cobrado</small><b>${money(r.income.collected)}</b></div>
      <div class="card kpi"><small>Por cobrar</small><b>${money(r.income.receivable)}</b></div>
      <div class="card kpi"><small>Stock bajo</small><b style="color:${r.low_stock.length ? 'var(--bad)' : 'inherit'}">${r.low_stock.length}</b><span class="hint">${r.low_stock.map((s) => esc(s.name)).join(', ') || 'Todo en orden'}</span></div></div>
      <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Metas de venta · ${esc(r.goals[0]?.period || '')}</h3><button class="btn sm" id="goal">Fijar meta</button></div><div class="card-b">${r.goals.map((g) => { const p = Math.min(100, g.sold / g.target * 100); const done = g.sold >= g.target; return `<div class="hbar"><span><b>${esc(g.name)}</b></span><span>${money(g.sold)} <span style="color:var(--mute)">/ ${money(g.target)}</span> <span class="tag ${done ? 'ok' : 'warn'}">${done ? 'Alcanzada' : p.toFixed(0) + '%'}</span></span><div class="bar ${done ? 'ok' : ''}"><i style="width:${p}%"></i></div></div>`; }).join('') || empty('Sin metas', 'Fija una meta por vendedor.')}</div></div>
      <div class="card"><div class="card-h"><h3>Productos mas vendidos</h3></div><div class="card-b">${r.top_products.map((p) => `<div class="hbar"><span>${art(p.name)} ${esc(p.name)}</span><span>${num(p.qty)} u · <b>${money(p.revenue)}</b></span><div class="bar accent"><i style="width:${p.revenue / maxP * 100}%"></i></div></div>`).join('') || empty('Aun sin ventas')}</div></div>
      <div class="card"><div class="card-h"><h3>Ventas por vendedor</h3></div><div class="card-b">${r.by_seller.map((s) => `<div class="hbar"><span>${esc(s.name)}</span><span>${s.sales} ventas · <b>${money(s.total)}</b></span><div class="bar"><i style="width:${s.total / maxS * 100}%"></i></div></div>`).join('') || empty('Aun sin ventas')}</div></div>
      <div class="card"><div class="card-h"><h3>Stock bajo</h3></div><div class="card-b" style="padding:0">${r.low_stock.length ? `<table class="table">${r.low_stock.map((s) => `<tr><td>${esc(s.name)}</td><td class="n"><span class="tag bad">${num(s.stock)} ${esc(s.unit)}</span></td><td class="n" style="color:var(--mute)">min ${num(s.min_stock)}</td></tr>`).join('')}</table>` : empty('Todo en orden')}</div></div></div>`;
    $('#goal').onclick = goalModal;
  },

  async shopify() {
    const ev = await api('/shopify/events');
    const prods = sellable();
    const last = VIEWS.shopify.last;
    $('#view').innerHTML = `<div class="grid"><div class="card"><div class="card-h"><h3>Simular pedido de la tienda</h3></div><div class="card-b">
      <div class="steps">
        <div class="step"><small>Paso 1 · orders/create</small><div class="row"><select class="input grow" id="ssku">${prods.map((i) => `<option value="${esc(i.sku)}">${esc(i.name)}</option>`).join('')}<option value="SKU-DESCONOCIDO">SKU sin mapeo (prueba)</option></select><input class="input" id="sqty" type="number" value="1" min="1" style="width:70px"></div><button class="btn" id="s1" style="margin-top:10px;width:100%">Crear pedido</button><div style="color:var(--mute);font-size:12px;margin-top:6px">Se registra, no toca stock.</div></div>
        <div class="step"><small>Paso 2 · orders/paid</small><div style="min-height:38px">${last ? `Pedido <b>${esc(last.order)}</b> · ${esc(last.sku)} x${last.qty}` : '<span style="color:var(--mute)">Primero crea un pedido</span>'}</div><button class="btn primary" id="s2" style="margin-top:10px;width:100%" ${last && !last.paid ? '' : 'disabled'}>Marcar pagado</button><div style="color:var(--mute);font-size:12px;margin-top:6px">Descuenta stock o crea la comanda.</div></div>
        <div class="step"><small>Prueba · reintento</small><div style="min-height:38px;color:var(--mute)">Shopify reintenta webhooks. El ERP debe ignorar el duplicado.</div><button class="btn" id="s3" style="margin-top:10px;width:100%" ${last?.lastId ? '' : 'disabled'}>Reenviar ultimo webhook</button></div>
      </div></div></div>
      <div class="card"><div class="card-h"><h3>Eventos recibidos</h3></div><div class="card-b" style="padding:0">${ev.length ? `<div class="table-wrap"><table class="table"><tr><th>Cuando</th><th>Webhook</th><th>Topic</th><th>Estado</th><th>Detalle</th></tr>${ev.map((e) => `<tr><td style="color:var(--mute);white-space:nowrap">${time(e.created_at)}</td><td><code>${esc(e.webhook_id)}</code></td><td>${e.topic}</td><td><span class="tag ${e.status === 'OK' ? 'ok' : 'bad'}">${e.status === 'OK' ? 'OK' : 'Revisar'}</span></td><td>${esc(e.note)}</td></tr>`).join('')}</table></div>` : empty('Sin eventos', 'Crea un pedido de prueba.')}</div></div></div>`;
    const send = act(async (topic, dup) => {
      const l = VIEWS.shopify.last;
      const id = dup ? l.lastId : 'wh_' + Math.random().toString(36).slice(2, 8);
      const r = await api('/shopify/webhook', { webhook_id: id, topic: dup ? l.lastTopic : topic, shopify_order: l.order, customer: 'Cliente web', line_items: [{ sku: l.sku, qty: l.qty }] });
      l.lastId = id; if (!dup) l.lastTopic = topic;
      if (topic === 'orders/paid' && !dup && r.status === 'PAID') l.paid = true;
      toast(r.duplicated ? 'Duplicado ignorado: no se desconto dos veces' : r.status === 'NEEDS_ATTENTION' ? 'Pedido marcado para revision' : `Webhook ${esc(topic)} procesado`, r.status === 'NEEDS_ATTENTION' ? 'bad' : 'ok');
      go('shopify');
    });
    $('#s1').onclick = () => { VIEWS.shopify.last = { order: '#' + (1000 + Math.floor(Math.random() * 9000)), sku: $('#ssku').value, qty: +$('#sqty').value || 1 }; send('orders/create'); };
    $('#s2').onclick = () => send('orders/paid');
    $('#s3').onclick = () => send(null, true);
  },
};

function payModal(saleId, pending) {
  openModal(`<div class="dialog-h"><h2>Registrar pago · venta #${saleId}</h2></div><div class="dialog-b">
    <div class="notice warn">Saldo pendiente: <b>&nbsp;${money(pending)}</b></div>
    <label class="field"><span>Monto</span><input class="input" id="amt" type="number" min="0.1" step="0.1" value="${pending}"></label>
    <div class="field"><span>Metodo</span><div class="seg" id="pm">${METHODS.map(([k, n], i) => `<button data-m="${k}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</div></div></div>
    <div class="dialog-f"><button class="btn ghost" id="cancel">Cancelar</button><button class="btn primary" id="ok">Registrar</button></div>`, (m) => {
    $$('#pm button', m).forEach((b) => (b.onclick = () => $$('#pm button', m).forEach((x) => x.classList.toggle('on', x === b))));
    $('#cancel', m).onclick = closeModal;
    $('#ok', m).onclick = act(async () => {
      const amount = +$('#amt').value; if (!(amount > 0)) throw new Error('Monto invalido.');
      await api('/payments', { sale_id: saleId, amount, method: $('#pm .on').dataset.m });
      closeModal(); toast(amount >= pending - 0.001 ? 'Venta pagada por completo' : 'Pago parcial registrado', 'ok'); go('finance');
    });
  });
}
function goalModal() {
  openModal(`<div class="dialog-h"><h2>Meta de venta del mes</h2></div><div class="dialog-b">
    <label class="field"><span>Vendedor</span><select class="input" id="gs">${S.users.filter((u) => u.role === 'SALES').map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Monto a alcanzar (S/)</span><input class="input" id="gt" type="number" min="1" step="50"></label></div>
    <div class="dialog-f"><button class="btn ghost" id="cancel">Cancelar</button><button class="btn primary" id="ok">Guardar meta</button></div>`, (m) => {
    $('#cancel', m).onclick = closeModal;
    $('#ok', m).onclick = act(async () => {
      const target = +$('#gt').value; if (!(target > 0)) throw new Error('Indica un monto.');
      await api('/goals', { seller_id: +$('#gs').value, target }); closeModal(); toast('Meta guardada', 'ok'); go('reports');
    });
  });
}

boot().catch((e) => toast(esc(e.message), 'bad'));
