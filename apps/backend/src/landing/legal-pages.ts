export interface LegalPageContext {
  siteUrl: string;
  productName: string;
  contactEmail: string;
  year: number;
}

export function renderPrivacyPage(context: LegalPageContext): string {
  const { siteUrl, productName, contactEmail, year } = context;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — ${productName}</title>
  <meta name="description" content="Privacy policy for ${productName}, including data collection, retention, and your rights." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${siteUrl}/privacy" />
  <style>${LEGAL_STYLES}</style>
</head>
<body>
  <header class="legal-header">
    <div class="container">
      <a class="brand" href="${siteUrl}">${productName}</a>
    </div>
  </header>
  <main class="container legal-main">
    <h1>Privacy Policy</h1>
    <p class="legal-updated">Last updated: June 2026</p>

    <section>
      <h2>Who we are</h2>
      <p>${productName} is operated by Diwakar IT. For privacy requests, contact us at <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>
    </section>

    <section>
      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account data:</strong> email address, display name, and password hash when you register.</li>
        <li><strong>Link data:</strong> original URLs, custom short IDs, archive state, and timestamps for links you create.</li>
        <li><strong>API key metadata:</strong> key names, prefixes, creation and last-used timestamps. Full API secrets are shown only once at creation.</li>
        <li><strong>Security and abuse prevention:</strong> Cloudflare Turnstile tokens during signup and login, plus rate-limiting metadata.</li>
        <li><strong>Technical data:</strong> standard web server logs and Cloudflare edge analytics as configured for the site.</li>
      </ul>
    </section>

    <section>
      <h2>Why we use this data</h2>
      <ul>
        <li>Provide and secure your account, links, and API access.</li>
        <li>Send email verification codes when email verification is enabled.</li>
        <li>Prevent abuse, fraud, and unauthorized access.</li>
        <li>Operate, maintain, and improve the service.</li>
      </ul>
    </section>

    <section>
      <h2>Processors and third parties</h2>
      <p>We use Cloudflare for CDN, TLS, Turnstile bot protection, and optional web analytics. Email delivery may use Gmail SMTP or another configured provider when verification emails are enabled.</p>
    </section>

    <section>
      <h2>Retention</h2>
      <p>Account and link data are kept while your account is active. When you delete your account, associated links and API keys are removed from our primary database. Backups may retain data for a limited period before rotation.</p>
    </section>

    <section>
      <h2>Your rights and choices</h2>
      <ul>
        <li>Export your profile and links from the Profile page or via <code>GET /api/auth/me/export</code>.</li>
        <li>Delete your account from the Profile page or via <code>DELETE /api/auth/me</code>.</li>
        <li>Contact <a href="mailto:${contactEmail}">${contactEmail}</a> for access, correction, or other privacy requests.</li>
      </ul>
      <p>Depending on your location, you may have additional rights under applicable privacy laws. We will respond to verified requests within a reasonable timeframe.</p>
    </section>

    <section>
      <h2>Cookies and similar technologies</h2>
      <p>We use an HttpOnly session cookie to keep you signed in. Cloudflare Turnstile may set cookies or use browser storage during human verification. See Cloudflare’s privacy documentation for details on their services.</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Privacy questions or requests: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
    </section>
  </main>
  <footer class="legal-footer">
    <div class="container">
      <p>© ${year} ${productName}. <a href="${siteUrl}/terms">Terms</a> · <a href="${siteUrl}/privacy">Privacy</a></p>
    </div>
  </footer>
</body>
</html>`;
}

export function renderTermsPage(context: LegalPageContext): string {
  const { siteUrl, productName, contactEmail, year } = context;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service — ${productName}</title>
  <meta name="description" content="Terms of service and acceptable use for ${productName}." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${siteUrl}/terms" />
  <style>${LEGAL_STYLES}</style>
</head>
<body>
  <header class="legal-header">
    <div class="container">
      <a class="brand" href="${siteUrl}">${productName}</a>
    </div>
  </header>
  <main class="container legal-main">
    <h1>Terms of Service</h1>
    <p class="legal-updated">Last updated: June 2026</p>

    <section>
      <h2>Agreement</h2>
      <p>By creating an account or using ${productName}, you agree to these terms and our <a href="${siteUrl}/privacy">Privacy Policy</a>.</p>
    </section>

    <section>
      <h2>Service description</h2>
      <p>${productName} provides URL shortening, link management, and an integration API. Features may change as the product evolves.</p>
    </section>

    <section>
      <h2>Acceptable use</h2>
      <p>You must not use ${productName} to distribute malware, phishing, illegal content, spam, or to interfere with the service or other users. We may suspend or terminate accounts that violate these rules or pose a security risk.</p>
    </section>

    <section>
      <h2>Accounts and security</h2>
      <p>You are responsible for safeguarding your credentials and API keys. Notify us promptly at <a href="mailto:${contactEmail}">${contactEmail}</a> if you suspect unauthorized access.</p>
    </section>

    <section>
      <h2>Availability and liability</h2>
      <p>The service is provided on an “as is” basis without warranties of uninterrupted availability. To the extent permitted by law, we are not liable for indirect or consequential damages arising from use of the service.</p>
    </section>

    <section>
      <h2>Termination</h2>
      <p>You may delete your account at any time from the Profile page. We may suspend or terminate access for violations of these terms or to protect the service.</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Questions about these terms: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
    </section>
  </main>
  <footer class="legal-footer">
    <div class="container">
      <p>© ${year} ${productName}. <a href="${siteUrl}/terms">Terms</a> · <a href="${siteUrl}/privacy">Privacy</a></p>
    </div>
  </footer>
</body>
</html>`;
}

