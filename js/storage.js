/* =============================================================================
 * Gravity Estimator — storage (localStorage) + JSON backup / restore
 * ========================================================================== */
(function (root) {
  'use strict';
  const C = root.GE_CONFIG;
  const KEY_PROJECTS = 'ge.projects.v1';
  const KEY_SETTINGS = 'ge.settings.v1';
  const SCHEMA = 1;

  /* Safe wrappers — localStorage can throw (private mode, quota full). */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Storage read failed', key, e);
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write failed', key, e);
      alert('Could not save — device storage may be full. Remove the logo or export a backup and delete old projects.');
      return false;
    }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  /* ---------------------------------------------------------------------------
   * Settings
   * ------------------------------------------------------------------------ */
  function defaultSettings() {
    return {
      schema: SCHEMA,
      company: { ...C.company },
      logo: '',                          // data URL
      commercial: { ...C.commercial },
      overrides: {},                     // "path" → number (see engine.resolve)
      verified: {},                      // "path" → true (rate confirmed)
      terms: C.terms.join('\n'),
      counter: 0                         // estimate reference counter
    };
  }

  function loadSettings() {
    const s = readJSON(KEY_SETTINGS, null);
    const d = defaultSettings();
    if (!s) return d;
    return {
      ...d, ...s,
      company: { ...d.company, ...(s.company || {}) },
      commercial: { ...d.commercial, ...(s.commercial || {}) },
      overrides: s.overrides || {},
      verified: s.verified || {}
    };
  }
  const saveSettings = (s) => writeJSON(KEY_SETTINGS, s);

  /* ---------------------------------------------------------------------------
   * Projects
   * ------------------------------------------------------------------------ */
  function newProject(settings) {
    const c = (settings && settings.commercial) || C.commercial;
    const now = new Date().toISOString();
    return {
      schema: SCHEMA,
      id: uid(),
      ref: '',
      createdAt: now,
      updatedAt: now,
      client: '',
      phone: '',
      location: '',
      date: today(),
      type: 'new',
      plotCents: '',
      floors: [''],                     // built-up area per floor (sq.ft), GF first
      spec: 'standard',
      quickRate: '',                    // optional project-specific ₹/sq.ft
      foundation: 'column',
      roof: 'flat',
      masonry: 'block',
      notes: '',
      boq: {
        qty: {},                        // itemId → overridden quantity
        rate: {},                       // itemId → project-specific rate
        custom: [],                     // user-added items
        sections: {},                   // sectionId → true/false (manual include)
        contingencyPct: c.contingencyPct,
        gstEnabled: c.gstEnabled,
        gstPct: c.gstPct
      },
      materials: {},                    // materialId → overridden quantity
      print: { quick: true, payment: true, boq: true, materials: true, terms: true }
    };
  }

  /** Fill in any fields missing from older / imported projects. */
  function normalizeProject(p, settings) {
    const d = newProject(settings);
    const out = { ...d, ...p, boq: { ...d.boq, ...(p.boq || {}) }, print: { ...d.print, ...(p.print || {}) } };
    if (!Array.isArray(out.floors) || !out.floors.length) out.floors = [''];
    out.materials = out.materials || {};
    return out;
  }

  function loadProjects(settings) {
    const list = readJSON(KEY_PROJECTS, []);
    return Array.isArray(list) ? list.map((p) => normalizeProject(p, settings)) : [];
  }
  const saveProjects = (list) => writeJSON(KEY_PROJECTS, list);

  function duplicateProject(p) {
    const copy = JSON.parse(JSON.stringify(p));
    const now = new Date().toISOString();
    copy.id = uid();
    copy.ref = '';
    copy.client = (p.client || 'Untitled') + ' (copy)';
    copy.createdAt = now;
    copy.updatedAt = now;
    return copy;
  }

  /* ---------------------------------------------------------------------------
   * Backup (JSON export / import)
   * ------------------------------------------------------------------------ */
  function exportData(projects, settings, onlyProject) {
    return {
      app: 'gravity-estimator',
      schema: SCHEMA,
      exportedAt: new Date().toISOString(),
      settings: onlyProject ? undefined : settings,
      projects: onlyProject ? [onlyProject] : projects
    };
  }

  /**
   * Validate an imported file. Returns { projects, settings } or throws.
   * Projects are merged by id (imported copy wins); settings replaced only if present.
   */
  function parseImport(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('File is not valid JSON.'); }
    if (!data || data.app !== 'gravity-estimator') throw new Error('This is not a Gravity Estimator backup file.');
    const projects = Array.isArray(data.projects) ? data.projects.filter((p) => p && p.id) : [];
    return { projects, settings: data.settings || null };
  }

  root.GE_STORE = {
    loadSettings, saveSettings, defaultSettings,
    loadProjects, saveProjects, newProject, normalizeProject, duplicateProject,
    exportData, parseImport, uid, today
  };
})(typeof window !== 'undefined' ? window : globalThis);
