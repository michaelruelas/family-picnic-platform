import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos' }],
  },
  allowedDevOrigins: ['100.81.148.51'],
};

export default nextConfig;