export function renderNotFoundPage(context: LegalPageContext): string {
  const { siteUrl, productName } = context;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Not Found — ${productName}</title>
  <meta name="robots" content="noindex" />
  <style>${LEGAL_STYLES}</style>
</head>
<body>
  <main class="container legal-main not-found-main">
    <h1>Link not found</h1>
    <p>This short link does not exist, has been removed, or is no longer active.</p>
    <p><a class="btn" href="${siteUrl}/login">Go to ${productName}</a></p>
  </main>
</body>
</html>`;
}

export function renderSecurityTxt(
  siteUrl: string,
  contactEmail: string,
): string {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  const expiresDate = expires.toISOString().slice(0, 10);

  return `Contact: mailto:${contactEmail}
Expires: ${expiresDate}T23:59:59.000Z
Preferred-Languages: en
Canonical: ${siteUrl}/.well-known/security.txt
Policy: ${siteUrl}/terms
`;
}

const LEGAL_STYLES = `
:root {
  --text: #0f172a;
  --muted: #64748b;
  --primary: #1769aa;
  --border: #e2e8f0;
  --bg: #f8fafc;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
  line-height: 1.6;
}
.container { width: min(100%, 760px); margin: 0 auto; padding: 0 24px; }
.legal-header, .legal-footer {
  background: #fff;
  border-bottom: 1px solid var(--border);
}
.legal-footer { border-top: 1px solid var(--border); border-bottom: 0; margin-top: 48px; }
.legal-header .container, .legal-footer .container { padding-top: 16px; padding-bottom: 16px; }
.brand { color: var(--primary); font-weight: 800; text-decoration: none; }
.legal-main { padding: 40px 24px 56px; }
.legal-main h1 { margin-top: 0; font-size: 2rem; }
.legal-main h2 { margin-top: 32px; font-size: 1.25rem; }
.legal-updated { color: var(--muted); }
.legal-main a { color: var(--primary); }
.not-found-main { text-align: center; padding-top: 80px; }
.btn {
  display: inline-block;
  margin-top: 16px;
  padding: 12px 20px;
  border-radius: 10px;
  background: var(--primary);
  color: #fff !important;
  text-decoration: none;
  font-weight: 600;
}
`;
