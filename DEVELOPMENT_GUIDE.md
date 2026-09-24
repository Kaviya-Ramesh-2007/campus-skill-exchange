# Development Guide

## Prerequisites

Install:

- Node.js 24 (see `.nvmrc`)
- npm 11 or compatible
- Git
- PostgreSQL 14 or a compatible supported PostgreSQL release

Docker or a managed PostgreSQL service can be used instead of a local PostgreSQL installation. Do not substitute SQLite for the development database.

## Clone and install

```bash
git clone <repository-url>
cd campus-skill-exchange
npm install
```

For CI or a clean reproducible install, use `npm ci`.

## Configure the environment

```bash
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Set `DATABASE_URL` to a local PostgreSQL database. The values in `.env.example` are placeholders. Never commit `.env`.

## Database setup

Create a PostgreSQL database and user matching the connection string, then run:

```bash
npm run db:validate
npm run db:generate
npm run db:deploy
```

For a new reviewed development migration, use `npm run db:migrate`. `npm run db:reset` is destructive and is only for disposable local data.

## Start development servers

```bash
npm run dev
```

Or run separately:

```bash
npm run dev:api
npm run dev:web
```

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- API liveness: `http://localhost:3001/api/v1/health`
- API readiness: `http://localhost:3001/api/v1/ready`
- API documentation: `http://localhost:3001/api/docs`

The API can start without a reachable database so liveness remains useful. Readiness will return `503` until PostgreSQL responds.

## Authentication development

Prompt 1 uses local email/password authentication and an opaque server-side session cookie. Configure the session values in `.env`:

```text
AUTH_SESSION_TTL_SECONDS=2592000
AUTH_SESSION_COOKIE_NAME=cse_session
AUTH_SESSION_SAME_SITE=lax
```

The API must be reached through the same-origin web proxy for browser authentication. Passwords are never returned or logged. OIDC configuration remains deferred; do not add provider secrets or claim a provider is connected without a later implementation.

## Quality commands

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

`npm run format` rewrites files. Review the diff before committing.

## Testing expectations

- Contracts and pure infrastructure logic use unit tests.
- API tests use Nest testing utilities and an isolated database override where appropriate.
- Database migration validation uses a real PostgreSQL database in CI.
- Future feature branches must add tests for authorization, validation, state transitions, and eligibility.
- Prompt 28 expands integration testing; it is not a substitute for feature-level tests.

## Git workflow

1. Start from the latest `develop`.
2. Create a focused branch: `feature/<TASK-ID>-<short-name>`.
3. Implement only the assigned module or task.
4. Add tests and update documentation.
5. Run the relevant quality commands.
6. Commit with a clear message and task reference.
7. Push the branch.
8. Open a PR into `develop`.
9. Resolve review feedback and wait for CI.
10. Merge only after approval.

`main` is stable. Do not commit directly to `main` or `develop`.

## Shared-file caution

Root workspace configuration, lockfile, Prisma migrations, shared contracts, API bootstrap, UI tokens, and CI files affect the whole repository. Keep changes small and request review from the relevant maintainers.

## Troubleshooting

### PostgreSQL is unavailable

- Verify PostgreSQL is running.
- Check `DATABASE_URL` without sharing credentials.
- Run `npm run db:validate` to validate configuration/schema independently of connectivity.
- Use `GET /api/v1/ready` to inspect database readiness.

### Package install problems

- Confirm Node.js and npm versions.
- Remove only generated local dependency folders if necessary.
- Prefer `npm ci` for a clean lockfile-based install.
- Do not commit `node_modules`.

### Shared package changes

Shared packages are compiled before application builds. After changing `packages/contracts`, `packages/config`, or `packages/ui`, run `npm run build:packages` and restart the development processes if necessary.
