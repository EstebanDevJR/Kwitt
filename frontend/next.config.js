import type { NextConfig } from 'next';

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['github.com', 'avatars.githubusercontent.com'],
  },
};

export default nextConfig;