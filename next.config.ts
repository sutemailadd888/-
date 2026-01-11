import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // エラーがあってもビルドを強行する設定
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;