# Trace admin analytics

Open `https://www.yourtrace.online/admin/analytics`. The page verifies the signed, HTTP-only admin cookie before loading any metrics. The JSON, live and favicon endpoints verify the same cookie. Set a distinct `ANALYTICS_PASSWORD` and `ANALYTICS_SECRET` in the root-owned `/etc/trace/web-runtime.env` and restart `trace-web` after rotation. Rotate the signing secret to invalidate all existing sessions.

The visitor beacon uses no cookies or account identifiers. It sends public route templates, a coarse referrer source and viewport width. The server discards bots, resolves the country from Cloudflare or the shared DB-IP Lite file, and hashes the visitor address and user agent with a new random salt each UTC day. Only the hash, last-seen time and date enter the visitor table. Aggregates and timing histograms persist. Visitor hashes expire after five days and prior salts are pruned hourly and during ingestion. Live now counts distinct daily hashes active in the last five minutes. A visitor returning on two different days contributes to both daily counts.

Node 22's built-in SQLite keeps local writes on disk under the service's private `/var/lib/trace-web-analytics`. Production hosts and all other hosts use separate files. Batches flush after three seconds. The queue holds at most 500 events and retries failed writes. Abrupt process termination can lose an unflushed batch.

The Signups tab counts records in Trace's `free_newsletter_subscribers` collection and groups original subscription dates in UTC. It includes currently opted-out records in lifetime signups. The System tab uses machine gauges from StocksBrew's existing `tm_ops_health/latest`. Install the snapshot script in `/usr/local/lib` and enable `trace-analytics-snapshot.timer` to refresh the aggregate-only snapshot every five minutes. The web user has no access to the underlying StocksBrew database.

Speed shows real full-page loads (reported on hide or client navigation) and Caddy's time to upstream response headers. Caddy adds the trace-origin Server-Timing entry, and the Worker removes it from edge cache hits. Each metric has its own sample count. Timing bins are 10 ms for durations and 0.001 for layout shift.

Updates to the Next release, Caddy timing header and Worker assets follow the deployment procedure in `frontend/cloudflare/README.md`. Verify signed-out access first, then use the Worker preview hostname to exercise the live beacon without adding to production metrics.
