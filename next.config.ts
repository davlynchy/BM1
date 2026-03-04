import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "80MB",
    },
  },
  typedRoutes: true,
};

export default nextConfig;
