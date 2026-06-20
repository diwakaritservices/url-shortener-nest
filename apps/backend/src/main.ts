import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback');
  const configuredOrigins = process.env.FRONTEND_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: configuredOrigins?.length ? configuredOrigins : !isProduction,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
