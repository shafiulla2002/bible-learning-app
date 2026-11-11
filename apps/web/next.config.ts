import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: [
    '@bible-lms/api',
    '@bible-lms/shared',
    '@nestjs/core',
    '@nestjs/common',
    '@nestjs/platform-express',
    '@nestjs/config',
    '@nestjs/jwt',
    '@nestjs/passport',
    '@nestjs/swagger',
    '@prisma/client',
    'prisma',
    'bcrypt',
    'passport',
    'passport-jwt',
    'cookie-parser',
    'reflect-metadata',
    'class-validator',
    'class-transformer',
  ],
  outputFileTracingIncludes: {
    '/api/v1/[[...slug]]': [
      '../api/dist/**/*',
      '../../packages/shared/dist/**/*',
      '../../node_modules/.prisma/client/**/*',
      '../../node_modules/@prisma/client/**/*',
    ],
  },
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
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/:path((?!v1(?:/|$)).*)',
          destination: '/api/v1/:path',
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
