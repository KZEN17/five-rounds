import { createSerwistRoute } from "@serwist/turbopack";

// Serwist builds the service worker from src/app/sw.ts and serves it at /serwist/sw.js.
// The offline page is precached so a navigation with no network has somewhere to land.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  additionalPrecacheEntries: [{ url: "/offline", revision: "1" }],
});
