import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthResponse, AuthenticatedUser } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { TurnstileService } from './turnstile.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly turnstileService: TurnstileService,
  ) {}

  @Post('signup')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async signup(
    @Body() credentials: AuthCredentialsDto,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    await this.turnstileService.verifyToken(
      credentials.turnstileToken,
      this.getClientIp(request),
    );

    return this.authService.signup(credentials);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(
    @Body() credentials: AuthCredentialsDto,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    await this.turnstileService.verifyToken(
      credentials.turnstileToken,
      this.getClientIp(request),
    );

    return this.authService.login(credentials);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest): AuthenticatedUser {
    return request.user;
  }

  private getClientIp(request: Request): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim();
    }

    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0];
    }

    return request.ip;
  }
}
