(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    form: $('form'), name: $('name'), weight: $('weight'), units: $('units'),
    home: $('home'), addView: $('addView'), homeBar: $('homeBar'), openAdd: $('openAdd'), back: $('back'), newItem: $('newItem'), recent: $('recent'), recentHead: $('recentHead'), recentList: $('recentList'), date: $('date'), amount: $('amount'),
    preview: $('preview'), list: $('list'), count: $('count'), clear: $('clear'),
    exportBtn: $('export'), importBtn: $('import'), file: $('file'), bar: $('bar'), primary: $('primary'),
    toast: $('toast'), toastText: $('toastText'), toastAction: $('toastAction'), names: $('names'),
  };

  const UNITS = ['g', 'kg', 'ml', 'L'];
  const KEY = 'expiry.v1';

  // ---------- state ----------
  const state = load() || {};
  state.entries = state.entries || [];
  state.names = state.names || {}; // name -> { weight, unit }
  state.unit = state.unit || 'g';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        entries: state.entries, names: state.names, unit: state.unit,
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

  // YYMMDD typed as plain digits -> 20YY-MM-DD, shown as "YY.MM.DD".
  function parseDigits(digits) {
    const d = digits.slice(0, 6);
    return {
      complete: d.length === 6,
      y: 2000 + +d.slice(0, 2), m: +d.slice(2, 4), d: +d.slice(4, 6),
      display: [d.slice(0, 2), d.slice(2, 4), d.slice(4, 6)].filter(Boolean).join('.'),
    };
  }

  function currentDate() {
    const r = parseDigits(el.date.value.replace(/\D/g, ''));
    if (!r.complete) return { complete: false, empty: el.date.value === '' };
    return { complete: true, valid: r.m >= 1 && r.m <= 12 && r.d >= 1 && realDate(r.y, r.m, r.d), y: r.y, m: r.m, d: r.d };
  }

  function relative(y, m, d) {
    const t = today();
    const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.y, t.m - 1, t.d)) / 86400000);
    if (days === 0) return '오늘';
    if (days < 0) return `${-days}일 지남`;
    if (days < 60) return `${days}일 후`;
    const months = (y - t.y) * 12 + (m - t.m) - (d < t.d ? 1 : 0);
    if (months < 24) return `${months}개월 후`;
    return `${Math.floor(months / 12)}년 후`;
  }

  const fmtLong = new Intl.DateTimeFormat('ko-KR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

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

  function renderPreview(msg) {
    el.preview.classList.remove('err');
    if (msg) { el.preview.textContent = msg; return; }
    const cd = currentDate();
    if (!cd.complete) {
      el.preview.innerHTML = cd.empty && document.activeElement === el.date
        ? '연 월 일 6자리 · 예: 261225'
        : '&nbsp;';
      return;
    }
    if (!cd.valid) {
      el.preview.classList.add('err');
      el.preview.textContent = `${iso(cd.y, cd.m, cd.d)} 존재하지 않는 날짜예요`;
      return;
    }
    el.preview.textContent = `${fmtLong.format(new Date(Date.UTC(cd.y, cd.m - 1, cd.d)))} · ${relative(cd.y, cd.m, cd.d)}`;
  }

  // Shows 1000g+ as kg and 1000ml+ as L; the typed value and the export keep g / ml.
  function fmtWeight(weight, unit) {
    if (!weight) return '';
    if (/^\d+([.,]\d+)?$/.test(weight)) {
      const n = parseFloat(weight.replace(',', '.'));
      if (n >= 1000 && unit === 'g') return `${+(n / 1000).toFixed(2)}kg`;
      if (n >= 1000 && unit === 'ml') return `${+(n / 1000).toFixed(2)}L`;
    }
    return weight + unit;
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
    el.count.textContent = n === 0 ? '기록 없음' : `${n}건 · ${groups.size}개 품목`;

    const frag = document.createDocumentFragment();
    [...groups.entries()].forEach(([k, g]) => { // Map keeps first-entered order
      g.rows.sort((a, b) => iso(a.y, a.m, a.d).localeCompare(iso(b.y, b.m, b.d)));
      const box = document.createElement('div');
      box.className = 'group';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'group-head';
      head.dataset.key = k;
      const nm = document.createElement('span');
      nm.className = 'gname';
      nm.textContent = g.name;
      const meta = document.createElement('span');
      meta.className = 'gmeta';
      meta.textContent = `${g.weight ? fmtWeight(g.weight, g.unit) + ' · ' : ''}${g.total}x`;
      head.append(nm, meta);
      box.appendChild(head);

      for (const e of g.rows) {
        const row = document.createElement('div');
        row.className = 'row' + (e.id === flashId ? ' flash' : '');
        row.innerHTML =
          `<span class="rdate"></span><span class="rqty"></span>` +
          `<button type="button" class="rdel" aria-label="삭제"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
        row.querySelector('.rdate').textContent = iso(e.y, e.m, e.d);
        row.querySelector('.rqty').textContent = `${e.amount}x`;
        row.querySelector('.rdel').dataset.id = e.id;
        box.appendChild(row);
      }
      frag.appendChild(box);
    });
    el.list.replaceChildren(frag);
    if (n === 0) el.list.innerHTML = '<p class="empty">추가한 기록이 여기에 표시돼요.</p>';
    renderRecent();
  }

  // Entries added since the add screen was opened, pinned above the bar for quick checking.
  let recent = [];
  function renderRecent() {
    const rows = recent.map((id) => state.entries.find((e) => e.id === id)).filter(Boolean).reverse();
    el.recent.hidden = rows.length === 0;
    el.recentHead.textContent = `이번에 추가 ${rows.length}건`;
    el.recentList.replaceChildren(...rows.map((e) => {
      const row = document.createElement('div');
      row.className = 'rrow';
      row.innerHTML = '<span class="rname"></span><span class="rmeta"></span><button type="button" class="rdel" aria-label="삭제"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>';
      row.querySelector('.rname').textContent = e.name + (e.weight ? ` ${fmtWeight(e.weight, e.unit)}` : '');
      row.querySelector('.rmeta').textContent = `${iso(e.y, e.m, e.d).slice(2)} · ${e.amount}x`;
      row.querySelector('.rdel').dataset.id = e.id;
      return row;
    }));
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
  const STEPS = ['name', 'weight', 'date', 'amount'].map((k, i) => ({ i, box: $('s-' + k), val: $('v-' + k), input: el[k] }));
  const PLACEHOLDER = ['품목 이름', '무게 없음', '유통기한', '1x'];
  let step = 0;        // furthest revealed step
  let editing = null;  // earlier step reopened by tapping its text

  function stepText(i) {
    if (i === 0) return el.name.value.trim();
    if (i === 1) { const w = el.weight.value.trim(); return w ? fmtWeight(w, state.unit) : ''; }
    if (i === 2) { const cd = currentDate(); return cd.complete && cd.valid ? `${cd.y}.${pad(cd.m)}.${pad(cd.d)}` : ''; }
    return el.amount.value ? `${el.amount.value}x` : '';
  }

  function showSteps(focus) {
    const act = editing ?? step;
    for (const s of STEPS) {
      s.box.classList.toggle('open', s.i <= step);
      s.box.classList.toggle('active', s.i === act);
      const t = stepText(s.i);
      s.val.textContent = t || PLACEHOLDER[s.i];
      s.val.classList.toggle('empty', !t);
      s.val.classList.toggle('num', s.i > 0 && !!t);
    }
    if (focus) {
      STEPS[act].input.focus({ preventScroll: true });
      if (window.scrollY) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    updatePrimary();
  }

  function advance(to) {
    if (editing !== null) editing = null; else step = Math.max(step, to);
    showSteps(true);
  }

  function addLot() {
    const name = el.name.value.trim();
    if (!name) { editing = 0; showSteps(true); shake(STEPS[0].box); return; }
    const cd = currentDate();
    if (!cd.complete || !cd.valid) { editing = 2; showSteps(true); shake(STEPS[2].box); return; }
    const amount = parseInt(el.amount.value, 10) || 1;
    const weight = el.weight.value.trim();

    const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, weight, unit: state.unit, y: cd.y, m: cd.m, d: cd.d, amount };
    state.entries.push(entry);
    recent.push(entry.id);
    state.names[name] = { weight, unit: state.unit };
    save();
    renderNames();
    renderList(entry.id);

    el.date.value = '';
    el.amount.value = '';
    editing = null;
    step = 2;
    showSteps(true);
    renderPreview(`✓ ${iso(cd.y, cd.m, cd.d)} · ${amount}x 추가됨`);
  }

  function resetForm() {
    el.name.value = '';
    el.weight.value = '';
    el.date.value = '';
    el.amount.value = '';
    step = 0;
    editing = null;
    renderPreview();
  }

  // ---------- navigation: list is home, adding happens on its own screen ----------
  let homeScroll = 0;
  function route() {
    const add = location.hash === '#add';
    if (add === !el.addView.hidden) return;
    el.home.hidden = add;
    el.homeBar.hidden = add;
    el.addView.hidden = !add;
    el.bar.hidden = !add;
    document.body.classList.toggle('adding', add);
    if (add) { homeScroll = window.scrollY; window.scrollTo(0, 0); showSteps(true); }
    else { renderList(); window.scrollTo(0, homeScroll); document.activeElement && document.activeElement.blur(); }
    setBarHeight();
  }
  function openAdd(key) {
    resetForm();
    recent = [];
    renderRecent();
    if (key) {
      const e = state.entries.find((x) => groupKey(x) === key);
      if (e) { el.name.value = e.name; el.weight.value = e.weight; state.unit = e.unit; step = 2; renderUnits(); }
    }
    location.hash = '#add';
    route();
  }
  function goHome() {
    if (location.hash === '#add') history.back(); else route();
  }

  function next(from) {
    if (from === el.name) {
      if (!el.name.value.trim()) { shake(STEPS[0].box); return; }
      advance(1);
    } else if (from === el.weight) advance(2);
    else if (from === el.date) {
      const cd = currentDate();
      if (cd.complete && cd.valid) advance(3); else shake(STEPS[2].box);
    } else addLot();
  }

  function updatePrimary() {
    el.primary.textContent = (editing ?? step) === 3 ? '추가' : '다음';
  }

  function deleteEntry(id) {
    const idx = state.entries.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const [removed] = state.entries.splice(idx, 1);
    save();
    renderList();
    toast(`삭제됨 ${iso(removed.y, removed.m, removed.d)} · ${removed.amount}x`, () => {
      state.entries.splice(idx, 0, removed);
      save();
      renderList(removed.id);
    });
  }

  function stamp() {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}`;
  }

  async function exportXlsx() {
    if (!state.entries.length) return;
    const rows = [['이름', '무게', '단위', '유통기한', '수량']];
    // Items stay in the order they were first entered; each item's dates run earliest first.
    const order = new Map();
    state.entries.forEach((e) => { const k = groupKey(e); if (!order.has(k)) order.set(k, order.size); });
    const sorted = [...state.entries].sort((a, b) =>
      order.get(groupKey(a)) - order.get(groupKey(b)) ||
      iso(a.y, a.m, a.d).localeCompare(iso(b.y, b.m, b.d)));
    for (const e of sorted) {
      let w = parseFloat(e.weight.replace(',', '.'));
      const numeric = /^\d+([.,]\d+)?$/.test(e.weight);
      let unit = e.weight ? e.unit : '';
      if (numeric && unit === 'kg') { w = Math.round(w * 1000 * 100) / 100; unit = 'g'; }
      else if (numeric && unit === 'L') { w = Math.round(w * 1000 * 100) / 100; unit = 'ml'; }
      rows.push([e.name, numeric ? w : e.weight, unit, { date: [e.y, e.m, e.d] }, e.amount]);
    }
    const blob = XLSX.build(rows, { sheetName: '유통기한', widths: [32, 10, 7, 13, 9] });
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
    toast(`${filename} 저장됨`);
  }

  // ---------- import ----------
  const HEADERS = {
    name: /name|이름|품명|상품|제품/i,
    weight: /weight|무게|중량|용량|규격/i,
    unit: /^\s*unit|단위/i,
    expiry: /expir|유통|소비|기한|date|날짜/i,
    amount: /amount|qty|quantity|count|개수|갯수|수량/i,
  };

  function parseWeight(v, fallbackUnit) {
    if (v === null || v === undefined || v === '') return { weight: '', unit: fallbackUnit };
    if (typeof v === 'number') return { weight: String(v), unit: fallbackUnit };
    const m = String(v).trim().match(/^([\d.,]+)\s*(kg|g|ml|l)?$/i);
    if (!m) return { weight: String(v).trim(), unit: fallbackUnit };
    const u = m[2] ? (m[2].toLowerCase() === 'l' ? 'L' : m[2].toLowerCase()) : fallbackUnit;
    return { weight: m[1].replace(',', '.'), unit: u };
  }

  function parseDateCell(v) {
    if (v && v.date) return v.date;
    const m = typeof v === 'string' && v.trim().match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*$/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  // rows: header row + data rows (see XLSX.parse). Blank/incomplete rows are skipped.
  function rowsToEntries(rows) {
    const hi = rows.findIndex((r) => r.some((c) => typeof c === 'string' && HEADERS.name.test(c)) &&
                                     r.some((c) => typeof c === 'string' && HEADERS.expiry.test(c)));
    if (hi < 0) return null;
    const col = {};
    rows[hi].forEach((c, i) => {
      if (typeof c !== 'string') return;
      for (const k of Object.keys(HEADERS)) if (!(k in col) && HEADERS[k].test(c)) { col[k] = i; break; }
    });
    const out = [];
    let skipped = 0;
    for (const r of rows.slice(hi + 1)) {
      if (!r.some((c) => c !== null && c !== '')) continue; // separator row
      const name = String(r[col.name] ?? '').trim();
      const dt = parseDateCell(r[col.expiry]);
      if (!name || !dt || !realDate(dt[0], dt[1], dt[2])) { skipped++; continue; }
      const { weight, unit } = parseWeight(r[col.weight], 'g');
      const cu = col.unit !== undefined ? String(r[col.unit] ?? '').trim().toLowerCase() : '';
      const u = UNITS.find((x) => x.toLowerCase() === cu) || unit;
      out.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + out.length,
        name, weight, unit: u, y: dt[0], m: dt[1], d: dt[2],
        amount: Math.max(1, Math.round(Number(r[col.amount])) || 1),
      });
    }
    return { entries: out, skipped };
  }

  async function importFile(file) {
    try {
      const rows = await XLSX.parse(await file.arrayBuffer());
      const res = rowsToEntries(rows);
      if (!res) { toast('이름 / 유통기한 열을 찾을 수 없어요'); return; }
      const seen = new Set(state.entries.map((e) => `${groupKey(e)}\u0000${iso(e.y, e.m, e.d)}\u0000${e.amount}`));
      const fresh = res.entries.filter((e) => {
        const k = `${groupKey(e)}\u0000${iso(e.y, e.m, e.d)}\u0000${e.amount}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (!fresh.length) { toast(res.skipped ? `가져온 항목 없음 · ${res.skipped}건 건너뜀` : '새로 가져올 항목이 없어요'); return; }
      const before = state.entries.length;
      const prevNames = JSON.stringify(state.names);
      state.entries.push(...fresh);
      for (const e of fresh) state.names[e.name] = { weight: e.weight, unit: e.unit };
      save();
      renderNames();
      renderList();
      const dup = res.entries.length - fresh.length;
      const note = [dup && `중복 ${dup}건`, res.skipped && `${res.skipped}건 건너뜀`].filter(Boolean).join(', ');
      toast(`${fresh.length}건 가져옴${note ? ` · ${note}` : ''}`, () => {
        state.entries.splice(before, fresh.length);
        state.names = JSON.parse(prevNames);
        save();
        renderNames();
        renderList();
      });
    } catch (err) {
      toast('파일을 읽을 수 없어요');
    }
  }

  // ---------- events ----------
  // Keep the keyboard up when tapping chips/buttons while typing.
  const keepFocus = (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') e.preventDefault();
  };
  for (const n of [el.units, el.bar, el.toast]) n.addEventListener('mousedown', keepFocus);

  el.form.addEventListener('submit', (e) => { e.preventDefault(); addLot(); });

  for (const input of [el.name, el.weight, el.date, el.amount]) {
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
    const r = parseDigits(el.date.value.replace(/\D/g, ''));
    el.date.value = r.display;
    renderPreview();
    if (r.complete && e.inputType && e.inputType.startsWith('insert')) {
      if (currentDate().valid) next(el.date);
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

  el.recentList.addEventListener('click', (e) => {
    const del = e.target.closest('.rdel');
    if (del) deleteEntry(del.dataset.id);
  });

  el.list.addEventListener('click', (e) => {
    const del = e.target.closest('.rdel');
    if (del) { deleteEntry(del.dataset.id); return; }
    const head = e.target.closest('.group-head');
    if (head) openAdd(head.dataset.key);
  });

  el.clear.addEventListener('click', () => {
    if (!confirm(`기록 ${state.entries.length}건을 모두 삭제할까요?`)) return;
    const backup = state.entries;
    state.entries = [];
    save();
    renderList();
    toast('모두 삭제됨', () => { state.entries = backup; save(); renderList(); });
  });

  for (const s of STEPS) {
    s.val.addEventListener('click', () => { editing = s.i; showSteps(true); });
  }

  el.exportBtn.addEventListener('click', exportXlsx);
  el.file.addEventListener('change', () => {
    const f = el.file.files[0];
    el.file.value = '';
    if (f) importFile(f);
  });
  el.primary.addEventListener('click', () => next(document.activeElement));
  el.openAdd.addEventListener('click', () => openAdd());
  el.back.addEventListener('click', goHome);
  el.newItem.addEventListener('click', () => { resetForm(); showSteps(true); });
  window.addEventListener('hashchange', route);

  // ---------- keyboard accessory bar ----------
  let blurTimer;
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName !== 'INPUT') return;
    clearTimeout(blurTimer);
    updatePrimary();
    if (e.target === el.date) renderPreview();
    placeBar();
  });
  document.addEventListener('focusout', () => {
    blurTimer = setTimeout(() => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
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

  // Keeps page bottom padding equal to whichever bottom bar is showing, so content never hides behind it.
  function setBarHeight() {
    const bar = el.addView.hidden ? el.homeBar : el.bar;
    document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  }
  if ('ResizeObserver' in window) new ResizeObserver(setBarHeight).observe(el.bar), new ResizeObserver(setBarHeight).observe(el.homeBar);

  // ---------- init ----------
  renderUnits();
  if (location.hash === '#add') history.replaceState(null, '', location.pathname);
  route();
  renderNames();
  renderList();
  renderPreview();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // exposed for tests
  window.__expiry = { parseDigits, rowsToEntries };
})();
