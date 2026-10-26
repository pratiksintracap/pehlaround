import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./content/**/*"] },
  poweredByHeader: false,
  async redirects() {
    return [
      // The old address moves to the new domain (API routes stay reachable on both).
      { source: "/:path((?!api/).*)", has: [{ type: "host", value: "pehlaround.vercel.app" }], destination: "https://beforethebell.in/:path", permanent: true },
      { source: "/:path((?!api/).*)", has: [{ type: "host", value: "offmarketdesk.in" }], destination: "https://beforethebell.in/:path", permanent: true },
      { source: "/:path((?!api/).*)", has: [{ type: "host", value: "www.offmarketdesk.in" }], destination: "https://beforethebell.in/:path", permanent: true },
      { source: "/:path*", has: [{ type: "host", value: "www.beforethebell.in" }], destination: "https://beforethebell.in/:path*", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/diary", destination: "/dashboard", permanent: true },
      { source: "/diligence", destination: "/how-it-works", permanent: true },
      { source: "/nda", destination: "/deals", permanent: false },
      { source: "/room/:slug/memo", destination: "/room/:slug/summary", permanent: true },
      { source: "/:path((?!google[0-9a-f]+$).+)\\.html", destination: "/:path", permanent: true }, // search-engine verification files stay reachable
    ];
  },
  async headers() {
    return [
      { source: "/(room|dashboard|admin|nda)(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex" }, { key: "Cache-Control", value: "private, no-store" }] },
      { source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
    ];
  },
};
export default config;
