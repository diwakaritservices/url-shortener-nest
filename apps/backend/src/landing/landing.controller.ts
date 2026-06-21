import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { LandingService } from './landing.service';

@ApiExcludeController()
@Controller()
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  getLandingPage(@Res() response: Response): void {
    response.send(this.landingService.renderLandingPage());
  }

  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  getPrivacyPage(@Res() response: Response): void {
    response.send(this.landingService.renderPrivacyPage());
  }

  @Get('terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  getTermsPage(@Res() response: Response): void {
    response.send(this.landingService.renderTermsPage());
  }

  @Get('not-found')
  getNotFoundPage(@Res() response: Response): void {
    response
      .status(404)
      .type('text/html; charset=utf-8')
      .set('Cache-Control', 'no-store')
      .send(this.landingService.renderNotFoundPage());
  }

  @Get('.well-known/security.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400')
  getSecurityTxt(@Res() response: Response): void {
    response.send(this.landingService.renderSecurityTxt());
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  getRobotsTxt(@Res() response: Response): void {
    response.send(this.landingService.renderRobotsTxt());
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  getSitemap(@Res() response: Response): void {
    response.send(this.landingService.renderSitemapXml());
  }

  @Get('logo.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=86400')
  getLogoSvg(@Res() response: Response): void {
    this.landingService.sendBrandAsset(response, 'logo.svg');
  }

  @Get('logo.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=86400')
  getLogoPng(@Res() response: Response): void {
    this.landingService.sendBrandAsset(response, 'logo.png');
  }

  @Get('favicon.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=86400')
  getFaviconSvg(@Res() response: Response): void {
    this.landingService.sendBrandAsset(response, 'favicon.svg');
  }

  @Get('favicon.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=86400')
  getFaviconPng(@Res() response: Response): void {
    this.landingService.sendBrandAsset(response, 'favicon.png');
  }

  @Get('og-image.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=86400')
  getOgImage(@Res() response: Response): void {
    this.landingService.sendBrandAsset(response, 'og-image.png');
  }
}
