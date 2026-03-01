import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/agents/:id(\\d+)",
        destination: "/agents/baseSepolia/:id",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
