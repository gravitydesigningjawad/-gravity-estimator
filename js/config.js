/* =============================================================================
 * Gravity Estimator — CONFIG (rates, thumb rules and quantity formulas)
 * -----------------------------------------------------------------------------
 * THIS IS THE ONLY FILE YOU NEED TO EDIT TO CHANGE DEFAULT RATES OR FORMULAS.
 *
 *  • Every rate below is a PLACEHOLDER Kerala rate (composite: material +
 *    labour, excluding GST). The app shows a "VERIFY" badge next to each rate
 *    until it is confirmed or edited in Settings.
 *  • Values edited in the app (Settings) are stored as overrides in the
 *    browser and take priority over the defaults here. Settings → "Reset"
 *    brings back the values in this file.
 *  • Quantity formulas receive:
 *       g  – derived geometry of the project (see `geometry()` below)
 *       t  – thumb-rule coefficients (see `thumb` below, editable in Settings)
 *       q  – q('itemId') returns the FINAL quantity (after any manual
 *            override) of an item defined EARLIER in the list
 *
 * Units: cum = cubic metre, sqm = square metre, sqft = square foot,
 *        rmt = running metre, nos = numbers, kg = kilogram, set = set.
 * ========================================================================== */
(function (root) {
  'use strict';

  const SQM_PER_SQFT = 0.09290304;
  const SQFT_PER_CENT = 435.6;           // 1 cent = 435.6 sq.ft (40.47 sqm)
  const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

  const CONFIG = {
    appVersion: '1.0.0',
    SQM_PER_SQFT,
    SQFT_PER_CENT,

    /* -------------------------------------------------------------------------
     * Company details (defaults — editable in Settings → Company)
     * ---------------------------------------------------------------------- */
    company: {
      name: 'Gravity Architectural Studio',
      tagline: 'Architects · Design & Build',
      address: 'Murikkan Building, YMCA, Alappuzha, Kerala',
      website: 'gravityarchitectural.com',
      phone: '',
      email: '',
      gstin: '',
      refPrefix: 'GAS/EST'
    },

    /* Default commercial settings for new projects */
    commercial: {
      contingencyPct: 5,
      gstEnabled: false,
      gstPct: 18,            // Works contract GST — verify with your CA
      validityDays: 30
    },

    /* -------------------------------------------------------------------------
     * Project input options
     * ---------------------------------------------------------------------- */
    options: {
      projectTypes: [
        { id: 'new', label: 'New construction' },
        { id: 'renovation', label: 'Renovation' },
        { id: 'structural', label: 'Structural-only' },
        { id: 'interiors', label: 'Interiors' }
      ],
      specs: [
        { id: 'basic', label: 'Basic' },
        { id: 'standard', label: 'Standard' },
        { id: 'premium', label: 'Premium' }
      ],
      foundations: [
        { id: 'rubble', label: 'Rubble' },
        { id: 'column', label: 'Column footing' },
        { id: 'pile', label: 'Pile' }
      ],
      roofs: [
        { id: 'flat', label: 'Flat RCC' },
        { id: 'sloped', label: 'Sloped RCC + tiles' },
        { id: 'truss', label: 'Truss + tiles' }
      ],
      masonry: [
        { id: 'laterite', label: 'Laterite' },
        { id: 'brick', label: 'Brick' },
        { id: 'block', label: 'Solid block' }
      ]
    },

    /* -------------------------------------------------------------------------
     * MODULE 1 — QUICK ESTIMATE
     * ---------------------------------------------------------------------- */
    quick: {
      // ₹ per sq.ft of built-up area, by project type × specification. VERIFY.
      ratesPerSqft: {
        new:        { basic: 1900, standard: 2400, premium: 3300 },
        renovation: { basic: 1100, standard: 1500, premium: 2200 },
        structural: { basic: 1050, standard: 1250, premium: 1550 },
        interiors:  { basic: 700,  standard: 1200, premium: 2000 }
      },

      // Construction stages, in site sequence (also used for payment schedule)
      stages: [
        { id: 'foundation', label: 'Foundation' },
        { id: 'structure', label: 'Structure (RCC frame & slabs)' },
        { id: 'masonry', label: 'Masonry' },
        { id: 'roofing', label: 'Roofing' },
        { id: 'plastering', label: 'Plastering' },
        { id: 'electrical', label: 'Electrical' },
        { id: 'plumbing', label: 'Plumbing' },
        { id: 'flooring', label: 'Flooring' },
        { id: 'doorsWindows', label: 'Doors & Windows' },
        { id: 'painting', label: 'Painting' },
        { id: 'finishes', label: 'Finishes' }
      ],

      // % share of each stage (should total 100 for each project type)
      split: {
        new:        { foundation: 10, structure: 20, masonry: 9, roofing: 7, plastering: 7, electrical: 6, plumbing: 7, flooring: 10, doorsWindows: 9, painting: 5, finishes: 10 },
        renovation: { foundation: 3, structure: 8, masonry: 8, roofing: 10, plastering: 10, electrical: 10, plumbing: 10, flooring: 15, doorsWindows: 10, painting: 8, finishes: 8 },
        structural: { foundation: 20, structure: 40, masonry: 17, roofing: 10, plastering: 13 },
        interiors:  { electrical: 15, flooring: 25, doorsWindows: 15, painting: 15, finishes: 30 }
      },

      // Multipliers applied to a single stage based on project choices
      modifiers: {
        foundation: { rubble: 1.0, column: 1.15, pile: 1.6 },
        roofing: { flat: 1.0, sloped: 1.35, truss: 1.15 }
      },

      // Payment schedule: advance on agreement, then stage-wise, retention at handover
      payment: { advancePct: 10, retentionPct: 5 }
    },

    /* -------------------------------------------------------------------------
     * THUMB RULES — used by the quantity formulas and material summary.
     * All editable in Settings → Thumb rules.
     * ---------------------------------------------------------------------- */
    thumb: {
      // Plan geometry
      perimeterFactor:    { v: 4.4,  unit: '',        label: 'Perimeter factor k (external wall length = k × √floor area)' },
      internalWallFactor: { v: 0.30, unit: 'm/sqm',   label: 'Internal wall length per sqm of floor area' },
      floorHeight:        { v: 3.0,  unit: 'm',       label: 'Floor-to-floor height' },
      wallHeight:         { v: 2.75, unit: 'm',       label: 'Masonry height per floor (below beam)' },
      extWallThk:         { v: 0.20, unit: 'm',       label: 'External wall thickness' },
      intWallThk:         { v: 0.20, unit: 'm',       label: 'Internal wall thickness' },
      openingDeduction:   { v: 0.15, unit: 'ratio',   label: 'Deduction for door/window openings (masonry & plaster)' },
      parapetHeight:      { v: 0.9,  unit: 'm',       label: 'Parapet height (flat roof)' },
      parapetThk:         { v: 0.15, unit: 'm',       label: 'Parapet thickness' },
      plinthHeight:       { v: 0.60, unit: 'm',       label: 'Plinth height above ground (low-lying sites: raise)' },
      carpetRatio:        { v: 0.85, unit: 'ratio',   label: 'Floor-finish area ÷ built-up area' },

      // Foundation
      foundationDepth:    { v: 1.2,  unit: 'm',       label: 'Foundation depth below GL' },
      pccThk:             { v: 0.10, unit: 'm',       label: 'PCC bed thickness under foundation' },
      workingSpace:       { v: 0.15, unit: 'm',       label: 'Working space each side of footing pit' },
      rubbleTrenchWidth:  { v: 0.90, unit: 'm',       label: 'Rubble foundation — trench width' },
      rubbleAvgWidth:     { v: 0.60, unit: 'm',       label: 'Rubble foundation — average masonry width' },
      colFactorRubble:    { v: 0.25, unit: 'ratio',   label: 'Columns in rubble (load-bearing) option vs framed' },
      columnsPerSqm:      { v: 0.15, unit: 'nos/sqm', label: 'Columns per sqm of ground floor' },
      footingSize:        { v: 1.2,  unit: 'm',       label: 'Isolated footing size (square)' },
      footingThk:         { v: 0.35, unit: 'm',       label: 'Isolated footing average thickness' },
      beamTrenchW:        { v: 0.60, unit: 'm',       label: 'Plinth/grade beam trench width' },
      beamTrenchD:        { v: 0.45, unit: 'm',       label: 'Plinth/grade beam trench depth' },
      pilesPerColumn:     { v: 1.5,  unit: 'nos',     label: 'Piles per column (average)' },
      pileLength:         { v: 8,    unit: 'm',       label: 'Pile length' },
      pileDia:            { v: 0.30, unit: 'm',       label: 'Pile diameter' },
      pileCapSize:        { v: 0.90, unit: 'm',       label: 'Pile cap size (square)' },
      pileCapDepth:       { v: 0.50, unit: 'm',       label: 'Pile cap depth' },
      pileSteelPerRmt:    { v: 6.5,  unit: 'kg/rmt',  label: 'Steel in pile per running metre' },

      // RCC frame
      colB:               { v: 0.23, unit: 'm',       label: 'Column width' },
      colD:               { v: 0.30, unit: 'm',       label: 'Column depth' },
      plinthBeamB:        { v: 0.23, unit: 'm',       label: 'Plinth beam width' },
      plinthBeamD:        { v: 0.30, unit: 'm',       label: 'Plinth beam depth' },
      gradeBeamD:         { v: 0.40, unit: 'm',       label: 'Grade beam depth (pile foundation)' },
      beamFactor:         { v: 1.0,  unit: 'ratio',   label: 'Beam length ÷ wall length' },
      beamB:              { v: 0.23, unit: 'm',       label: 'Beam width' },
      beamD:              { v: 0.23, unit: 'm',       label: 'Beam depth below slab' },
      lintelFactor:       { v: 0.35, unit: 'ratio',   label: 'Lintel length ÷ wall length' },
      lintelD:            { v: 0.15, unit: 'm',       label: 'Lintel depth' },
      slabThk:            { v: 0.125, unit: 'm',      label: 'Slab thickness' },
      overhangFactor:     { v: 1.08, unit: 'ratio',   label: 'Slab area factor for sunshades/projections' },
      slopeFactor:        { v: 1.25, unit: 'ratio',   label: 'Sloped roof area ÷ plan area (incl. eaves)' },
      stairToTerrace:     { v: 1,    unit: '1/0',     label: 'Stair up to terrace on flat roof (1 = yes)' },
      stairConcrete:      { v: 1.8,  unit: 'cum',     label: 'Concrete per staircase flight (floor to floor)' },
      stairFormwork:      { v: 9,    unit: 'sqm',     label: 'Formwork per staircase flight' },
      trussKgPerSqm:      { v: 12,   unit: 'kg/sqm',  label: 'Steel truss weight per sqm of roof' },

      // Steel (reinforcement) — kg per cum of concrete
      steelFooting:       { v: 80,   unit: 'kg/cum',  label: 'Steel in footings' },
      steelPileCap:       { v: 90,   unit: 'kg/cum',  label: 'Steel in pile caps' },
      steelPlinth:        { v: 110,  unit: 'kg/cum',  label: 'Steel in plinth / grade beams' },
      steelColumn:        { v: 180,  unit: 'kg/cum',  label: 'Steel in columns' },
      steelBeam:          { v: 150,  unit: 'kg/cum',  label: 'Steel in beams & lintels' },
      steelSlab:          { v: 90,   unit: 'kg/cum',  label: 'Steel in slabs' },
      steelStair:         { v: 100,  unit: 'kg/cum',  label: 'Steel in staircase' },

      // Finishes & services
      dadoRatio:          { v: 0.15, unit: 'sqm/sqm', label: 'Wall tiles (toilets, kitchen) per sqm BUA' },
      skirtingFactor:     { v: 0.70, unit: 'ratio',   label: 'Skirting length ÷ room perimeter' },
      toiletFloorArea:    { v: 4.5,  unit: 'sqm',     label: 'Floor area per toilet (anti-skid tiles)' },
      toiletWpArea:       { v: 7,    unit: 'sqm',     label: 'Waterproofing area per toilet (floor + upturn)' },
      stairFinishSqft:    { v: 70,   unit: 'sqft',    label: 'Granite on treads & risers per flight' },
      sqmPerToilet:       { v: 35,   unit: 'sqm',     label: 'Built-up area per toilet' },
      sqmPerDoor:         { v: 15,   unit: 'sqm',     label: 'Built-up area per door (all doors)' },
      windowRatio:        { v: 0.12, unit: 'sqm/sqm', label: 'Window area per sqm BUA' },
      pointsPerSqm:       { v: 0.45, unit: 'nos/sqm', label: 'Electrical light/fan/socket points per sqm' },
      powerPerSqm:        { v: 0.06, unit: 'nos/sqm', label: 'Power points (16A) per sqm' },
      mainLineLength:     { v: 25,   unit: 'rmt',     label: 'Main supply cable length' },
      downpipes:          { v: 4,    unit: 'nos',     label: 'Rainwater downpipes' },
      extDrainFactor:     { v: 1.2,  unit: 'ratio',   label: 'External drainage length ÷ GF perimeter' },

      // Masonry units per cum of masonry (incl. ~5% wastage)
      unitsLaterite:      { v: 85,   unit: 'nos/cum', label: 'Laterite stones per cum' },
      unitsBrick:         { v: 500,  unit: 'nos/cum', label: 'Bricks per cum' },
      unitsBlock:         { v: 60,   unit: 'nos/cum', label: 'Solid blocks (400×200×200) per cum' },
      rubblePerCum:       { v: 1.1,  unit: 'cum/cum', label: 'Granite rubble per cum of RR masonry' }
    },

    /* -------------------------------------------------------------------------
     * MATERIAL COEFFICIENTS per unit of the BOQ item they are linked to
     * (cement in 50 kg bags, sand & aggregate in cft; include normal wastage).
     * Editable in Settings → Thumb rules.
     * ---------------------------------------------------------------------- */
    mixes: {
      PCC148:   { label: 'PCC 1:4:8 (per cum)',                     cement: 3.40,  sand: 16.5, agg: 33.0 },
      M15:      { label: 'Concrete M15 1:2:4 (per cum)',            cement: 6.34,  sand: 15.5, agg: 31.0 },
      M20:      { label: 'Concrete M20 1:1.5:3 (per cum)',          cement: 8.06,  sand: 14.8, agg: 29.7 },
      M25:      { label: 'Concrete M25 (per cum)',                  cement: 9.00,  sand: 14.0, agg: 28.5 },
      RR16:     { label: 'Rubble masonry CM 1:6 (per cum)',         cement: 1.86,  sand: 13.7, agg: 0 },
      LAT16:    { label: 'Laterite masonry CM 1:6 (per cum)',       cement: 0.82,  sand: 6.0,  agg: 0 },
      BRK16:    { label: 'Brick masonry CM 1:6 (per cum)',          cement: 1.37,  sand: 10.1, agg: 0 },
      BLK16:    { label: 'Block masonry CM 1:6 (per cum)',          cement: 0.44,  sand: 3.2,  agg: 0 },
      PLINT:    { label: 'Internal plaster 12mm CM 1:6 (per sqm)',  cement: 0.066, sand: 0.49, agg: 0 },
      PLEXT:    { label: 'External plaster 15mm CM 1:4 (per sqm)',  cement: 0.115, sand: 0.57, agg: 0 },
      PLCEIL:   { label: 'Ceiling plaster 10mm CM 1:3 (per sqm)',   cement: 0.096, sand: 0.35, agg: 0 },
      TILEBED:  { label: 'Tile bed 20mm CM 1:4 + slurry (per sqft)', cement: 0.017, sand: 0.07, agg: 0 }
    },

    /* Material summary lines (order of display) */
    materials: [
      { id: 'cement', label: 'Cement (50 kg bags)', unit: 'bags' },
      { id: 'steel', label: 'Steel — TMT Fe500D', unit: 'kg' },
      { id: 'sand', label: 'Sand / M-sand', unit: 'cft' },
      { id: 'agg', label: 'Aggregate (20/40 mm)', unit: 'cft' },
      { id: 'units', label: 'Bricks / blocks / laterite', unit: 'nos' },
      { id: 'rubble', label: 'Granite rubble', unit: 'cum', optional: true },
      { id: 'structSteel', label: 'Structural steel (truss)', unit: 'kg', optional: true }
    ],

    /* -------------------------------------------------------------------------
     * MODULE 2 — BOQ SECTIONS and which ones apply to each project type
     * ---------------------------------------------------------------------- */
    sections: [
      { id: 'earthwork', label: 'Earthwork' },
      { id: 'pcc', label: 'Plain Cement Concrete (PCC)' },
      { id: 'rcc', label: 'Reinforced Cement Concrete (RCC)' },
      { id: 'masonry', label: 'Masonry' },
      { id: 'roofing', label: 'Roofing' },
      { id: 'plastering', label: 'Plastering' },
      { id: 'waterproofing', label: 'Waterproofing' },
      { id: 'flooring', label: 'Flooring & Tiling' },
      { id: 'doors', label: 'Doors & Windows' },
      { id: 'electrical', label: 'Electrical' },
      { id: 'plumbing', label: 'Plumbing & Sanitary' },
      { id: 'painting', label: 'Painting' }
    ],

    sectionsByProjectType: {
      new:        ['earthwork', 'pcc', 'rcc', 'masonry', 'roofing', 'plastering', 'waterproofing', 'flooring', 'doors', 'electrical', 'plumbing', 'painting'],
      renovation: ['masonry', 'roofing', 'plastering', 'waterproofing', 'flooring', 'doors', 'electrical', 'plumbing', 'painting'],
      structural: ['earthwork', 'pcc', 'rcc', 'masonry', 'roofing', 'plastering', 'waterproofing'],
      interiors:  ['flooring', 'doors', 'electrical', 'plumbing', 'painting']
    },

    units: ['cum', 'sqm', 'sqft', 'rmt', 'nos', 'kg', 'set', 'LS'],

    /* -------------------------------------------------------------------------
     * DERIVED GEOMETRY — turns project inputs into lengths, areas & volumes.
     * All lengths in metres, areas in sqm, volumes in cum.
     * ---------------------------------------------------------------------- */
    geometry(p, t) {
      const areasSqft = (p.floors || []).map(Number).filter((a) => a > 0);
      const n = areasSqft.length;
      const floors = areasSqft.map((sqft) => {
        const a = sqft * SQM_PER_SQFT;
        return { a, P: t.perimeterFactor * Math.sqrt(a), Lint: t.internalWallFactor * a };
      });
      const A = sum(floors.map((f) => f.a));
      const Ag = n ? floors[0].a : 0;
      const Atop = n ? floors[n - 1].a : 0;
      const Pg = n ? floors[0].P : 0;
      const LintG = n ? floors[0].Lint : 0;
      const Ptop = n ? floors[n - 1].P : 0;
      const flat = p.roof === 'flat';
      const sloped = p.roof === 'sloped';
      const truss = p.roof === 'truss';
      const open = 1 - t.openingDeduction;

      // Columns
      const colFactor = p.foundation === 'rubble' ? t.colFactorRubble : 1;
      const nCols = Ag > 0 ? Math.ceil(Ag * t.columnsPerSqm * colFactor) : 0;
      const colHeight = n * t.floorHeight + t.foundationDepth;

      // Slabs: one over every floor, except the top floor under a truss roof
      let slabPlan = 0;       // plan area (ceiling plaster)
      let slabArea = 0;       // concrete area incl. sunshades / slope
      floors.forEach((f, i) => {
        const top = i === n - 1;
        if (top && truss) return;
        slabPlan += f.a;
        slabArea += f.a * (top && sloped ? t.slopeFactor : t.overhangFactor);
      });

      const wallLen = sum(floors.map((f) => f.P + f.Lint));
      const Lf = Pg + LintG;  // foundation / plinth beam length
      const flights = n > 0 ? Math.max(0, n - 1 + (flat && t.stairToTerrace ? 1 : 0)) : 0;
      const toilets = A > 0 ? Math.max(1, Math.round(A / t.sqmPerToilet)) : 0;

      // Foundation quantities by foundation type
      const fdn = { exc: 0, pcc: 0, rubble: 0, footing: 0, plinthBeam: 0, pileCap: 0, piles: 0, pileRmt: 0, formwork: 0, belowGL: 0 };
      if (Ag > 0) {
        const d = t.foundationDepth;
        if (p.foundation === 'pile') {
          fdn.piles = Math.ceil(nCols * t.pilesPerColumn);
          fdn.pileRmt = fdn.piles * t.pileLength;
          const pit = t.pileCapSize + 2 * t.workingSpace;
          fdn.exc = nCols * pit * pit * (t.pileCapDepth + t.pccThk) + Lf * t.beamTrenchW * t.beamTrenchD;
          fdn.pcc = nCols * Math.pow(t.pileCapSize + 0.3, 2) * t.pccThk;
          fdn.pileCap = nCols * t.pileCapSize * t.pileCapSize * t.pileCapDepth;
          fdn.plinthBeam = Lf * t.plinthBeamB * t.gradeBeamD;
          fdn.formwork = nCols * 4 * t.pileCapSize * t.pileCapDepth + 2 * Lf * t.gradeBeamD;
          fdn.belowGL = fdn.pcc + fdn.pileCap;
        } else {
          // Isolated footings (all columns in "column", a few in "rubble")
          const pit = t.footingSize + 2 * t.workingSpace;
          fdn.exc = nCols * pit * pit * d;
          fdn.pcc = nCols * Math.pow(t.footingSize + 0.3, 2) * t.pccThk;
          fdn.footing = nCols * t.footingSize * t.footingSize * t.footingThk;
          fdn.plinthBeam = Lf * t.plinthBeamB * t.plinthBeamD;
          fdn.formwork = nCols * 4 * t.footingSize * t.footingThk + 2 * Lf * t.plinthBeamD;
          fdn.belowGL = fdn.pcc + fdn.footing + nCols * t.colB * t.colD * Math.max(0, d - t.pccThk - t.footingThk);
          if (p.foundation === 'rubble') {
            // Continuous RR masonry under all walls
            fdn.exc += Lf * t.rubbleTrenchWidth * d;
            fdn.pcc += Lf * t.rubbleTrenchWidth * t.pccThk;
            fdn.rubble = Lf * t.rubbleAvgWidth * (d - t.pccThk + t.plinthHeight);
            fdn.belowGL += Lf * t.rubbleTrenchWidth * t.pccThk + Lf * t.rubbleAvgWidth * (d - t.pccThk);
          } else {
            fdn.exc += Lf * t.beamTrenchW * t.beamTrenchD;
          }
        }
      }

      // Masonry and plaster
      const masonryVol =
        sum(floors.map((f) => (f.P * t.extWallThk + f.Lint * t.intWallThk) * t.wallHeight)) * open +
        (flat ? Ptop * t.parapetHeight * t.parapetThk : 0);
      const plasterInt = sum(floors.map((f) => (f.P + 2 * f.Lint) * t.wallHeight)) * open;
      const plasterExt =
        sum(floors.map((f) => f.P * t.floorHeight)) * open +
        Pg * t.plinthHeight +
        (flat ? 2 * Ptop * t.parapetHeight : 0);

      return {
        n, A, Ag, Atop, Pg, Ptop, LintG, Lf, floors,
        Asqft: sum(areasSqft),
        plotSqm: (Number(p.plotCents) || 0) * SQFT_PER_CENT * SQM_PER_SQFT,
        flat, sloped, truss,
        foundation: p.foundation, masonry: p.masonry,
        nCols, colHeight, slabPlan, slabArea, wallLen, flights, toilets,
        fdn, masonryVol, plasterInt, plasterExt
      };
    },

    /* -------------------------------------------------------------------------
     * BOQ ITEM MASTER
     *  id      – unique key (do not change once projects are saved)
     *  sec     – section id
     *  desc    – description (IS 1200 style)
     *  unit    – unit of measurement
     *  rate    – number, or { basic, standard, premium } for spec-dependent items
     *  when    – (g) => boolean; item appears only when true (optional)
     *  qty     – (g, t, q) => auto quantity
     *  mat     – [[mixId, factor]] material coefficients per unit (factor may be (t)=>n)
     *  steel   – (t) => kg TMT per unit (optional)
     *  structSteel – (t) => kg structural steel per unit (optional)
     *  rubble  – (t) => cum granite rubble per unit (optional)
     *  units   – thumb key giving bricks / blocks per unit (optional)
     *  All rates: PLACEHOLDER — VERIFY before issuing to a client.
     * ---------------------------------------------------------------------- */
    items: [
      /* ---- EARTHWORK ---- */
      { id: 'ew_clear', sec: 'earthwork', unit: 'sqm', rate: 25,
        desc: 'Site clearance: removing shrubs, grass and debris, levelling and disposal within site',
        qty: (g) => g.plotSqm || g.Ag * 1.5 },
      { id: 'ew_exc', sec: 'earthwork', unit: 'cum', rate: 380,
        desc: 'Earthwork in excavation for foundation in ordinary soil up to 1.5 m depth incl. dewatering (if required), lift and lead up to 50 m',
        qty: (g) => g.fdn.exc },
      { id: 'ew_backfill', sec: 'earthwork', unit: 'cum', rate: 180,
        desc: 'Backfilling foundation trenches with excavated earth in 150 mm layers, watered and consolidated',
        qty: (g, t, q) => Math.max(0, q('ew_exc') - g.fdn.belowGL) },
      { id: 'ew_plinthfill', sec: 'earthwork', unit: 'cum', rate: 850,
        desc: 'Filling in plinth with approved earth / sand in layers, watered and rammed',
        qty: (g, t) => g.Ag * t.carpetRatio * t.plinthHeight },
      { id: 'ew_antitermite', sec: 'earthwork', unit: 'sqm', rate: 60,
        desc: 'Anti-termite pre-constructional treatment as per IS 6313 (Part 2)',
        qty: (g) => g.Ag },

      /* ---- PCC ---- */
      { id: 'pcc_fdn', sec: 'pcc', unit: 'cum', rate: 6500,
        desc: 'PCC 1:4:8 (40 mm nominal size aggregate) in foundation bed, incl. compaction and curing',
        qty: (g) => g.fdn.pcc, mat: [['PCC148', 1]] },
      { id: 'pcc_floor', sec: 'pcc', unit: 'cum', rate: 6500,
        desc: 'PCC 1:4:8, 75 mm thick, as base for ground floor flooring',
        qty: (g, t) => g.Ag * t.carpetRatio * 0.075, mat: [['PCC148', 1]] },
      { id: 'pcc_dpc', sec: 'pcc', unit: 'sqm', rate: 550,
        desc: 'Damp-proof course 40 mm thick CC 1:2:4 with integral waterproofing compound at plinth level',
        qty: (g, t) => g.Pg * t.extWallThk + g.LintG * t.intWallThk, mat: [['M15', 0.04]] },

      /* ---- RCC ---- */
      { id: 'rcc_pile', sec: 'rcc', unit: 'rmt', rate: 2200, when: (g) => g.foundation === 'pile',
        desc: 'Bored cast-in-situ RCC pile, 300 mm dia, M25, incl. boring, reinforcement cage, concreting by tremie, chipping pile head (composite rate)',
        qty: (g) => g.fdn.pileRmt,
        mat: [['M25', (t) => Math.PI * t.pileDia * t.pileDia / 4]], steel: (t) => t.pileSteelPerRmt },
      { id: 'rcc_pilecap', sec: 'rcc', unit: 'cum', rate: 7200, when: (g) => g.foundation === 'pile',
        desc: 'RCC M20 in pile caps (excluding reinforcement & formwork)',
        qty: (g) => g.fdn.pileCap, mat: [['M20', 1]] },
      { id: 'rcc_footing', sec: 'rcc', unit: 'cum', rate: 7000, when: (g) => g.foundation !== 'pile',
        desc: 'RCC M20 in isolated column footings (excluding reinforcement & formwork)',
        qty: (g) => g.fdn.footing, mat: [['M20', 1]] },
      { id: 'rcc_plinth', sec: 'rcc', unit: 'cum', rate: 7400,
        desc: 'RCC M20 in plinth beams / grade beams (excluding reinforcement & formwork)',
        qty: (g) => g.fdn.plinthBeam, mat: [['M20', 1]] },
      { id: 'rcc_column', sec: 'rcc', unit: 'cum', rate: 7800,
        desc: 'RCC M20 in columns up to roof level (excluding reinforcement & formwork)',
        qty: (g, t) => g.nCols * t.colB * t.colD * g.colHeight, mat: [['M20', 1]] },
      { id: 'rcc_beam', sec: 'rcc', unit: 'cum', rate: 7600,
        desc: 'RCC M20 in beams, lintels and roof belts (excluding reinforcement & formwork)',
        qty: (g, t) => g.wallLen * t.beamFactor * t.beamB * t.beamD + g.wallLen * t.lintelFactor * t.extWallThk * t.lintelD,
        mat: [['M20', 1]] },
      { id: 'rcc_slab', sec: 'rcc', unit: 'cum', rate: 7400,
        desc: 'RCC M20 in floor / roof slabs incl. sunshades and projections (excluding reinforcement & formwork)',
        qty: (g, t) => g.slabArea * t.slabThk, mat: [['M20', 1]] },
      { id: 'rcc_stair', sec: 'rcc', unit: 'cum', rate: 7800,
        desc: 'RCC M20 in staircase waist slab, steps and landing (excluding reinforcement & formwork)',
        qty: (g, t) => g.flights * t.stairConcrete, mat: [['M20', 1]] },
      { id: 'rcc_steel', sec: 'rcc', unit: 'kg', rate: 85,
        desc: 'TMT reinforcement Fe500D: cutting, bending, placing and binding with annealed wire, incl. laps & wastage',
        qty: (g, t, q) =>
          q('rcc_pilecap') * t.steelPileCap + q('rcc_footing') * t.steelFooting + q('rcc_plinth') * t.steelPlinth +
          q('rcc_column') * t.steelColumn + q('rcc_beam') * t.steelBeam + q('rcc_slab') * t.steelSlab +
          q('rcc_stair') * t.steelStair,
        steel: () => 1 },
      { id: 'fw_fdn', sec: 'rcc', unit: 'sqm', rate: 420,
        desc: 'Formwork to footings / pile caps and plinth beams, incl. strutting and removal',
        qty: (g) => g.fdn.formwork },
      { id: 'fw_column', sec: 'rcc', unit: 'sqm', rate: 520,
        desc: 'Formwork to columns incl. strutting and removal',
        qty: (g, t) => g.nCols * 2 * (t.colB + t.colD) * g.colHeight },
      { id: 'fw_beam', sec: 'rcc', unit: 'sqm', rate: 520,
        desc: 'Formwork to beams, lintels and belts incl. props up to 3.3 m',
        qty: (g, t) => g.wallLen * t.beamFactor * (t.beamB + 2 * t.beamD) + g.wallLen * t.lintelFactor * (t.extWallThk + 2 * t.lintelD) },
      { id: 'fw_slab', sec: 'rcc', unit: 'sqm', rate: 480,
        desc: 'Centering and shuttering to slabs and sunshades incl. props up to 3.3 m',
        qty: (g) => g.slabArea },
      { id: 'fw_stair', sec: 'rcc', unit: 'sqm', rate: 620,
        desc: 'Formwork to staircase waist slab, landing and risers',
        qty: (g, t) => g.flights * t.stairFormwork },

      /* ---- MASONRY ---- */
      { id: 'ms_rubble', sec: 'masonry', unit: 'cum', rate: 5200, when: (g) => g.foundation === 'rubble',
        desc: 'Random rubble (granite) masonry in CM 1:6 in foundation and basement up to plinth',
        qty: (g) => g.fdn.rubble, mat: [['RR16', 1]], rubble: (t) => t.rubblePerCum },
      { id: 'ms_laterite', sec: 'masonry', unit: 'cum', rate: 6000, when: (g) => g.masonry === 'laterite',
        desc: 'Laterite stone masonry (dressed) in CM 1:6 in superstructure incl. parapet',
        qty: (g) => g.masonryVol, mat: [['LAT16', 1]], units: 'unitsLaterite' },
      { id: 'ms_brick', sec: 'masonry', unit: 'cum', rate: 7400, when: (g) => g.masonry === 'brick',
        desc: 'Brick masonry (wire-cut / country burnt) in CM 1:6 in superstructure incl. parapet',
        qty: (g) => g.masonryVol, mat: [['BRK16', 1]], units: 'unitsBrick' },
      { id: 'ms_block', sec: 'masonry', unit: 'cum', rate: 5800, when: (g) => g.masonry === 'block',
        desc: 'Solid concrete block masonry (400×200×200) in CM 1:6 in superstructure incl. parapet',
        qty: (g) => g.masonryVol, mat: [['BLK16', 1]], units: 'unitsBlock' },

      /* ---- ROOFING ---- */
      { id: 'rf_tiles_slab', sec: 'roofing', unit: 'sqm', when: (g) => g.sloped,
        rate: { basic: 850, standard: 1250, premium: 1900 },
        desc: 'Roof tiles (clay / ceramic) over sloped RCC slab on battens / mortar, incl. ridge & hip tiles',
        qty: (g, t) => g.Atop * t.slopeFactor },
      { id: 'rf_truss', sec: 'roofing', unit: 'kg', rate: 140, when: (g) => g.truss,
        desc: 'Fabrication & erection of MS/GI tubular roof truss with purlins, incl. primer and two coats enamel',
        qty: (g, t) => g.Atop * t.slopeFactor * t.trussKgPerSqm, structSteel: () => 1 },
      { id: 'rf_tiles_truss', sec: 'roofing', unit: 'sqm', when: (g) => g.truss,
        rate: { basic: 900, standard: 1300, premium: 1950 },
        desc: 'Roof tiles (clay / ceramic) fixed over truss purlins incl. ridge & hip tiles',
        qty: (g, t) => g.Atop * t.slopeFactor },
      { id: 'rf_ceiling', sec: 'roofing', unit: 'sqm', when: (g) => g.truss,
        rate: { basic: 900, standard: 1250, premium: 1900 },
        desc: 'Ceiling under truss roof (gypsum / PVC / wood panelling) with framework',
        qty: (g) => g.Atop },

      /* ---- PLASTERING ---- */
      { id: 'pl_int', sec: 'plastering', unit: 'sqm', rate: 280,
        desc: '12 mm cement plaster in CM 1:6 to internal walls, finished smooth',
        qty: (g) => g.plasterInt, mat: [['PLINT', 1]] },
      { id: 'pl_ext', sec: 'plastering', unit: 'sqm', rate: 340,
        desc: '15 mm cement plaster in CM 1:4 to external walls with waterproofing compound',
        qty: (g) => g.plasterExt, mat: [['PLEXT', 1]] },
      { id: 'pl_ceil', sec: 'plastering', unit: 'sqm', rate: 300,
        desc: '10 mm cement plaster in CM 1:3 to ceilings',
        qty: (g) => g.slabPlan, mat: [['PLCEIL', 1]] },

      /* ---- WATERPROOFING ---- */
      { id: 'wp_roof', sec: 'waterproofing', unit: 'sqm', rate: 450, when: (g) => g.flat,
        desc: 'Terrace waterproofing (polymer-modified cementitious / membrane) with protective screed',
        qty: (g, t) => g.Atop * t.overhangFactor },
      { id: 'wp_toilet', sec: 'waterproofing', unit: 'sqm', rate: 350,
        desc: 'Waterproofing of toilet floors and sunken areas incl. 300 mm upturn on walls',
        qty: (g, t) => g.toilets * t.toiletWpArea },

      /* ---- FLOORING & TILING ---- */
      { id: 'fl_main', sec: 'flooring', unit: 'sqft',
        rate: { basic: 110, standard: 150, premium: 260 },
        desc: 'Flooring: vitrified / large-format tiles (spec as agreed) laid in CM 1:4 bed with joint filling',
        qty: (g, t) => g.Asqft * t.carpetRatio, mat: [['TILEBED', 1]] },
      { id: 'fl_toilet', sec: 'flooring', unit: 'sqft',
        rate: { basic: 95, standard: 130, premium: 200 },
        desc: 'Anti-skid ceramic / vitrified tiles in toilet floors',
        qty: (g, t) => g.toilets * t.toiletFloorArea / SQM_PER_SQFT, mat: [['TILEBED', 1]] },
      { id: 'fl_dado', sec: 'flooring', unit: 'sqft',
        rate: { basic: 95, standard: 130, premium: 210 },
        desc: 'Glazed wall tiles (dado) in toilets and kitchen, set in CM 1:3 / tile adhesive',
        qty: (g, t) => g.A * t.dadoRatio / SQM_PER_SQFT, mat: [['TILEBED', 0.6]] },
      { id: 'fl_skirting', sec: 'flooring', unit: 'rmt',
        rate: { basic: 140, standard: 190, premium: 300 },
        desc: 'Skirting 100 mm high matching floor tile',
        qty: (g, t) => g.floors.reduce((s, f) => s + (f.P + 2 * f.Lint), 0) * t.skirtingFactor },
      { id: 'fl_stair', sec: 'flooring', unit: 'sqft',
        rate: { basic: 180, standard: 250, premium: 380 },
        desc: 'Granite (polished, 18–20 mm) on stair treads and risers incl. nosing',
        qty: (g, t) => g.flights * t.stairFinishSqft, mat: [['TILEBED', 1]] },

      { id: 'fl_kitchen', sec: 'flooring', unit: 'rmt',
        rate: { basic: 4500, standard: 6500, premium: 11000 },
        desc: 'Kitchen counter: RCC / stone slab with polished granite top (600 mm wide) incl. nosing and sink cut-out',
        qty: (g) => (g.n > 0 ? 3.5 : 0) },

      /* ---- DOORS & WINDOWS ---- */
      { id: 'dw_main', sec: 'doors', unit: 'nos',
        rate: { basic: 35000, standard: 55000, premium: 95000 },
        desc: 'Main door: hardwood / teak frame and panelled shutter with hardware, lock and polish',
        qty: (g) => (g.n > 0 ? 1 : 0) },
      { id: 'dw_int', sec: 'doors', unit: 'nos',
        rate: { basic: 12000, standard: 18000, premium: 30000 },
        desc: 'Internal doors: wooden frame with flush / panelled shutter, hardware and finish',
        qty: (g, t) => Math.max(0, Math.round(g.A / t.sqmPerDoor) - g.toilets - 1) },
      { id: 'dw_toilet', sec: 'doors', unit: 'nos',
        rate: { basic: 7000, standard: 9500, premium: 14000 },
        desc: 'Toilet doors: WPC / FRP frame and shutter with hardware',
        qty: (g) => g.toilets },
      { id: 'dw_window', sec: 'doors', unit: 'sqm',
        rate: { basic: 6500, standard: 9500, premium: 15000 },
        desc: 'Windows (wood / UPVC / aluminium as per spec) with glazing and hardware',
        qty: (g, t) => g.A * t.windowRatio },
      { id: 'dw_grill', sec: 'doors', unit: 'sqm', rate: 1900,
        desc: 'MS safety grills for windows, fabricated and fixed with primer',
        qty: (g, t, q) => q('dw_window') },
      { id: 'dw_vent', sec: 'doors', unit: 'nos',
        rate: { basic: 2500, standard: 3500, premium: 5000 },
        desc: 'Ventilators with louvred glass / exhaust provision for toilets',
        qty: (g) => g.toilets },

      /* ---- ELECTRICAL ---- */
      { id: 'el_point', sec: 'electrical', unit: 'nos',
        rate: { basic: 1300, standard: 1700, premium: 2400 },
        desc: 'Wiring for light / fan / 6A socket point in PVC conduit with FRLS copper wire and modular switch',
        qty: (g, t) => Math.round(g.A * t.pointsPerSqm) },
      { id: 'el_power', sec: 'electrical', unit: 'nos',
        rate: { basic: 1800, standard: 2300, premium: 3000 },
        desc: 'Power point 16A with independent circuit (4 sq.mm) and modular socket',
        qty: (g, t) => Math.round(g.A * t.powerPerSqm) },
      { id: 'el_db', sec: 'electrical', unit: 'nos',
        rate: { basic: 9000, standard: 14000, premium: 22000 },
        desc: 'Distribution board with MCBs and RCCB, fixed and connected (one per floor)',
        qty: (g) => g.n },
      { id: 'el_earth', sec: 'electrical', unit: 'nos',
        rate: { basic: 6000, standard: 8000, premium: 12000 },
        desc: 'Earthing station (GI pipe / chemical) with earth pit and cover as per IS 3043',
        qty: (g) => (g.n > 0 ? 2 : 0) },
      { id: 'el_main', sec: 'electrical', unit: 'rmt', rate: 380,
        desc: 'Main supply cable from meter to DB (armoured copper) incl. clamping',
        qty: (g, t) => (g.n > 0 ? t.mainLineLength : 0) },

      /* ---- PLUMBING & SANITARY ---- */
      { id: 'pb_fixtures', sec: 'plumbing', unit: 'set',
        rate: { basic: 22000, standard: 38000, premium: 75000 },
        desc: 'Sanitary fixtures per toilet: EWC with seat & cistern, wash basin, CP fittings, shower & accessories',
        qty: (g) => g.toilets },
      { id: 'pb_internal', sec: 'plumbing', unit: 'set',
        rate: { basic: 14000, standard: 18000, premium: 25000 },
        desc: 'Internal water supply (CPVC) and drainage (UPVC/SWR) piping per toilet incl. concealed work',
        qty: (g) => g.toilets },
      { id: 'pb_kitchen', sec: 'plumbing', unit: 'nos',
        rate: { basic: 9000, standard: 14000, premium: 24000 },
        desc: 'Kitchen sink (SS) with CP tap, waste coupling and connection',
        qty: (g) => (g.n > 0 ? 1 : 0) },
      { id: 'pb_tank', sec: 'plumbing', unit: 'nos',
        rate: { basic: 12000, standard: 15000, premium: 20000 },
        desc: 'Overhead water tank (PVC, 1000–2000 L) with inlet, outlet, overflow and valves',
        qty: (g) => (g.n > 0 ? 1 : 0) },
      { id: 'pb_septic', sec: 'plumbing', unit: 'nos',
        rate: { basic: 55000, standard: 65000, premium: 85000 },
        desc: 'Septic tank and soak pit / bio-tank as per KPBR norms (high water table: bio-tank recommended)',
        qty: (g) => (g.n > 0 ? 1 : 0) },
      { id: 'pb_ext', sec: 'plumbing', unit: 'rmt', rate: 650,
        desc: 'External drainage UPVC 110 mm incl. inspection chambers and connections',
        qty: (g, t) => g.Pg * t.extDrainFactor },
      { id: 'pb_rwp', sec: 'plumbing', unit: 'rmt', rate: 450,
        desc: 'Rainwater downpipes UPVC 110 mm with clamps, bends and khurrah',
        qty: (g, t) => (g.n > 0 ? t.downpipes * (g.n * t.floorHeight + 1) : 0) },

      /* ---- PAINTING ---- */
      { id: 'pt_int', sec: 'painting', unit: 'sqm',
        rate: { basic: 140, standard: 190, premium: 280 },
        desc: 'Interior emulsion, two coats over wall putty and primer (walls and ceilings)',
        qty: (g, t, q) => q('pl_int') + q('pl_ceil') },
      { id: 'pt_ext', sec: 'painting', unit: 'sqm',
        rate: { basic: 110, standard: 150, premium: 220 },
        desc: 'Exterior weather-proof emulsion, two coats over primer',
        qty: (g, t, q) => q('pl_ext') },
      { id: 'pt_enamel', sec: 'painting', unit: 'sqm', rate: 120,
        desc: 'Synthetic enamel, two coats over primer, on grills and steel work (both faces)',
        qty: (g, t, q) => q('dw_grill') * 2 }
    ],

    /* -------------------------------------------------------------------------
     * Default terms & notes (one per line — editable in Settings → Terms)
     * ---------------------------------------------------------------------- */
    terms: [
      'This is a preliminary estimate based on the built-up area stated and standard thumb rules. Final cost will be based on approved drawings, structural design and actual measurement as per IS 1200.',
      'Rates are indicative as on the date of this estimate and valid for the period stated. Rates are subject to variation in the market price of cement, steel and other materials.',
      'GST is extra as applicable unless shown in the summary.',
      'Excludes, unless specifically listed: compound wall and gate, landscaping, well/borewell, sump, solar, KSEB/KWA connection deposits, permit and approval fees, light fittings, fans, modular kitchen, wardrobes and loose furniture.',
      'Foundation type and depth are subject to soil investigation and the structural engineer\'s design (particularly in high water-table areas).',
      'Payments are due as per the stage-wise payment schedule. Work will proceed on receipt of the respective stage payment.',
      'Additional or varied works will be charged at the BOQ rates or at mutually agreed rates.'
    ]
  };

  root.GE_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
