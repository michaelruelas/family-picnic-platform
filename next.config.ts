import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: process.env.NEXT_IGNORE_BUILD_ERRORS === 'true',
  },
  images: {
    // FPP-69: photo URLs stored in the Photo table point at the
    // public SeaweedFS bucket on i.foliapicnic.com, so Next.js
    // Image optimization must whitelist that hostname or the
    // gallery / detail view 500s with "hostname not configured".
    // picsum.photos remains for the placeholder photo flow.
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'i.foliapicnic.com' },
    ],
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost', '100.81.148.51'],
};

export default nextConfig;
