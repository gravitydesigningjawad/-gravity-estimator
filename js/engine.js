/* =============================================================================
 * Gravity Estimator — calculation engine
 * -----------------------------------------------------------------------------
 * Pure functions (no DOM). Turns a project + settings into:
 *   • quick estimate (stage split + payment schedule)
 *   • detailed BOQ (sections, items, subtotals, contingency, GST)
 *   • material summary
 * All defaults and formulas live in config.js; this file only applies them.
 * ========================================================================== */
(function (root) {
  'use strict';
  const C = root.GE_CONFIG;

  /* ---------------------------------------------------------------------------
   * Settings resolution — merge user overrides (flat "path" → number map)
   * over the defaults from config.js.
   * ------------------------------------------------------------------------ */
  function resolve(settings) {
    const ov = (settings && settings.overrides) || {};
    const pick = (key, def) => {
      const v = ov[key];
      return v === undefined || v === null || v === '' || !isFinite(Number(v)) ? def : Number(v);
    };

    const rates = {};
    C.items.forEach((it) => {
      if (typeof it.rate === 'object') {
        rates[it.id] = {};
        Object.keys(it.rate).forEach((s) => { rates[it.id][s] = pick(`rate.${it.id}.${s}`, it.rate[s]); });
      } else {
        rates[it.id] = pick(`rate.${it.id}`, it.rate);
      }
    });

    const qrates = {};
    Object.keys(C.quick.ratesPerSqft).forEach((type) => {
      qrates[type] = {};
      Object.keys(C.quick.ratesPerSqft[type]).forEach((s) => {
        qrates[type][s] = pick(`qrate.${type}.${s}`, C.quick.ratesPerSqft[type][s]);
      });
    });

    const split = {};
    Object.keys(C.quick.split).forEach((type) => {
      split[type] = {};
      C.quick.stages.forEach((st) => {
        split[type][st.id] = pick(`split.${type}.${st.id}`, C.quick.split[type][st.id] || 0);
      });
    });

    const mods = {};
    Object.keys(C.quick.modifiers).forEach((stage) => {
      mods[stage] = {};
      Object.keys(C.quick.modifiers[stage]).forEach((k) => {
        mods[stage][k] = pick(`mod.${stage}.${k}`, C.quick.modifiers[stage][k]);
      });
    });

    const pay = {};
    Object.keys(C.quick.payment).forEach((k) => { pay[k] = pick(`pay.${k}`, C.quick.payment[k]); });

    const thumb = {};
    Object.keys(C.thumb).forEach((k) => { thumb[k] = pick(`thumb.${k}`, C.thumb[k].v); });

    const mixes = {};
    Object.keys(C.mixes).forEach((m) => {
      mixes[m] = {};
      ['cement', 'sand', 'agg'].forEach((f) => { mixes[m][f] = pick(`mix.${m}.${f}`, C.mixes[m][f]); });
    });

    return { rates, qrates, split, mods, pay, thumb, mixes };
  }

  /** True when a master rate still needs checking (not edited and not ticked). */
  function isUnverified(settings, key) {
    const s = settings || {};
    return !(s.overrides && s.overrides[key] !== undefined) && !(s.verified && s.verified[key]);
  }

  /** Settings key of an item's master rate for a given spec. */
  function rateKey(item, spec) {
    return typeof item.rate === 'object' ? `rate.${item.id}.${spec}` : `rate.${item.id}`;
  }

  /* ---------------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------------ */
  const num = (v) => (v === '' || v === null || v === undefined || !isFinite(Number(v)) ? 0 : Number(v));
  const hasVal = (v) => v !== '' && v !== null && v !== undefined && isFinite(Number(v));

  function roundQty(v, unit) {
    if (!isFinite(v) || v < 0) return 0;
    if (unit === 'nos' || unit === 'set' || unit === 'kg' || unit === 'LS') return Math.round(v);
    return Math.round(v * 100) / 100;
  }

  function sectionActive(p, secId) {
    const manual = p.boq && p.boq.sections ? p.boq.sections[secId] : undefined;
    if (manual === true || manual === false) return manual;
    return (C.sectionsByProjectType[p.type] || []).includes(secId);
  }

  /* ---------------------------------------------------------------------------
   * MODULE 1 — Quick estimate
   * ------------------------------------------------------------------------ */
  function computeQuick(p, R) {
    const g = C.geometry(p, R.thumb);
    const area = g.Asqft;
    const type = R.qrates[p.type] ? p.type : 'new';
    const master = R.qrates[type][p.spec] || 0;
    const rateOverridden = hasVal(p.quickRate);           // project-specific ₹/sq.ft
    const rate = rateOverridden ? Number(p.quickRate) : master;
    const base = area * rate;
    const split = R.split[type];
    const splitTotal = Object.values(split).reduce((a, b) => a + b, 0);

    let stages = C.quick.stages
      .filter((s) => split[s.id] > 0)
      .map((s) => {
        let modifier = 1;
        if (s.id === 'foundation') modifier = R.mods.foundation[p.foundation] || 1;
        if (s.id === 'roofing') modifier = R.mods.roofing[p.roof] || 1;
        return { id: s.id, label: s.label, basePct: split[s.id], modifier, amount: Math.round((base * split[s.id]) / 100 * modifier) };
      });
    const total = stages.reduce((a, s) => a + s.amount, 0);
    stages = stages.map((s) => ({ ...s, pct: total ? (s.amount / total) * 100 : 0 }));

    // Payment schedule: advance → each stage (pro-rata) → retention at handover
    const adv = R.pay.advancePct, ret = R.pay.retentionPct;
    const payments = [];
    if (total > 0) {
      payments.push({ label: 'Advance on signing agreement', pct: adv, amount: Math.round((total * adv) / 100) });
      const balancePct = 100 - adv - ret;
      stages.forEach((s) => {
        const pct = (s.pct * balancePct) / 100;
        payments.push({ label: `On completion of ${s.label}`, pct, amount: Math.round((total * pct) / 100) });
      });
      payments.push({ label: 'On handover (retention)', pct: ret, amount: 0 });
      // Put rounding difference into the last row so the schedule sums exactly
      const paid = payments.reduce((a, r) => a + r.amount, 0);
      payments[payments.length - 1].amount = total - paid;
      let cum = 0;
      payments.forEach((r) => { cum += r.amount; r.cumulative = cum; });
    }

    return { area, type, rate, master, rateOverridden, base, total, perSqft: area ? total / area : 0, stages, payments, splitTotal };
  }

  /* ---------------------------------------------------------------------------
   * MODULE 2 — Detailed BOQ + material summary
   * ------------------------------------------------------------------------ */
  function computeBOQ(p, R) {
    const t = R.thumb;
    const g = C.geometry(p, t);
    const boq = p.boq || {};
    const qtyOv = boq.qty || {};
    const rateOv = boq.rate || {};
    const qmap = {};
    const q = (id) => qmap[id] || 0;

    const items = C.items.map((it) => {
      const applicable = !it.when || !!it.when(g);
      let auto = 0;
      if (applicable) {
        try { auto = roundQty(it.qty(g, t, q), it.unit); } catch (e) { auto = 0; }
      }
      const qtyOverridden = applicable && hasVal(qtyOv[it.id]);
      const qty = applicable ? (qtyOverridden ? Number(qtyOv[it.id]) : auto) : 0;
      qmap[it.id] = qty;

      const master = typeof R.rates[it.id] === 'object' ? R.rates[it.id][p.spec] || 0 : R.rates[it.id];
      const rateOverridden = hasVal(rateOv[it.id]);
      const rate = rateOverridden ? Number(rateOv[it.id]) : master;
      return {
        id: it.id, sec: it.sec, desc: it.desc, unit: it.unit, def: it,
        applicable, auto, qty, qtyOverridden, master, rate, rateOverridden,
        amount: Math.round(qty * rate), custom: false
      };
    });

    // Custom (user-added) items
    (boq.custom || []).forEach((c) => {
      const qty = num(c.qty), rate = num(c.rate);
      items.push({
        id: c.id, sec: c.sec, desc: c.desc || '', unit: c.unit || 'nos', applicable: true,
        auto: qty, qty, qtyOverridden: false, master: rate, rate, rateOverridden: false,
        amount: Math.round(qty * rate), custom: true
      });
    });

    const sections = C.sections.map((s) => {
      const list = items.filter((i) => i.sec === s.id && i.applicable);
      const active = sectionActive(p, s.id);
      const subtotal = list.reduce((a, i) => a + i.amount, 0);
      return { id: s.id, label: s.label, active, items: list, subtotal };
    });

    const subtotal = sections.filter((s) => s.active).reduce((a, s) => a + s.subtotal, 0);
    const contingencyPct = num(boq.contingencyPct);
    const contingency = Math.round((subtotal * contingencyPct) / 100);
    const gstPct = num(boq.gstPct);
    const gst = boq.gstEnabled ? Math.round(((subtotal + contingency) * gstPct) / 100) : 0;
    const total = subtotal + contingency + gst;

    const materials = computeMaterials(p, R, g, sections);

    return {
      g, sections, subtotal, contingencyPct, contingency,
      gstEnabled: !!boq.gstEnabled, gstPct, gst, total,
      perSqft: g.Asqft ? total / g.Asqft : 0,
      materials
    };
  }

  function computeMaterials(p, R, g, sections) {
    const t = R.thumb;
    const acc = { cement: 0, steel: 0, sand: 0, agg: 0, units: 0, rubble: 0, structSteel: 0 };
    const val = (f) => (typeof f === 'function' ? f(t) : Number(f) || 0);

    sections.filter((s) => s.active).forEach((s) => {
      s.items.forEach((i) => {
        if (i.custom || !i.def) return;
        const d = i.def;
        (d.mat || []).forEach(([mixId, factor]) => {
          const m = R.mixes[mixId];
          if (!m) return;
          const f = val(factor);
          acc.cement += i.qty * f * m.cement;
          acc.sand += i.qty * f * m.sand;
          acc.agg += i.qty * f * m.agg;
        });
        if (d.steel) acc.steel += i.qty * val(d.steel);
        if (d.structSteel) acc.structSteel += i.qty * val(d.structSteel);
        if (d.rubble) acc.rubble += i.qty * val(d.rubble);
        if (d.units) acc.units += i.qty * (t[d.units] || 0);
      });
    });

    const unitsLabel = { laterite: 'Laterite stones', brick: 'Bricks', block: 'Solid blocks (400×200×200)' }[p.masonry] || 'Bricks / blocks';
    const ov = p.materials || {};
    return C.materials
      .map((m) => {
        const raw = acc[m.id] || 0;
        const auto = m.id === 'cement' ? Math.ceil(raw) : m.unit === 'cum' ? Math.round(raw * 10) / 10 : Math.round(raw);
        const overridden = hasVal(ov[m.id]);
        return {
          id: m.id, unit: m.unit, optional: !!m.optional,
          label: m.id === 'units' ? unitsLabel : m.label,
          auto, value: overridden ? Number(ov[m.id]) : auto, overridden
        };
      })
      .filter((m) => !m.optional || m.auto > 0 || m.overridden);
  }

  /* ---------------------------------------------------------------------------
   * Formatting helpers (Indian number system)
   * ------------------------------------------------------------------------ */
  const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const inr2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

  function fmtINR(n) { return '₹ ' + inr0.format(Math.round(num(n))); }
  function fmtNum(n, dp) {
    if (dp === 0) return inr0.format(num(n));
    if (dp === 1) return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(num(n));
    return inr2.format(num(n));
  }
  function fmtLakh(n) {
    n = num(n);
    if (Math.abs(n) >= 1e7) return '₹ ' + (n / 1e7).toFixed(2) + ' Cr';
    if (Math.abs(n) >= 1e5) return '₹ ' + (n / 1e5).toFixed(2) + ' L';
    return fmtINR(n);
  }

  /** Amount in words, Indian system: "Rupees Twelve Lakh Five Thousand Only". */
  function inWords(amount) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
      'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const two = (n) => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''));
    const three = (n) => (n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n));
    let n = Math.round(num(amount));
    if (n === 0) return 'Rupees Zero Only';
    const parts = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1e3); n %= 1e3;
    if (crore) parts.push((crore >= 100 ? three(crore) : two(crore)) + ' Crore');
    if (lakh) parts.push(two(lakh) + ' Lakh');
    if (thousand) parts.push(two(thousand) + ' Thousand');
    if (n) parts.push(three(n));
    return 'Rupees ' + parts.join(' ') + ' Only';
  }

  root.GE_ENGINE = {
    resolve, isUnverified, rateKey, computeQuick, computeBOQ, sectionActive,
    roundQty, fmtINR, fmtNum, fmtLakh, inWords, num, hasVal
  };
})(typeof window !== 'undefined' ? window : globalThis);
