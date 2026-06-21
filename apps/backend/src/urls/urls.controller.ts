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
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ShortUrlConflictErrorDto,
  ShortUrlResponseDto,
} from '../swagger/dto/short-url-response.dto';
import { CreateUrlDto } from './dto/create-url.dto';
import { ShortUrlResponse, UrlsService } from './urls.service';

@ApiTags('Links')
@ApiBearerAuth('access-token')
@Controller('urls')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class UrlsController {
  constructor(private readonly urlsService: UrlsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a short link' })
  @ApiCreatedResponse({ type: ShortUrlResponseDto })
  @ApiResponse({
    status: 409,
    description: 'The URL or custom short code already exists for this account.',
    type: ShortUrlConflictErrorDto,
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createUrlDto: CreateUrlDto,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.create(request.user.id, createUrlDto);
  }

  @Get()
  @ApiOperation({ summary: 'List short links' })
  @ApiQuery({
    name: 'archived',
    required: false,
    enum: ['true'],
    description: 'Pass `true` to list archived links. Defaults to active links.',
  })
  @ApiOkResponse({ type: ShortUrlResponseDto, isArray: true })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('archived') archived?: string,
  ): Promise<ShortUrlResponse[]> {
    return this.urlsService.findAllForUser(
      request.user.id,
      archived === 'true',
    );
  }

  @Get(':shortId')
  @ApiOperation({ summary: 'Get one short link' })
  @ApiParam({ name: 'shortId', example: 'launch-notes' })
  @ApiOkResponse({ type: ShortUrlResponseDto })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.findOneForUser(request.user.id, shortId);
  }

  @Delete(':shortId')
  @ApiOperation({ summary: 'Delete a short link' })
  @ApiParam({ name: 'shortId', example: 'launch-notes' })
  @ApiOkResponse({ type: ShortUrlResponseDto })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.removeForUser(request.user.id, shortId);
  }

  @Patch(':shortId/archive')
  @ApiOperation({ summary: 'Archive a short link' })
  @ApiParam({ name: 'shortId', example: 'launch-notes' })
  @ApiOkResponse({ type: ShortUrlResponseDto })
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.archiveForUser(request.user.id, shortId);
  }

  @Patch(':shortId/unarchive')
  @ApiOperation({ summary: 'Restore an archived short link' })
  @ApiParam({ name: 'shortId', example: 'launch-notes' })
  @ApiOkResponse({ type: ShortUrlResponseDto })
  unarchive(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.unarchiveForUser(request.user.id, shortId);
  }
}
