import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep Turbopack rooted at frontend/ — avoids picking up /Users/ttomar/package-lock.json
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  trailingSlash: false,
  turbopack: {
    root: projectRoot,
  },
  images: {
    maximumDiskCacheSize: 128 * 1024 * 1024,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'randomuser.me',
        pathname: '/api/portraits/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/a/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'yourtrace.online' }],
        destination: 'https://www.yourtrace.online/:path*',
        permanent: true,
      },
      // A reader's share link from the daily email (backend v3/lib/referral.py): the code rides
      // along as ?via= for lib/first-touch.ts. Temporary, so a code never gets cached as permanent.
      { source: '/r/:code([a-z2-7]{8})', destination: '/?via=:code', permanent: false },
      // Bio links on our social profiles, so signups from them are credited (lib/first-touch.ts).
      { source: '/yt', destination: '/?utm_source=youtube', permanent: false },
      { source: '/tt', destination: '/?utm_source=tiktok', permanent: false },
      { source: '/ig', destination: '/?utm_source=instagram', permanent: false },
      // retired legacy surfaces (redesigned experience lives in /feed)
      { source: '/trending', destination: '/feed', permanent: true },
      { source: '/trending/:topic', destination: '/feed', permanent: true },
      // The old daily pages still earn impressions; send them to the brief
      // archive, not /feed (robots.txt blocks /feed, so Google lost them).
      { source: '/daily', destination: '/brief', permanent: true },
      { source: '/daily/:date', destination: '/brief', permanent: true },
      { source: '/topics/:id', destination: '/feed', permanent: true },
      { source: '/bookmarks', destination: '/feed', permanent: true },
      { source: '/profile', destination: '/feed', permanent: true },
      { source: '/feed/article', destination: '/feed', permanent: true },
      // Trace is free for everyone; old pricing/checkout links land in the feed.
      { source: '/subscribe', destination: '/feed', permanent: true },
      // Compare pages that duplicated a blog roundup: the roundup is the one
      // that ranks, so fold the compare page into it.
      { source: '/compare/feedly-alternative', destination: '/blog/feedly-alternatives', permanent: true },
      { source: '/compare/trace-vs-flipboard', destination: '/blog/flipboard-alternatives', permanent: true },
      { source: '/compare/techmeme-alternative', destination: '/blog/techmeme-alternatives', permanent: true },
      { source: '/compare/daily-dev-alternative', destination: '/blog/daily-dev-alternatives', permanent: true },
      { source: '/compare/tldr-newsletter-alternative', destination: '/blog/tldr-newsletter-alternatives', permanent: true },
      { source: '/compare/ground-news-alternative-for-tech', destination: '/blog/ground-news-alternatives-for-tech', permanent: true },
      // One page per topic (2026-11-22 recovery after Google's September 2026 spam update): near-
      // duplicate posts fold into the strongest page on the subject.
      { source: '/blog/best-tech-news-apps-for-developers', destination: '/blog/best-tech-news-aggregator-apps', permanent: true },
      { source: '/blog/daily-tech-news-app', destination: '/blog/best-tech-news-aggregator-apps', permanent: true },
      { source: '/blog/free-news-aggregators-for-developers', destination: '/blog/best-tech-news-aggregator-apps', permanent: true },
      { source: '/blog/ai-summary-tools-for-news', destination: '/blog/ai-news-digest-tools', permanent: true },
      { source: '/blog/news-aggregator-vs-rss-reader', destination: '/blog/best-rss-reader-apps', permanent: true },
      { source: '/blog/daily-tech-briefing-routine', destination: '/blog/daily-tech-briefing-guide', permanent: true },
      { source: '/blog/daily-ai-briefing-for-founders', destination: '/blog/stay-on-top-of-ai-news-without-twitter', permanent: true },
      { source: '/blog/ai-news-for-non-technical-founders', destination: '/blog/stay-on-top-of-ai-news-without-twitter', permanent: true },
      { source: '/blog/how-to-follow-ai-model-releases', destination: '/blog/best-way-to-keep-up-with-ai-news-daily', permanent: true },
      { source: '/blog/tech-news-fatigue-solutions', destination: '/blog/information-overload-solutions', permanent: true },
      { source: '/blog/anti-brain-rot-attention-moat', destination: '/blog/information-overload-solutions', permanent: true },
      { source: '/blog/hacker-news-alternatives', destination: '/blog/daily-dev-alternatives', permanent: true },
      { source: '/blog/developer-news-consumption-habits', destination: '/blog/developer-news-aggregator-guide', permanent: true },
      { source: '/blog/personalized-developer-news-feed', destination: '/blog/developer-news-aggregator-guide', permanent: true },
      { source: '/blog/how-to-stay-updated-on-tech-without-doomscrolling', destination: '/blog/how-to-stay-updated-with-tech-news', permanent: true },
      // Old URLs Search Console still reports as 404s.
      { source: '/use-cases/trace-for-:who(founders|pms|developers|designers|marketers|investors|students|remote-teams|researchers|creators)', destination: '/use-cases/for-:who', permanent: true },
      { source: '/solutions/stop-info-overload', destination: '/solutions/info-overload', permanent: true },
      { source: '/research', destination: '/blog', permanent: true },
      { source: '/research/:slug', destination: '/blog', permanent: true },
      { source: '/Home', destination: '/', permanent: true },
      {
        source: "/:path+/",
        destination: "/:path+",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://datafa.st https://va.vercel-scripts.com https://apis.google.com https://accounts.google.com https://*.firebaseapp.com https://us-assets.i.posthog.com https://*.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://accounts.google.com https://*.firebaseapp.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/trace.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/(trace.png|trace-email.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          // The emails show the logo, and mail apps load it from their own origin.
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
        ],
      },
      {
        // The display serif, for the emails' @font-face (Apple Mail, iOS Mail).
        // Fonts load cross-origin only with CORS, and need CORP relaxed too.
        source: "/fonts/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
