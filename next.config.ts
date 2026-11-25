import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Gives `next dev` access to the Cloudflare bindings declared in wrangler.jsonc. Not needed (and skipped) on Vercel.
if (!process.env.VERCEL) initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The site only shows a few small icons, so the image optimiser (and its per-plan quota) is not used on any host.
  images: { unoptimized: true },
  poweredByHeader: false,
  // Pages are built at deploy time on Vercel (see src/lib/static-params.ts). The API on Render's free plan can take up to a
  // minute to wake up, so a page may wait for it: give each page build room, and one retry, before the deploy is failed.
  staticPageGenerationTimeout: 180,
  experimental: {
    // Be gentle with the API at deploy time (about 1,300 pages are built): a few at a time, and a failed page is retried
    // before the deploy is failed.
    cpus: 3,
    staticGenerationMaxConcurrency: 3,
    staticGenerationRetryCount: 3,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The first release served one university at /rajasthan-university; keep those links (and their ranking) alive.
  async redirects() {
    return [
      // www -> the plain domain, and http -> https. Answered here (not in proxy.ts) so ordinary page views never run a function.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.(?<host>.*)" }],
        destination: "https://:host/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          { type: "header", key: "x-forwarded-proto", value: "http" },
          { type: "host", value: "(?<host>.*)" },
        ],
        destination: "https://:host/:path*",
        permanent: true,
      },
      {
        source: "/rajasthan-university/:path*",
        destination: "/universities/rajasthan-university/:path*",
        permanent: true,
      },
      {
        source: "/rajasthan-university",
        destination: "/universities/rajasthan-university",
        permanent: true,
      },
      // Rajasthan Board class and subject pages moved to a shorter address.
      {
        source: "/exams/uni-rajasthanboard/:channel(class-9|class-10|class-11|class-12|model-papers)/:subject",
        destination: "/rajasthanboard/:channel/:subject",
        permanent: true,
      },
      {
        source: "/exams/uni-rajasthanboard/:channel(class-9|class-10|class-11|class-12|model-papers)",
        destination: "/rajasthanboard/:channel",
        permanent: true,
      },
      // The board's front page lives at /rajasthanboard only.
      { source: "/exams/uni-rajasthanboard", destination: "/rajasthanboard", permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/:type(papers|courses|subjects|exams|static)/:file(\\d+\\.xml)",
        destination: "/sitemaps/:type/:file",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
      // Icons and the manifest are asked for on every visit. Without a lifetime the browser re-checks each one every time
      // (a "304" request that still counts as a CDN request), which was ~30% of all requests. public/_headers does this on
      // Cloudflare only; Vercel needs it here.
      {
        source: "/:file(favicon.ico|icon.png|icon-192.png|apple-touch-icon.png|og-default.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
      {
        source: "/favicon/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/papers/:path*",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=2592000, stale-while-revalidate=86400" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=2592000, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/exams/:path*",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/universities/:path*",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/rajasthanboard/:path*",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/categories/:path*",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/boards",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/notes/:path*",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=604800, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
