# Backend

NestJS API for Linkable. It handles authentication, Turnstile verification, user-owned short links, duplicate URL detection, redirects, and archive state.

## Stack

- NestJS 11
- TypeScript
- MongoDB with Mongoose
- JWT authentication
- Cloudflare Turnstile server-side verification
- Helmet
- NestJS throttling
- Nano ID for generated short IDs

## Setup

Install dependencies:

```bash
npm install
```

Start local MongoDB and Redis from the repo root:

```bash
docker compose -f docker-compose.dev.yml up -d mongodb redis
```

Create `apps/backend/.env` for local development:

```bash
cp apps/backend/.env.example apps/backend/.env
```

```env
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/url-shortener
REDIS_URL=redis://localhost:8765
SHORT_URL_CACHE_TTL_SECONDS=43200
JWT_SECRET=local-development-secret
JWT_EXPIRES_IN=1d
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
TRUST_PROXY=loopback
```

Run the API:

```bash
npm run dev --workspace=@url-shortener/backend
```

The API listens on `http://localhost:3000` by default.

## Environment Variables

| Name                          | Required   | Description                                                                                        |
| ----------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                    | No         | Use `production` for production-only checks.                                                       |
| `PORT`                        | No         | API port. Defaults to `3000`.                                                                      |
| `MONGODB_URI`                 | Production | MongoDB connection URI. Required when `NODE_ENV=production`.                                       |
| `REDIS_URL`                   | No         | Redis connection URI for public short-link redirect caching. Defaults to `redis://localhost:8765`. |
| `SHORT_URL_CACHE_TTL_SECONDS` | No         | Sliding TTL for cached short-link redirects. Defaults to `43200` seconds.                          |
| `JWT_SECRET`                  | Production | Secret used to sign access tokens. Required when `NODE_ENV=production`.                            |
| `JWT_EXPIRES_IN`              | No         | JWT lifetime. Defaults to `1d`.                                                                    |
| `FRONTEND_ORIGINS`            | Production | Comma-separated allowed CORS origins.                                                              |
| `TURNSTILE_SECRET_KEY`        | Production | Cloudflare Turnstile secret key. Required when `NODE_ENV=production`.                              |
| `TURNSTILE_SKIP_VERIFY`       | No         | Set to `true` only outside production to bypass Turnstile verification.                            |
| `TRUST_PROXY`                 | No         | Express trust proxy setting. Use `1` behind the frontend Nginx container.                          |

## API Overview

Auth:

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

URL management, all authenticated with `Authorization: Bearer <token>`:

- `POST /urls`
- `GET /urls`
- `GET /urls?archived=true`
- `GET /urls/:shortId`
- `DELETE /urls/:shortId`
- `PATCH /urls/:shortId/archive`
- `PATCH /urls/:shortId/unarchive`

Public redirect:

- `GET /:shortId`

The public redirect returns a `302` by default. If the request includes `Accept: application/json` or `Content-Type: application/json`, it returns JSON containing the destination URL instead.

Public redirect lookups use Redis as a cache. Cache keys are `short-url:<shortId>`, values contain only the destination `fullUrl`, and cache hits refresh the TTL back to `SHORT_URL_CACHE_TTL_SECONDS`.

## URL Creation Rules

- Generated short IDs are 10-character Base62 strings produced with Nano ID.
- Custom short IDs must match `^[a-zA-Z0-9_-]{3,64}$`.
- `shortId` is globally unique.
- `{ ownerId, fullUrl }` is unique, so the same user cannot shorten the exact same URL twice.
- Duplicate URL attempts return `409 Conflict` and include the existing shortened URL in `existingUrl`.

## Database Indexes

The `ShortUrl` collection uses:

- unique `shortId`
- `{ ownerId: 1, createdAt: -1 }`
- `{ ownerId: 1, archivedAt: 1 }`
- unique `{ ownerId: 1, fullUrl: 1 }`

Before deploying the unique `{ ownerId, fullUrl }` index to an existing database, clean any duplicate rows for the same owner and full URL.

## Commands

```bash
# development
npm run start:dev

# production build
npm run build
npm run start:prod

# lint
npx eslint "{src,apps,libs,test}/**/*.ts"

# unit tests
npm test -- --watchman=false

# e2e tests
npm run test:e2e -- --watchman=false --runInBand

# production dependency audit
npm audit --omit=dev
```

The e2e suite expects MongoDB on `localhost:27017`. It creates an isolated test database named with the current process id.

## Docker

Build the backend image from the repository root:

```bash
docker compose --env-file .env.docker.example -f docker-compose.dev.yml build backend
```

The runtime image starts:

```bash
node dist/main
```

Do not bake runtime secrets into the image. Supply `JWT_SECRET`, `TURNSTILE_SECRET_KEY`, and `MONGODB_URI` through the deployment environment or Compose env file.
