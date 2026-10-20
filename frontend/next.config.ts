import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep Turbopack rooted at frontend/ — avoids picking up /Users/ttomar/package-lock.json
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: false,
  trailingSlash: false,
  turbopack: {
    root: projectRoot,
  },
  images: {
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
      // retired legacy surfaces (redesigned experience lives in /feed)
      { source: '/trending', destination: '/feed', permanent: true },
      { source: '/trending/:topic', destination: '/feed', permanent: true },
      { source: '/daily', destination: '/feed', permanent: true },
      { source: '/daily/:date', destination: '/feed', permanent: true },
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
