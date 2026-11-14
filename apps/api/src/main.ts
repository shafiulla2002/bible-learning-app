import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { getRequiredJwtSecret } from './core/auth/jwt-secret.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  getRequiredJwtSecret();

  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp?.disable === 'function') {
    expressApp.disable('x-powered-by');
  }

  app.use(
    typeof (cookieParser as any) === 'function'
      ? (cookieParser as any)()
      : (cookieParser as any).default(),
  );

  // Security headers + lightweight sliding-window rate limiter
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    const ip =
      String(req.headers['x-forwarded-for'] || req.ip || 'unknown')
        .split(',')[0]
        .trim();
    const path = String(req.path || req.url || '');
    const isAuthRoute = path.startsWith('/api/v1/auth/');
    const windowMs = 60_000;
    const limit = isAuthRoute ? 60 : 400;
    const bucketKey = `${isAuthRoute ? 'auth' : 'api'}:${ip}`;
    const now = Date.now();
    const current = rateBuckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    } else if (current.count >= limit) {
      const retrySeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySeconds));
      return res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please slow down and try again shortly.',
      });
    } else {
      current.count += 1;
    }

    if (rateBuckets.size > 10000) {
      rateBuckets.clear();
    }

    return next();
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Strict Production CORS Allowlist
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const defaultApprovedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'https://bible-learning-app-bm4j.vercel.app',
    'https://berea-bible-institute.vercel.app',
    'https://biblelearninglms.covenantsynergy.in',
  ];

  const allowedOrigins = Array.from(new Set([...defaultApprovedOrigins, ...envOrigins]));

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        return callback(null, true);
      }
      const isAllowedExplicit = allowedOrigins.includes(requestOrigin);
      const isVercelPreview =
        /^https:\/\/(bible-learning-app|berea-bible-institute)[a-zA-Z0-9-]*\.vercel\.app$/.test(
          requestOrigin,
        );
      if (isAllowedExplicit || isVercelPreview) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'Accept',
      'Origin',
    ],
    maxAge: 86400,
  });

  const config = new DocumentBuilder()
    .setTitle('Bible Institute LMS API')
    .setDescription('Enterprise multi-tenant backend API for Bible Learning Institute Management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Bible LMS API is running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
