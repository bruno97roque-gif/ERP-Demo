// Planilla tipo Excel reutilizable: celdas editables, teclado, pegar desde Excel,
// validacion por celda, celdas calculadas y deteccion de cambios.
// columns: { key, label, type: 'static'|'text'|'num'|'select'|'check'|'calc'|'button', width, align,
//            get(row) (static/calc), options(row) (select), validate(row) -> mensaje, onClick(row) (button) }
// En la app final esto lo resuelve AG Grid Community; aqui basta con una tabla de inputs.
function createSheet(container, { columns, rows, rowKey = 'id', footer, onChange }) {
  const editable = columns.filter((c) => ['text', 'num', 'select', 'check'].includes(c.type));
  rows.forEach((r) => (r._orig = JSON.stringify(pick(r))));
  function pick(r) { const o = {}; editable.forEach((c) => (o[c.key] = r[c.key] ?? '')); return o; }
  const isDirty = (r) => r._new || JSON.stringify(pick(r)) !== r._orig;
  const parseNum = (v) => (v === '' || v == null ? '' : Number(String(v).replace(',', '.')));

  container.innerHTML = `<div class="sheet-wrap"><table class="sheet"><thead><tr>${columns.map((c) => `<th style="${c.width ? `width:${c.width}` : ''}" class="${c.align === 'right' ? 'n' : ''} ${c.sticky ? 'sticky' : ''}">${c.label}</th>`).join('')}</tr></thead><tbody></tbody>${footer ? '<tfoot><tr></tr></tfoot>' : ''}</table></div>`;
  const tbody = container.querySelector('tbody');

  function cellHtml(c, r) {
    const cls = `${c.align === 'right' ? 'n' : ''} ${c.sticky ? 'sticky' : ''}`;
    const v = r[c.key] ?? '';
    if (c.type === 'static' || c.type === 'calc') return `<td class="${cls} ro" data-k="${c.key}">${c.get ? c.get(r) : esc(v)}</td>`;
    if (c.type === 'button') return `<td class="${cls}"><button class="cell-btn" data-k="${c.key}">${c.get(r)}</button></td>`;
    if (c.type === 'check') return `<td class="${cls} ed"><input type="checkbox" data-k="${c.key}" ${v ? 'checked' : ''}></td>`;
    if (c.type === 'select') return `<td class="${cls} ed"><select data-k="${c.key}">${c.options(r).map(([val, label]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></td>`;
    return `<td class="${cls} ed"><input data-k="${c.key}" value="${esc(v)}" ${c.type === 'num' ? 'inputmode="decimal"' : ''} placeholder="${c.placeholder ? esc(c.placeholder(r)) : ''}" autocomplete="off" spellcheck="false"></td>`;
  }
  function renderRows() {
    tbody.innerHTML = rows.map((r, i) => `<tr data-i="${i}">${columns.map((c) => cellHtml(c, r)).join('')}</tr>`).join('');
    rows.forEach((r, i) => refreshRow(i));
    renderFooter();
  }
  function refreshRow(i) {
    const r = rows[i], tr = tbody.querySelector(`tr[data-i="${i}"]`); if (!tr) return;
    columns.forEach((c) => {
      const el = tr.querySelector(`[data-k="${c.key}"]`); if (!el) return;
      const td = el.closest('td') || el;
      if (c.type === 'calc') el.innerHTML = c.get(r);
      if (c.type === 'button') el.innerHTML = c.get(r);
      const err = c.validate ? c.validate(r) : '';
      td.classList.toggle('err', !!err); td.title = err || '';
      if (editable.includes(c)) td.classList.toggle('changed', !r._new && String(pick(r)[c.key]) !== String(JSON.parse(r._orig)[c.key]));
    });
    tr.classList.toggle('dirty', isDirty(r));
    tr.classList.toggle('new', !!r._new);
  }
  function renderFooter() {
    if (!footer) return;
    container.querySelector('tfoot tr').innerHTML = columns.map((c) => `<td class="${c.align === 'right' ? 'n' : ''} ${c.sticky ? 'sticky' : ''}">${footer[c.key] ? footer[c.key](rows) : ''}</td>`).join('');
  }
  function setValue(i, key, raw) {
    const c = columns.find((x) => x.key === key);
    rows[i][key] = c.type === 'num' ? parseNum(raw) : c.type === 'check' ? !!raw : raw;
    c.onSet?.(rows[i]);
    refreshRow(i); renderFooter(); onChange?.();
  }
  // Navegacion por teclado entre celdas editables.
  function focusCell(i, ci) {
    const tr = tbody.querySelector(`tr[data-i="${i}"]`); if (!tr || tr.hidden) return false;
    const el = tr.querySelector(`[data-k="${editable[ci]?.key}"]`); if (!el) return false;
    el.focus(); el.select?.(); return true;
  }
  const visibleIdx = () => [...tbody.querySelectorAll('tr')].filter((tr) => !tr.hidden).map((tr) => +tr.dataset.i);
  function move(i, ci, di, dc) {
    const vis = visibleIdx(); let p = vis.indexOf(i);
    if (dc) { const n = ci + dc; if (n >= 0 && n < editable.length) return focusCell(i, n); return; }
    p += di; if (p >= 0 && p < vis.length) focusCell(vis[p], ci);
  }
  tbody.addEventListener('input', (e) => { const el = e.target; if (el.dataset.k && el.type !== 'checkbox') setValue(+el.closest('tr').dataset.i, el.dataset.k, el.value); });
  tbody.addEventListener('change', (e) => { const el = e.target; if (el.type === 'checkbox' || el.tagName === 'SELECT') setValue(+el.closest('tr').dataset.i, el.dataset.k, el.type === 'checkbox' ? el.checked : el.value); });
  tbody.addEventListener('click', (e) => { const b = e.target.closest('.cell-btn'); if (b) columns.find((c) => c.key === b.dataset.k).onClick(rows[+b.closest('tr').dataset.i], () => refreshRow(+b.closest('tr').dataset.i)); });
  tbody.addEventListener('focusin', (e) => e.target.closest('td')?.classList.add('focus'));
  tbody.addEventListener('focusout', (e) => e.target.closest('td')?.classList.remove('focus'));
  tbody.addEventListener('keydown', (e) => {
    const el = e.target; if (!el.dataset.k) return;
    const i = +el.closest('tr').dataset.i, ci = editable.findIndex((c) => c.key === el.dataset.k);
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0, atEnd = el.selectionStart === (el.value || '').length;
    if (e.key === 'Enter' || (e.key === 'ArrowDown' && el.tagName !== 'SELECT')) { e.preventDefault(); move(i, ci, e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'ArrowUp' && el.tagName !== 'SELECT') { e.preventDefault(); move(i, ci, -1, 0); }
    else if (e.key === 'ArrowRight' && (el.tagName !== 'INPUT' || el.type === 'checkbox' || atEnd)) { e.preventDefault(); move(i, ci, 0, 1); }
    else if (e.key === 'ArrowLeft' && (el.tagName !== 'INPUT' || el.type === 'checkbox' || atStart)) { e.preventDefault(); move(i, ci, 0, -1); }
    else if (e.key === 'Escape' && el.tagName === 'INPUT' && el.type !== 'checkbox') { const orig = JSON.parse(rows[i]._orig || '{}')[el.dataset.k] ?? ''; el.value = orig; setValue(i, el.dataset.k, orig); }
  });
  // Pegar un bloque copiado de Excel (filas con \n, columnas con \t) desde la celda actual.
  tbody.addEventListener('paste', (e) => {
    const el = e.target; if (!el.dataset.k) return;
    const text = e.clipboardData.getData('text'); if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const vis = visibleIdx(), start = vis.indexOf(+el.closest('tr').dataset.i), ci = editable.findIndex((c) => c.key === el.dataset.k);
    const grid = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
    let n = 0;
    grid.forEach((cells, dr) => cells.forEach((val, dc) => {
      const ri = vis[start + dr], col = editable[ci + dc];
      if (ri == null || !col || col.type === 'select' || col.type === 'check') return;
      const input = tbody.querySelector(`tr[data-i="${ri}"] [data-k="${col.key}"]`);
      input.value = val.trim(); setValue(ri, col.key, val.trim()); n++;
    }));
    toast(`Pegadas ${n} celdas`);
  });

  renderRows();
  return {
    rows,
    changed: () => rows.filter(isDirty),
    errors: () => rows.flatMap((r) => columns.filter((c) => c.validate && c.validate(r)).map((c) => `${r.name || r.sku || 'Fila nueva'}: ${c.validate(r)}`)),
    filter(fn) { tbody.querySelectorAll('tr').forEach((tr) => (tr.hidden = !fn(rows[+tr.dataset.i]))); },
    addRow(r) { r._new = true; rows.unshift(r); r._orig = JSON.stringify(pick(r)); renderRows(); focusCell(0, 0); onChange?.(); },
    refresh: renderRows,
    focusFirst() { const v = visibleIdx(); if (v.length) focusCell(v[0], 0); },
  };
}
