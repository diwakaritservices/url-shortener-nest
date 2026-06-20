import { Controller, Get, Param, Req, Res } from '@nestjs/common';
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
    const shortUrl = await this.urlsService.resolve(shortId);

    if (this.prefersJson(request)) {
      response.json({
        shortId: shortUrl.shortId,
        fullUrl: shortUrl.fullUrl,
        isArchived: shortUrl.isArchived,
        archivedAt: shortUrl.archivedAt,
      });
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
