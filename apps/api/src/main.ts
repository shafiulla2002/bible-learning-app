import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    'https://bible-learning-app-bm4j.vercel.app',
  ];

  const allowedOrigins = Array.from(new Set([...defaultApprovedOrigins, ...envOrigins]));

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Allow non-browser requests (e.g. server-to-server, curl, tests) where origin is undefined
      if (!requestOrigin) {
        return callback(null, true);
      }

      const isAllowedExplicit = allowedOrigins.includes(requestOrigin);
      // Support Vercel production and preview deployment URLs for this application
      const isVercelPreview = /^https:\/\/bible-learning-app[a-zA-Z0-9-]*\.vercel\.app$/.test(requestOrigin);

      if (isAllowedExplicit || isVercelPreview) {
        callback(null, true);
      } else {
        // Reject unapproved origins from receiving CORS headers
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
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
