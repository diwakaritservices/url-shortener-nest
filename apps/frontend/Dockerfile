FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS prepare
COPY . .
RUN npx --yes turbo@2.5.4 prune @url-shortener/frontend --docker

FROM base AS deps
ENV NODE_ENV=development
COPY --from=prepare /app/out/json/ .
RUN npm ci --include=optional \
  && npm install vite@6.3.5 @vitejs/plugin-react@4.7.0 --workspace=@url-shortener/frontend

FROM base AS build
ENV NODE_ENV=development
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/full/ .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
ARG VITE_API_URL=/api
ARG VITE_PUBLIC_BASE_URL
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_BASE_URL=$VITE_PUBLIC_BASE_URL
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN ./node_modules/.bin/turbo run build --filter=@url-shortener/frontend

FROM nginx:latest AS runtime
COPY --from=build /app/apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
