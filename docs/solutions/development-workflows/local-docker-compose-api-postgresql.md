---
title: "Run the local API and PostgreSQL stack with Docker Compose"
date: 2026-10-02
category: development-workflows
module: "local development"
problem_type: workflow_pattern
component: docker-compose
applies_when:
  - "Running the API and PostgreSQL locally without exposing PostgreSQL on the host"
  - "Applying committed Prisma migrations to a persistent local Compose database"
tags:
  - docker
  - docker-compose
  - postgresql
  - prisma
  - local-development
---

# Run the local API and PostgreSQL stack with Docker Compose

## Context

The Compose stack runs the API with PostgreSQL on Docker's internal network. PostgreSQL is reached from the API as `postgres:5432`, not `localhost`, and only the API is published to the host at `http://localhost:3001` by default.

## Guidance

Create the ignored Compose-specific environment file from `docker.env.example`, then always pass it explicitly so Compose does not interpolate values from the root `.env`:

```bash
cp docker.env.example .env.docker
docker compose --env-file .env.docker up --build
```

`POSTGRES_PASSWORD` is concatenated directly into `DATABASE_URL`. Keep it unencoded and URL-safe: `[A-Za-z0-9._~-]` only. Do not use `@`, `:`, `/`, `?`, `#`, `%`, or spaces unless the connection-string construction is changed to encode credentials.

After PostgreSQL passes its health check, the API runs `prisma migrate deploy`, optionally seeds an admin, and starts. Leave both `ADMIN_EMAIL` and `ADMIN_PASSWORD` blank to skip seeding; provide both to seed or promote the admin. Supplying only one intentionally fails startup.

Use `docker compose --env-file .env.docker down` to stop the stack while keeping the named `postgres_data` volume. `down -v` removes that volume and permanently deletes the local database.

## Why This Matters

The explicit environment file prevents accidental reuse of standalone local settings, and the internal hostname keeps the database private to the Compose network. The persistent volume makes restarts and rebuilds safe, but means destructive cleanup must be deliberate.

## When to Apply

Use this workflow for local API and PostgreSQL development when the committed Prisma migrations should be applied automatically. Migrations are forward-only at startup; PostgreSQL enum additions cannot be safely rolled back in place. Recover with a backup/restore or a separately planned corrective migration rather than treating `migrate deploy` as reversible.

## Related

- `Dockerfile`
- `docker-compose.yml`
- `docker.env.example`
- `README.md`
