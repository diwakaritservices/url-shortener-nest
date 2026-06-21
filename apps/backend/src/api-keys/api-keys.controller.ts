import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ApiKeySummary, CreateApiKeyResponse } from '@url-shortener/shared';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiKeySummaryDto,
  CreateApiKeyResponseDto,
} from '../swagger/dto/api-key-response.dto';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('API Keys')
@ApiBearerAuth('access-token')
@Controller('v1/api-keys')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Create an integration API key',
    description:
      'Returns the full API key once. Store it securely because it cannot be retrieved later.',
  })
  @ApiCreatedResponse({ type: CreateApiKeyResponseDto })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponse> {
    return this.apiKeysService.createForUser(
      request.user.id,
      createApiKeyDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List active API keys' })
  @ApiOkResponse({ type: ApiKeySummaryDto, isArray: true })
  list(@Req() request: AuthenticatedRequest): Promise<ApiKeySummary[]> {
    return this.apiKeysService.listForUser(request.user.id);
  }

  @Delete(':apiKeyId')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'apiKeyId', example: '664f1f2bcf86cd799439011' })
  @ApiOkResponse({ type: ApiKeySummaryDto })
  revoke(
    @Req() request: AuthenticatedRequest,
    @Param('apiKeyId') apiKeyId: string,
  ): Promise<ApiKeySummary> {
    return this.apiKeysService.revokeForUser(request.user.id, apiKeyId);
  }
}
