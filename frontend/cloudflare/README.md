# Trace web hosting

The `trace-web` Worker serves Next's versioned assets on Cloudflare and forwards application requests over HTTPS to Caddy on the VPS. Caddy authenticates the Worker and forwards to Next on loopback port 3817. Next continues to use Firebase Admin and the existing LocalDB service.

## Deploy a release

1. Build the frontend off the VPS with the locked dependencies and production build settings. Use Linux x64 or include the matching Linux x64 Sharp and libvips packages in the standalone artifact when building on macOS.
2. Package `.next/standalone`, with `public` copied to its root and `.next/static` copied to its `.next/static`. Supply credentials at runtime. Inspect the artifact for dotenv files before transferring it.
3. Install the artifact under `/srv/trace-web/releases/<release>`. Keep application code root-owned. Grant the dedicated `trace-web` user access to the release and write access for the Next image and ISR caches. Systemd loads the private environment and Firebase configuration from `/etc/trace` using the service definition in `backend/vps/trace-web.service`.
4. Stage Cloudflare assets with `node frontend/cloudflare/prepare-assets.mjs /path/to/frontend/.next`. Use Wrangler from `frontend/cloudflare` with the Trace Cloudflare account. The Worker secret `ORIGIN_KEY` must match the private Caddy include installed from `backend/vps/Caddyfile.trace-web`.
5. Coordinate the origin and Worker release so their static build IDs agree. Switch `/srv/trace-web/current` to the prepared release and restart `trace-web.service`. Retain the prior working release and its Worker version for rollback.
6. Verify a dated public brief, the hydrated feed, an authenticated session, isolated signup and duplicate signup, and a hashed asset. Check `systemctl show trace-web -p MemoryPeak -p NRestarts` and `http://127.0.0.1:8502/health`.

The Worker test hostname is `trace-web.tarat211.workers.dev`. Serving a custom domain requires its Cloudflare route or custom-domain binding and working authoritative DNS. Preserve mail and database records during any zone transfer.
