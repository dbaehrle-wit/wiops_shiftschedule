# WiOps Shift Planner – React Client Island (starter)

**Architecture:** React 19 + MUI 7 + Redux Toolkit + RTK Query + TanStack Virtual; one independent EVE client island; **custom** 2-axis virtualized grid (not MUI X). All API shapes and EVE mounting contracts are proposed, **not confirmed EVE APIs**.

See the [refactoring guide](docs/refactoring.md) for shared component entry points, state boundaries, and recommended future module splits.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
npm run build
npm test
```

Default `VITE_DEMO=true` is an in-memory fake API. It generates six uniquely named employees (three Freezer, three Ambient) and 140 days of sample assignments; real endpoints are only used with `VITE_DEMO=false`. A production setup must supply the site-local current date from the server; demo calendar uses client current date.

## GitHub Pages demo

In the repository's **Settings > Pages > Build and deployment**, set **Source** to
**GitHub Actions**. Push `.github/workflows/pages.yml` to `main`, or run
**Deploy planner to GitHub Pages** manually from the Actions tab after that file
has been pushed. The workflow tests and builds the app, then publishes only `dist`.
Do not select `Deploy from a branch` with the repository root: its `index.html`
loads TypeScript source that must first be compiled by Vite.

The workflow sets Vite's base path from the repository name, so assets load under
`/wiops_shiftschedule/` rather than the domain root. Local development still uses
`/`. To reproduce the Pages build locally:

```bash
npm run build -- --base /wiops_shiftschedule/
npx vite preview
```

Open `http://localhost:4173/wiops_shiftschedule/` for that preview. Pages explicitly
builds in demo mode: changes remain in memory and reset on reload. The middleware
is not hosted by GitHub Pages.

## Components

```
EVE Shell (existing)
  └── EveClientIsland widget (proposed adapter, not provided in this repo)
      └── mountShiftPlanner(container, bootstrap)
          ├── Provider (per-instance Redux store)
          ├── ThemeProvider (MUI)
          └── ShiftPlanner
              ├── PlannerToolbar (MUI)
              ├── PlanningGrid (custom 2-axis virtualized canvas)
              │    ├── Sticky Employee column
              │    ├── Sticky Day header
              │    ├── Selection and keyboard model
              │    └── Context menu (MUI)
              └── Save feedback
```

## Redux responsibilities

- `plannerApi` (RTK Query): canonical server snapshot, `getPlanner`, atomic `saveAssignments` batch, fetch invalidation after commit.
- `draftSlice`: pending edits keyed by employee/date, undo/redo snapshots, saving/error state. Changes do **not** automatically persist.
- `uiSlice`: view mode, anchor date, employee filter, color mode, focus, anchor cell and selected cell keys.
- Tiny drag-only transient state can remain component-local; do not write pointer coordinates to Redux every frame.

## API contract

For the proposed production hand-off, see the [middleware v2 draft](docs/middleware/README.md), [suggested DTOs](docs/middleware/contracts.ts), and [JSON examples](docs/middleware/examples/README.md). That proposal covers atomic batches, concurrency/idempotency, windowed reads, draft-safe synchronization, SignalR hints with a durable pull feed, polling fallback, source-database ingestion, and migration. The v1 endpoints below remain the current runtime implementation.

`GET /api/wiops/sites/{siteId}/shift-planner` -> `PlannerSnapshot` (see `src/model/types.ts`).

`POST /api/wiops/sites/{siteId}/shift-planner/assignments:batch` -> `SaveBatchResponse`.

```json
{
  "requestId":"batch-123", "siteId":1, "expectedPlanVersion":42,
  "operations":[
    {"employeeId":1001,"date":"2026-11-02","shiftCode":"E","areaId":1,"expectedVersion":3},
    {"employeeId":1001,"date":"2026-11-03","shiftCode":"L","areaId":1,"expectedVersion":2}
  ]
}
```

**Server requirements:** authentication, site authorization, validation of shifts, absence/skill/working-time rules, idempotent requestId, optimistic concurrency on plan AND assignment version, all-or-nothing transaction, response includes new versions. On conflict retain draft; don't clear it. Return structured 409 (or `status:conflict`) and rebase only with deliberate user action. Evaluate ISO dates in the **site** calendar, not UTC date truncation. Server-side skill compatibility is authoritative. CORS/cookies/CSRF/token policy depends on the EVE hosting arrangement.

## Interactions implemented in first TSX slice

