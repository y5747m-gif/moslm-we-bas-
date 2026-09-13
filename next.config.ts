import type { NextConfig } from "next";

// When building for the native Android wrapper (Capacitor) we need a fully
// static export inside `out/`. Normal web builds (`next build`) are unchanged.
const isCapacitorExport = process.env.CAPACITOR_EXPORT === "true";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  ...(isCapacitorExport
    ? {
        output: "export" as const,
        distDir: "out",
      }
    : {}),
};

export default nextConfig;
