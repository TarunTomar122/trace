# AGENTS.md

## Required quality pass (always)

After completing any non-trivial work — feature, bug fix, refactor, config or
content change — do **not** report it as done immediately. First, spawn a
subagent (task tool, general/explore) to run a full and thorough quality pass
over the changes.

The pass must:

- Re-read every changed file plus its direct dependencies and call sites.
- Hunt for remaining bugs, edge cases, regressions, security issues,
  inconsistencies, and stale copy ("5 stories", "$3", "on the roadmap", etc).
- Look for quality-of-life and UX clarity improvements the user would want.
- Verify with the best available checks: tests, typecheck, lint, build, and
  browser/runtime checks where applicable.
- Report findings with file:line evidence, ordered by severity.

Then fix everything that is in scope before finishing, and in the final
summary say what the pass found, what was fixed, and what was deliberately
left (with reason). Do this proactively, without being asked.
