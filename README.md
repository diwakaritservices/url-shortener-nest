# moklay

moklay is a full-stack URL shortener with email/password auth, Cloudflare Turnstile verification, user-owned links, archive support, duplicate URL detection, and a Docker/Nginx hosting setup.

## Stack

- Monorepo: Turborepo with npm workspaces
- Shared types: `@url-shortener/shared`
- Backend: NestJS 11, TypeScript, MongoDB, Mongoose, JWT auth, Helmet, Nest throttling
- Frontend: React 19, Vite, TypeScript, Material UI
- Infrastructure: Docker Compose, Nginx, MongoDB, Redis
- Registry: GitHub Container Registry via GitHub Actions

## Repository Layout

```txt
.
+-- apps/
|   +-- backend/             # NestJS API (@url-shortener/backend)
|   `-- frontend/            # React app served by Nginx in Docker
+-- packages/
|   `-- shared/              # Shared API types (@url-shortener/shared)
+-- docker-compose.dev.yml   # Local stack: frontend, backend, MongoDB, Redis
+-- docker-compose.prod.yml  # Production stack using GHCR images
+-- turbo.json               # Turborepo task pipeline
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
- Shared TypeScript contracts between backend and frontend via `@url-shortener/shared`.

## Local Development

Start MongoDB and Redis from the repo root. The dev compose file exposes MongoDB on `27017` and Redis on `8765` for host-based app development.

```bash
docker compose -f docker-compose.dev.yml up -d url-shortener-mongodb url-shortener-redis
```

Copy local env templates if you have not already:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Install dependencies from the repo root:

```bash
npm install
```

Run both apps in dev mode (builds shared types first):

```bash
npm run dev
```

Or run individual workspaces:

```bash
npm run dev --workspace=@url-shortener/backend
npm run dev --workspace=@url-shortener/frontend
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- MongoDB: `mongodb://localhost:27017/url-shortener`
- Redis: `redis://localhost:8765`

## Local Docker Stack

For local image builds of the full stack, use `docker-compose.dev.yml`.

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
BACKEND_IMAGE=ghcr.io/abhidiwakar/url-shortener-nest-backend:latest
FRONTEND_IMAGE=ghcr.io/abhidiwakar/url-shortener-nest-frontend:latest
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
TURNSTILE_SITE_KEY=your-cloudflare-turnstile-site-key
TURNSTILE_SECRET_KEY=your-cloudflare-turnstile-secret-key
TRUST_PROXY=1
```

Run the stack:

```bash
docker compose --env-file .env.docker -f docker-compose.dev.yml up -d --build
```

For production servers using GHCR images, use `docker-compose.prod.yml` instead:

```bash
docker compose --env-file .env.docker -f docker-compose.prod.yml pull
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d
```

To pin a specific image published by GitHub Actions, set image tags in `.env.docker`:

```env
BACKEND_IMAGE=ghcr.io/abhidiwakar/url-shortener-nest-backend:sha-956438e
FRONTEND_IMAGE=ghcr.io/abhidiwakar/url-shortener-nest-frontend:sha-956438e
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

Root (all workspaces):

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

Backend:

```bash
npm run build --workspace=@url-shortener/backend
npm test --workspace=@url-shortener/backend -- --watchman=false
npm run test:e2e --workspace=@url-shortener/backend -- --watchman=false --runInBand
```

Frontend:

```bash
npm run lint --workspace=@url-shortener/frontend
npm run build --workspace=@url-shortener/frontend
```

Docker:

```bash
docker compose --env-file .env.docker.example -f docker-compose.dev.yml build url-shortener-backend url-shortener-frontend
docker compose --env-file .env.docker.example -f docker-compose.dev.yml up -d
docker compose --env-file .env.docker.example -f docker-compose.dev.yml ps
docker compose --env-file .env.docker.example -f docker-compose.prod.yml config
```

## Production Notes

- Use real Cloudflare Turnstile keys in production.
- Do not deploy with the dummy Turnstile test keys from local examples.
- Use a long, random `JWT_SECRET`.
- The compound unique MongoDB index on `{ ownerId, fullUrl }` requires existing duplicate data to be cleaned before deployment.
- The current duplicate URL check is an exact stored string match. URL canonicalization is not applied.
- Public short-link redirects use Redis as a cache and fall back to MongoDB if Redis is unavailable.
- Short-link cache entries use sliding expiration. The default TTL is 12 hours of inactivity.
