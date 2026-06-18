# URL Shortener

Full-stack URL shortener with email/password auth, Cloudflare Turnstile verification, user-owned links, archive support, duplicate URL detection, and a Docker/Nginx hosting setup.

## Stack

- Backend: NestJS 11, TypeScript, MongoDB, Mongoose, JWT auth, Helmet, Nest throttling
- Frontend: React 19, Vite, TypeScript, Material UI
- Infrastructure: Docker Compose, Nginx, MongoDB, Redis
- Registry: GitHub Container Registry via GitHub Actions

## Repository Layout

```txt
.
+-- backend/                 # NestJS API
+-- frontend/                # React app served by Nginx in Docker
+-- docker-compose.yml       # Hosted stack: frontend, backend, MongoDB, Redis
+-- .env.docker.example      # Deployment env template
`-- .github/workflows/       # Docker image publishing workflow
```

## Features

- Register and log in with email/password.
- Verify login/register with Cloudflare Turnstile.
- Create random 10-character Base62 short IDs using Nano ID.
- Optionally provide a custom short ID.
- List active and archived links per authenticated user.
- Archive and unarchive links.
- Prevent the same user from shortening the exact same URL twice.
- Return the existing short link on duplicate URL attempts.
- Public short-link redirects from `/<shortId>`.
- JSON response instead of redirect when `Accept` or `Content-Type` includes `application/json`.

## Local Development

Start MongoDB and Redis. The backend-local compose file exposes MongoDB on `27017` and Redis on `8765`.

```bash
cd backend
docker compose up -d
```

Install and run the backend:

```bash
cd backend
npm install
npm run start:dev
```

Install and run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- MongoDB: `mongodb://localhost:27017/url-shortener`

## Hosted Docker Stack

Copy the deployment env template:

```bash
cp .env.docker.example .env.docker
```

Update `.env.docker` with production values:

```env
WEB_PORT=8080
PUBLIC_BASE_URL=https://your-domain.com
FRONTEND_ORIGINS=https://your-domain.com
SHORT_URL_CACHE_TTL_SECONDS=43200
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
TURNSTILE_SITE_KEY=your-cloudflare-turnstile-site-key
TURNSTILE_SECRET_KEY=your-cloudflare-turnstile-secret-key
TRUST_PROXY=1
```

Run the stack:

```bash
docker compose --env-file .env.docker up -d --build
```

In this setup:

- Nginx is the only public HTTP service.
- `/api/*` proxies to the NestJS backend.
- `/`, `/login`, `/register`, and `/my-links` serve the React app.
- Other root paths are proxied to the backend for short-link redirects.
- MongoDB and Redis are internal Compose services.
- Redis caches public short-link redirect destinations as `short-url:<shortId>` values containing only the `fullUrl`.

## GitHub Container Registry

The GitHub Actions workflow publishes two images:

- `ghcr.io/abhidiwakar/url-shortener-nest-backend`
- `ghcr.io/abhidiwakar/url-shortener-nest-frontend`

The workflow builds on pull requests without pushing images. It pushes on `main`, version tags like `v1.2.3`, and manual dispatch.

GitHub repository variables used by the frontend image build:

- `PUBLIC_BASE_URL`
- `TURNSTILE_SITE_KEY`

Backend secrets such as `JWT_SECRET` and `TURNSTILE_SECRET_KEY` are runtime configuration and should be supplied on the deployment server, not baked into Docker images.

## Useful Commands

Backend:

```bash
cd backend
npm run build
npm test -- --watchman=false
npm run test:e2e -- --watchman=false --runInBand
npx eslint "{src,apps,libs,test}/**/*.ts"
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Docker:

```bash
docker compose --env-file .env.docker.example build backend frontend
docker compose --env-file .env.docker.example up -d
docker compose --env-file .env.docker.example ps
```

## Production Notes

- Use real Cloudflare Turnstile keys in production.
- Do not deploy with the dummy Turnstile test keys from local examples.
- Use a long, random `JWT_SECRET`.
- The compound unique MongoDB index on `{ ownerId, fullUrl }` requires existing duplicate data to be cleaned before deployment.
- The current duplicate URL check is an exact stored string match. URL canonicalization is not applied.
- Public short-link redirects use Redis as a cache and fall back to MongoDB if Redis is unavailable.
- Short-link cache entries use sliding expiration. The default TTL is 12 hours of inactivity.
