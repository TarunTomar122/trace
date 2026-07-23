const SITE_URL = "https://www.yourtrace.online";
const INDEXNOW_KEY = "2c58d696e16d6fa0fdae3dd716584637";
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

const priorityPaths = [
  "/",
  "/blog",
  "/blog/developer-news-aggregator-guide",
  "/blog/personalized-developer-news-feed",
  "/blog/tldr-newsletter-alternatives",
  "/blog/developer-news-consumption-habits",
  "/blog/category/guides",
  "/blog/category/comparisons",
  "/compare",
  "/compare/daily-dev-alternative",
  "/compare/tldr-newsletter-alternative",
  "/compare/ground-news-alternative-for-tech",
  "/resources",
];

const requestedPaths = process.argv.slice(2);
const urlList = (requestedPaths.length ? requestedPaths : priorityPaths).map((path) => {
  const url = new URL(path, SITE_URL);
  if (url.origin !== SITE_URL) throw new Error(`URL must belong to ${SITE_URL}: ${url}`);
  return url.href;
});

const keyResponse = await fetch(KEY_LOCATION);
if (!keyResponse.ok || (await keyResponse.text()).trim() !== INDEXNOW_KEY) {
  throw new Error(`IndexNow key is not live at ${KEY_LOCATION}`);
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

if (!response.ok) {
  throw new Error(`IndexNow returned ${response.status}: ${await response.text()}`);
}

console.log(`IndexNow accepted ${urlList.length} URLs with HTTP ${response.status}.`);
