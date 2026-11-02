import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const apiHost = process.env.NEXT_PUBLIC_API_URL;
    if (!apiHost) {
      return [];
    }
    const cleanHost = apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
    const targetHost = cleanHost.endsWith('/api/v1') ? cleanHost : `${cleanHost}/api/v1`;
    return [
      {
        source: '/api/:path*',
        destination: `${targetHost}/:path*`,
      },
    ];
  },
};

export default nextConfig;
