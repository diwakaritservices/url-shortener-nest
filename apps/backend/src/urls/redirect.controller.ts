import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { RedirectJsonResponse } from '@url-shortener/shared';
import type { Request, Response } from 'express';
import { UrlsService } from './urls.service';

@Controller()
export class RedirectController {
  constructor(private readonly urlsService: UrlsService) {}

  @Get(':shortId')
  async resolve(
    @Param('shortId') shortId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    let shortUrl;

    try {
      shortUrl = await this.urlsService.resolve(shortId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        if (this.prefersJson(request)) {
          response.status(404).json({
            statusCode: 404,
            message: 'Short URL not found',
          });
          return;
        }

        response.redirect(302, '/not-found');
        return;
      }

      throw error;
    }

    if (this.prefersJson(request)) {
      const payload: RedirectJsonResponse = {
        shortId: shortUrl.shortId,
        fullUrl: shortUrl.fullUrl,
        isArchived: shortUrl.isArchived,
        archivedAt: shortUrl.archivedAt,
      };
      response.json(payload);
      return;
    }

    response.redirect(302, shortUrl.fullUrl);
  }

  private prefersJson(request: Request): boolean {
    const contentType = request.headers['content-type'];
    const accept = request.headers.accept;

    return this.includesJson(contentType) || this.includesJson(accept);
  }

  private includesJson(header: string | string[] | undefined): boolean {
    if (!header) {
      return false;
    }

    const value = Array.isArray(header) ? header.join(',') : header;

    return value.toLowerCase().includes('application/json');
  }
}
