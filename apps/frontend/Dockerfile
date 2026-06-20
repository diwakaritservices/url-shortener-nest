FROM node:24-alpine AS build

WORKDIR /app

ARG VITE_API_URL=/api
ARG VITE_PUBLIC_BASE_URL
ARG VITE_TURNSTILE_SITE_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_BASE_URL=$VITE_PUBLIC_BASE_URL
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:latest AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
