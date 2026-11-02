# Minimal view: local performance comparison

Measured on 31 October 2026 with headless Microsoft Edge, a 1440×1000 viewport, the same demo dataset, and the Vite development server. React Strict Mode and Redux development checks remained enabled. Four runs switched from the one-week view into minimal mode and then clicked cell 2:2.

| Measurement | Before | After |
| --- | ---: | ---: |
| Cell selection, median Event Timing duration | 1,416 ms | 96 ms |
| Switch to minimal view, median Event Timing duration | 616 ms | 184 ms |
| Mounted shift cells at the initial viewport | 2,272 | 1,350 |

The comparison uses the longest Event Timing entry for each sampled interaction. The raw `wall` values also include automation and explicit settling waits and are **not** used as interaction latency. These are local development measurements, not production or field INP results; timings vary with hardware, viewport, browser and session.

The primary problem was repeated date formatting during full-grid updates. Each cell formatted its date separately for its accessible label and tooltip; `toLocaleDateString` recreated expensive locale formatting work on every call. After fixing date formatting alone, selection measurements fell to approximately 376–496 ms.

The final implementation reuses date formatters, prepares date labels once per displayed period, uses memoized native HTML cells with static CSS in minimal mode, and maps areas by ID. Virtualization now accounts for the frozen header/employee offsets with `scrollMargin` instead of compensating through large overscan windows. This keeps the same visible dates and interactions while mounting roughly 40% fewer cells in this viewport.

Raw samples: [before](minimal-before.json), [after](minimal-after.json). Reload the page before repeating an INP session so earlier slow interactions do not influence the new result.
