import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { UrlsService } from '../urls/urls.service';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { DomainEventName } from '../notifications/domain-event.constants';
import { DomainEventPublisher } from '../notifications/domain-event.publisher';
import type { AuthResponse, AuthenticatedUser } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  DisableMfaDto,
  MfaCodeDto,
  MfaLoginVerifyDto,
} from './dto/mfa.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password-reset.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { TurnstileService } from './turnstile.service';
import {
  AuthResponseDto,
  AuthenticatedUserDto,
  MfaSetupResponseDto,
  VerificationResendStatusDto,
} from '../swagger/dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
    private readonly turnstileService: TurnstileService,
    private readonly urlsService: UrlsService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  @Post('signup')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new account' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  async signup(
    @Body() credentials: AuthCredentialsDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    await this.turnstileService.verifyToken(
      credentials.turnstileToken,
      this.getClientIp(request),
    );

    const authResponse = await this.authService.signup(credentials);

    if (authResponse.accessToken) {
      this.authCookieService.setAccessTokenCookie(
        response,
        authResponse.accessToken,
      );
    }

    return authResponse;
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(
    @Body() credentials: AuthCredentialsDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    await this.turnstileService.verifyToken(
      credentials.turnstileToken,
      this.getClientIp(request),
    );

    const authResponse = await this.authService.login(credentials);

    if (authResponse.accessToken) {
      this.authCookieService.setAccessTokenCookie(
        response,
        authResponse.accessToken,
      );
    }

    return authResponse;
  }

  @Post('mfa/verify-login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Complete sign-in with an MFA code' })
  @ApiOkResponse({ type: AuthResponseDto })
  async verifyMfaLogin(
    @Body() mfaLoginVerifyDto: MfaLoginVerifyDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const authResponse = await this.authService.verifyMfaLogin(
      mfaLoginVerifyDto.mfaToken,
      mfaLoginVerifyDto.code,
    );

    if (authResponse.accessToken) {
      this.authCookieService.setAccessTokenCookie(
        response,
        authResponse.accessToken,
      );
    }

    return authResponse;
  }

  @Post('forgot-password')
  @HttpCode(204)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Request a password reset code' })
  @ApiNoContentResponse()
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.turnstileService.verifyToken(
      forgotPasswordDto.turnstileToken,
      this.getClientIp(request),
    );

    await this.authService.requestPasswordReset(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @HttpCode(204)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Reset password with an emailed code' })
  @ApiNoContentResponse()
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.turnstileService.verifyToken(
      resetPasswordDto.turnstileToken,
      this.getClientIp(request),
    );

    await this.authService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.otp,
      resetPasswordDto.newPassword,
    );
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out and clear the session cookie' })
  @ApiNoContentResponse()
  logout(@Res({ passthrough: true }) response: Response): void {
    this.authCookieService.clearAccessTokenCookie(response);
  }

  @Post('verify-email')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify email with a one-time code' })
  @ApiOkResponse({ type: AuthenticatedUserDto })
  verifyEmail(
    @Req() request: AuthenticatedRequest,
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.verifyEmail(request.user.id, verifyEmailDto.otp);
  }

  @Get('verification-resend-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get email verification resend limits' })
  @ApiOkResponse({ type: VerificationResendStatusDto })
  getVerificationResendStatus(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.getVerificationResendStatus(request.user.id);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Resend the email verification code' })
  @ApiOkResponse({ type: VerificationResendStatusDto })
  resendVerification(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.resendVerificationEmail(request.user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse({ type: AuthenticatedUserDto })
  me(@Req() request: AuthenticatedRequest): AuthenticatedUser {
    return request.user;
  }

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Export account profile and link data' })
  async exportMe(@Req() request: AuthenticatedRequest) {
    const links = await this.urlsService.findAllForUser(request.user.id, 'all');

    this.domainEventPublisher.publish(DomainEventName.AccountExported, {
      user: request.user,
      linkCount: links.length,
    });

    return {
      exportedAt: new Date().toISOString(),
      profile: request.user,
      links,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiOkResponse({ type: AuthenticatedUserDto })
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.updateProfile(
      request.user.id,
      updateProfileDto.name,
    );
  }

  @Patch('me/password')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change the current account password' })
  @ApiNoContentResponse()
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.changePassword(
      request.user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );

    const accessToken = await this.authService.createAccessToken(request.user);
    this.authCookieService.setAccessTokenCookie(response, accessToken);
  }

  @Delete('me')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete the current account and associated data' })
  @ApiNoContentResponse()
  async deleteMe(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.deleteAccount(request.user.id);
    this.authCookieService.clearAccessTokenCookie(response);
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Begin MFA setup and get an authenticator secret' })
  @ApiOkResponse({ type: MfaSetupResponseDto })
  beginMfaSetup(@Req() request: AuthenticatedRequest) {
    return this.authService.beginMfaSetup(
      request.user.id,
      request.user.email,
    );
  }

  @Post('mfa/enable')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Enable MFA after verifying an authenticator code' })
  @ApiOkResponse({ type: AuthenticatedUserDto })
  enableMfa(
    @Req() request: AuthenticatedRequest,
    @Body() mfaCodeDto: MfaCodeDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.enableMfa(request.user.id, mfaCodeDto.code);
  }

  @Post('mfa/disable')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable MFA for the current account' })
  @ApiOkResponse({ type: AuthenticatedUserDto })
  disableMfa(
    @Req() request: AuthenticatedRequest,
    @Body() disableMfaDto: DisableMfaDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.disableMfa(
      request.user.id,
      disableMfaDto.password,
      disableMfaDto.code,
    );
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
