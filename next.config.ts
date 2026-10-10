import type { NextConfig } from "next";

// Lead-owned. cacheComponents is OFF on purpose: SAFAL pages are per-student and read the
// login cookie on every request, which Cache Components would force into <Suspense> everywhere.
const nextConfig: NextConfig = {
  cacheComponents: false,
};

export default nextConfig;
