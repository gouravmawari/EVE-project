# Docker Compose setup

This guide runs the NestJS API and PostgreSQL stack with Docker Compose on Windows.

## Prerequisite

Install and start [Docker Desktop](https://www.docker.com/products/docker-desktop/). Confirm Docker is available in PowerShell:

```powershell
docker --version
docker compose version
```

## Open the project

Clone the repository, or open an existing checkout, then enter the project folder:

```powershell
git clone <repository-url>
Set-Location .\my-nest-project
```

If the project is already cloned, use `Set-Location` with its actual path instead.

## Create the Docker environment file

Copy the example file and open the copy:

```powershell
Copy-Item .\docker.env.example .\.env.docker
notepad .\.env.docker
```

Set the required values. These are safe local examples only; replace the secret values with your own:

```dotenv
POSTGRES_USER=diagnostics_app
POSTGRES_PASSWORD=LocalDbPassword_2026
POSTGRES_DB=diagnostics
API_PORT=3001
JWT_SECRET=local-jwt-secret-change-me-123456
WEBHOOK_SECRET=local-webhook-secret-change-me-123456
```

`POSTGRES_PASSWORD` is inserted directly into the database URL. Use only URL-safe characters matching `[A-Za-z0-9._~-]`; do not use `@`, `:`, `/`, `?`, `#`, `%`, or spaces.

Leave `ADMIN_EMAIL` and `ADMIN_PASSWORD` blank to skip admin seeding. To seed an admin, set both values; setting only one makes the API container stop.

## Start the stack

From the repository root, run:

```powershell
docker compose --env-file .env.docker up --build
```

The API waits for PostgreSQL, applies migrations, optionally seeds the admin, and then starts. Open:

```text
http://localhost:3001/health
```

The expected response is a successful health response such as `{ "status": "ok" }`.

## Check status and logs

Run these commands from the repository root:

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f api
docker compose --env-file .env.docker logs -f postgres
```

Press `Ctrl+C` to stop following logs.

## Stop and preserve the database

Stop and remove the containers while keeping PostgreSQL data:

```powershell
docker compose --env-file .env.docker down
```

The named `postgres_data` volume persists across `down`, container recreation, and API restarts. To delete the containers **and all local database data**, use:

```powershell
docker compose --env-file .env.docker down -v
```

Use `down -v` only when permanent data deletion is intended.

## Restart or rebuild

Restart the API without rebuilding:

```powershell
docker compose --env-file .env.docker restart api
```

Rebuild and recreate the stack after code or dependency changes:

```powershell
docker compose --env-file .env.docker up --build
```

## Change the API port

Edit `API_PORT` in `.env.docker`, for example:

```dotenv
API_PORT=3002
```

Recreate the stack:

```powershell
docker compose --env-file .env.docker up --build
```

The API will then be available at `http://localhost:3002/health`. The container still listens on port `3000` internally.

## Troubleshooting

- **Docker is unavailable:** Start Docker Desktop and confirm `docker compose version` works. Retry the start command.
- **Port conflict:** Change `API_PORT` to an unused host port, then run `docker compose --env-file .env.docker up --build` again. The PostgreSQL container is not published to a host port.
- **A container stops or health checks fail:** Inspect its logs and status:

  ```powershell
  docker compose --env-file .env.docker ps
  docker compose --env-file .env.docker logs api
  docker compose --env-file .env.docker logs postgres
  ```

- **Environment-file errors:** Run Compose with `--env-file .env.docker` exactly as shown and verify all required values are present. Do not use unsupported characters in `POSTGRES_PASSWORD`.

## Security

`.env.docker` contains local database credentials and application secrets. Never commit it, paste real secrets into documentation, or share it publicly. Keep it local and replace the example secret values before using the stack.
