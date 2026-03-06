import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "80MB",
    },
  },
  typedRoutes: true,
};

export default nextConfig;
