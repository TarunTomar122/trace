// Tell Bing (and the other IndexNow engines) which pages changed. ChatGPT search
// leans on Bing's index, so run this after every web release.
//
//   npm run seo:indexnow                  pages whose sitemap lastmod is in the last 7 days (not /brief/*)
//   npm run seo:indexnow -- --days 30     ... in the last 30 days
//   npm run seo:indexnow -- --all         every URL in the live sitemap
//   npm run seo:indexnow -- /blog/x /     just these paths
//   add --dry-run to print the list without sending it
//
// The daily brief pings its own pages (backend/v3/lib/indexnow.py).

const SITE_URL = "https://www.yourtrace.online";
const INDEXNOW_KEY = "2c58d696e16d6fa0fdae3dd716584637";
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const MAX_URLS = 10_000; // IndexNow's limit per request

function fail(message) {
  console.error(message);
  process.exit(1);
}

// Strict on purpose: an unknown flag must never fall through to a real send.
let dryRun = false;
let all = false;
let days = 7;
let daysGiven = false;
const paths = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--dry-run") dryRun = true;
  else if (arg === "--all") all = true;
  else if (arg === "--days") {
    days = Number(args[++i]);
    daysGiven = true;
    if (!Number.isFinite(days) || days <= 0) fail("--days needs a positive number, e.g. --days 30");
  } else if (arg.startsWith("/") || arg.startsWith(`${SITE_URL}/`) || arg === SITE_URL) paths.push(arg);
  else fail(`Unknown argument: ${arg}\nUse --dry-run, --all, --days N, or paths on ${SITE_URL}.`);
}
if (paths.length && (all || daysGiven)) fail("Give either paths or --all/--days, not both.");

function sameSite(value) {
  const url = new URL(value, SITE_URL);
  if (url.origin !== SITE_URL) fail(`URL must belong to ${SITE_URL}: ${url}`);
  return url.href;
}

async function fromSitemap() {
  const response = await fetch(`${SITE_URL}/sitemap.xml`);
  if (!response.ok) fail(`sitemap.xml returned ${response.status}`);
  const xml = await response.text();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const urls = [];
  for (const [, entry] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc) continue;
    if (!all) {
      // The daily brief job already pings its own pages.
      if (new URL(loc).pathname.startsWith("/brief/")) continue;
      const changed = Date.parse(entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? "");
      if (!Number.isFinite(changed) || changed < since) continue;
    }
    urls.push(sameSite(loc));
  }
  return urls;
}

const urlList = [...new Set(paths.length ? paths.map(sameSite) : await fromSitemap())].slice(0, MAX_URLS);
if (!urlList.length) {
  console.log(all ? "The sitemap is empty; nothing sent." : `No sitemap page changed in the last ${days} days; nothing sent.`);
  process.exit(0);
}
if (dryRun) {
  console.log(urlList.join("\n"));
  console.log(`${urlList.length} URL${urlList.length === 1 ? "" : "s"} (dry run, not sent).`);
  process.exit(0);
}

const keyResponse = await fetch(KEY_LOCATION);
if (!keyResponse.ok || (await keyResponse.text()).trim() !== INDEXNOW_KEY) {
  fail(`IndexNow key is not live at ${KEY_LOCATION}`);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE_URL).host,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  }),
});

// 200 = accepted, 202 = accepted while the key is still being checked.
if (response.status !== 200 && response.status !== 202) {
  fail(`IndexNow returned ${response.status}: ${await response.text()}`);
}

console.log(`IndexNow accepted ${urlList.length} URL${urlList.length === 1 ? "" : "s"} with HTTP ${response.status}.`);
