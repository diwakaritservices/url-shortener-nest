# Frontend

React application for Linkable — register, log in, create short links, copy links, and manage active or archived links.

## Stack

- React 19
- Vite
- TypeScript
- Material UI
- React Router
- Cloudflare Turnstile widget

## Setup

Install dependencies:

```bash
npm install
```

Create `frontend/.env` for local development:

```env
VITE_API_URL=http://localhost:3000
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

Run the app:

```bash
npm run dev
```

The Vite dev server listens on `http://localhost:5173` by default.

## Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | No | API base URL. Local default is `http://localhost:3000`; Docker build uses `/api`. |
| `VITE_PUBLIC_BASE_URL` | No | Public base used when copying short links. In Docker, this should be the deployed app origin. |
| `VITE_TURNSTILE_SITE_KEY` | Yes | Cloudflare Turnstile public site key. This is safe to expose to the browser. |

Turnstile secret keys are backend runtime secrets and must not be added to frontend env files.

## Routes

- `/` redirects based on auth state.
- `/login` shows the login form.
- `/register` shows the registration form.
- `/my-links` shows the authenticated link dashboard.

Unknown frontend routes redirect to `/login`. In the hosted Docker setup, Nginx sends unknown root paths to the backend so public short-link redirects still work.

## Auth State

The frontend stores the JWT access token and user record in `localStorage`. Authenticated API calls include:

```txt
Authorization: Bearer <token>
```

If the user is already logged in, `/login` and `/register` redirect to `/my-links`.

## Link Dashboard Behavior

The dashboard supports:

- list active links
- list archived links
- create a new short link
- provide an optional custom short ID
- copy a public short link
- archive and unarchive links

If the backend returns a duplicate URL conflict with `existingUrl`, the create dialog shows the existing short link with a copy button.

## Commands

```bash
# development
npm run dev

# lint
npm run lint

# production build
npm run build

# local production preview
npm run preview
```

Vite may warn if local Node.js is below its preferred version. The Docker build uses Node 24.

## Docker and Nginx

The frontend Docker image builds the Vite app and serves it with Nginx.

Build from the repository root:

```bash
docker compose --env-file .env.docker.example -f docker-compose.dev.yml build frontend
```

In the hosted stack:

- React assets are served by Nginx.
- `/api/*` is proxied to the backend container.
- `/`, `/login`, `/register`, and `/my-links` serve `index.html`.
- Other root paths are proxied to the backend for short-link redirects.

Frontend Docker build args are wired from the root Compose file:

```txt
VITE_API_URL=/api
VITE_PUBLIC_BASE_URL=${PUBLIC_BASE_URL}
VITE_TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY}
```
