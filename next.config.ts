import type { NextConfig } from "next";

// Let next/image optimize approved property photos stored in Supabase Storage.
// KEEP IN SYNC with src/lib/landing/image-hosts.ts (isOptimizableImage), which the
// landing page uses to decide which URLs go through next/image. (Kept inline here
// because importing app files into next.config.ts isn't reliable across Next versions.)
const SUPABASE_PUBLIC_STORAGE_PATH = "/storage/v1/object/public/";
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  experimental: {
    // CSV imports are sent to a server action; allow a few thousand rows.
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: `${SUPABASE_PUBLIC_STORAGE_PATH}**` }]
      : [],
  },
};

export default nextConfig;
