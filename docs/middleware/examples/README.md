# Payload examples

All values are illustrative. Version/cursor strings are opaque even when their example spelling contains numbers. These files demonstrate the proposed v2 DTOs, not existing running endpoints.

| File | Example |
| --- | --- |
| `window-snapshot.json` | A complete seven-day snapshot for a small four-employee cohort at `cursor-1042`; unspecified cells are unplanned |
| `batch-request.json` | Change a working shift, assign sick leave, create PTO, and delete an assignment atomically |
| `batch-success.json` | Successful canonical response for that request, including versions, absence attribution and a delete tombstone |
| `batch-conflict.json` | **Alternative outcome** for the same request if a concurrent writer changed a cell before execution; not a response returned after the illustrated successful receipt |
| `change-page.json` | The successful batch delivered as one durable transaction envelope |
| `push-notice.json` | Lightweight SignalR hint for that transaction; not a replacement for pulling the change page |
| `ops-hours.json` | All 168 real hourly intervals for the selected department/area during a non-DST week, after the sample commit; UTC timestamps and local labels are both supplied |
| `aggregate-preview-request.json` | Project the same local draft over the baseline without saving it |

The window request uses `from=2026-11-02&to=2026-11-09`; `to` is exclusive. The first snapshot was created at 10:00 UTC on 2026-10-31 and expires five minutes later. Batch commit examples occur at 10:20 UTC. A user may continue editing local drafts after a snapshot token expires; tokens govern paging/read sessions, while assignment versions govern saving.

The sample read and mutation are deliberately small for review. They do not enumerate all real site employees, requirements, calendars or authorization rules. `compatibility: unknown` must not be interpreted as successful skill validation; production middleware must apply its agreed validation policy before committing.
