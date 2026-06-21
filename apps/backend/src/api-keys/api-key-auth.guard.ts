import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@url-shortener/shared';
import { Request } from 'express';
import { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & Partial<AuthenticatedRequest>>();
    const apiKey = this.extractApiKey(request);
    const { ownerId } = await this.apiKeysService.authenticate(apiKey);
    const user = await this.usersService.findById(ownerId);

    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email address is not verified');
    }

    request.user = this.toAuthenticatedUser(user);

    return true;
  }

  private extractApiKey(request: Request): string {
    const headerApiKey = request.headers['x-api-key'];

    if (typeof headerApiKey === 'string' && headerApiKey.trim()) {
      return headerApiKey.trim();
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Missing API key');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid API key');
    }

    return token;
  }

  private toAuthenticatedUser(user: {
    _id: { toString(): string };
    email: string;
    name?: string | null;
    emailVerified?: boolean;
    mfaEnabled?: boolean;
  }): AuthenticatedUser {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name ?? null,
      emailVerified: user.emailVerified ?? true,
      mfaEnabled: user.mfaEnabled ?? false,
    };
  }
}
