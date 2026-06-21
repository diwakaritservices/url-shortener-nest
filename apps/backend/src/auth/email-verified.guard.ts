import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();

    if (!request.user?.emailVerified) {
      throw new ForbiddenException('Email address is not verified');
    }

    return true;
  }
}
