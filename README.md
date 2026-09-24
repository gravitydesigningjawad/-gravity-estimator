# Gravity Estimator

Mobile-first web app for **Gravity Architectural Studio, Alappuzha** to prepare site estimates and a Bill of Quantities (BOQ) for residential projects, either at the site visit or in the office.

- **Quick estimate:** ₹/sq.ft × built-up area, split into 11 construction stages, with a stage-wise payment schedule.
- **Detailed BOQ:** Kerala / IS 1200-style items in 12 work sections. Quantities are calculated from the areas, and every quantity and rate can be overridden. You can add custom items, and the BOQ shows section subtotals, contingency, GST and the grand total.
- **Material summary:** cement, steel, sand/M-sand, aggregate, bricks/blocks/laterite (plus rubble and truss steel where relevant).
- **Output:** A4 print / Save as PDF with company header and logo. You can also share a text summary (Web Share, with WhatsApp or clipboard as fallback), download the BOQ as CSV, and export or import JSON backups.
- **Offline:** plain HTML + CSS + JavaScript with no build step. A service worker makes it work offline, and it can be installed to the home screen.

> ⚠️ **All default rates are placeholders.** Each one shows a **VERIFY** badge until you confirm or edit it in *Settings*. The app also warns you before printing or sharing an estimate that uses unverified rates.

---

## Files

```
index.html              App shell
css/app.css             Styles (mobile-first + A4 print layout)
js/config.js            ★ RATES, THUMB RULES, QUANTITY FORMULAS, TERMS — edit here
js/engine.js            Calculation engine (quick estimate, BOQ, materials)
js/storage.js           localStorage + JSON backup/restore
js/app.js               User interface
sw.js                   Service worker (offline cache)
manifest.webmanifest    "Add to home screen" metadata
icons/                  App icons
```

## Using the app

1. **Projects → + New project.**
2. **Details:** enter the client, site, date and project type, the plot area in cents, the number of floors and the area of each floor in sq.ft. Then choose the specification, foundation, roof and wall masonry.
3. **Quick:** shows the estimate by stage and the payment schedule. To use a different ₹/sq.ft rate for this project only, type it in.
4. **BOQ:** tap a section to open it.
   - Grey numbers are automatic. Type a new value to override it; ↺ restores the automatic value.
   - Use **+ Add custom item** for anything that isn't listed.
   - Switch sections on or off as needed.
   - Set contingency and GST in the *Abstract*.
5. **Materials:** shows procurement quantities. Each one can be overridden.
6. **Output:**
   - Tick the parts to include.
   - **Print / Save PDF** saves a PDF (choose "Save as PDF" as the printer). Share that PDF on WhatsApp or by email.
   - **Share** sends a short text summary.
7. **Projects list:** duplicate a project (useful for comparing options) or delete it.

Data is stored **only in this browser on this device**. Use **Settings → Backup → Export** regularly, and use *Import* to restore it or move it to another phone or laptop.

## Updating rates

There are two ways to change rates.

### A. In the app (no coding)

- **Settings → Quick rates:** ₹/sq.ft by project type and spec, the stage split %, the foundation/roof multipliers and the payment advance/retention.
- **Settings → BOQ rates:** every item rate. Spec-dependent items have a Basic, a Standard and a Premium rate.
  - Tap **VERIFY** to mark a rate as confirmed. Editing a rate also marks it confirmed.
  - Clear a field to go back to the default.
- **Settings → Thumb rules:** the coefficients behind the quantities and materials.

Rates edited in the app are saved as overrides on that device. They are included in the JSON backup, so you can export from one device and import on another to copy your rate master.

### B. In `js/config.js` (changes the defaults for everyone)

Everything is in one file with comments:

| What | Where in `config.js` |
|---|---|
| ₹/sq.ft quick rates | `quick.ratesPerSqft` |
| Stage split % | `quick.split` (each project type should total 100) |
| Foundation / roof adjustment | `quick.modifiers` |
| Payment schedule | `quick.payment` |
| BOQ item rates | `items[].rate`: a number, or `{ basic, standard, premium }` |
| BOQ item description / unit | `items[].desc`, `items[].unit` |
| Quantity formula | `items[].qty: (g, t, q) => …` |
| Plan geometry (perimeter, walls, foundations) | `geometry()` |
| Thumb rules (heights, thicknesses, steel kg/cum…) | `thumb` |
| Cement / sand / aggregate coefficients | `mixes` |
| Sections per project type | `sectionsByProjectType` |
| Company details, GST/contingency defaults | `company`, `commercial` |
| Default terms | `terms` |

In a quantity formula:

- `g` is the derived geometry (e.g. `g.A` total built-up area in sqm, `g.Asqft`, `g.Pg` ground floor perimeter, `g.nCols`, `g.slabArea`, `g.toilets`).
- `t` holds the thumb rules.
- `q('itemId')` returns the final quantity of an item listed earlier. This is how steel follows concrete and painting follows plaster.

To **add an item**, copy an existing entry, give it a new unique `id` and set `sec`, `desc`, `unit`, `rate` and `qty`. Don't rename the `id` of an existing item, because saved projects refer to it.

Rates you have edited in the app still take priority over `config.js`. Use *Settings → Reset* to fall back to the file's values.

After changing any file, **bump `CACHE` in `sw.js`** (e.g. `ge-v1.0.1`) so installed phones download the new version.

## How quantities are estimated (summary)

These are thumb rules for a first-cut BOQ. Replace them with measured quantities once drawings are ready.

- External wall length per floor = `4.4 × √(floor area)`. Internal wall length = `0.30 m per sqm`.
- Masonry = wall length × thickness × 2.75 m, less 15 % for openings, plus the parapet on a flat roof.
- Columns ≈ 0.15 per sqm of ground floor (25 % of that for rubble/load-bearing), 230×300 mm.
- Foundations:
  - **Rubble:** continuous RR masonry under all walls.
  - **Column footing:** 1.2 m square footings plus plinth beam.
  - **Pile:** 300 mm bored piles, 8 m long, 1.5 per column, with pile caps and grade beams.
- Steel is calculated from concrete volume: footing 80, plinth 110, column 180, beam 150, slab 90 kg/cum.
- Slabs: one over each floor. On a sloped roof the top slab × 1.25. With a truss roof there is no top slab; truss steel is 12 kg/sqm.
- Services: toilets ≈ 1 per 35 sqm, doors ≈ 1 per 15 sqm, windows = 12 % of floor area, electrical points ≈ 0.45 per sqm.

The quick estimate and the BOQ are calculated independently. They will not match exactly: the quick estimate includes a general "Finishes" allowance that the BOQ covers only through the items you list.

## Deploying to GitHub Pages

1. Push this repository to GitHub (the files must be at the repository root).
2. On GitHub, open **Settings → Pages**.
3. Under *Build and deployment*, set **Source: Deploy from a branch** and **Branch: `main` / `(root)`**, then click Save.
4. After about a minute the app is live at `https://<your-username>.github.io/<repo-name>/`, for example `https://gravitydesigningjawad.github.io/-gravity-estimator/`.
5. Open it on your phone and use **Add to Home screen** (Chrome: ⋮ menu; Safari: Share → Add to Home Screen). After the first load it works offline.

All paths are relative, so the app also works from a sub-folder or a custom domain. The empty `.nojekyll` file stops GitHub from processing the files with Jekyll.

To try it on your computer, serve the folder over HTTP (offline mode does not work when you open the file directly):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Disclaimer

Estimates are indicative and based on thumb rules and placeholder rates. Verify rates against current local market prices. Final structural quantities (foundation, steel) must come from the structural engineer's design and actual measurement.
