import { clientAddress } from "@/lib/ip-rate-limit";
import { parseIp } from "@/lib/analytics/mmdb";

// Caddy overwrites X-Forwarded-For from the authenticated Worker's visitor address.
export function visitorAddress(headers: Headers) {
  const address = clientAddress(headers);
  return parseIp(address) ? address : "unknown";
}
/** Cloudflare's country for the visitor ("US"), or null: absent, unknown ("XX") or Tor ("T1"). */
export function cloudflareCountry(headers: Headers): string | null {
  const code = headers.get("cf-ipcountry")?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1" ? code : null;
}
