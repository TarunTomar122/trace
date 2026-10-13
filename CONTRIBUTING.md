# Contributing to Trace

Thanks for helping out. Small, focused pull requests are easiest to review.

## Getting set up
- Follow the quickstart in the [README](README.md) (Docker Compose, or run the
  pieces manually).
- Frontend: `cd frontend && npm install && npm run dev` (port 5001).
- Pipeline: `python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt`, then run it from `backend/` (`cd backend && ../.venv/bin/python -m v3.scheduler --help`).

## Checks before you open a PR
CI runs these on every pull request (`.github/workflows/ci.yml`):
- Frontend: `cd frontend && npx tsc --noEmit -p . && node --test lib/feed-ranking.test.mjs && npm run build`
- Pipeline (from `backend/`): `python3 -m unittest discover -s v3 -p "test_*.py" -t .`
- LocalDB (from `backend/`): `python3 -m unittest discover -s tests`

The newsletter story selection exists twice, in Python
(`backend/v3/flows/send_audience_newsletter.py`, `_select_from_groups`) and TypeScript
(`frontend/lib/newsletter-select.ts`, used by the live preview). Change both;
`backend/v3/test_newsletter_parity.py` runs them side by side (it needs `node`).
The same goes for summary paragraph splitting (`_paragraphs` / `frontend/lib/body-text.ts`).
- Keep secrets out of commits: never commit `.env*`, service-account JSON or
  keys. Only `.env.example` is tracked.

## Good first contributions
- New news sources (see "Adding news sources" in the README).
- Better summaries/ranking prompts, source-quality fixes, bug reports.
- Docs and self-hosting improvements.

## Guidelines
- Match the style of the surrounding code; avoid unrelated reformatting.
- Describe what changed and why in the PR description; include screenshots for UI.
- By contributing you agree your work is licensed under the project's
  AGPL-3.0 license.

## Security
Please report vulnerabilities privately; see [SECURITY.md](SECURITY.md).
