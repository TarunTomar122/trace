/**
 * What the first-party analytics reads from a User-Agent: whether it is a bot,
 * the device class and the browser family. Pure, so the beacon route and the
 * tests share it. Nothing else from the UA is kept.
 */

/**
 * Crawlers, link unfurlers, monitors, headless browsers and HTTP libraries. A
 * real browser always sends "Mozilla/5.0"; anything that does not is dropped too.
 */
const BOT_RE = new RegExp(
  [
    "bot\\b", "bot/", "-bot", "_bot", "crawl", "spider", "slurp", "scrape", "headless", "phantomjs", "puppeteer", "playwright",
    "selenium", "webdriver", "lighthouse", "pagespeed", "pingdom", "uptime", "monitor", "statuscake", "datadog", "newrelic",
    "facebookexternalhit", "facebot", "embedly", "quora link preview", "skypeuripreview", "preview", "vercel", "curl/", "wget/", "python", "httpclient", "http_request", "java/", "okhttp", "go-http",
    "axios", "node-fetch", "undici", "libwww", "feedfetcher", "rss", "ahrefs", "semrush", "mj12", "dotbot", "petalbot",
    "bytespider", "gptbot", "chatgpt", "oai-searchbot", "claudebot", "claude-web", "anthropic", "perplexity", "ccbot",
    "applebot", "yandex", "baiduspider", "duckduckbot", "bingpreview", "google-inspectiontool", "googleother", "adsbot",
    "mediapartners", "cloudflare", "check_http", "nagios", "zgrab", "masscan", "nmap",
  ]
    .join("|"),
  "i",
);

export function isBot(ua: string | null | undefined): boolean {
  const value = (ua ?? "").trim();
  if (value.length < 20 || value.length > 1000) return true;
  if (!/^Mozilla\/5\.0/.test(value)) return true;
  return BOT_RE.test(value);
}

export type DeviceClass = "desktop" | "mobile" | "tablet";

export function deviceClass(ua: string | null | undefined, screenWidth?: number | null): DeviceClass {
  const value = ua ?? "";
  if (/iPad|Tablet|PlayBook|Silk|Kindle|(Android(?!.*Mobile))/i.test(value)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(value)) return "mobile";
  // iPadOS asks for the desktop site and says "Macintosh": a touch-sized screen gives it away.
  if (/Macintosh/.test(value) && screenWidth != null && screenWidth > 0 && screenWidth < 1100) return "tablet";
  return "desktop";
}

export type BrowserFamily = "Chrome" | "Safari" | "Firefox" | "Edge" | "Samsung" | "Opera" | "Brave" | "Other";

export function browserFamily(ua: string | null | undefined): BrowserFamily {
  const value = ua ?? "";
  if (/Edg(e|A|iOS)?\//.test(value)) return "Edge";
  if (/OPR\/|Opera/.test(value)) return "Opera";
  if (/SamsungBrowser\//.test(value)) return "Samsung";
  if (/Brave/.test(value)) return "Brave";
  if (/Firefox\/|FxiOS\//.test(value)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(value)) return "Chrome";
  if (/Safari\//.test(value) && /Version\//.test(value)) return "Safari";
  // In-app browsers on iOS (Instagram, X, LinkedIn) are WebKit without "Version/": Safari for our purposes.
  if (/iPhone|iPad|iPod/.test(value) && /AppleWebKit/.test(value)) return "Safari";
  return "Other";
}

/** Screen width as a coarse bucket, so the exact size (a fingerprinting bit) is never stored. */
export function screenBucket(width: unknown): string | null {
  const n = typeof width === "number" ? width : Number(width);
  if (!Number.isFinite(n) || n <= 0 || n > 20000) return null;
  if (n < 480) return "<480";
  if (n < 768) return "480-767";
  if (n < 1024) return "768-1023";
  if (n < 1440) return "1024-1439";
  if (n < 1920) return "1440-1919";
  return "1920+";
}
