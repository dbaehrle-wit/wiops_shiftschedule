# Refactoring guide

The app has shared UI primitives and pure planning rules. Extend these entry points before introducing new view-specific implementations.

| Change | Shared entry point |
| --- | --- |
| Compact field sizing or label spacing | `src/styles/compactControls.ts` |
| Compact selects, date inputs, accessible label wiring | `src/components/PlannerControls.tsx` |
| Table header layout and responsive wrapping | `src/components/PlannerViewHeader.tsx` |
| Department/area filtering UI | `src/components/PlannerFilters.tsx` |
| Undo/Redo, draft count, Discard, Save | `src/components/PlannerHeaderActions.tsx` |
| Resolve drafts against the server snapshot | `src/model/assignments.ts` |
| Read memoized assignments from a view | `src/components/usePlannerAssignments.ts` |
| Shift/skill palettes and color selection | `src/model/shiftDisplay.ts` |
| Qualification checks and expiry rules | `src/model/skills.ts` |
| Skill legends, reasons and requirements overview | `src/components/SkillUi.tsx` |
| Date navigation, labels, weekend classification | `src/utils/date.ts` |
| Scope filtering, rotation generation, coverage calculation | `src/model/planning.ts` |
| Absence-rate calculations and history-based area attribution | `src/model/absence.ts` |
| Small absence labels and explanatory tooltips | `src/components/AbsenceRate.tsx` |
| Hourly headcounts, overnight shifts, operating targets | `src/model/opsHours.ts` |
| Virtualized hourly SVG lanes | `src/components/OpsHoursView.tsx` |
| Browser-scoped operating windows and shift-time editing | `src/components/OpsHoursSettings.tsx` |
| Rectangle selection, move/copy/fill plans | `src/utils/gridDrag.ts` |
| Pointer capture, autoscroll and drag lifecycle | `src/components/useGridDrag.ts` |
| Assignment editing | `ShiftEditorDialog` in `src/components/PlannerDialogs.tsx` |
| API endpoint and save contract | `src/api/plannerApi.ts` and `src/model/types.ts` |

## Boundaries to preserve

- UI state belongs to `uiSlice`; unsaved assignments and undo history belong to `draftSlice`; server snapshots belong to RTK Query. Counts, colors and filters are derived, not stored as competing state.
- Day, area and timeline views use the same draft-overlay policy. A draft retains the server version and lock state; no-op edits retain compatibility, changed assignments become unchecked for server compatibility. Client skill checks remain separate from the authoritative server compatibility field.
- Reuse `buildAssignmentPatch` for single-cell editing: it omits no-ops and locked edits, clears the area for OFF and stamps the snapshot version. Multi-cell move/fill operations additionally use the atomic rules in `gridDrag.ts`.
- Filters and editing actions are passed into view headers through `PlannerHeaderSlots`. The header component controls layout; views control their own content.
- Keep date-only arithmetic in UTC helpers. Classify weekends by date, never by translated labels.
- Keep pure calculations independent of React so they can be tested and later reused with backend preview responses.

## Next useful splits as features grow

1. `PlanningGrid.tsx`: extract clipboard/keyboard commands and the assignment context menu into dedicated modules. Keep row/column coordinate mapping and virtualizers together until those boundaries are explicit.
2. `AutoPlanningDialog.tsx`: extract the pattern editor/storage adapter and the preview table. Rotation generation is already a pure model function.
3. `DayOverview.tsx`: extract department roster sections if additional employee actions or contact fields are added.
4. For application-wide visual theming, promote repeated border/background colors to MUI theme tokens. Current compact sizing, palettes and table headers already have central entry points.

Avoid replacing compact virtualized cells with a general MUI cell component: `CompactPlannerCell` deliberately uses memoized native HTML and primitive props to preserve interaction performance. Assignment indexes are memoized per consumer; the view hook resolves drafts lazily rather than copying the full schedule on selection changes.

## Verification

Run `npm.cmd test` and `npm.cmd run build`. TypeScript also rejects unused imports, locals and parameters to catch leftovers during future refactors. For changes to shared controls or headers, check all Day/Areas/timeline views at desktop and mobile widths, including accessible labels, label clipping, filter recovery and KPI overlays. For assignment changes, check one-step Undo/Redo, locks, OFF area clearing, versions, and matching counts in the Day view and KPI bar.