- Vertical and horizontal virtualization; sticky employee column and day header
- 1 week, 4 weeks, month, per-user calendar, minimal three-month, and area staffing modes. Period navigation advances whole weeks/months and displays the ISO calendar weeks below the date range, including week-year boundaries.
- Per-user mode displays a full Monday-to-Sunday month calendar with one row per week. Neighboring month days are dimmed. Selection, assignment, move/copy, fill, and draft edits share the same employee/date keys as the timeline.
- Minimal mode uses small color-only cells for three complete months, readable day numbers, sticky month/day headers and employee names, a shift-color legend, and two-axis scrolling. Unplanned days are hatched instead of being shown as confirmed days off.
- Minimal cells use memoized native HTML and static CSS. Date labels are prepared once per period, and virtualizers account for frozen-pane offsets with small overscan windows. See the [local performance comparison](docs/performance/README.md).
- Click select, shift-click range, ctrl/meta-click toggle, shift-arrow range
- Arrow-key navigation, E/L/N/O/S/P quick assignment, right-click menu
- Custom right-click menu and a visible assignment dropdown apply shifts to the current selection and offer deselection; Escape also clears the selection. Locked cells are not changed.
- Clicking an employee name opens the personal shift distribution for the last 28 days using clearly labelled example values. Day statuses and the weekly status overview are accessed by double-clicking a date header; in the person calendar, double-click the small date inside a day card. Day statistics group all employees by their actual assignment area, include drafts, and offer a weekly area filter and assigned-person list. Absence statuses remain deterministic demo values, not real absence data.
- An employee's department stays under their name. Their daily cell shows shift and the area where they are assigned that day (COM, Depal, Receiving, Matrix in the demo). There is no fixed employee-to-area mapping. Minimal mode keeps its color-only cells and exposes area details in tooltips and the editor.
- Double-clicking a cell (or pressing Enter) opens its employee, department, date, shift, and area dropdowns. OFF has no area. Applying stages one undoable draft operation; suggestions currently have a placeholder. Context-menu area actions can change areas for multiple selected working shifts at once. The same editor works in the calendar and minimal modes.
- The Areas view shows four weeks of daily assigned-person counts per area, including unsaved edits, alongside sample daily requirements (COM: 2, Depal: 3). OFF is excluded from staffing; unassigned or unknown areas are not silently attributed to another area. Clicking a count opens the relevant day's details. Requirements and absence statuses still need backend integration.
- Ctrl/Cmd+C/V clipboard TSV on secure origin and browser permission
- Ctrl/Cmd+Z/Y local undo/redo, marked draft cells, explicit Save Changes/Discard
- Shift/skills color toggle in timeline, person calendar, minimal, Day and auto-plan previews. Area skill colors are red for Not qualified, orange for Qualified, yellow for Intermediate, light green for Experienced, and dark green for Expert. `Employee.areaSkills` maps area IDs to `notQualified | qualified | intermediate | experienced | expert`; missing/invalid levels display as Not qualified. Levels are independent per employee and area. OFF, sick leave and PTO keep their absence colors; unplanned/no-area cells have no area level. Drafts and drag previews use the destination area. This replaces the former hard/soft credential and expiry model.
- The Area skills dialog shows an employee-by-area matrix. The shift editor shows the level for the selected area and recalculates it as that area changes. Demo data covers all five display states. Levels currently provide visual guidance; they do not block assignments.
- The toolbar's Help button opens an English usage guide covering selection, moving, copying, filling, shortcuts, views, filters, auto-planning, coverage KPIs, colors, touch gestures, and draft/save behavior.
- Day view groups employees by department and daily work area with roles and demo mobile/radio numbers. Its date-adjacent All shifts / Early / Late / Night dropdown filters the roster and planned counts.
- Ops hours shows a Monday-Sunday, 168-hour timeline grouped by department and area. Memoized native SVG lanes are vertically virtualized. Each hour shows planned headcount as a bar, operating windows as a blue-tinted background, closed hours as a gray baseline, and the configured hourly target as a dashed line only during operation. Staffing outside operation stays visible in gray; amber bars indicate shortages. Fit-week and zoom controls change hour width; clicking an hour shows assigned employees. Arrow keys and Enter also inspect hours.
- Hourly staffing is derived from saved assignments plus drafts, including carry-in from the previous Sunday and clipping at the week's end. Non-working statuses are excluded and overlapping shifts count each person once per area/hour. Shift-start dates determine overnight assignments. Department/area filters are applied without losing prior-day carry-in. `Configure hours` edits whole-hour shift boundaries and per-department/area operating windows and targets, with browser persistence per site. Defaults come from demo shift types and operating profiles; these hourly targets are distinct from existing site-wide daily KPI targets. The chart uses nominal site-local wall-clock hours, not timestamp-expanded DST weeks. Real operating calendars, breaks and timestamp/DST handling remain backend integration work.
- Compact department and area filters sit inside each planner's table header alongside assignment controls. Area filtering includes employees assigned to that area during the displayed period; timeline cells retain other daily assignments for context. Filters include unsaved changes and clear cell selection to avoid stale row coordinates.
- Undo/Redo icons, the unsaved count, Discard, Save Changes, and a keyboard-shortcut tooltip share that table header. The page toolbar has one row on wide screens. Floating filter labels have top clearance inside the rounded header so they are not clipped.
- Auto-plan adapts the manual/rotating workflow from `../wiops_workforce`: fixed-shift planning or staggered rotation pipelines with weekly, bi-weekly, and four-week cycles, department/shift-group scope, optional weekends, and configurable work areas. Patterns are editable and persisted in browser storage. A scoped preview precedes a single undoable draft; explicit Save Changes uses the existing save endpoint. Locked cells are preserved, no-op changes are omitted, and date windows are capped at 366 days. Skill/absence/coverage enforcement remains deferred to backend integration.
- A 42px single-line KPI bar below the planner is collapsed by default. It shows abbreviated areas, T/P (Target / Planned), and a check or cross for daily coverage. Expand or clicking an area opens the full KPI cards in a modal overlay, preserving the raster's size and scroll position. The details show per-area shift totals, planned/target assignments, days covered, and summed daily gaps. Surpluses cannot mask a shortage on another day. Filters change the planned contribution; demo targets remain daily site-wide targets, not department- or shift-specific requirements. Experience KPIs need actual experience data and are not synthesized.
- Drag-to-fill: select a cell or a rectangular pattern, then drag its blue bottom-right handle horizontally, vertically, or diagonally. The pattern repeats across the entire expanded rectangle, including shift and area.
- Rectangle selection: drag directly over cell bodies or the gaps between them to select any number of rows and columns (for example 2×2, 3×3, 4×4, or 2×5), with live dimensions and cell count. Shift-drag extends from the existing anchor; Ctrl/Cmd-click toggles individual cells. On touch screens, tapping selects and swiping the cell body scrolls.
- Drag-and-drop: select a shift, then drag its visible dotted grip to move it, or the grip of any selected shift to move the whole selection. Grips only appear on selected cells. Hold Ctrl/Cmd while dragging the grip to copy instead. Moves set source cells to `OFF` with no area; overlapping destinations take precedence. Move and fill handles also support touch.
- A sparse selection can be moved/copied; filling requires a complete rectangle.
- Live destination previews, replacement count, locked-cell feedback, edge auto-scroll, and Escape/pointer-cancel to abort. Dropping outside the grid or onto a locked target cancels the whole operation.
- Each completed drag is a single draft/undo action. Source values include unsaved edits, destination versions come from the server snapshot, and saving remains explicit. Changed cells show unknown compatibility until validated by the server.

