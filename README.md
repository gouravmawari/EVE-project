# Diagnostic Booking API

## Project overview

This is a NestJS/TypeScript API for diagnostic centres, diagnostic tests, authenticated bookings, and payment state changes. PostgreSQL is accessed through Prisma. Users can sign up and log in with JWTs; only admins can manage the catalogue.

The supported endpoint contract is in the [API reference](API.md). Legacy `/users` scaffold routes are intentionally unsupported and excluded.

## Prerequisites

- Node.js and npm
- Docker (for local PostgreSQL)
- PostgreSQL reachable through `DATABASE_URL`
- A shell capable of running the commands below

## Local setup

Start a local PostgreSQL container:

```bash
docker run --name diagnostic-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=local-postgres-password \
  -e POSTGRES_DB=diagnostics \
  -p 5432:5432 -d postgres:16
```

Create `.env` in the repository root. Use your own long random values for secrets; the values below are placeholders:

```dotenv
DATABASE_URL="postgresql://postgres:local-postgres-password@localhost:5432/diagnostics"
JWT_SECRET="<long-random-jwt-secret>"
WEBHOOK_SECRET="<long-random-webhook-secret>"
PORT=3000
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
ADMIN_EMAIL="<admin-email>"
ADMIN_PASSWORD="<admin-password>"
```

`.env` is local configuration and must not be committed.

## Install, generate, migrate, seed, and run

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

`prisma:seed` creates or promotes an admin only when both `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set. Omit them to skip admin creation. Other run options are `npm run start` and `npm run start:prod` after `npm run build`.

## Docker Compose local stack

Docker Compose runs the API and PostgreSQL on an internal network. PostgreSQL is not published to a host port; the API is available at `http://localhost:3001` by default.

Create the explicitly named Compose environment file and replace its placeholders with local values. Keep `POSTGRES_PASSWORD` URL-safe and unencoded because Compose constructs `DATABASE_URL` by concatenating these fields: use only `[A-Za-z0-9._~-]`, with no `@`, `:`, `/`, `?`, `#`, `%`, or spaces.

```bash
cp docker.env.example .env.docker
docker compose --env-file .env.docker up --build
```

The API waits for PostgreSQL health, applies migrations, optionally runs the idempotent admin seed, and then starts. Leave both admin variables blank to skip seeding; setting only one makes startup fail clearly. See [DOCKER_SETUP.md](DOCKER_SETUP.md) for the complete Windows setup and troubleshooting guide.

Common operations:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f api
docker compose --env-file .env.docker restart api
docker compose --env-file .env.docker down
```

The named PostgreSQL volume survives `docker compose down`, container recreation, and API restarts. `docker compose down -v` is destructive: it removes the database volume and all local database data. Do not use it unless permanent local data deletion is intended.

## Environment variables

| Variable         | Required | Purpose                                                           |
| ---------------- | -------- | ----------------------------------------------------------------- |
| `DATABASE_URL`   | Yes      | PostgreSQL connection string.                                     |
| `JWT_SECRET`     | Yes      | Signs login access tokens; at least 16 characters.                |
| `WEBHOOK_SECRET` | Yes      | Verifies payment webhook HMAC signatures; at least 16 characters. |
| `PORT`           | No       | HTTP port; defaults to `3000`.                                    |
| `THROTTLE_TTL`   | No       | Throttling window in milliseconds; defaults to `60000`.           |
| `THROTTLE_LIMIT` | No       | Requests allowed per throttling window; defaults to `100`.        |
| `ADMIN_EMAIL`    | No       | Seed admin email; used only with `ADMIN_PASSWORD`.                |
| `ADMIN_PASSWORD` | No       | Seed admin password; used only with `ADMIN_EMAIL`.                |

## Testing commands and current limitations

```bash
npm test
npm test -- --runInBand
npm run test:cov
npm run test:e2e
npm run test:e2e -- --runInBand
npm run build
npm run lint
```

Unit tests are database-independent and use mocks where applicable. The e2e suite is skipped when `DATABASE_URL` is absent; when enabled it needs reachable PostgreSQL with generated and migrated Prisma schema plus the required secrets.

Current limitations include incomplete endpoint e2e coverage, process-local distributed rate limiting, a simplified payment simulation rather than a real provider integration, and no catalogue filtering/sorting, API documentation generation, or production deployment configuration. PostgreSQL migrations are applied forward-only; enum changes may require backup/restore or a separately planned corrective migration.
