import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Disable Turbopack file system cache to avoid "Persisting failed: Another write batch
    // or compaction is already active" errors during dev (LMDB concurrency issue).
    turbopackFileSystemCacheForDev: false,
  },
  async redirects() {
    return [
      {
        source: "/agents/:id(\\d+)",
        destination: "/agents/sepolia/:id",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
