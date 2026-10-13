# Security policy

Please do not open a public issue for security problems.

Report vulnerabilities privately through GitHub's **Report a vulnerability**
button (Security tab -> Advisories). Include what you found, how to reproduce
it, and the impact you expect. You will get a reply within a few days.

In scope: the web app (`frontend/`), the pipeline (`v3/`), LocalDB
(`backend/localdb/`) and the example deployment files. Out of scope: issues
that need a compromised server or leaked credentials to begin with.

Never commit secrets. Only `.env.example` is tracked; `.env*`, service-account
JSON and keys are ignored.
