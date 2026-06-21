import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Response } from 'express';
import {
  LANDING_KEYWORDS,
  LOGO_PATH,
  OG_IMAGE_PATH,
  FAVICON_PATH,
  PENDING_URL_QUERY_PARAM,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from './landing.constants';
import { renderLandingShortenScript } from './landing-shorten.script';
import {
  renderNotFoundPage,
  renderPrivacyPage,
  renderSecurityTxt,
  renderTermsPage,
} from './legal-pages';

export interface LandingPageContext {
  siteUrl: string;
  registerUrl: string;
  loginUrl: string;
  myLinksUrl: string;
  developersUrl: string;
  productName: string;
  tagline: string;
  description: string;
  keywords: string;
  year: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

@Injectable()
export class LandingService {
  constructor(private readonly configService: ConfigService) {}

  getContext(): LandingPageContext {
    const siteUrl = this.normalizeSiteUrl(
      this.configService.get<string>('PUBLIC_BASE_URL') ??
        'http://localhost:8080',
    );

    return {
      siteUrl,
      registerUrl: `${siteUrl}/register`,
      loginUrl: `${siteUrl}/login`,
      myLinksUrl: `${siteUrl}/my-links`,
      developersUrl: `${siteUrl}/developers`,
      productName: PRODUCT_NAME,
      tagline: PRODUCT_TAGLINE,
      description: PRODUCT_DESCRIPTION,
      keywords: LANDING_KEYWORDS,
      year: new Date().getFullYear(),
    };
  }

  renderLandingPage(): string {
    const context = this.getContext();
    const e = escapeHtml;
    const logoUrl = `${context.siteUrl}${LOGO_PATH}`;
    const ogImageUrl = `${context.siteUrl}${OG_IMAGE_PATH}`;

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: context.productName,
          url: context.siteUrl,
          logo: logoUrl,
          description: context.description,
        },
        {
          '@type': 'WebSite',
          name: context.productName,
          url: context.siteUrl,
          description: context.description,
        },
        {
          '@type': 'SoftwareApplication',
          name: context.productName,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description: context.description,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          url: context.siteUrl,
        },
      ],
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${e(context.productName)} — ${e(context.tagline)}</title>
  <meta name="description" content="${e(context.description)}" />
  <meta name="keywords" content="${e(context.keywords)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${e(context.siteUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${e(context.productName)}" />
  <meta property="og:title" content="${e(context.productName)} — ${e(context.tagline)}" />
  <meta property="og:description" content="${e(context.description)}" />
  <meta property="og:url" content="${e(context.siteUrl)}" />
  <meta property="og:image" content="${e(ogImageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${e(context.productName)} — ${e(context.tagline)}" />
  <meta name="twitter:description" content="${e(context.description)}" />
  <meta name="twitter:image" content="${e(ogImageUrl)}" />
  <link rel="icon" type="image/svg+xml" href="${this.renderInlineFaviconHref()}" />
  <link rel="apple-touch-icon" href="${e(ogImageUrl)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script type="application/ld+json">${jsonLd}</script>
  <style>${LANDING_STYLES}</style>
</head>
<body>
  <header class="site-header">
    <div class="container site-header-inner">
      <a class="brand" href="${e(context.siteUrl)}" aria-label="${e(context.productName)} home">
        ${this.renderInlineLogo()}
        <span>${e(context.productName)}</span>
      </a>
      <nav class="header-nav" aria-label="Primary">
        <a class="btn btn-ghost" href="${e(context.developersUrl)}">Developers</a>
        <a class="btn btn-ghost" href="${e(context.loginUrl)}">Sign in</a>
        <a class="btn btn-primary" href="${e(context.registerUrl)}">Get started</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div class="container hero-grid">
        <div>
          <span class="eyebrow">${e(context.tagline)}</span>
          <h1 id="hero-title">Short links your team can trust and manage</h1>
          <p class="hero-lead">
            ${e(context.productName)} helps you create memorable short URLs, keep them organized,
            and connect your product with a clean REST API and API keys.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="${e(context.registerUrl)}">Create free account</a>
            <a class="btn btn-secondary" href="${e(context.developersUrl)}">Explore API docs</a>
          </div>
          <ul class="hero-points">
            <li>Custom short IDs for campaigns and product launches</li>
            <li>Dashboard for active and archived links</li>
            <li>Integration-ready API with scoped API keys</li>
          </ul>
        </div>
        <aside class="hero-panel hero-shorten" aria-label="Shorten a URL">
          <p class="hero-panel-label">Try it now</p>
          <h2 class="hero-shorten-title">Shorten a URL</h2>
          <p class="hero-shorten-copy">
            Paste any link below and get a short URL you can share in seconds.
          </p>
          <form
            id="hero-shorten-form"
            class="hero-shorten-form"
            data-my-links-url="${e(context.myLinksUrl)}"
            data-url-param="${e(PENDING_URL_QUERY_PARAM)}"
            novalidate
          >
            <label class="sr-only" for="hero-shorten-input">URL to shorten</label>
            <input
              id="hero-shorten-input"
              class="hero-shorten-input"
              type="url"
              name="url"
              inputmode="url"
              placeholder="https://example.com/your-page"
              autocomplete="url"
              maxlength="2048"
              required
            />
            <button class="btn btn-primary hero-shorten-btn" type="submit">Shorten URL</button>
            <p id="hero-shorten-error" class="hero-shorten-error" hidden role="alert"></p>
          </form>
        </aside>
      </div>
    </section>

    <section class="section" aria-labelledby="features-title">
      <div class="container">
        <div class="section-heading">
          <p class="section-kicker">Why teams choose ${e(context.productName)}</p>
          <h2 id="features-title">Everything you need to ship links with confidence</h2>
          <p class="section-copy">
            From one-off campaign links to automated integrations, ${e(context.productName)} keeps
            short URLs simple for humans and predictable for software.
          </p>
        </div>
        <div class="feature-grid">
          <article class="feature-card">
            <h3>Memorable short links</h3>
            <p>Choose custom short IDs or let ${e(context.productName)} generate them. Share links that look professional in docs, emails, and social posts.</p>
          </article>
          <article class="feature-card">
            <h3>Organized link workspace</h3>
            <p>Track active links, archive old ones, and restore them when campaigns return. Your dashboard stays clean as your link library grows.</p>
          </article>
          <article class="feature-card">
            <h3>Developer-friendly API</h3>
            <p>Create, list, archive, and restore links programmatically. Issue API keys per integration and connect external systems in minutes.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section-muted" aria-labelledby="workflow-title">
      <div class="container">
        <div class="section-heading">
          <p class="section-kicker">How it works</p>
          <h2 id="workflow-title">From signup to shared link in three steps</h2>
        </div>
        <ol class="steps">
          <li>
            <span class="step-number">1</span>
            <div>
              <h3>Paste your URL</h3>
              <p>Enter the link you want to shorten on the homepage, then create your free account.</p>
            </div>
          </li>
          <li>
            <span class="step-number">2</span>
            <div>
              <h3>Sign in and share</h3>
              <p>After registration, ${e(context.productName)} shortens your link and adds it to your dashboard.</p>
            </div>
          </li>
          <li>
            <span class="step-number">3</span>
            <div>
              <h3>Scale with the API</h3>
              <p>Automate link creation from your app, scripts, or internal tools with API keys.</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <section class="section cta-band" aria-labelledby="cta-title">
      <div class="container cta-band-inner">
        <div>
          <p class="section-kicker">Ready to launch?</p>
          <h2 id="cta-title">Start shortening links with ${e(context.productName)} today</h2>
          <p class="section-copy">Create your account, share your first link, and integrate when you are ready.</p>
        </div>
        <div class="cta-actions">
          <a class="btn btn-primary" href="${e(context.registerUrl)}">Get started free</a>
          <a class="btn btn-secondary" href="${e(context.loginUrl)}">Sign in</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div>
        <p class="footer-brand">${e(context.productName)}</p>
        <p class="footer-copy">${e(context.tagline)}</p>
      </div>
      <nav class="footer-nav" aria-label="Footer">
        <a href="${e(context.developersUrl)}">Developers</a>
        <a href="${e(`${context.siteUrl}/privacy`)}">Privacy</a>
        <a href="${e(`${context.siteUrl}/terms`)}">Terms</a>
        <a href="${e(context.registerUrl)}">Register</a>
        <a href="${e(context.loginUrl)}">Sign in</a>
      </nav>
      <p class="footer-meta">© ${context.year} ${e(context.productName)}. All rights reserved.</p>
    </div>
  </footer>
  <script>${renderLandingShortenScript()}</script>
</body>
</html>`;
  }

  renderRobotsTxt(): string {
    const { siteUrl } = this.getContext();

    return `User-agent: *
Allow: /
Disallow: /my-links
Disallow: /api-keys
Disallow: /profile
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`;
  }

  renderSitemapXml(): string {
    const { siteUrl } = this.getContext();
    const pages = ['', '/login', '/register', '/developers', '/privacy', '/terms'];

    const urls = pages
      .map(
        (path) => `  <url>
    <loc>${escapeHtml(`${siteUrl}${path}`)}</loc>
    <changefreq>${path === '' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${path === '' ? '1.0' : '0.7'}</priority>
  </url>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  }

  renderPrivacyPage(): string {
    return renderPrivacyPage(this.getLegalContext());
  }

  renderTermsPage(): string {
    return renderTermsPage(this.getLegalContext());
  }

  renderNotFoundPage(): string {
    return renderNotFoundPage(this.getLegalContext());
  }

  renderSecurityTxt(): string {
    const { siteUrl } = this.getContext();

    return renderSecurityTxt(siteUrl, this.getContactEmail());
  }

  private getLegalContext() {
    const { siteUrl, productName, year } = this.getContext();

    return {
      siteUrl,
      productName,
      contactEmail: this.getContactEmail(),
      year,
    };
  }

  private getContactEmail(): string {
    return (
      this.configService.get<string>('SECURITY_CONTACT_EMAIL') ??
      this.configService.get<string>('SMTP_FROM') ??
      'security@diwakarit.com'
    );
  }

  sendBrandAsset(response: Response, filename: string): void {
    const assetPath = join(__dirname, 'assets', filename);

    try {
      response.send(readFileSync(assetPath));
    } catch {
      throw new NotFoundException(`Brand asset not found: ${filename}`);
    }
  }

  renderInlineLogo(): string {
    const svg = this.readBrandSvg('logo.svg');

    if (!svg) {
      return `<img class="brand-mark" src="${LOGO_PATH}" width="40" height="40" alt="" aria-hidden="true" />`;
    }

    return svg.replace(
      /^<svg\b/,
      '<svg class="brand-mark" aria-hidden="true" focusable="false"',
    );
  }

  renderInlineFaviconHref(): string {
    const svg = this.readBrandSvg('favicon.svg');

    if (!svg) {
      return FAVICON_PATH;
    }

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  private readBrandSvg(filename: string): string | null {
    const assetPath = join(__dirname, 'assets', filename);

    try {
      return readFileSync(assetPath, 'utf8')
        .replace(/<\?xml[\s\S]*?\?>/gi, '')
        .trim();
    } catch {
      return null;
    }
  }

  private normalizeSiteUrl(value: string): string {
    return value.replace(/\/+$/, '');
  }
}

const LANDING_STYLES = `
:root {
  --bg: #f4f6f9;
  --surface: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --primary: #1769aa;
  --primary-dark: #125a8f;
  --primary-soft: #e8f2fa;
  --border: #e2e8f0;
  --hero-start: #0f172a;
  --hero-end: #1769aa;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: var(--text);
  background: var(--bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }

.container {
  width: min(100%, 1120px);
  margin-inline: auto;
  padding-inline: 24px;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(10px);
}

.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 64px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #ffffff;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.brand-mark {
  width: 40px;
  height: 40px;
  display: block;
  flex: 0 0 auto;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(23, 105, 170, 0.35);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 18px;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 600;
  border: 1px solid transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.btn:hover { transform: translateY(-1px); }

.btn-primary {
  background: var(--primary);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(23, 105, 170, 0.28);
}

.btn-primary:hover { background: var(--primary-dark); }

.btn-ghost {
  color: rgba(255, 255, 255, 0.92);
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
}

.btn-ghost:hover { background: rgba(255, 255, 255, 0.1); }

.btn-secondary {
  background: var(--surface);
  color: var(--primary);
  border-color: var(--border);
}

.btn-secondary:hover {
  background: var(--primary-soft);
  border-color: #c9dff0;
}

.hero {
  position: relative;
  overflow: hidden;
  color: #ffffff;
  background:
    radial-gradient(circle at 18% 18%, rgba(23, 105, 170, 0.28), transparent 42%),
    radial-gradient(circle at 82% 72%, rgba(46, 125, 50, 0.18), transparent 36%),
    linear-gradient(160deg, var(--hero-start) 0%, var(--hero-end) 100%);
  padding: 72px 0 88px;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 48px;
  align-items: center;
}

.eyebrow {
  display: inline-block;
  margin-bottom: 16px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 0 0 18px;
  font-size: clamp(2.4rem, 5vw, 3.75rem);
  line-height: 1.08;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.hero-lead {
  margin: 0 0 28px;
  max-width: 54ch;
  font-size: clamp(1.05rem, 2vw, 1.2rem);
  color: rgba(255, 255, 255, 0.84);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 28px;
}

.hero-points {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.95rem;
}

.hero-points li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-points li::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #7dd3fc;
  flex: 0 0 auto;
}

.hero-panel {
  padding: 24px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
}

.hero-panel-label {
  margin: 0 0 8px;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
}

.hero-panel-url {
  margin: 0 0 10px;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  word-break: break-word;
}

.hero-panel-destination {
  margin: 0 0 18px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.95rem;
  word-break: break-word;
}

.hero-panel-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-panel-meta span {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.8125rem;
  font-weight: 600;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.hero-shorten-title {
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.hero-shorten-copy {
  margin: 0 0 18px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.95rem;
  line-height: 1.5;
}

.hero-shorten-form {
  display: grid;
  gap: 12px;
}

.hero-shorten-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.35);
  color: #ffffff;
  font: inherit;
  font-size: 0.95rem;
}

.hero-shorten-input::placeholder {
  color: rgba(255, 255, 255, 0.48);
}

.hero-shorten-input:focus {
  outline: 2px solid rgba(125, 211, 252, 0.85);
  outline-offset: 2px;
  border-color: rgba(125, 211, 252, 0.65);
}

.hero-shorten-btn {
  width: 100%;
  justify-content: center;
}

.hero-shorten-input:invalid:not(:placeholder-shown) {
  border-color: #fca5a5;
}

.hero-shorten-error {
  margin: 0;
  color: #fecaca;
  font-size: 0.875rem;
  line-height: 1.4;
}

.section {
  padding: 72px 0;
}

.section-muted {
  background: #eef2f7;
}

.section-heading {
  max-width: 720px;
  margin-bottom: 36px;
}

.section-kicker {
  margin: 0 0 10px;
  color: var(--primary);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-heading h2 {
  margin: 0 0 12px;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.section-copy {
  margin: 0;
  color: var(--muted);
  font-size: 1.05rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.feature-card {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.feature-card h3 {
  margin: 0 0 10px;
  font-size: 1.125rem;
}

.feature-card p {
  margin: 0;
  color: var(--muted);
}

.steps {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  align-items: start;
  padding: 20px 22px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.step-number {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 800;
}

.steps h3 {
  margin: 0 0 6px;
  font-size: 1.05rem;
}

.steps p {
  margin: 0;
  color: var(--muted);
}

.cta-band {
  padding-top: 48px;
}

.cta-band-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 32px;
  border-radius: 20px;
  border: 1px solid #c9dff0;
  background: linear-gradient(135deg, #ffffff 0%, #e8f2fa 100%);
}

.cta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.site-footer {
  padding: 32px 0 40px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.footer-inner {
  display: grid;
  gap: 16px;
}

.footer-brand {
  margin: 0;
  font-weight: 800;
}

.footer-copy {
  margin: 4px 0 0;
  color: var(--muted);
}

.footer-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--primary);
  font-weight: 600;
}

.footer-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.875rem;
}

@media (max-width: 900px) {
  .hero-grid,
  .feature-grid,
  .cta-band-inner {
    grid-template-columns: 1fr;
    display: grid;
  }

  .cta-band-inner {
    align-items: start;
  }
}

@media (max-width: 640px) {
  .container { padding-inline: 16px; }
  .hero { padding: 56px 0 64px; }
  .section { padding: 56px 0; }
  .header-nav .btn-ghost { display: none; }
  .cta-band-inner { padding: 24px; }
}
`;