## Deliberately deferred / next increments

1. Additive multi-range mouse drag selection (rectangle selection, fill, move and copy are implemented).
2. Server-side auto-planning: replace the implemented client preview with `POST /rotation-plans:preview` -> validated changes + reasons; `POST /rotation-plans:commit` with plan version after review.
3. Absences, locks, area selection editor, overlap and work-time validation visualizations.
4. Focus restoration after virtualization, screen-reader grid semantics, shortcuts while a menu/dialog is open.
5. Backend-driven site-local today, pagination/windowed range fetching, very large dataset memory optimization.
6. EVE widget registration, JSON property/schema versioning, mount lifecycle, auth bridge, event bridge.

## EVE boundary (conceptual)

```
EVE WidgetTree: {type:'EveClientIsland', id:'ShiftPlanner_1', componentKey:'wiops-shift-planner', props:{siteId:1, schemaVersion:1}}
  -> React renderer registry
  -> mountShiftPlanner(domElement, props)
  -> REST calls to C# middleware (requires approved authentication integration)
```

The React component does not interpret EVE's widget tree beyond this mount envelope. No database access or business-rule authority lives in React. Use the same MUI theme tokens as EVE to remain visually consistent.

S (Sick leave) and P (PTO) are non-working assignment codes. Both clear the daily work area, bypass skill checks, and are excluded from staffing counts and area filters. They are available in assignment menus, the editor, keyboard shortcuts, clipboard operations, rotation patterns, and Day-view filters. Explicit assignments override demo absence statuses.

Small `◌ %` absence rates appear in date headers (including compact headers and personal-calendar cells) and per-area KPI summaries/details. Rates use actual OFF/P/S assignments divided by recorded employee-days, exclude unplanned cells, include drafts, and follow department/area scope independently of shift filters. As absence assignments have no area, area attribution is an explicit client approximation using the most recent working area on or before each date. Future assignments are never used. Employees without area history are reported as unattributed, not silently assigned to an area; zero recorded days shows `n/a`. Backend-provided absence-area attribution can later replace this rule in `model/absence.ts`.

Demo seed definition: `src/api/demoSeed.ts`. COM, Depal and Matrix operate continuously from Sunday 14:00 to Friday 14:00; Receiving operates Monday-Friday 06:00-22:00. Shifts are Early 06:00-14:00, Late 14:00-22:00, and Night 22:00-06:00, with no Receiving nights. Seed assignments follow those calendars and rotate work areas weekly. The operating-profile revision scopes browser overrides so saved settings from the earlier seed cannot mask the new calendars. Historical performance samples in `docs/performance` used the former 120-employee demo fixture.
