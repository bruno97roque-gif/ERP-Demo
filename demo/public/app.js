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
  waste: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
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
  waste: { label: 'Mermas', sub: 'Perdidas por insumo y motivo.', roles: ['ADMIN', 'PRODUCTION'] },
  finance: { label: 'Cobranza', sub: 'Cuentas por cobrar y ventas recientes.', roles: ['ADMIN', 'SALES'] },
  reports: { label: 'Reportes', sub: 'Ventas, vendedores, metas e inventario.', roles: ['ADMIN'] },
  shopify: { label: 'Shopify', sub: 'Simulador de pedidos de la tienda online.', roles: ['ADMIN'] },
};
const METHODS = [['EFECTIVO', 'Efectivo'], ['TARJETA', 'Tarjeta'], ['YAPE_PLIN', 'Yape / Plin'], ['TRANSFERENCIA', 'Transferencia'], ['CULQI', 'Culqi']];
const S = { me: null, users: [], items: [], cash: null, tab: 'pos', cart: [], filter: 'ALL', search: '', method: 'EFECTIVO', pending: 0, seenOrders: new Set(), busy: false };

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
  $('#user').onchange = () => { S.me = S.users.find((u) => u.id == $('#user').value); S.cart = []; go(S.tab); };
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
  $('#topActions').innerHTML = '';
}
const isOpen = () => S.cash?.session && !S.cash.session.closed_at;
async function go(tab) {
  S.tab = tab || S.tab;
  const prod = await refresh();
  shell();
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
      <div class="p-art">${art(i.name)}${inCart ? `<span class="qty">${inCart}</span>` : ''}</div>
      <div class="p-body"><b>${esc(i.name)}</b><small>${i.kind === 'PRODUCT' ? 'Arreglo · se produce' : `Reventa · stock ${num(i.stock)}`}</small><span class="p-price">${money(i.price)}</span></div></button>`;
  }).join('') || `<div class="card" style="grid-column:1/-1">${empty('Sin resultados', 'Prueba otra busqueda o crea un arreglo nuevo.')}</div>`;
  $$('#products .p-card').forEach((b) => (b.onclick = () => addCart(+b.dataset.id)));
}
function addCart(id) {
  const i = S.items.find((x) => x.id === id);
  const l = S.cart.find((x) => x.item_id === id);
  if (i.kind === 'RESALE' && (l?.qty || 0) + 1 > i.stock) return toast(`No hay mas stock de ${esc(i.name)}`, 'bad');
  l ? l.qty++ : S.cart.push({ item_id: id, name: i.name, kind: i.kind, qty: 1, price: i.price });
  renderCatalog(); renderTicket();
}
function setQty(id, d) {
  const l = S.cart.find((x) => x.item_id === id); if (!l) return;
  const i = S.items.find((x) => x.id === id);
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
    <div class="ticket-lines">${S.cart.map((l) => `<div class="t-line"><div><b>${esc(l.name)}</b><small>${money(l.price)} c/u${l.kind === 'PRODUCT' ? ' · genera comanda' : ''}</small></div>
      <div class="stepper"><button data-q="${l.item_id}" data-d="-1" aria-label="Quitar uno">−</button><span>${l.qty}</span><button data-q="${l.item_id}" data-d="1" aria-label="Agregar uno">+</button></div>
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
function newProductModal() {
  const supplies = S.items.filter((i) => i.kind === 'SUPPLY');
  const opts = supplies.map((s) => `<option value="${s.id}">${esc(s.name)} (${esc(s.unit)})</option>`).join('');
  const row = () => `<div class="recipe-row"><select class="input r-sup">${opts}</select><input class="input r-qty" type="number" min="0.1" step="0.1" value="1"><button class="btn ghost sm r-del" aria-label="Quitar">${icon('x')}</button></div>`;
  openModal(`<div class="dialog-h"><h2>Nuevo arreglo</h2><button class="btn ghost sm" id="cancelX">${icon('x')}</button></div>
    <div class="dialog-b">
      <div class="row"><label class="field grow"><span>Nombre</span><input class="input" id="pname" placeholder="Ej. Ramo primavera"></label><label class="field" style="width:130px"><span>Precio de venta</span><input class="input" id="pprice" type="number" min="1" step="0.5"></label></div>
      <div class="field"><span>Receta (insumos por unidad)</span><div id="rows" style="display:flex;flex-direction:column;gap:8px">${row()}</div>
      <button class="btn ghost sm" id="addRow" style="align-self:flex-start">${icon('plus')} Agregar insumo</button></div>
      <div id="margin"></div></div>
    <div class="dialog-f"><button class="btn ghost" id="cancel">Cancelar</button><button class="btn primary" id="save">Crear y listar</button></div>`, (m) => {
    const calc = () => {
      const cost = $$('.recipe-row', m).reduce((a, r) => a + (supplies.find((s) => s.id == $('.r-sup', r).value)?.price || 0) * (+$('.r-qty', r).value || 0), 0);
      const price = +$('#pprice', m).value || 0;
      $('#margin', m).innerHTML = `<div class="notice ${price && price > cost ? 'ok' : 'warn'}">Costo de insumos ${money(cost)}${price ? ` · Margen ${money(price - cost)} (${price ? ((1 - cost / price) * 100).toFixed(0) : 0}%)` : ''}</div>`;
    };
    const wire = () => { $$('.r-del', m).forEach((b) => (b.onclick = () => { if ($$('.recipe-row', m).length > 1) b.parentElement.remove(); calc(); })); };
    m.oninput = calc; m.onchange = calc;
    $('#addRow', m).onclick = () => { $('#rows', m).insertAdjacentHTML('beforeend', row()); wire(); calc(); };
    $('#cancel', m).onclick = $('#cancelX', m).onclick = closeModal;
    $('#save', m).onclick = act(async () => {
      const name = $('#pname', m).value.trim(), price = +$('#pprice', m).value;
      const recipe = $$('.recipe-row', m).map((r) => ({ supply_id: +$('.r-sup', r).value, qty: +$('.r-qty', r).value })).filter((r) => r.qty > 0);
      if (!name) throw new Error('Ponle un nombre al arreglo.');
      if (!(price > 0)) throw new Error('Indica un precio de venta.');
      if (new Set(recipe.map((r) => r.supply_id)).size !== recipe.length) throw new Error('Hay insumos repetidos en la receta.');
      await api('/products', { name, price, recipe });
      closeModal(); toast(`Arreglo <b>${esc(name)}</b> creado y disponible en el POS`, 'ok');
      S.search = ''; await go('pos');
    });
    wire(); calc();
  });
}

// ---------- vistas ----------
const VIEWS = {
  async pos() {
    $('#topActions').innerHTML = `<button class="btn" id="newP">${icon('plus')} Nuevo arreglo</button>${isOpen() ? '<button class="btn" id="closeC">Cerrar caja</button>' : '<button class="btn primary" id="openC">Abrir caja</button>'}`;
    $('#newP').onclick = newProductModal;
    $('#closeC') && ($('#closeC').onclick = closeCashModal);
    $('#openC') && ($('#openC').onclick = openCashModal);
    $('#view').innerHTML = `<div class="pos-layout"><div>
      <div class="toolbar"><div class="search">${icon('search')}<input class="input" id="q" placeholder="Buscar producto o SKU" autocomplete="off" value="${esc(S.search)}"><kbd>/</kbd></div>
        <div class="seg" id="filters">${[['ALL', 'Todo'], ['PRODUCT', 'Arreglos'], ['RESALE', 'Reventa']].map(([k, n]) => `<button data-f="${k}" class="${S.filter === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="products" id="products"></div></div>
      <div class="card ticket" id="ticket"></div></div>`;
    const q = $('#q');
    q.oninput = () => { S.search = q.value; renderCatalog(); };
    q.onkeydown = (e) => { if (e.key === 'Enter') { const f = filtered()[0]; if (f) { addCart(f.id); q.select(); } } };
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
    const value = stockItems.reduce((a, i) => a + i.stock * i.price, 0);
    if (S.me.role === 'ADMIN') { $('#topActions').innerHTML = `<button class="btn primary" id="buy">${icon('plus')} Ingreso de mercaderia</button>`; $('#buy').onclick = purchaseModal; }
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

  async waste() {
    const w = await api('/waste');
    const REASONS = [['MARCHITA', 'Marchita'], ['DANADA', 'Danada'], ['VENCIDA', 'Vencida'], ['ERROR_PRODUCCION', 'Error de produccion'], ['OTRO', 'Otro']];
    const byReason = REASONS.map(([k, n]) => [n, w.filter((x) => x.reason === k).reduce((a, x) => a + x.qty, 0)]);
    const max = Math.max(1, ...byReason.map((r) => r[1]));
    $('#view').innerHTML = `<div class="grid g3"><div class="card"><div class="card-h"><h3>Registrar merma</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">
        <label class="field"><span>Insumo o producto</span><select class="input" id="witem">${S.items.filter((i) => i.kind !== 'PRODUCT').map((i) => `<option value="${i.id}">${esc(i.name)} · stock ${num(i.stock)}</option>`).join('')}</select></label>
        <label class="field"><span>Cantidad</span><input class="input" id="wqty" type="number" min="1" value="1"></label>
        <div class="field"><span>Motivo</span><div class="seg" id="reasons">${REASONS.map(([k, n], i) => `<button data-r="${k}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</div></div>
        <button class="btn primary" id="addW">Registrar merma</button></div></div>
      <div class="card"><div class="card-h"><h3>Por motivo</h3></div><div class="card-b">${byReason.map(([n, v]) => `<div class="hbar"><span>${n}</span><b>${num(v)}</b><div class="bar bad"><i style="width:${v / max * 100}%"></i></div></div>`).join('')}</div></div>
      <div class="card"><div class="card-h"><h3>Historial</h3></div><div class="card-b" style="padding:0">${w.length ? `<table class="table">${w.map((x) => `<tr><td><b>${esc(x.item)}</b><div style="color:var(--mute);font-size:12px">${time(x.created_at)} · ${esc(x.user)}</div></td><td><span class="tag bad">${esc(x.reason)}</span></td><td class="n neg">-${num(x.qty)}</td></tr>`).join('')}</table>` : empty('Sin mermas registradas')}</div></div></div>`;
    $$('#reasons button').forEach((b) => (b.onclick = () => $$('#reasons button').forEach((x) => x.classList.toggle('on', x === b))));
    $('#addW').onclick = act(async () => {
      const qty = +$('#wqty').value; if (!(qty > 0)) throw new Error('La cantidad debe ser mayor a 0.');
      await api('/waste', { item_id: +$('#witem').value, qty, reason: $('#reasons .on').dataset.r });
      toast('Merma registrada y descontada del stock', 'ok'); go('waste');
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

function purchaseModal() {
  openModal(`<div class="dialog-h"><h2>Ingreso de mercaderia</h2></div><div class="dialog-b">
    <label class="field"><span>Item</span><select class="input" id="pitem">${S.items.filter((i) => i.kind !== 'PRODUCT').map((i) => `<option value="${i.id}">${esc(i.name)} · stock ${num(i.stock)} ${esc(i.unit)}</option>`).join('')}</select></label>
    <div class="row"><label class="field grow"><span>Cantidad</span><input class="input" id="pqty" type="number" min="1"></label><label class="field grow"><span>Referencia</span><input class="input" id="pref" placeholder="Proveedor / guia"></label></div></div>
    <div class="dialog-f"><button class="btn ghost" id="cancel">Cancelar</button><button class="btn primary" id="ok">Ingresar</button></div>`, (m) => {
    $('#cancel', m).onclick = closeModal;
    $('#ok', m).onclick = act(async () => {
      const qty = +$('#pqty').value; if (!(qty > 0)) throw new Error('La cantidad debe ser mayor a 0.');
      await api('/purchase', { item_id: +$('#pitem').value, qty, ref: $('#pref').value || 'Compra' });
      closeModal(); toast('Ingreso registrado', 'ok'); go('inventory');
    });
  });
}
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
