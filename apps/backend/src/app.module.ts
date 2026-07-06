import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuthController } from './auth/auth.controller';
import { PrivateCacheMiddleware } from './common/private-cache.middleware';
import { IntegrationsModule } from './integrations/integrations.module';
import { IntegrationsController } from './integrations/integrations.controller';
import { LandingModule } from './landing/landing.module';
import { ApiKeysController } from './api-keys/api-keys.controller';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { UrlsModule } from './urls/urls.module';
import { UrlsController } from './urls/urls.controller';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';

        if (!uri && isProduction) {
          throw new Error('MONGODB_URI is required in production');
        }

        return {
          uri: uri ?? 'mongodb://localhost:27017/url-shortener',
          serverSelectionTimeoutMS: 10_000,
          connectTimeoutMS: 10_000,
        };
      },
    }),
    LandingModule,
    UsersModule,
    AuthModule,
    UrlsModule,
    IntegrationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(PrivateCacheMiddleware)
      .forRoutes(
        AuthController,
        UrlsController,
        IntegrationsController,
        ApiKeysController,
      );
  }
}
