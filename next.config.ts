import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./content/**/*"] },
  poweredByHeader: false,
  // Credit console uploads go through server actions; Vercel caps a request at 4.5 MB, so larger files are sent in parts.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async redirects() {
    return [
      // The old address moves to the new domain (API routes stay reachable on both).
      { source: "/:path((?!api/).*)", has: [{ type: "host", value: "pehlaround.vercel.app" }], destination: "https://beforethebell.in/:path", permanent: true },
      { source: "/:path((?!api/).*)", has: [{ type: "host", value: "offmarketdesk.in" }], destination: "https://beforethebell.in/:path", permanent: true },
      { source: "/:path((?!api/).*)", has: [{ type: "host", value: "www.offmarketdesk.in" }], destination: "https://beforethebell.in/:path", permanent: true },
      // The private-credit desk moved here from NBFC Desk: its website maps onto /private-credit, its console onto /credit.
      { source: "/", has: [{ type: "host", value: "(www\\.)?nbfcdesk\\.com" }], destination: "https://beforethebell.in/private-credit", permanent: true },
      { source: "/:path*", has: [{ type: "host", value: "(www\\.)?nbfcdesk\\.com" }], destination: "https://beforethebell.in/private-credit/:path*", permanent: true },
      { source: "/:path*", has: [{ type: "host", value: "app\\.nbfcdesk\\.com" }], destination: "https://beforethebell.in/credit/:path*", permanent: true },
      { source: "/:path*", has: [{ type: "host", value: "www.beforethebell.in" }], destination: "https://beforethebell.in/:path*", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/diary", destination: "/dashboard", permanent: true },
      { source: "/diligence", destination: "/how-it-works", permanent: true },
      { source: "/nda", destination: "/deals", permanent: false },
      { source: "/room/:slug/memo", destination: "/room/:slug/summary", permanent: true },
      { source: "/:path((?!google[0-9a-f]+\\.html$).+)\\.html", destination: "/:path", permanent: true }, // search-engine verification files stay reachable
    ];
  },
  async headers() {
    return [
      { source: "/(room|dashboard|admin|nda)(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex" }, { key: "Cache-Control", value: "private, no-store" }] },
      { source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
      // The private-credit console holds confidential borrower files: never indexed, cached, framed or referred.
      { source: "/(credit|api/credit)(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }, { key: "Cache-Control", value: "private, no-store, max-age=0" }, { key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};
export default config;
