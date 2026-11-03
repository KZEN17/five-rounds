import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Fonts are self-hosted by next/font, so Google Fonts is allowed only as a fallback.
// Next's hydration needs inline scripts; dev tooling also needs eval.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The dev badge sits over the bottom tab bar; errors still surface without it.
  devIndicators: false,
  // PGlite ships WASM; keep it out of the server bundle so it loads from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      { source: "/serwist/:path*", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default withSerwist(nextConfig);
