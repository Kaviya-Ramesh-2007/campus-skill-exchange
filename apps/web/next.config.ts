import type { NextConfig } from 'next';

const apiInternalUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:3001').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Next.js dev blocks its own client bundle when the page is opened from a
  // different origin than the one it was served on (localhost vs 127.0.0.1 vs
  // the LAN address). That silently produces a dead, non-hydrated page.
  allowedDevOrigins: ['localhost', '127.0.0.1', '0.0.0.0', '10.14.161.210'],
  transpilePackages: [
    '@campus-skill-exchange/config',
    '@campus-skill-exchange/contracts',
    '@campus-skill-exchange/ui',
  ],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiInternalUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
