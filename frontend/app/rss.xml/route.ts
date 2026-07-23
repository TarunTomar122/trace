import { blogPosts } from "@/app/blog/content";
import { standaloneBlogPosts } from "@/app/blog/standalone-content";
import { SITE_BASE_URL } from "@/lib/seo";

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character] || character);

export function GET() {
  const posts = [...blogPosts, ...standaloneBlogPosts]
    .filter((post, index, all) => all.findIndex((candidate) => candidate.slug === post.slug) === index)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const items = posts.map((post) => {
    const url = `${SITE_BASE_URL}/blog/${post.slug}`;
    return `
      <item>
        <title>${escapeXml(post.title)}</title>
        <link>${url}</link>
        <guid isPermaLink="true">${url}</guid>
        <description>${escapeXml("excerpt" in post ? post.excerpt : "")}</description>
        <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>Trace Guides</title>
        <link>${SITE_BASE_URL}/blog</link>
        <description>Practical guides for staying current with tech without the tab stack.</description>
        <language>en-US</language>
        <atom:link href="${SITE_BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
        ${items}
      </channel>
    </rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
