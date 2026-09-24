/* =============================================================================
 * Gravity Estimator — UI (routing, views, events, print, share, backup)
 * -----------------------------------------------------------------------------
 * Plain JS, no framework. Views are rendered as HTML strings into <main>.
 * Typing into inputs updates the model and calls refreshLive(), which patches
 * only computed values (amounts, totals) so the focused input is not lost.
 * ========================================================================== */
(function () {
  'use strict';
  const C = window.GE_CONFIG;
  const E = window.GE_ENGINE;
  const ST = window.GE_STORE;

  /* ---------------------------------------------------------------------------
   * Small utilities
   * ------------------------------------------------------------------------ */
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssEsc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));
  const inr = E.fmtINR;
  const fq = (n) => E.fmtNum(n, 2);                       // quantity format
  const label = (list, id) => (list.find((o) => o.id === id) || {}).label || id || '';
  const O = C.options;
  const FLOOR_NAMES = ['Ground floor', 'First floor', 'Second floor', 'Third floor', 'Fourth floor', 'Fifth floor'];
  const MAX_FLOORS = FLOOR_NAMES.length;

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return d && m && y ? `${d}-${m}-${y}` : iso;
  }
  function addDays(iso, days) {
    const d = new Date(iso || Date.now());
    if (isNaN(d)) return '';
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().slice(0, 10);
  }

  /* ---------------------------------------------------------------------------
   * App state
   * ------------------------------------------------------------------------ */
  const S = {
    settings: null,
    projects: [],
    R: null,                       // resolved settings (rates, thumb rules…)
    route: { view: 'list' },
    ui: { open: {}, search: '', rateFilter: '', splitType: 'new', lastProject: null, focusId: null }
  };

  const getP = () => S.projects.find((p) => p.id === S.route.id);
  const resolveSettings = () => { S.R = E.resolve(S.settings); };

  /* ---------------------------------------------------------------------------
   * Persistence (debounced)
   * ------------------------------------------------------------------------ */
  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 300);
  }
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    ST.saveProjects(S.projects);
    ST.saveSettings(S.settings);
  }
  function touch(p) {
    if (p) p.updatedAt = new Date().toISOString();
    persist();
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function nextRef() {
    S.settings.counter = (Number(S.settings.counter) || 0) + 1;
    const prefix = S.settings.company.refPrefix || 'EST';
    return `${prefix}/${new Date().getFullYear()}/${String(S.settings.counter).padStart(3, '0')}`;
  }

  /* ---------------------------------------------------------------------------
   * Routing  (#/  ·  #/p/<id>/<tab>  ·  #/settings/<sub>)
   * ------------------------------------------------------------------------ */
  function parseHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'p' && parts[1]) return { view: 'project', id: parts[1], tab: parts[2] || 'details' };
    if (parts[0] === 'settings') return { view: 'settings', sub: parts[1] || 'company' };
    return { view: 'list' };
  }
  function go(hash) {
    if (location.hash === hash) onRoute();
    else location.hash = hash;
  }
  function onRoute() {
    S.route = parseHash();
    if (S.route.view === 'project') {
      if (!getP()) { location.replace('#/'); return; }
      S.ui.lastProject = S.route.id;
    }
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------------------
   * Main render
   * ------------------------------------------------------------------------ */
  function render() {
    const r = S.route;
    let title = 'Gravity Estimator';
    let sub = S.settings.company.name;
    let body = '';
    let back = false;

    if (r.view === 'project') {
      const p = getP();
      title = p.client || 'Untitled project';
      sub = [p.ref, p.location].filter(Boolean).join(' · ');
      back = true;
      body = projectTabs(p) + viewProjectTab(p, r.tab);
    } else if (r.view === 'settings') {
      title = 'Settings';
      body = settingsTabs(r.sub) + viewSettings(r.sub);
    } else {
      body = viewList();
    }

    $('#hdr-title').textContent = title;
    $('#hdr-sub').textContent = sub;
    $('#hdr-back').hidden = !back;
    document.title = r.view === 'project' ? `${title} — Gravity Estimator` : 'Gravity Estimator';
    $('#main').innerHTML = body;
    renderNav();

    if (S.ui.focusId) {
      const el = document.getElementById(S.ui.focusId);
      if (el) el.focus();
      S.ui.focusId = null;
    }
  }

  function renderNav() {
    const r = S.route;
    const last = S.ui.lastProject && S.projects.find((p) => p.id === S.ui.lastProject);
    const items = [
      { href: '#/', icon: '▤', text: 'Projects', on: r.view === 'list' },
      last ? { href: `#/p/${last.id}/${r.view === 'project' ? r.tab : 'details'}`, icon: '✎', text: 'Estimate', on: r.view === 'project' } : null,
      { href: '#/settings', icon: '⚙', text: 'Settings', on: r.view === 'settings' }
    ].filter(Boolean);
    $('#nav').innerHTML = items.map((i) =>
      `<a href="${i.href}" class="${i.on ? 'on' : ''}" ${i.on ? 'aria-current="page"' : ''}><span class="nav-ic" aria-hidden="true">${i.icon}</span><span>${i.text}</span></a>`
    ).join('');
  }

  /* ---------------------------------------------------------------------------
   * Shared UI snippets
   * ------------------------------------------------------------------------ */
  function seg(field, options, value, attr) {
    attr = attr || 'data-f';
    return `<div class="seg seg-${options.length}" role="radiogroup">${options.map((o) =>
      `<button type="button" role="radio" aria-checked="${o.id === value}" class="${o.id === value ? 'on' : ''}" data-act="setf" ${attr}="${field}" data-v="${o.id}">${esc(o.label)}</button>`
    ).join('')}</div>`;
  }
  const numIn = (attrs, value, ph) =>
    `<input type="number" inputmode="decimal" step="any" min="0" ${attrs} value="${esc(value)}" placeholder="${esc(ph === undefined ? '' : ph)}">`;
  const field = (lbl, inner, hint) =>
    `<label class="field"><span class="lbl">${lbl}</span>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const group = (lbl, inner, hint) =>
    `<div class="field"><span class="lbl">${lbl}</span>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;

  function badgeHTML(key) {
    const s = S.settings;
    if (s.overrides[key] !== undefined) return `<span class="badge ok" title="Edited">✓ edited</span>`;
    if (s.verified[key]) return `<button type="button" class="badge ok" data-act="verify" data-key="${esc(key)}" title="Tap to mark as not verified">✓ ok</button>`;
    return `<button type="button" class="badge verify" data-act="verify" data-key="${esc(key)}" title="Placeholder rate — tap once confirmed">VERIFY</button>`;
  }

  /* ---------------------------------------------------------------------------
   * VIEW: project list
   * ------------------------------------------------------------------------ */
  function viewList() {
    const q = S.ui.search.trim().toLowerCase();
    const list = [...S.projects]
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .filter((p) => !q || `${p.client} ${p.location} ${p.ref}`.toLowerCase().includes(q));

    const cards = list.map((p) => {
      const B = E.computeBOQ(p, S.R);
      const Q = E.computeQuick(p, S.R);
      const area = B.g.Asqft;
      return `<article class="card proj">
        <a class="proj-main" href="#/p/${p.id}/details">
          <div class="proj-title">${esc(p.client || 'Untitled project')}</div>
          <div class="muted small">${esc([p.location, fmtDate(p.date), p.ref].filter(Boolean).join(' · '))}</div>
          <div class="chips">
            <span class="chip">${esc(label(O.projectTypes, p.type))}</span>
            <span class="chip">${esc(label(O.specs, p.spec))}</span>
            ${area ? `<span class="chip">${E.fmtNum(area, 0)} sq.ft</span>` : ''}
          </div>
          ${area ? `<div class="proj-totals"><span>Quick <b>${E.fmtLakh(Q.total)}</b></span><span>BOQ <b>${E.fmtLakh(B.total)}</b></span></div>` : ''}
        </a>
        <div class="proj-actions">
          <button type="button" class="btn ghost" data-act="dup" data-id="${p.id}">Duplicate</button>
          <button type="button" class="btn ghost danger" data-act="del" data-id="${p.id}">Delete</button>
        </div>
      </article>`;
    }).join('');

    return `<section class="stack">
      <button type="button" class="btn primary lg block" data-act="new">+ New project</button>
      ${S.projects.length > 3 ? `<input type="search" class="search" id="search" data-ui="search" placeholder="Search client, site or ref…" value="${esc(S.ui.search)}">` : ''}
      ${cards || (S.projects.length
        ? '<p class="empty">No projects match your search.</p>'
        : `<div class="empty card"><p><b>No projects yet.</b></p><p class="muted">Create a project at the site visit: enter the areas, pick the spec, and get a quick estimate and BOQ.</p></div>`)}
      <div class="btn-row">
        <button type="button" class="btn" data-act="export-all">⭳ Export backup</button>
        <button type="button" class="btn" data-act="import">⭱ Import backup</button>
      </div>
      <p class="muted small center">Data is stored on this device only. Export a backup regularly.</p>
    </section>`;
  }

  /* ---------------------------------------------------------------------------
   * VIEW: project tabs
   * ------------------------------------------------------------------------ */
  const TABS = [['details', 'Details'], ['quick', 'Quick'], ['boq', 'BOQ'], ['materials', 'Materials'], ['output', 'Output']];
  function projectTabs(p) {
    return `<nav class="tabs no-print" aria-label="Project sections">${TABS.map(([id, t]) =>
      `<a href="#/p/${p.id}/${id}" class="${S.route.tab === id ? 'on' : ''}">${t}</a>`).join('')}</nav>`;
  }
  function viewProjectTab(p, tab) {
    switch (tab) {
      case 'quick': return viewQuick(p);
      case 'boq': return viewBOQ(p);
      case 'materials': return viewMaterials(p);
      case 'output': return viewOutput(p);
      default: return viewDetails(p);
    }
  }
  function needArea(p) {
    return `<div class="card notice">Enter the built-up area in <a href="#/p/${p.id}/details">Details</a> to see this.</div>`;
  }

  /* ---------------------------------------------------------------------------
   * VIEW: project details (inputs)
   * ------------------------------------------------------------------------ */
  function areaSummary(p) {
    const g = C.geometry(p, S.R.thumb);
    return `${E.fmtNum(g.Asqft, 0)} sq.ft · ${E.fmtNum(g.A, 1)} sqm · ${g.n} floor${g.n === 1 ? '' : 's'}`;
  }
  function plotSummary(p) {
    const c = E.num(p.plotCents);
    return c ? `= ${E.fmtNum(c * C.SQFT_PER_CENT, 0)} sq.ft · ${E.fmtNum(c * C.SQFT_PER_CENT * C.SQM_PER_SQFT, 1)} sqm` : '1 cent = 435.6 sq.ft';
  }

  function viewDetails(p) {
    const floors = p.floors.map((a, i) => field(FLOOR_NAMES[i] + ' (sq.ft)', numIn(`data-floor="${i}" id="floor-${i}"`, a, 'e.g. 1200'))).join('');
    return `<section class="stack">
      <div class="card">
        <h2 class="card-h">Client & site</h2>
        ${field('Client name', `<input type="text" data-f="client" value="${esc(p.client)}" autocomplete="off" placeholder="e.g. Mr. Joseph Thomas">`)}
        ${field('Client phone', `<input type="tel" data-f="phone" value="${esc(p.phone)}" placeholder="optional">`)}
        ${field('Site location', `<input type="text" data-f="location" value="${esc(p.location)}" placeholder="e.g. Kalavoor, Alappuzha">`)}
        <div class="grid-2">
          ${field('Date', `<input type="date" data-f="date" value="${esc(p.date)}">`)}
          ${field('Estimate ref.', `<input type="text" data-f="ref" value="${esc(p.ref)}">`)}
        </div>
        ${group('Project type', seg('type', O.projectTypes, p.type))}
      </div>

      <div class="card">
        <h2 class="card-h">Areas</h2>
        ${field('Plot area (cents)', numIn('data-f="plotCents"', p.plotCents, 'e.g. 8'), `<span data-out="plot">${plotSummary(p)}</span>`)}
        ${group('Number of floors', `<div class="stepper">
          <button type="button" class="btn" data-act="floors-" aria-label="Remove floor" ${p.floors.length <= 1 ? 'disabled' : ''}>−</button>
          <output>${p.floors.length}</output>
          <button type="button" class="btn" data-act="floors+" aria-label="Add floor" ${p.floors.length >= MAX_FLOORS ? 'disabled' : ''}>+</button>
        </div>`)}
        ${floors}
        <div class="total-line">Total built-up: <b data-out="area">${areaSummary(p)}</b></div>
      </div>

      <div class="card">
        <h2 class="card-h">Specification & structure</h2>
        ${group('Specification level', seg('spec', O.specs, p.spec))}
        ${group('Foundation type', seg('foundation', O.foundations, p.foundation))}
        ${group('Roof type', seg('roof', O.roofs, p.roof))}
        ${group('Wall masonry', seg('masonry', O.masonry, p.masonry))}
      </div>

      <div class="card">
        ${field('Project notes (printed on the estimate)', `<textarea data-f="notes" rows="3" placeholder="e.g. Site is low-lying; plinth raised by 600 mm. Excludes compound wall.">${esc(p.notes)}</textarea>`)}
      </div>

      <a class="btn primary lg block" href="#/p/${p.id}/quick">Quick estimate →</a>
    </section>`;
  }

  /* ---------------------------------------------------------------------------
   * VIEW: quick estimate
   * ------------------------------------------------------------------------ */
  function viewQuick(p) {
    const Q = E.computeQuick(p, S.R);
    if (!Q.area) return needArea(p);
    const rk = `qrate.${Q.type}.${p.spec}`;
    return `<section class="stack">
      <div class="card">
        <div class="grid-2 align-end">
          ${group('Rate for this project (₹/sq.ft)', numIn('data-f="quickRate" id="quickRate"', p.quickRate, Q.master),
            `Master rate ${inr(Q.master)} <span data-out-html="badge:${rk}">${badgeHTML(rk)}</span> · leave blank to use it`)}
          <a class="btn" href="#/settings/quick">Edit master rates</a>
        </div>
      </div>
      <div id="quick-live" class="stack">${quickLive(p)}</div>
    </section>`;
  }

  /** The computed part of the quick-estimate view (re-rendered while typing). */
  function quickLive(p) {
    const Q = E.computeQuick(p, S.R);
    const B = E.computeBOQ(p, S.R);
    const mods = [];
    const fm = S.R.mods.foundation[p.foundation];
    const rm = S.R.mods.roofing[p.roof];
    if (Q.stages.some((s) => s.id === 'foundation') && fm !== 1) mods.push(`Foundation × ${fm} (${label(O.foundations, p.foundation)})`);
    if (Q.stages.some((s) => s.id === 'roofing') && rm !== 1) mods.push(`Roofing × ${rm} (${label(O.roofs, p.roof)})`);
    const diff = B.subtotal && Q.total ? ((B.total - Q.total) / Q.total) * 100 : 0;

    return `
      <div class="card total-card">
        <div class="muted">Quick estimate · ${esc(label(O.projectTypes, p.type))} · ${esc(label(O.specs, p.spec))}</div>
        <div class="big">${inr(Q.total)}</div>
        <div class="muted">${E.fmtNum(Q.area, 0)} sq.ft × ${inr(Q.rate)}/sq.ft${mods.length ? ' + stage adjustments' : ''} = ${inr(Q.perSqft)}/sq.ft effective</div>
        <div class="muted small">${esc(E.inWords(Q.total))}</div>
        ${mods.length ? `<p class="small muted">Adjustments: ${esc(mods.join(' · '))}</p>` : ''}
        ${Math.abs(Q.splitTotal - 100) > 0.01 ? `<p class="warn small">Stage split for this project type totals ${Q.splitTotal}% (should be 100%). Check Settings → Quick rates.</p>` : ''}
      </div>

      <div class="card">
        <h2 class="card-h">Cost by stage</h2>
        <table class="tbl">
          <thead><tr><th>Stage</th><th class="r">Amount</th><th class="r">%</th></tr></thead>
          <tbody>${Q.stages.map((s) => `<tr>
            <td>${esc(s.label)}${s.modifier !== 1 ? ` <span class="muted small">×${s.modifier}</span>` : ''}
              <div class="bar"><span style="width:${Math.min(100, s.pct * 3).toFixed(1)}%"></span></div></td>
            <td class="r nowrap">${inr(s.amount)}</td><td class="r">${s.pct.toFixed(1)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><th>Total</th><th class="r nowrap">${inr(Q.total)}</th><th class="r">100</th></tr></tfoot>
        </table>
      </div>

      <div class="card">
        <h2 class="card-h">Payment schedule</h2>
        ${paymentTable(Q)}
      </div>

      ${B.subtotal ? `<a class="card link-card" href="#/p/${p.id}/boq">
        <span>Detailed BOQ total <b>${inr(B.total)}</b></span>
        <span class="muted small">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% vs quick estimate →</span></a>` : ''}`;
  }

  function paymentTable(Q) {
    return `<table class="tbl">
      <thead><tr><th>#</th><th>Milestone</th><th class="r">%</th><th class="r">Amount</th></tr></thead>
      <tbody>${Q.payments.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.label)}</td><td class="r">${r.pct.toFixed(1)}</td><td class="r nowrap">${inr(r.amount)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th></th><th>Total</th><th class="r">100</th><th class="r nowrap">${inr(Q.total)}</th></tr></tfoot>
    </table>`;
  }

  /* ---------------------------------------------------------------------------
   * VIEW: detailed BOQ
   * ------------------------------------------------------------------------ */
  function itemMeta(i, p) {
    const bits = [];
    if (i.qtyOverridden) bits.push(`<button type="button" class="link" data-act="reset-qty" data-id="${i.id}">↺ auto qty ${fq(i.auto)}</button>`);
    if (i.rateOverridden) bits.push(`<button type="button" class="link" data-act="reset-rate" data-id="${i.id}">↺ master rate ${E.fmtNum(i.master, 2)}</button>`);
    else if (E.isUnverified(S.settings, E.rateKey(i.def, p.spec))) bits.push('<span class="badge verify">VERIFY rate</span>');
    return bits.join(' ');
  }

  function itemHTML(i, p) {
    if (i.custom) {
      return `<div class="item custom">
        <input type="text" class="desc-in" id="cust-${i.id}" data-cust="${i.id}" data-k="desc" value="${esc(i.desc)}" placeholder="Description of item">
        <div class="item-grid">
          <label><span class="lbl">Qty</span>${numIn(`data-cust="${i.id}" data-k="qty"`, (p.boq.custom.find((c) => c.id === i.id) || {}).qty, '0')}</label>
          <label><span class="lbl">Unit</span><select data-cust="${i.id}" data-k="unit">${C.units.map((u) => `<option ${u === i.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
          <label><span class="lbl">Rate ₹</span>${numIn(`data-cust="${i.id}" data-k="rate"`, (p.boq.custom.find((c) => c.id === i.id) || {}).rate, '0')}</label>
          <div class="amt"><span class="lbl">Amount</span><b data-out="amt:${i.id}">${inr(i.amount)}</b></div>
        </div>
        <div class="item-meta"><span class="badge">custom</span> <button type="button" class="link danger" data-act="del-custom" data-id="${i.id}">Remove</button></div>
      </div>`;
    }
    return `<div class="item">
      <div class="item-desc">${esc(i.desc)}</div>
      <div class="item-grid">
        <label><span class="lbl">Qty (${i.unit})</span>${numIn(`data-qty="${i.id}" class="${i.qtyOverridden ? '' : 'is-auto'}"`, i.qty, fq(i.auto))}</label>
        <label><span class="lbl">Rate ₹/${i.unit}</span>${numIn(`data-rate="${i.id}" class="${i.rateOverridden ? '' : 'is-auto'}"`, i.rate, i.master)}</label>
        <div class="amt"><span class="lbl">Amount</span><b data-out="amt:${i.id}">${inr(i.amount)}</b></div>
      </div>
      <div class="item-meta" data-out-html="meta:${i.id}">${itemMeta(i, p)}</div>
    </div>`;
  }

  function viewBOQ(p) {
    const B = E.computeBOQ(p, S.R);
    const noArea = !B.g.A;
    const secs = B.sections.map((s) => {
      const open = S.ui.open[s.id] ? 'open' : '';
      return `<details class="card sec ${s.active ? '' : 'off'}" data-sec="${s.id}" ${open}>
        <summary><span class="sec-title">${esc(s.label)}</span><span class="sec-amt" data-out="sub:${s.id}">${s.active ? inr(s.subtotal) : 'excluded'}</span></summary>
        <label class="switch"><input type="checkbox" data-sec-on="${s.id}" ${s.active ? 'checked' : ''}> Include this section</label>
        ${s.items.map((i) => itemHTML(i, p)).join('') || '<p class="muted small">No standard items for the current inputs. Add a custom item if needed.</p>'}
        <button type="button" class="btn ghost block" data-act="add-custom" data-sec="${s.id}">+ Add custom item</button>
      </details>`;
    }).join('');

    return `<section class="stack">
      <div class="sticky-total card">
        <div><div class="muted small">BOQ grand total</div><div class="big-sm" data-out="boq-total">${inr(B.total)}</div></div>
        <div class="r"><div class="muted small">per sq.ft</div><div data-out="boq-psf">${inr(B.perSqft)}</div></div>
      </div>
      ${noArea ? `<div class="card notice">Quantities are calculated from the areas in <a href="#/p/${p.id}/details">Details</a>. You can also type quantities directly.</div>` : ''}
      <p class="muted small">Measured per IS 1200. Auto quantities are thumb-rule values (grey text). Type a quantity or rate to override it for this project, or tap ↺ to restore it.
        <button type="button" class="link" data-act="expand-all">Expand all</button> · <button type="button" class="link" data-act="collapse-all">Collapse all</button></p>
      ${secs}
      <div class="card">
        <h2 class="card-h">Abstract</h2>
        <table class="tbl">
          <tbody>
            ${B.sections.filter((s) => s.active).map((s) => `<tr><td>${esc(s.label)}</td><td class="r nowrap" data-out="abs:${s.id}">${inr(s.subtotal)}</td></tr>`).join('')}
            <tr class="strong"><td>Sub-total</td><td class="r nowrap" data-out="boq-sub">${inr(B.subtotal)}</td></tr>
            <tr><td><label class="inline">Contingency ${numIn('data-boq="contingencyPct" class="pct"', p.boq.contingencyPct, '0')} %</label></td><td class="r nowrap" data-out="boq-cont">${inr(B.contingency)}</td></tr>
            <tr><td><label class="inline"><input type="checkbox" data-boq="gstEnabled" ${p.boq.gstEnabled ? 'checked' : ''}> GST ${numIn('data-boq="gstPct" class="pct"', p.boq.gstPct, '18')} %</label></td><td class="r nowrap" data-out="boq-gst">${inr(B.gst)}</td></tr>
          </tbody>
          <tfoot><tr><th>Grand total</th><th class="r nowrap" data-out="boq-total2">${inr(B.total)}</th></tr></tfoot>
        </table>
        <p class="small muted" data-out="boq-words">${esc(E.inWords(B.total))}</p>
      </div>
      <div class="btn-row">
        <a class="btn" href="#/p/${p.id}/materials">Material summary →</a>
        <a class="btn primary" href="#/p/${p.id}/output">Output / Print →</a>
      </div>
    </section>`;
  }

  /* ---------------------------------------------------------------------------
   * VIEW: material summary
   * ------------------------------------------------------------------------ */
  function viewMaterials(p) {
    const B = E.computeBOQ(p, S.R);
    if (!B.g.A && !B.subtotal) return needArea(p);
    return `<section class="stack">
      <div class="card">
        <h2 class="card-h">Material summary</h2>
        <p class="muted small">Calculated from the BOQ quantities using standard thumb rules (coefficients in Settings → Thumb rules). Type a value to override it for this project.</p>
        ${B.materials.map((m) => `<div class="mat-row">
          <div><div class="mat-name">${esc(m.label)}</div><div class="small muted" data-out-html="mat-meta:${m.id}">${matMeta(m)}</div></div>
          <label class="mat-in">${numIn(`data-mat="${m.id}" class="${m.overridden ? '' : 'is-auto'}"`, m.value, m.auto)}<span>${m.unit}</span></label>
        </div>`).join('')}
      </div>
      <div class="card small muted">
        <b>Notes.</b> BOQ rates are composite (material + labour), so material quantities are for procurement planning and are <b>not</b> added to the cost.
        Cement is in 50 kg bags; sand and aggregate in cft (1 cum = 35.31 cft). Quantities include normal wastage. Check steel against the structural drawings.
      </div>
    </section>`;
  }
  const matMeta = (m) => (m.overridden
    ? `<button type="button" class="link" data-act="reset-mat" data-id="${m.id}">↺ auto ${E.fmtNum(m.auto, 1)} ${m.unit}</button>`
    : 'auto');

  /* ---------------------------------------------------------------------------
   * VIEW: output (print preview + actions)
   * ------------------------------------------------------------------------ */
  const PRINT_PARTS = [['quick', 'Quick estimate'], ['payment', 'Payment schedule'], ['boq', 'Detailed BOQ'], ['materials', 'Material summary'], ['terms', 'Terms & notes']];

  function viewOutput(p) {
    const unv = unverifiedUsed(p);
    return `<section class="stack">
      <div class="card no-print">
        <h2 class="card-h">Include in document</h2>
        <div class="checks">${PRINT_PARTS.map(([k, t]) =>
          `<label class="check"><input type="checkbox" data-print="${k}" ${p.print[k] ? 'checked' : ''}> ${t}</label>`).join('')}</div>
        ${unv ? `<p class="warn small">${unv} rate${unv > 1 ? 's' : ''} used here ${unv > 1 ? 'are' : 'is'} still marked VERIFY. Check them in Settings before sending to the client.</p>` : ''}
        <div class="btn-grid">
          <button type="button" class="btn primary" data-act="print">🖨 Print / Save PDF</button>
          <button type="button" class="btn primary" data-act="share">↗ Share</button>
          <button type="button" class="btn" data-act="csv">⭳ BOQ (CSV)</button>
          <button type="button" class="btn" data-act="export-project">⭳ Project (JSON)</button>
        </div>
        <p class="muted small">To send a PDF: tap Print, choose "Save as PDF", then share the file (for example on WhatsApp).</p>
      </div>
      <div class="doc-wrap"><div class="doc" id="doc">${docHTML(p)}</div></div>
    </section>`;
  }

  /** Count of master rates still marked VERIFY that affect this project's totals. */
  function unverifiedUsed(p) {
    let n = 0;
    const B = E.computeBOQ(p, S.R);
    if (p.print.boq) {
      B.sections.filter((s) => s.active).forEach((s) => s.items.forEach((i) => {
        if (!i.custom && !i.rateOverridden && i.qty > 0 && E.isUnverified(S.settings, E.rateKey(i.def, p.spec))) n++;
      }));
    }
    if ((p.print.quick || p.print.payment) && !E.hasVal(p.quickRate)) {
      const Q = E.computeQuick(p, S.R);
      if (E.isUnverified(S.settings, `qrate.${Q.type}.${p.spec}`)) n++;
    }
    return n;
  }

  function docHTML(p) {
    const co = S.settings.company;
    const Q = E.computeQuick(p, S.R);
    const B = E.computeBOQ(p, S.R);
    const pr = p.print;
    const g = B.g;
    const validity = S.settings.commercial.validityDays;
    const activeSecs = B.sections.filter((s) => s.active && s.items.some((i) => i.qty > 0 || i.amount));

    const head = `<header class="doc-head">
      ${S.settings.logo ? `<img class="doc-logo" src="${S.settings.logo}" alt="">` : ''}
      <div class="doc-co">
        <div class="doc-co-name">${esc(co.name)}</div>
        ${co.tagline ? `<div class="doc-co-tag">${esc(co.tagline)}</div>` : ''}
        <div>${esc(co.address)}</div>
        <div>${[co.website, co.phone, co.email].filter(Boolean).map(esc).join(' · ')}</div>
        ${co.gstin ? `<div>GSTIN: ${esc(co.gstin)}</div>` : ''}
      </div>
    </header>`;

    const SHORT = ['GF', 'FF', 'SF', 'TF', '4F', '5F'];
    const floorsTxt = p.floors.map(Number).filter((a) => a > 0).map((a, i) => `${SHORT[i]} ${E.fmtNum(a, 0)}`).join(', ');
    const meta = [
      ['Ref. no.', p.ref], ['Date', fmtDate(p.date)],
      ['Client', p.client], ['Phone', p.phone],
      ['Site', p.location], ['Project type', label(O.projectTypes, p.type)],
      ['Plot area', E.num(p.plotCents) ? `${E.fmtNum(p.plotCents, 2)} cents` : ''],
      ['Built-up area', g.Asqft ? `${E.fmtNum(g.Asqft, 0)} sq.ft (${E.fmtNum(g.A, 1)} sqm)` : ''],
      ['Floors', g.n ? `${g.n} — ${floorsTxt} sq.ft` : ''], ['Specification', label(O.specs, p.spec)],
      ['Foundation', label(O.foundations, p.foundation)], ['Roof', label(O.roofs, p.roof)],
      ['Masonry', label(O.masonry, p.masonry)], ['Valid until', validity ? fmtDate(addDays(p.date, validity)) : '']
    ].filter(([, v]) => v);

    const headline = pr.boq ? B.total : Q.total;
    const summary = `<div class="doc-summary">
      <div class="doc-sum-main">
        <div class="doc-sum-lbl">${pr.boq ? 'Estimated project cost (as per BOQ)' : 'Estimated project cost'}</div>
        <div class="doc-sum-amt">${inr(headline)}</div>
        <div class="doc-sum-words">${esc(E.inWords(headline))}</div>
      </div>
      <div class="doc-sum-side">
        ${g.Asqft ? `<div><span>Built-up area</span><b>${E.fmtNum(g.Asqft, 0)} sq.ft</b></div>` : ''}
        ${g.Asqft ? `<div><span>Cost per sq.ft</span><b>${inr(headline / g.Asqft)}</b></div>` : ''}
        ${pr.boq && pr.quick ? `<div><span>Quick estimate</span><b>${inr(Q.total)}</b></div>` : ''}
        ${pr.boq ? `<div><span>GST</span><b>${B.gstEnabled ? `${B.gstPct}% included` : 'Extra as applicable'}</b></div>` : ''}
      </div>
    </div>`;

    let html = head + `<h1 class="doc-title">${pr.boq ? 'Estimate &amp; Bill of Quantities' : 'Preliminary Cost Estimate'}</h1>`;
    html += `<table class="doc-meta"><tbody>${pairRows(meta)}</tbody></table>` + summary;

    if (pr.quick && Q.total) {
      html += `<h2 class="doc-h">A. Quick estimate — cost by stage</h2>
      <p class="doc-note">${E.fmtNum(Q.area, 0)} sq.ft × ${inr(Q.rate)}/sq.ft (${esc(label(O.specs, p.spec))}), with adjustments for foundation and roof type.</p>
      <table class="doc-tbl"><thead><tr><th>Stage</th><th class="r">Amount (₹)</th><th class="r">%</th></tr></thead>
      <tbody>${Q.stages.map((s) => `<tr><td>${esc(s.label)}</td><td class="r">${E.fmtNum(s.amount, 0)}</td><td class="r">${s.pct.toFixed(1)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th>Total</th><th class="r">${E.fmtNum(Q.total, 0)}</th><th class="r">100.0</th></tr></tfoot></table>`;
    }

    if (pr.payment && Q.total) {
      const base = pr.boq ? B.total : Q.total;
      const rows = Q.payments.map((r) => ({ ...r, amt: Math.round((base * r.pct) / 100) }));
      const diff = base - rows.reduce((a, r) => a + r.amt, 0);
      if (rows.length) rows[rows.length - 1].amt += diff;
      html += `<h2 class="doc-h">${pr.quick ? 'B' : 'A'}. Payment schedule</h2>
      <p class="doc-note">On ${pr.boq ? 'BOQ grand total' : 'quick estimate total'} of ${inr(base)}.</p>
      <table class="doc-tbl"><thead><tr><th>#</th><th>Milestone</th><th class="r">%</th><th class="r">Amount (₹)</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.label)}</td><td class="r">${r.pct.toFixed(1)}</td><td class="r">${E.fmtNum(r.amt, 0)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th></th><th>Total</th><th class="r">100.0</th><th class="r">${E.fmtNum(base, 0)}</th></tr></tfoot></table>`;
    }

    if (pr.boq) {
      html += `<h2 class="doc-h page-break">Bill of Quantities</h2>
      <table class="doc-tbl boq"><thead><tr><th>Sl.</th><th>Description of item</th><th>Unit</th><th class="r">Qty</th><th class="r">Rate (₹)</th><th class="r">Amount (₹)</th></tr></thead><tbody>`;
      activeSecs.forEach((s, si) => {
        html += `<tr class="sec-row"><td>${si + 1}</td><td colspan="5">${esc(s.label)}</td></tr>`;
        s.items.filter((i) => i.qty > 0 || i.amount).forEach((i, ii) => {
          html += `<tr><td>${si + 1}.${ii + 1}</td><td>${esc(i.desc)}</td><td>${esc(i.unit)}</td><td class="r">${fq(i.qty)}</td><td class="r">${E.fmtNum(i.rate, 2)}</td><td class="r">${E.fmtNum(i.amount, 0)}</td></tr>`;
        });
        html += `<tr class="sub-row"><td></td><td colspan="4">Total — ${esc(s.label)}</td><td class="r">${E.fmtNum(s.subtotal, 0)}</td></tr>`;
      });
      html += `</tbody></table>
      <h2 class="doc-h">Abstract of cost</h2>
      <table class="doc-tbl"><tbody>
        ${activeSecs.map((s, si) => `<tr><td>${si + 1}</td><td>${esc(s.label)}</td><td class="r">${E.fmtNum(s.subtotal, 0)}</td></tr>`).join('')}
        <tr class="sub-row"><td></td><td>Sub-total</td><td class="r">${E.fmtNum(B.subtotal, 0)}</td></tr>
        ${B.contingencyPct ? `<tr><td></td><td>Contingency @ ${B.contingencyPct}%</td><td class="r">${E.fmtNum(B.contingency, 0)}</td></tr>` : ''}
        ${B.gstEnabled ? `<tr><td></td><td>GST @ ${B.gstPct}%</td><td class="r">${E.fmtNum(B.gst, 0)}</td></tr>` : ''}
      </tbody><tfoot><tr><th></th><th>Grand total</th><th class="r">${E.fmtNum(B.total, 0)}</th></tr></tfoot></table>
      <p class="doc-note"><b>${esc(E.inWords(B.total))}</b>${B.gstEnabled ? '' : ' (GST extra as applicable)'}</p>`;
    }

    if (pr.materials && B.materials.some((m) => m.value)) {
      html += `<h2 class="doc-h">Material summary (approximate)</h2>
      <table class="doc-tbl"><thead><tr><th>Material</th><th>Unit</th><th class="r">Quantity</th></tr></thead>
      <tbody>${B.materials.map((m) => `<tr><td>${esc(m.label)}</td><td>${esc(m.unit)}</td><td class="r">${E.fmtNum(m.value, m.unit === 'cum' ? 1 : 0)}</td></tr>`).join('')}</tbody></table>
      <p class="doc-note">For planning only; included in the item rates above. Based on standard thumb rules.</p>`;
    }

    if (pr.terms) {
      const terms = String(S.settings.terms || '').split('\n').map((t) => t.trim()).filter(Boolean);
      if (terms.length) html += `<h2 class="doc-h">Terms &amp; notes</h2><ol class="doc-terms">${terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
      if (p.notes) html += `<h2 class="doc-h">Project notes</h2><p class="doc-pre">${esc(p.notes)}</p>`;
    }

    html += `<div class="doc-sign">
      <div><div class="sign-line"></div>For ${esc(co.name)}</div>
      <div><div class="sign-line"></div>Accepted by client</div>
    </div>
    <div class="doc-foot">${esc(co.name)} · ${esc(co.website)} · Generated ${fmtDate(ST.today())}</div>`;
    return html;
  }

  function pairRows(pairs) {
    let out = '';
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i], b = pairs[i + 1];
      out += `<tr><th>${esc(a[0])}</th><td>${esc(a[1])}</td>${b ? `<th>${esc(b[0])}</th><td>${esc(b[1])}</td>` : '<th></th><td></td>'}</tr>`;
    }
    return out;
  }

  /* ---------------------------------------------------------------------------
   * VIEW: settings
   * ------------------------------------------------------------------------ */
  const SET_TABS = [['company', 'Company'], ['quick', 'Quick rates'], ['rates', 'BOQ rates'], ['thumb', 'Thumb rules'], ['terms', 'Terms'], ['backup', 'Backup']];
  function settingsTabs(sub) {
    return `<nav class="tabs no-print" aria-label="Settings sections">${SET_TABS.map(([id, t]) =>
      `<a href="#/settings/${id}" class="${sub === id ? 'on' : ''}">${t}</a>`).join('')}</nav>`;
  }
  function viewSettings(sub) {
    switch (sub) {
      case 'quick': return setQuick();
      case 'rates': return setRates();
      case 'thumb': return setThumb();
      case 'terms': return setTerms();
      case 'backup': return setBackup();
      default: return setCompany();
    }
  }

  /** Input bound to a settings override path, showing the effective value. */
  function ovIn(key, effective, def, extraClass) {
    const has = S.settings.overrides[key] !== undefined;
    return numIn(`data-set="${esc(key)}" class="${has ? '' : 'is-auto'} ${extraClass || ''}"`, effective, def);
  }

  function setCompany() {
    const co = S.settings.company, cm = S.settings.commercial;
    const t = (k, lbl, ph, type) => field(lbl, `<input type="${type || 'text'}" data-co="${k}" value="${esc(co[k])}" placeholder="${esc(ph || '')}">`);
    return `<section class="stack">
      <div class="card">
        <h2 class="card-h">Company details</h2>
        ${t('name', 'Company name')}
        ${t('tagline', 'Tagline')}
        ${field('Address', `<textarea data-co="address" rows="2">${esc(co.address)}</textarea>`)}
        ${t('website', 'Website')}
        <div class="grid-2">${t('phone', 'Phone', '+91 …', 'tel')}${t('email', 'Email', '', 'email')}</div>
        <div class="grid-2">${t('gstin', 'GSTIN', 'optional')}${t('refPrefix', 'Estimate ref. prefix', 'GAS/EST')}</div>
      </div>
      <div class="card">
        <h2 class="card-h">Logo</h2>
        <div class="logo-box">${S.settings.logo ? `<img src="${S.settings.logo}" alt="Company logo">` : '<span class="muted small">No logo uploaded</span>'}</div>
        <div class="btn-row">
          <button type="button" class="btn" data-act="logo">Upload logo</button>
          ${S.settings.logo ? '<button type="button" class="btn ghost danger" data-act="logo-remove">Remove</button>' : ''}
        </div>
        <p class="muted small">PNG with a transparent background works best. It is resized to save space.</p>
      </div>
      <div class="card">
        <h2 class="card-h">Defaults for new projects</h2>
        <div class="grid-2">
          ${field('Contingency %', numIn('data-comm="contingencyPct"', cm.contingencyPct))}
          ${field('GST %', numIn('data-comm="gstPct"', cm.gstPct))}
        </div>
        <label class="check"><input type="checkbox" data-comm="gstEnabled" ${cm.gstEnabled ? 'checked' : ''}> Add GST to BOQ by default</label>
        ${field('Estimate validity (days)', numIn('data-comm="validityDays"', cm.validityDays))}
      </div>
    </section>`;
  }

  function setQuick() {
    const R = S.R, qd = C.quick;
    const types = O.projectTypes;
    const specs = O.specs;
    const st = S.ui.splitType;
    const splitSum = C.quick.stages.reduce((a, s) => a + (R.split[st][s.id] || 0), 0);
    return `<section class="stack">
      <div class="card">
        <h2 class="card-h">Rate per sq.ft (₹)</h2>
        <p class="muted small">Placeholder Kerala rates — tap VERIFY once confirmed, or type a new rate.</p>
        ${types.map((ty) => `<div class="rate-block">
          <div class="rate-name">${esc(ty.label)}</div>
          <div class="grid-3">${specs.map((sp) => {
            const key = `qrate.${ty.id}.${sp.id}`;
            return `<div class="rate-cell"><span class="lbl">${sp.label} <span data-out-html="badge:${key}">${badgeHTML(key)}</span></span>${ovIn(key, R.qrates[ty.id][sp.id], qd.ratesPerSqft[ty.id][sp.id])}</div>`;
          }).join('')}</div></div>`).join('')}
      </div>
      <div class="card">
        <h2 class="card-h">Stage split (%)</h2>
        ${seg('splitType', types, st, 'data-ui')}
        ${C.quick.stages.map((s) => {
          const key = `split.${st}.${s.id}`;
          return `<div class="kv"><span>${esc(s.label)}</span>${ovIn(key, R.split[st][s.id], qd.split[st][s.id] || 0, 'pct')}</div>`;
        }).join('')}
        <div class="kv strong"><span>Total</span><span data-out="split-sum" class="${Math.abs(splitSum - 100) > 0.01 ? 'warn' : ''}">${E.fmtNum(splitSum, 2)} %</span></div>
      </div>
      <div class="card">
        <h2 class="card-h">Stage adjustments (multipliers)</h2>
        <p class="muted small">Applied to the Foundation and Roofing stages, depending on the choice in project Details.</p>
        ${O.foundations.map((f) => `<div class="kv"><span>Foundation — ${esc(f.label)}</span>${ovIn(`mod.foundation.${f.id}`, R.mods.foundation[f.id], qd.modifiers.foundation[f.id])}</div>`).join('')}
        ${O.roofs.map((f) => `<div class="kv"><span>Roofing — ${esc(f.label)}</span>${ovIn(`mod.roofing.${f.id}`, R.mods.roofing[f.id], qd.modifiers.roofing[f.id])}</div>`).join('')}
      </div>
      <div class="card">
        <h2 class="card-h">Payment schedule</h2>
        <div class="kv"><span>Advance on agreement (%)</span>${ovIn('pay.advancePct', R.pay.advancePct, qd.payment.advancePct)}</div>
        <div class="kv"><span>Retention at handover (%)</span>${ovIn('pay.retentionPct', R.pay.retentionPct, qd.payment.retentionPct)}</div>
        <p class="muted small">The balance is spread across the stages in proportion to their cost.</p>
      </div>
      <button type="button" class="btn ghost danger block" data-act="reset-prefix" data-prefix="qrate.,split.,mod.,pay.">Reset quick-estimate settings to defaults</button>
    </section>`;
  }

  function unverifiedCount() {
    let n = 0;
    C.items.forEach((it) => {
      const keys = typeof it.rate === 'object' ? Object.keys(it.rate).map((s) => `rate.${it.id}.${s}`) : [`rate.${it.id}`];
      keys.forEach((k) => { if (E.isUnverified(S.settings, k)) n++; });
    });
    return n;
  }

  function setRates() {
    const f = S.ui.rateFilter.trim().toLowerCase();
    const R = S.R;
    const secs = C.sections.map((sec) => {
      const items = C.items.filter((it) => it.sec === sec.id && (!f || `${it.desc} ${it.id} ${sec.label}`.toLowerCase().includes(f)));
      if (!items.length) return '';
      return `<details class="card sec" ${f || S.ui.open['r_' + sec.id] ? 'open' : ''} data-sec="r_${sec.id}">
        <summary><span class="sec-title">${esc(sec.label)}</span><span class="muted small">${items.length} items</span></summary>
        ${items.map((it) => {
          const spec = typeof it.rate === 'object';
          const inputs = spec
            ? `<div class="grid-3">${O.specs.map((sp) => {
                const key = `rate.${it.id}.${sp.id}`;
                return `<div class="rate-cell"><span class="lbl">${sp.label} <span data-out-html="badge:${key}">${badgeHTML(key)}</span></span>${ovIn(key, R.rates[it.id][sp.id], it.rate[sp.id])}</div>`;
              }).join('')}</div>`
            : (() => {
                const key = `rate.${it.id}`;
                return `<div class="grid-3"><div class="rate-cell"><span class="lbl">All specs <span data-out-html="badge:${key}">${badgeHTML(key)}</span></span>${ovIn(key, R.rates[it.id], it.rate)}</div></div>`;
              })();
          return `<div class="item">
            <div class="item-desc">${esc(it.desc)}</div>
            <div class="small muted">Rate per ${it.unit} · <code>${it.id}</code></div>
            ${inputs}
          </div>`;
        }).join('')}
      </details>`;
    }).join('');

    return `<section class="stack">
      <div class="card">
        <p><b data-out="unv-count">${unverifiedCount()}</b> rates still marked <span class="badge verify">VERIFY</span>. All rates are composite (material + labour), excluding GST.</p>
        <div class="btn-row">
          <button type="button" class="btn" data-act="verify-all">Mark all as verified</button>
          <button type="button" class="btn ghost danger" data-act="reset-prefix" data-prefix="rate.">Reset all rates</button>
        </div>
      </div>
      <input type="search" class="search" id="rate-filter" data-ui="rateFilter" placeholder="Filter items…" value="${esc(S.ui.rateFilter)}">
      ${secs || '<p class="empty">No items match.</p>'}
    </section>`;
  }

  function setThumb() {
    const R = S.R;
    return `<section class="stack">
      <div class="card">
        <h2 class="card-h">Quantity thumb rules</h2>
        <p class="muted small">Used to calculate BOQ quantities from the project areas. Changes apply to every project (except quantities you typed in by hand).</p>
        ${Object.keys(C.thumb).map((k) => `<div class="kv">
          <span>${esc(C.thumb[k].label)} ${C.thumb[k].unit ? `<span class="muted small">(${esc(C.thumb[k].unit)})</span>` : ''}</span>
          ${ovIn(`thumb.${k}`, R.thumb[k], C.thumb[k].v)}
        </div>`).join('')}
      </div>
      <div class="card">
        <h2 class="card-h">Material coefficients</h2>
        <p class="muted small">Cement in bags, sand and aggregate in cft, per unit of the linked BOQ item.</p>
        <div class="mix-head"><span></span><span>Cement</span><span>Sand</span><span>Agg.</span></div>
        ${Object.keys(C.mixes).map((m) => `<div class="mix-row">
          <span class="small">${esc(C.mixes[m].label)}</span>
          ${['cement', 'sand', 'agg'].map((fld) => ovIn(`mix.${m}.${fld}`, R.mixes[m][fld], C.mixes[m][fld])).join('')}
        </div>`).join('')}
      </div>
      <button type="button" class="btn ghost danger block" data-act="reset-prefix" data-prefix="thumb.,mix.">Reset thumb rules to defaults</button>
    </section>`;
  }

  function setTerms() {
    return `<section class="stack">
      <div class="card">
        <h2 class="card-h">Terms & notes</h2>
        <p class="muted small">One term per line. Printed as a numbered list on every estimate.</p>
        <textarea data-terms rows="16">${esc(S.settings.terms)}</textarea>
      </div>
      <button type="button" class="btn ghost danger block" data-act="reset-terms">Restore default terms</button>
    </section>`;
  }

  function setBackup() {
    let bytes = 0;
    try { for (const k of Object.keys(localStorage)) bytes += (localStorage.getItem(k) || '').length; } catch (e) { /* ignore */ }
    return `<section class="stack">
      <div class="card">
        <h2 class="card-h">Backup & restore</h2>
        <p class="muted small">All data (projects, rates, company details and logo) is stored in this browser only. Export a backup to move it to another device or keep it safe.</p>
        <div class="btn-row">
          <button type="button" class="btn primary" data-act="export-all">⭳ Export backup (JSON)</button>
          <button type="button" class="btn" data-act="import">⭱ Import backup</button>
        </div>
        <p class="muted small">${S.projects.length} project(s) · about ${E.fmtNum(bytes / 1024, 0)} KB used.</p>
      </div>
      <div class="card">
        <h2 class="card-h">Reset</h2>
        <div class="btn-row">
          <button type="button" class="btn ghost danger" data-act="reset-settings">Reset all settings</button>
          <button type="button" class="btn ghost danger" data-act="delete-all">Delete all projects</button>
        </div>
      </div>
      <p class="muted small center">Gravity Estimator v${C.appVersion}</p>
    </section>`;
  }

  /* ---------------------------------------------------------------------------
   * Live refresh — update computed outputs without re-rendering inputs
   * ------------------------------------------------------------------------ */
  function setOut(key, text) {
    $$(`[data-out="${cssEsc(key)}"]`).forEach((el) => { el.textContent = text; });
  }
  function setOutHTML(key, html) {
    $$(`[data-out-html="${cssEsc(key)}"]`).forEach((el) => { el.innerHTML = html; });
  }
  function syncInput(sel, overridden, autoVal) {
    const el = $(sel);
    if (!el) return;
    el.classList.toggle('is-auto', !overridden);
    if (!overridden && document.activeElement !== el) el.value = autoVal;
  }

  function refreshLive() {
    const r = S.route;
    if (r.view === 'settings') {
      Object.keys(S.settings.overrides).concat(Object.keys(S.settings.verified)).forEach((k) => setOutHTML(`badge:${k}`, badgeHTML(k)));
      $$('[data-set]').forEach((el) => {
        const k = el.dataset.set;
        setOutHTML(`badge:${k}`, badgeHTML(k));
        el.classList.toggle('is-auto', S.settings.overrides[k] === undefined);
      });
      setOut('unv-count', String(unverifiedCount()));
      const st = S.ui.splitType;
      const sum = C.quick.stages.reduce((a, s) => a + (S.R.split[st][s.id] || 0), 0);
      const el = $('[data-out="split-sum"]');
      if (el) { el.textContent = `${E.fmtNum(sum, 2)} %`; el.classList.toggle('warn', Math.abs(sum - 100) > 0.01); }
      return;
    }
    if (r.view !== 'project') return;
    const p = getP();
    if (!p) return;

    if (r.tab === 'details') {
      setOut('area', areaSummary(p));
      setOut('plot', plotSummary(p));
      $('#hdr-title').textContent = p.client || 'Untitled project';
      $('#hdr-sub').textContent = [p.ref, p.location].filter(Boolean).join(' · ');
    } else if (r.tab === 'quick') {
      const box = $('#quick-live');
      if (box) box.innerHTML = quickLive(p);
    } else if (r.tab === 'boq') {
      const B = E.computeBOQ(p, S.R);
      B.sections.forEach((s) => {
        setOut(`sub:${s.id}`, s.active ? inr(s.subtotal) : 'excluded');
        setOut(`abs:${s.id}`, inr(s.subtotal));
        s.items.forEach((i) => {
          setOut(`amt:${i.id}`, inr(i.amount));
          if (i.custom) return;
          setOutHTML(`meta:${i.id}`, itemMeta(i, p));
          syncInput(`[data-qty="${i.id}"]`, i.qtyOverridden, i.auto);
          syncInput(`[data-rate="${i.id}"]`, i.rateOverridden, i.master);
        });
      });
      setOut('boq-sub', inr(B.subtotal));
      setOut('boq-cont', inr(B.contingency));
      setOut('boq-gst', inr(B.gst));
      setOut('boq-total', inr(B.total));
      setOut('boq-total2', inr(B.total));
      setOut('boq-psf', inr(B.perSqft));
      setOut('boq-words', E.inWords(B.total));
    } else if (r.tab === 'materials') {
      const B = E.computeBOQ(p, S.R);
      B.materials.forEach((m) => {
        syncInput(`[data-mat="${m.id}"]`, m.overridden, m.auto);
        setOutHTML(`mat-meta:${m.id}`, matMeta(m));
      });
    }
  }

  /* ---------------------------------------------------------------------------
   * Event handling (delegated)
   * ------------------------------------------------------------------------ */
  function onInput(e) {
    const el = e.target;
    const d = el.dataset;
    const p = S.route.view === 'project' ? getP() : null;
    const val = el.type === 'checkbox' ? el.checked : el.value;

    if (d.ui) {                               // UI-only state (search boxes)
      S.ui[d.ui] = val;
      const id = el.id;
      render();
      const again = document.getElementById(id);
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      return;
    }

    if (p) {
      if (d.f) { p[d.f] = val; touch(p); refreshLive(); return; }
      if (d.floor !== undefined) { p.floors[Number(d.floor)] = val; touch(p); refreshLive(); return; }
      if (d.qty) { setOrDelete(p.boq.qty, d.qty, val); touch(p); refreshLive(); return; }
      if (d.rate) { setOrDelete(p.boq.rate, d.rate, val); touch(p); refreshLive(); return; }
      if (d.mat) { setOrDelete(p.materials, d.mat, val); touch(p); refreshLive(); return; }
      if (d.cust) {
        const c = p.boq.custom.find((x) => x.id === d.cust);
        if (c) { c[d.k] = val; touch(p); refreshLive(); }
        return;
      }
      if (d.boq) {
        p.boq[d.boq] = val;
        touch(p);
        if (el.type === 'checkbox') render(); else refreshLive();
        return;
      }
    }

    // Settings
    if (d.set) {
      if (val === '' || val === null) delete S.settings.overrides[d.set];
      else if (isFinite(Number(val))) S.settings.overrides[d.set] = Number(val);
      resolveSettings(); persist(); refreshLive();
      return;
    }
    if (d.co) { S.settings.company[d.co] = val; persist(); if (d.co === 'name') $('#hdr-sub').textContent = val; return; }
    if (d.comm) { S.settings.commercial[d.comm] = el.type === 'checkbox' ? val : E.num(val); persist(); return; }
    if (d.terms !== undefined) { S.settings.terms = val; persist(); }
  }

  function onChange(e) {
    const el = e.target;
    const d = el.dataset;
    const p = S.route.view === 'project' ? getP() : null;
    if (p && d.secOn) {
      p.boq.sections[d.secOn] = el.checked;
      S.ui.open[d.secOn] = true;
      touch(p); render();
      return;
    }
    if (p && d.print) { p.print[d.print] = el.checked; touch(p); render(); return; }
    if (p && d.cust && d.k === 'unit') { refreshLive(); return; }
    if (d.qty || d.rate || d.mat) refreshLive();   // show auto value again after clearing
  }

  function setOrDelete(obj, key, val) {
    if (val === '' || val === null || !isFinite(Number(val))) delete obj[key];
    else obj[key] = Number(val);
  }

  function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const a = btn.dataset.act;
    const p = S.route.view === 'project' ? getP() : null;

    switch (a) {
      case 'back': go('#/'); break;
      case 'new': {
        const np = ST.newProject(S.settings);
        np.ref = nextRef();
        S.projects.push(np);
        flush();
        go(`#/p/${np.id}/details`);
        break;
      }
      case 'dup': {
        const src = S.projects.find((x) => x.id === btn.dataset.id);
        if (!src) break;
        const c = ST.duplicateProject(src);
        c.ref = nextRef();
        S.projects.push(c);
        flush(); render(); toast('Project duplicated');
        break;
      }
      case 'del': {
        const src = S.projects.find((x) => x.id === btn.dataset.id);
        if (!src || !confirm(`Delete "${src.client || 'Untitled project'}"? This cannot be undone.`)) break;
        S.projects = S.projects.filter((x) => x.id !== src.id);
        if (S.ui.lastProject === src.id) S.ui.lastProject = null;
        flush(); render(); toast('Project deleted');
        break;
      }
      case 'setf': {
        const target = btn.dataset.f;
        if (target && p) { p[target] = btn.dataset.v; touch(p); render(); }
        else if (btn.dataset.ui) { S.ui[btn.dataset.ui] = btn.dataset.v; render(); }
        break;
      }
      case 'floors+':
        if (p && p.floors.length < MAX_FLOORS) {
          p.floors.push(p.floors[p.floors.length - 1] || '');
          touch(p); S.ui.focusId = `floor-${p.floors.length - 1}`; render();
        }
        break;
      case 'floors-':
        if (p && p.floors.length > 1) { p.floors.pop(); touch(p); render(); }
        break;
      case 'reset-qty': delete p.boq.qty[btn.dataset.id]; touch(p); refreshLive(); break;
      case 'reset-rate': delete p.boq.rate[btn.dataset.id]; touch(p); refreshLive(); break;
      case 'reset-mat': delete p.materials[btn.dataset.id]; touch(p); refreshLive(); break;
      case 'add-custom': {
        const id = 'c_' + ST.uid();
        p.boq.custom.push({ id, sec: btn.dataset.sec, desc: '', unit: 'nos', qty: '', rate: '' });
        S.ui.open[btn.dataset.sec] = true;
        S.ui.focusId = `cust-${id}`;
        touch(p); render();
        break;
      }
      case 'del-custom':
        p.boq.custom = p.boq.custom.filter((c) => c.id !== btn.dataset.id);
        touch(p); render();
        break;
      case 'expand-all': C.sections.forEach((s) => { S.ui.open[s.id] = true; }); render(); break;
      case 'collapse-all': S.ui.open = {}; render(); break;
      case 'print': doPrint(p); break;
      case 'share': doShare(p); break;
      case 'csv': downloadCSV(p); break;
      case 'export-project': downloadJSON(ST.exportData(S.projects, S.settings, p), `estimate-${slug(p.client || 'project')}.json`); break;
      case 'export-all': downloadJSON(ST.exportData(S.projects, S.settings), `gravity-estimator-backup-${ST.today()}.json`); toast('Backup downloaded'); break;
      case 'import': $('#file-import').click(); break;
      case 'logo': $('#file-logo').click(); break;
      case 'logo-remove': S.settings.logo = ''; flush(); render(); break;
      case 'verify': {
        const k = btn.dataset.key;
        if (S.settings.verified[k]) delete S.settings.verified[k]; else S.settings.verified[k] = true;
        persist(); refreshLive();
        break;
      }
      case 'verify-all':
        C.items.forEach((it) => {
          if (typeof it.rate === 'object') Object.keys(it.rate).forEach((s) => { S.settings.verified[`rate.${it.id}.${s}`] = true; });
          else S.settings.verified[`rate.${it.id}`] = true;
        });
        persist(); render(); toast('All BOQ rates marked verified');
        break;
      case 'reset-prefix': {
        const prefixes = btn.dataset.prefix.split(',');
        if (!confirm('Reset these values to the defaults in config.js?')) break;
        Object.keys(S.settings.overrides).forEach((k) => { if (prefixes.some((pre) => k.startsWith(pre))) delete S.settings.overrides[k]; });
        Object.keys(S.settings.verified).forEach((k) => { if (prefixes.some((pre) => k.startsWith(pre))) delete S.settings.verified[k]; });
        resolveSettings(); flush(); render(); toast('Reset to defaults');
        break;
      }
      case 'reset-terms':
        if (confirm('Replace the terms with the defaults?')) { S.settings.terms = C.terms.join('\n'); flush(); render(); }
        break;
      case 'reset-settings':
        if (confirm('Reset company details, logo, rates and thumb rules to defaults? Projects are kept.')) {
          const counter = S.settings.counter;
          S.settings = ST.defaultSettings();
          S.settings.counter = counter;
          resolveSettings(); flush(); render(); toast('Settings reset');
        }
        break;
      case 'delete-all':
        if (confirm('Delete ALL projects on this device?') && confirm('Are you sure? Export a backup first if unsure.')) {
          S.projects = []; S.ui.lastProject = null; flush(); render(); toast('All projects deleted');
        }
        break;
      default: break;
    }
  }

  // <details> open/close state (toggle does not bubble → capture)
  function onToggle(e) {
    const el = e.target;
    if (el.tagName === 'DETAILS' && el.dataset.sec) S.ui.open[el.dataset.sec] = el.open;
  }

  /* ---------------------------------------------------------------------------
   * Output actions: print, share, CSV, JSON
   * ------------------------------------------------------------------------ */
  function confirmUnverified(p) {
    const n = unverifiedUsed(p);
    return !n || confirm(`${n} rate(s) used in this estimate are still marked VERIFY (placeholder rates).\n\nContinue anyway?`);
  }

  function doPrint(p) {
    if (!confirmUnverified(p)) return;
    flush();
    const prev = document.title;
    document.title = `Estimate - ${p.client || 'Project'} - ${fmtDate(p.date)}`;   // default PDF file name
    window.print();
    setTimeout(() => { document.title = prev; }, 500);
  }

  function shareText(p) {
    const co = S.settings.company;
    const Q = E.computeQuick(p, S.R);
    const B = E.computeBOQ(p, S.R);
    const lines = [
      `${co.name}`,
      `Estimate for ${p.client || 'client'}${p.location ? ' — ' + p.location : ''}`,
      `Ref: ${p.ref || '-'} · Date: ${fmtDate(p.date)}`,
      `Built-up area: ${E.fmtNum(B.g.Asqft, 0)} sq.ft (${B.g.n} floor${B.g.n === 1 ? '' : 's'}) · ${label(O.specs, p.spec)} spec`,
      p.print.quick || !p.print.boq ? `Quick estimate: ${inr(Q.total)} (${inr(Q.perSqft)}/sq.ft)` : '',
      p.print.boq ? `Detailed BOQ: ${inr(B.total)} (${inr(B.perSqft)}/sq.ft)${B.gstEnabled ? ` incl. GST ${B.gstPct}%` : ' + GST as applicable'}` : '',
      '',
      'Indicative estimate, subject to final drawings, structural design and site conditions.',
      co.website ? `https://${String(co.website).replace(/^https?:\/\//, '')}` : ''
    ];
    return lines.filter((l, i) => l || i === 6).join('\n');
  }

  async function doShare(p) {
    if (!confirmUnverified(p)) return;
    const text = shareText(p);
    const title = `Estimate — ${p.client || 'Project'}`;
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); toast('Summary copied to clipboard'); } catch (e) { /* ignore */ }
    if (confirm('Sharing is not supported in this browser. Open WhatsApp with the summary?')) {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project';
  const downloadJSON = (obj, name) => download(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), name);

  function downloadCSV(p) {
    const B = E.computeBOQ(p, S.R);
    const cell = (v) => {
      const s = String(v === undefined || v === null ? '' : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      [S.settings.company.name], [`Bill of Quantities — ${p.client || ''}`, p.location, p.ref, fmtDate(p.date)], [],
      ['Sl.', 'Section', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']
    ];
    B.sections.filter((s) => s.active).forEach((s, si) => {
      s.items.filter((i) => i.qty > 0 || i.amount).forEach((i, ii) =>
        rows.push([`${si + 1}.${ii + 1}`, s.label, i.desc, i.unit, i.qty, i.rate, i.amount]));
      rows.push(['', s.label, 'Section total', '', '', '', s.subtotal]);
    });
    rows.push([], ['', '', 'Sub-total', '', '', '', B.subtotal]);
    rows.push(['', '', `Contingency @ ${B.contingencyPct}%`, '', '', '', B.contingency]);
    if (B.gstEnabled) rows.push(['', '', `GST @ ${B.gstPct}%`, '', '', '', B.gst]);
    rows.push(['', '', 'Grand total', '', '', '', B.total]);
    const csv = '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n');   // BOM for Excel
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `boq-${slug(p.client || 'project')}.csv`);
  }

  /* ---------------------------------------------------------------------------
   * File inputs: import backup, upload logo
   * ------------------------------------------------------------------------ */
  function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { projects, settings } = ST.parseImport(String(reader.result));
        const msg = `Import ${projects.length} project(s)${settings ? ' and settings (rates, company details)' : ''}?\nProjects with the same ID will be replaced.`;
        if (!confirm(msg)) return;
        projects.forEach((raw) => {
          const np = ST.normalizeProject(raw, S.settings);
          const idx = S.projects.findIndex((x) => x.id === np.id);
          if (idx >= 0) S.projects[idx] = np; else S.projects.push(np);
        });
        if (settings) {
          const d = ST.defaultSettings();
          S.settings = {
            ...d, ...settings,
            company: { ...d.company, ...(settings.company || {}) },
            commercial: { ...d.commercial, ...(settings.commercial || {}) },
            overrides: settings.overrides || {}, verified: settings.verified || {}
          };
          resolveSettings();
        }
        flush(); render(); toast('Import complete');
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function onLogoFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 600 px wide / 240 px high to keep localStorage small
        const scale = Math.min(1, 600 / img.width, 240 / img.height);
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * scale));
        cv.height = Math.max(1, Math.round(img.height * scale));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const png = file.type === 'image/png' || file.type === 'image/svg+xml';
        S.settings.logo = cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9);
        flush(); render(); toast('Logo updated');
      };
      img.onerror = () => alert('Could not read that image.');
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  /* ---------------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------------ */
  function init() {
    S.settings = ST.loadSettings();
    S.projects = ST.loadProjects(S.settings);
    resolveSettings();

    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('click', onClick);
    document.addEventListener('toggle', onToggle, true);
    document.addEventListener('focusout', (e) => { if (e.target.matches('[data-qty],[data-rate],[data-mat],[data-set]')) setTimeout(refreshLive, 0); });
    $('#file-import').addEventListener('change', onImportFile);
    $('#file-logo').addEventListener('change', onLogoFile);
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

    onRoute();

    // Offline support (service worker needs http/https — not file://)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
