import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger/swagger.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback');
  const configuredOrigins = process.env.FRONTEND_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: configuredOrigins?.length ? configuredOrigins : !isProduction,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [
            `'self'`,
            `'unsafe-inline'`,
            'https://fonts.googleapis.com',
          ],
          fontSrc: [`'self'`, 'https://fonts.gstatic.com'],
          scriptSrc: [
            `'self'`,
            `'unsafe-inline'`,
            'https://challenges.cloudflare.com',
          ],
          imgSrc: [`'self'`, 'data:', 'https:'],
          frameSrc: ['https://challenges.cloudflare.com'],
          frameAncestors: [`'none'`],
          baseUri: [`'self'`],
          formAction: [`'self'`],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  if (process.env.SWAGGER_ENABLED !== 'false') {
    setupSwagger(app);
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
