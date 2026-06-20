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
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUrlDto } from './dto/create-url.dto';
import { ShortUrlResponse, UrlsService } from './urls.service';

@Controller('urls')
@UseGuards(JwtAuthGuard)
export class UrlsController {
  constructor(private readonly urlsService: UrlsService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createUrlDto: CreateUrlDto,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.create(request.user.id, createUrlDto);
  }

  @Get()
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
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.findOneForUser(request.user.id, shortId);
  }

  @Delete(':shortId')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.removeForUser(request.user.id, shortId);
  }

  @Patch(':shortId/archive')
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.archiveForUser(request.user.id, shortId);
  }

  @Patch(':shortId/unarchive')
  unarchive(
    @Req() request: AuthenticatedRequest,
    @Param('shortId') shortId: string,
  ): Promise<ShortUrlResponse> {
    return this.urlsService.unarchiveForUser(request.user.id, shortId);
  }
}
