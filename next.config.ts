import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CSV imports are sent to a server action; allow a few thousand rows.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
