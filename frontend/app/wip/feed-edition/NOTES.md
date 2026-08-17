# PROTOTYPE — feed edition redesign

**Question:** what should the Trace daily feed look like as an inkling-model.com-style
editorial "edition" — and does the 2-minute catch-up + Pro gating survive the translation?

**Run:** `npm run dev` → http://localhost:5001/wip/feed-edition
State toggles in the floating bar: `?tier=free|pro`, `?img=on`.

## Verdict (2026-07-22)

**Winner: A — "The Edition"** (user's pick; B "The Ledger" and C "The Reference" deleted).
Centered masthead, blue-serif stats row ("N min to catch up" — finally surfaces
`FeedEditionOrganizer.readMinutes`), contents filter bar, numbered topic sections with
inline-expand stories, locked sections as blurred wireframe rows + one calm
"PRO · THE FULL EDITION" box (free = first 3 stories, `FREE_READS_LIMIT` applies).

Open questions being evaluated on the route:
- `?img=on` — rationed imagery: one lead photo ("front-page photo") + images revealed
  inside expanded stories. No per-row thumbnails (protects the skim rhythm and hedges
  mixed RSS thumbnail quality).
- "Why it matters" block removed — field isn't populated in real story data.

**Next step:** rewrite properly into the real `/feed` (this code was written under
prototype constraints — no tests, minimal error handling; don't promote as-is),
then delete this directory.
