import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "80MB",
    },
  },
  typedRoutes: true,
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
