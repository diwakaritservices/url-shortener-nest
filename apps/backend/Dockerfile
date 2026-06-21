FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS prepare
COPY . .
RUN npx --yes turbo@2.5.4 prune @url-shortener/backend --docker

FROM base AS deps
ENV NODE_ENV=development
COPY --from=prepare /app/out/json/ .
RUN npm ci --include=optional

FROM base AS build
ENV NODE_ENV=development
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/full/ .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
RUN ./node_modules/.bin/turbo run build --filter=@url-shortener/backend

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
WORKDIR /app/apps/backend
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
