import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RedisModule } from '../redis/redis.module';
import { UrlsModule } from '../urls/urls.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerifiedGuard } from './email-verified.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MfaService } from './mfa.service';
import { PasswordResetService } from './password-reset.service';
import { TurnstileService } from './turnstile.service';
import { IsStrongPasswordConstraint } from './validators/password-policy.validator';

@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
    RedisModule,
    MailModule,
    NotificationsModule,
    forwardRef(() => UrlsModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieService,
    EmailVerificationService,
    EmailVerifiedGuard,
    JwtAuthGuard,
    MfaService,
    PasswordResetService,
    TurnstileService,
    IsStrongPasswordConstraint,
  ],
  exports: [AuthService, AuthCookieService, JwtAuthGuard, EmailVerifiedGuard],
})
export class AuthModule {}
