import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../../'),
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
    const apiHost =
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV !== 'production' ? 'http://localhost:4000/api/v1' : '');
    if (!apiHost || apiHost.startsWith('/')) {
      return [];
    }
    const cleanHost = apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
    const targetHost = cleanHost.endsWith('/api/v1') ? cleanHost : `${cleanHost}/api/v1`;
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/api/v1/:path*',
          destination: `${targetHost}/:path*`,
        },
        {
          source: '/api/:path*',
          destination: `${targetHost}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
