FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN ./node_modules/.bin/prisma generate && npm run build

FROM base AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
    && ./node_modules/.bin/prisma generate \
    && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
