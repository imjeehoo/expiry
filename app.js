(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    form: $('form'), name: $('name'), weight: $('weight'), units: $('units'),
    years: $('years'), order: $('order'), date: $('date'), amount: $('amount'),
    preview: $('preview'), list: $('list'), count: $('count'), clear: $('clear'),
    exportBtn: $('export'), bar: $('bar'), primary: $('primary'), newItem: $('newItem'),
    toast: $('toast'), toastText: $('toastText'), toastAction: $('toastAction'), names: $('names'),
  };

  const UNITS = ['g', 'kg', 'ml', 'L'];
  const YEARS_AHEAD = 5;
  const KEY = 'expiry.v1';

  // ---------- state ----------
  const state = load() || {};
  state.entries = state.entries || [];
  state.names = state.names || {}; // name -> { weight, unit }
  state.unit = state.unit || 'g';
  state.order = state.order || 'md';
  let yearLock = null; // user-picked year, sticky until "New item"

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        entries: state.entries, names: state.names, unit: state.unit, order: state.order,
      }));
    } catch { /* storage unavailable: keep working in memory */ }
  }

  // ---------- dates ----------
  const DIM = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Feb allows 29 until the year is known
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const realDate = (y, m, d) => d <= (m === 2 ? (isLeap(y) ? 29 : 28) : DIM[m]);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  function today() {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
  }

  // Turns typed digits into a month/day, auto-padding where the next digit can't
  // make a valid number ("3" -> "03", "15" as month -> "01" + day "5" -> "05").
  function parseDigits(digits, order) {
    const seq = order === 'md' ? ['m', 'd'] : ['d', 'm'];
    const p = { m: '', d: '' };
    const max = (k) => (k === 'm' ? 12 : p.m.length === 2 ? DIM[+p.m] : 31);
    const valid = (k, s) => {
      const n = +s;
      if (n < 1) return false;
      if (k === 'm') return n <= 12 && (p.d.length < 2 || +p.d <= DIM[n]);
      return n <= max('d');
    };

    let i = 0;
    let j = 0;
    while (j < digits.length && i < 2) {
      const ch = digits[j];
      const k = seq[i];
      const cur = p[k];
      if (cur === '') {
        if (+ch > Math.floor(max(k) / 10)) {
          if (valid(k, '0' + ch)) { p[k] = '0' + ch; i++; }
        } else {
          p[k] = ch;
        }
        j++;
      } else if (valid(k, cur + ch)) {
        p[k] = cur + ch; i++; j++;
      } else if (i === 0 && valid(k, '0' + cur)) {
        p[k] = '0' + cur; i++; // re-read ch as the start of the next part
      } else {
        j++; // impossible digit, ignore it
      }
    }

    const a = p[seq[0]];
    const b = p[seq[1]];
    return {
      complete: i >= 2,
      m: +p.m, d: +p.d,
      display: a + (b ? '.' + b : ''),
    };
  }

  function predictYear(m, d) {
    const t = today();
    for (let y = t.y; y <= t.y + YEARS_AHEAD; y++) {
      if (!realDate(y, m, d)) continue;
      if (y > t.y || m > t.m || (m === t.m && d >= t.d)) return y;
    }
    return t.y;
  }

  function currentDate() {
    const r = parseDigits(el.date.value.replace(/\D/g, ''), state.order);
    if (!r.complete) return { complete: false, empty: el.date.value === '' };
    const auto = yearLock === null;
    const y = auto ? predictYear(r.m, r.d) : yearLock;
    return { complete: true, valid: realDate(y, r.m, r.d), y, m: r.m, d: r.d, auto };
  }

  function relative(y, m, d) {
    const t = today();
    const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.y, t.m - 1, t.d)) / 86400000);
    if (days === 0) return 'today';
    if (days < 0) return `expired ${-days} day${days === -1 ? '' : 's'} ago`;
    if (days < 60) return `in ${days} day${days === 1 ? '' : 's'}`;
    const months = (y - t.y) * 12 + (m - t.m) - (d < t.d ? 1 : 0);
    if (months < 24) return `in ${months} months`;
    return `in ${Math.floor(months / 12)} years`;
  }

  const fmtLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

  // ---------- rendering ----------
  function renderUnits() {
    el.units.innerHTML = '';
    for (const u of UNITS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = u;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(u === state.unit));
      b.dataset.unit = u;
      el.units.appendChild(b);
    }
  }

  function renderYears() {
    const t = today();
    const cd = currentDate();
    const selected = yearLock ?? (cd.complete ? cd.y : null);
    el.years.innerHTML = '';
    for (let y = t.y; y <= t.y + YEARS_AHEAD; y++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = y;
      b.dataset.year = y;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(y === selected));
      if (y === selected && yearLock === null) b.classList.add('auto');
      el.years.appendChild(b);
    }
  }

  function renderOrder() {
    const f = state.order === 'md' ? 'MM.DD' : 'DD.MM';
    el.order.textContent = `Expiry · ${f}`;
    el.date.placeholder = f;
  }

  function renderPreview(msg) {
    el.preview.classList.remove('err');
    if (msg) { el.preview.textContent = msg; return; }
    const cd = currentDate();
    if (!cd.complete) {
      el.preview.innerHTML = cd.empty && document.activeElement === el.date
        ? `Type ${state.order === 'md' ? 'month then day' : 'day then month'}, e.g. ${state.order === 'md' ? '1225' : '2512'}`
        : '&nbsp;';
      return;
    }
    if (!cd.valid) {
      el.preview.classList.add('err');
      el.preview.textContent = `${iso(cd.y, cd.m, cd.d)} doesn’t exist`;
      return;
    }
    el.preview.textContent = `${fmtLong.format(new Date(Date.UTC(cd.y, cd.m - 1, cd.d)))} · ${relative(cd.y, cd.m, cd.d)}${cd.auto ? '' : ' · year fixed'}`;
  }

  const groupKey = (e) => `${e.name}\u0000${e.weight}\u0000${e.unit}`;

  function renderList(flashId) {
    const n = state.entries.length;
    el.exportBtn.disabled = n === 0;
    el.clear.hidden = n === 0;

    const groups = new Map();
    state.entries.forEach((e, idx) => {
      const k = groupKey(e);
      if (!groups.has(k)) groups.set(k, { name: e.name, weight: e.weight, unit: e.unit, rows: [], last: 0, total: 0 });
      const g = groups.get(k);
      g.rows.push(e);
      g.last = idx;
      g.total += e.amount;
    });
    el.count.textContent = n === 0 ? 'No entries' : `${n} entr${n === 1 ? 'y' : 'ies'} · ${groups.size} item${groups.size === 1 ? '' : 's'}`;

    const curKey = groupKey({ name: el.name.value.trim(), weight: el.weight.value.trim(), unit: state.unit });
    const frag = document.createDocumentFragment();
    [...groups.entries()].sort((a, b) => b[1].last - a[1].last).forEach(([k, g]) => {
      const box = document.createElement('div');
      box.className = 'group' + (k === curKey ? ' current' : '');
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'group-head';
      head.dataset.key = k;
      const nm = document.createElement('span');
      nm.className = 'gname';
      nm.textContent = g.name;
      const meta = document.createElement('span');
      meta.className = 'gmeta';
      meta.textContent = `${g.weight ? g.weight + ' ' + g.unit + ' · ' : ''}${g.total} total`;
      head.append(nm, meta);
      box.appendChild(head);

      for (const e of g.rows) {
        const row = document.createElement('div');
        row.className = 'row' + (e.id === flashId ? ' flash' : '');
        row.innerHTML =
          `<span class="rdate"></span><span class="rqty"></span>` +
          `<button type="button" class="rdel" aria-label="Delete"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
        row.querySelector('.rdate').textContent = iso(e.y, e.m, e.d);
        row.querySelector('.rqty').textContent = `× ${e.amount}`;
        row.querySelector('.rdel').dataset.id = e.id;
        box.appendChild(row);
      }
      frag.appendChild(box);
    });
    el.list.replaceChildren(frag);
    if (n === 0) el.list.innerHTML = '<p class="empty">Entries you add appear here.</p>';
  }

  function renderNames() {
    el.names.replaceChildren(...Object.keys(state.names).sort().map((n) => {
      const o = document.createElement('option');
      o.value = n;
      return o;
    }));
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(text, action) {
    clearTimeout(toastTimer);
    el.toastText.textContent = text;
    el.toastAction.hidden = !action;
    el.toastAction.onclick = action ? () => { action(); hideToast(); } : null;
    el.toast.hidden = false;
    toastTimer = setTimeout(hideToast, 4000);
  }
  function hideToast() { el.toast.hidden = true; }

  function shake(node) {
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
  }

  // ---------- actions ----------
  function addLot() {
    const name = el.name.value.trim();
    if (!name) { el.name.focus(); shake(el.name.closest('.card')); return; }
    const cd = currentDate();
    if (!cd.complete || !cd.valid) { el.date.focus(); shake(el.date.closest('.field')); return; }
    const amount = parseInt(el.amount.value, 10) || 1;
    const weight = el.weight.value.trim();

    const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, weight, unit: state.unit, y: cd.y, m: cd.m, d: cd.d, amount };
    state.entries.push(entry);
    state.names[name] = { weight, unit: state.unit };
    save();
    renderNames();
    renderList(entry.id);

    el.date.value = '';
    el.amount.value = '';
    el.date.focus();
    renderYears();
    renderPreview(`✓ Added ${iso(cd.y, cd.m, cd.d)} × ${amount}`);
    updatePrimary();
  }

  function newItem() {
    el.name.value = '';
    el.weight.value = '';
    el.date.value = '';
    el.amount.value = '';
    yearLock = null;
    renderYears();
    renderPreview();
    renderList();
    el.name.focus();
  }

  function next(from) {
    if (from === el.name) el.weight.focus();
    else if (from === el.weight) el.date.focus();
    else if (from === el.date) {
      const cd = currentDate();
      if (cd.complete && cd.valid) el.amount.focus(); else shake(el.date.closest('.field'));
    } else addLot();
  }

  function updatePrimary() {
    const a = document.activeElement;
    el.primary.textContent = a === el.amount ? 'Add' : 'Next';
  }

  function deleteEntry(id) {
    const idx = state.entries.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const [removed] = state.entries.splice(idx, 1);
    save();
    renderList();
    toast(`Deleted ${iso(removed.y, removed.m, removed.d)} × ${removed.amount}`, () => {
      state.entries.splice(idx, 0, removed);
      save();
      renderList(removed.id);
    });
  }

  function loadGroup(key) {
    const e = state.entries.find((x) => groupKey(x) === key);
    if (!e) return;
    el.name.value = e.name;
    el.weight.value = e.weight;
    state.unit = e.unit;
    yearLock = null;
    renderUnits();
    renderYears();
    renderList();
    el.date.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function stamp() {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}`;
  }

  async function exportXlsx() {
    if (!state.entries.length) return;
    const rows = [['Name', 'Weight', 'Unit', 'Expiry', 'Amount']];
    for (const e of state.entries) {
      const w = e.weight.replace(',', '.');
      rows.push([
        e.name,
        /^\d+(\.\d+)?$/.test(w) ? parseFloat(w) : e.weight,
        e.weight ? e.unit : '',
        { date: [e.y, e.m, e.d] },
        e.amount,
      ]);
    }
    const blob = XLSX.build(rows, { sheetName: 'Expiry', widths: [32, 10, 7, 13, 9] });
    const filename = `expiry-${stamp()}.xlsx`;
    const file = new File([blob], filename, { type: blob.type });

    if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast(`Saved ${filename}`);
  }

  // ---------- events ----------
  // Keep the keyboard up when tapping chips/buttons while typing.
  const keepFocus = (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') e.preventDefault();
  };
  for (const n of [el.units, el.years, el.order, el.bar, $('add'), el.toast]) n.addEventListener('mousedown', keepFocus);

  el.form.addEventListener('submit', (e) => { e.preventDefault(); addLot(); });

  for (const input of [el.name, el.weight, el.date]) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); next(input); }
    });
  }

  el.name.addEventListener('input', () => {
    const known = state.names[el.name.value.trim()];
    if (known && !el.weight.value) {
      el.weight.value = known.weight;
      state.unit = known.unit;
      renderUnits();
    }
    renderList();
  });

  el.weight.addEventListener('input', () => {
    const v = el.weight.value.replace(/[^\d.,]/g, '');
    if (v !== el.weight.value) el.weight.value = v;
    renderList();
  });

  el.date.addEventListener('input', (e) => {
    const r = parseDigits(el.date.value.replace(/\D/g, ''), state.order);
    el.date.value = r.display;
    renderYears();
    renderPreview();
    if (r.complete && e.inputType && e.inputType.startsWith('insert')) {
      const cd = currentDate();
      if (cd.valid) el.amount.focus();
    }
  });

  el.amount.addEventListener('input', () => {
    const v = el.amount.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6);
    if (v !== el.amount.value) el.amount.value = v;
  });

  // Backspace on an empty amount jumps back to the date.
  el.amount.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && el.amount.value === '') { e.preventDefault(); el.date.focus(); }
  });

  el.units.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.unit = b.dataset.unit;
    save();
    renderUnits();
    renderList();
  });

  el.years.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const y = +b.dataset.year;
    yearLock = yearLock === y ? null : y;
    renderYears();
    renderPreview();
    if (document.activeElement !== el.amount) {
      const cd = currentDate();
      if (cd.complete && cd.valid) el.amount.focus(); else el.date.focus();
    }
  });

  el.order.addEventListener('click', () => {
    state.order = state.order === 'md' ? 'dm' : 'md';
    save();
    el.date.value = '';
    renderOrder();
    renderYears();
    renderPreview();
    el.date.focus();
  });

  el.list.addEventListener('click', (e) => {
    const del = e.target.closest('.rdel');
    if (del) { deleteEntry(del.dataset.id); return; }
    const head = e.target.closest('.group-head');
    if (head) loadGroup(head.dataset.key);
  });

  el.clear.addEventListener('click', () => {
    if (!confirm(`Delete all ${state.entries.length} entries?`)) return;
    const backup = state.entries;
    state.entries = [];
    save();
    renderList();
    toast('Cleared', () => { state.entries = backup; save(); renderList(); });
  });

  el.exportBtn.addEventListener('click', exportXlsx);
  el.primary.addEventListener('click', () => next(document.activeElement));
  el.newItem.addEventListener('click', newItem);

  // ---------- keyboard accessory bar ----------
  let blurTimer;
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName !== 'INPUT') return;
    clearTimeout(blurTimer);
    el.bar.hidden = false;
    updatePrimary();
    if (e.target === el.date) renderPreview();
    placeBar();
  });
  document.addEventListener('focusout', () => {
    blurTimer = setTimeout(() => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      el.bar.hidden = true;
      renderPreview();
    }, 120);
  });

  const vv = window.visualViewport;
  function placeBar() {
    if (!vv) return;
    const offset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    el.bar.style.transform = offset ? `translateY(${-offset}px)` : '';
    el.bar.classList.toggle('kb', offset > 40);
    // keep the focused field clear of the bar
    const a = document.activeElement;
    if (a && a.tagName === 'INPUT') {
      const r = a.getBoundingClientRect();
      const limit = vv.offsetTop + vv.height - el.bar.offsetHeight - 12;
      if (r.bottom > limit) window.scrollBy(0, r.bottom - limit);
    }
  }
  if (vv) {
    vv.addEventListener('resize', placeBar);
    vv.addEventListener('scroll', placeBar);
  }

  // ---------- init ----------
  renderUnits();
  renderYears();
  renderOrder();
  renderNames();
  renderList();
  renderPreview();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // exposed for tests
  window.__expiry = { parseDigits, predictYear };
})();
