import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      // YouTube
      { protocol: 'https', hostname: '*.ytimg.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '*.youtube.com' },
      // TikTok (multiple regions/CDNs)
      { protocol: 'https', hostname: '*.tiktokcdn.com' },
      { protocol: 'https', hostname: '*.tiktokcdn-us.com' },
      { protocol: 'https', hostname: '*.tiktok-cdn.com' },
      { protocol: 'https', hostname: '*.tiktokv.com' },
      // Instagram (uses cdninstagram.com AND Meta's fbcdn.net)
      { protocol: 'https', hostname: '*.cdninstagram.com' },
      { protocol: 'https', hostname: '*.fbcdn.net' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
    deviceSizes: [640, 828, 1200],
    imageSizes: [16, 32, 64, 128],
  },
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
