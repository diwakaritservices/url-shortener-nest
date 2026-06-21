import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiSecurity,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { IntegrationShortUrlResponse } from '@url-shortener/shared';
import { ApiKeyAuthGuard } from '../api-keys/api-key-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import {
  IntegrationShortUrlResponseDto,
  ShortUrlConflictErrorDto,
} from '../swagger/dto/short-url-response.dto';
import { CreateUrlDto } from '../urls/dto/create-url.dto';
import { UrlsService } from '../urls/urls.service';
import { parseArchivedQueryFilter } from './archived-query.util';

@ApiTags('Links')
@ApiSecurity('api-key')
@Controller('v1/links')
@UseGuards(ApiKeyAuthGuard)
export class IntegrationsController {
  constructor(private readonly urlsService: UrlsService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary: 'Shorten a URL',
    description:
      'Create a short link for the authenticated integration account. ' +
      'Returns a ready-to-use `shortUrl` built from `PUBLIC_BASE_URL`.',
  })
  @ApiCreatedResponse({ type: IntegrationShortUrlResponseDto })
  @ApiResponse({
    status: 409,
    description: 'The URL or custom short code already exists for this account.',
    type: ShortUrlConflictErrorDto,
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createUrlDto: CreateUrlDto,
  ): Promise<IntegrationShortUrlResponse> {
    return this.urlsService.createIntegrationLink(
      request.user.id,
      createUrlDto,
    );
  }

  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiOperation({
    summary: 'List shortened URLs',
    description:
      'Returns all links by default. Use the `archived` query parameter to filter results.',
  })
  @ApiQuery({
    name: 'archived',
    required: false,
    enum: ['true', 'false', 'all'],
    description:
      'Filter by archive state. Omit to return all links, or pass `true`, `false`, or `all`.',
  })
  @ApiOkResponse({ type: IntegrationShortUrlResponseDto, isArray: true })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('archived') archived?: string,
  ): Promise<IntegrationShortUrlResponse[]> {
    return this.urlsService.findAllIntegrationLinksForUser(
      request.user.id,
      parseArchivedQueryFilter(archived),
    );
  }

  @Patch(':shortId/archive')
  @ApiOperation({ summary: 'Archive a short link' })
  @ApiParam({
    name: 'shortId',
    example: 'launch-notes',
  })
  @ApiOkResponse({ type: IntegrationShortUrlResponseDto })
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<IntegrationShortUrlResponse> {
    return this.urlsService.archiveIntegrationLinkForUser(
      request.user.id,
      shortId,
    );
  }

  @Patch(':shortId/unarchive')
  @ApiOperation({ summary: 'Restore an archived short link' })
  @ApiParam({
    name: 'shortId',
    example: 'launch-notes',
  })
  @ApiOkResponse({ type: IntegrationShortUrlResponseDto })
  unarchive(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<IntegrationShortUrlResponse> {
    return this.urlsService.unarchiveIntegrationLinkForUser(
      request.user.id,
      shortId,
    );
  }

}
