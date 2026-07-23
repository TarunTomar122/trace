#!/usr/bin/env node

const baseUrl = process.argv[2] || "https://www.yourtrace.online";
const concurrency = Math.max(1, Number(process.env.SEO_AUDIT_CONCURRENCY || 8));
const requestTimeoutMs = Math.max(1_000, Number(process.env.SEO_AUDIT_TIMEOUT_MS || 15_000));
const slowResponseMs = Math.max(1_000, Number(process.env.SEO_AUDIT_SLOW_MS || 8_000));
const skipImages = process.env.SEO_AUDIT_SKIP_IMAGES === "1";
const excludePattern = process.env.SEO_AUDIT_EXCLUDE
  ? new RegExp(process.env.SEO_AUDIT_EXCLUDE)
  : null;
const rewriteOrigin = process.env.SEO_AUDIT_REWRITE_ORIGIN || "";

function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return result;
}

function tags(html, name) {
  return Array.from(html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi")), (match) => match[0]);
}

function metaContent(html, key, value) {
  for (const tag of tags(html, "meta")) {
    const attrs = attributes(tag);
    if (attrs[key] === value) return attrs.content || "";
  }
  return "";
}

function textContent(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

async function fetchText(url) {
  const started = performance.now();
  const response = await fetch(url, {
    headers: { "user-agent": "Trace SEO audit/1.0" },
    signal: AbortSignal.timeout(requestTimeoutMs),
    redirect: "follow",
  });
  return {
    response,
    html: await response.text(),
    elapsedMs: Math.round(performance.now() - started),
  };
}

async function mapConcurrent(items, mapper) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function inspectPage(url, html, status, elapsedMs) {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "");
  const h1 = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i);
  const anchors = tags(html, "a")
    .map((tag) => attributes(tag).href)
    .filter((href) => href && href !== "#");
  const words = textContent(html).split(/\s+/).filter(Boolean).length;
  const og = {
    title: metaContent(html, "property", "og:title"),
    description: metaContent(html, "property", "og:description"),
    url: metaContent(html, "property", "og:url"),
    type: metaContent(html, "property", "og:type"),
    image: metaContent(html, "property", "og:image"),
  };
  const images = tags(html, "img")
    .map((tag) => attributes(tag).src)
    .filter(Boolean)
    .map((src) => new URL(src, url).href);

  return {
    url,
    status,
    elapsedMs,
    title,
    titleLength: title.length,
    hasH1: Boolean(h1),
    anchorCount: anchors.length,
    wordCount: words,
    missingOpenGraph: Object.entries(og).filter(([, value]) => !value).map(([key]) => key),
    images,
  };
}

const sitemapUrl = new URL("/sitemap.xml", baseUrl).href;
const { response: sitemapResponse, html: sitemap } = await fetchText(sitemapUrl);
if (!sitemapResponse.ok) {
  throw new Error(`Sitemap returned ${sitemapResponse.status}: ${sitemapUrl}`);
}

const urls = Array.from(
  sitemap.matchAll(/<loc>([^<]+)<\/loc>/g),
  (match) => decodeEntities(match[1]),
)
  .filter((url) => !excludePattern?.test(url))
  .map((url) => rewriteOrigin ? new URL(new URL(url).pathname, rewriteOrigin).href : url);
const crawlResults = await mapConcurrent(urls, async (url) => {
  try {
    const { response, html, elapsedMs } = await fetchText(url);
    return inspectPage(url, html, response.status, elapsedMs);
  } catch (error) {
    return {
      url,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: requestTimeoutMs,
      images: [],
    };
  }
});

const imageUrls = skipImages
  ? []
  : Array.from(new Set(crawlResults.flatMap((result) => result.images)));
const imageResults = await mapConcurrent(imageUrls, async (url) => {
  try {
    let response = await fetch(url, {
      method: "HEAD",
      headers: { "user-agent": "Trace SEO audit/1.0" },
      signal: AbortSignal.timeout(requestTimeoutMs),
      redirect: "follow",
    });
    let contentType = response.headers.get("content-type") || "";
    let size = Number(response.headers.get("content-length") || 0);

    if (!response.ok || !contentType.startsWith("image/") || size <= 0) {
      response = await fetch(url, {
        headers: {
          "user-agent": "Trace SEO audit/1.0",
          range: "bytes=0-0",
        },
        signal: AbortSignal.timeout(requestTimeoutMs),
        redirect: "follow",
      });
      contentType = response.headers.get("content-type") || "";
      const contentRange = response.headers.get("content-range") || "";
      size = Number(contentRange.match(/\/(\d+)$/)?.[1] || response.headers.get("content-length") || 0);
    }

    return {
      url,
      status: contentType.startsWith("image/") ? response.status : 415,
      size,
      contentType,
    };
  } catch (error) {
    return { url, error: error instanceof Error ? error.message : String(error), size: 0 };
  }
});

const report = {
  auditedAt: new Date().toISOString(),
  sitemapUrl,
  pageCount: urls.length,
  issues: {
    failedPages: crawlResults.filter((result) => result.error || result.status >= 400),
    slowPages: crawlResults.filter((result) => result.elapsedMs >= slowResponseMs),
    titlesTooLong: crawlResults.filter((result) => result.titleLength > 60),
    missingH1: crawlResults.filter((result) => result.hasH1 === false),
    lowWordCount: crawlResults.filter((result) => result.wordCount < 200),
    noOutgoingLinks: crawlResults.filter((result) => result.anchorCount === 0),
    incompleteOpenGraph: crawlResults.filter((result) => result.missingOpenGraph?.length),
    brokenImages: imageResults.filter((result) => result.error || result.status >= 400),
    oversizedImages: imageResults.filter((result) => result.size > 1_000_000),
  },
};

console.log(JSON.stringify(report, null, 2));

if (
  report.issues.failedPages.length ||
  report.issues.slowPages.length ||
  report.issues.titlesTooLong.length ||
  report.issues.missingH1.length ||
  report.issues.lowWordCount.length ||
  report.issues.noOutgoingLinks.length ||
  report.issues.incompleteOpenGraph.length ||
  report.issues.brokenImages.length ||
  report.issues.oversizedImages.length
) {
  process.exitCode = 1;
}
