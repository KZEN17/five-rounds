import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The dev badge sits over the bottom tab bar; errors still surface without it.
  devIndicators: false,
  // PGlite ships WASM; keep it out of the server bundle so it loads from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
