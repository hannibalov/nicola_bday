import type { NextConfig } from "next";

/** Long-lived cache for fingerprinted build assets (Next hashes file names). */
const NEXT_STATIC_CACHE = "public, max-age=31536000, immutable";

/** Party images under /public/images — safe to revalidate if filenames stay stable. */
const PUBLIC_IMAGES_CACHE =
  "public, max-age=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: NEXT_STATIC_CACHE }],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: PUBLIC_IMAGES_CACHE }],
      },
    ];
  },
};

export default nextConfig;
