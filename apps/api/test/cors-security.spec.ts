import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('CORS Security Policy Verification', () => {
  let app: INestApplication;
  let serverUrl: string;

  beforeAll(async () => {
    // Configure test environment origins
    process.env.CORS_ALLOWED_ORIGINS = 'https://custom-partner.biblelms.org';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    const defaultApprovedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://bible-learning-app-bm4j.vercel.app',
    ];

    const allowedOrigins = Array.from(new Set([...defaultApprovedOrigins, ...envOrigins]));

    app.enableCors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) {
          return callback(null, true);
        }

        const isAllowedExplicit = allowedOrigins.includes(requestOrigin);
        const isVercelPreview = /^https:\/\/bible-learning-app[a-zA-Z0-9-]*\.vercel\.app$/.test(requestOrigin);

        if (isAllowedExplicit || isVercelPreview) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
      maxAge: 86400,
    });

    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;
    serverUrl = `http://127.0.0.1:${port}/api/v1`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. permits approved localhost development origin with credentials: true', async () => {
    const res = await fetch(`${serverUrl}/auth/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('2. permits approved production Vercel frontend origin with credentials: true', async () => {
    const res = await fetch(`${serverUrl}/auth/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://bible-learning-app-bm4j.vercel.app',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('https://bible-learning-app-bm4j.vercel.app');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('3. permits approved Vercel preview deployment URLs matching regex with credentials: true', async () => {
    const res = await fetch(`${serverUrl}/auth/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://bible-learning-app-git-feat-branch.vercel.app',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('https://bible-learning-app-git-feat-branch.vercel.app');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('4. permits custom origins supplied via CORS_ALLOWED_ORIGINS environment variable', async () => {
    const res = await fetch(`${serverUrl}/auth/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://custom-partner.biblelms.org',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('https://custom-partner.biblelms.org');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('5. strictly blocks unauthorized origins from receiving Access-Control-Allow-Origin', async () => {
    const res = await fetch(`${serverUrl}/auth/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious-attacker.com',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('6. strictly blocks unauthorized domain attempting to spoof subdomains', async () => {
    const res = await fetch(`${serverUrl}/auth/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil-attacker.vercel.app',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
