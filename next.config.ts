import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PGlite ships WASM; keep it out of the server bundle so it loads from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
