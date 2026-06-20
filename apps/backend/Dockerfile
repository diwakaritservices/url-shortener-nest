FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:24-alpine AS build

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node --from=build /app/package*.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main"]
