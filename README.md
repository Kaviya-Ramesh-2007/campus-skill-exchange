# Campus Skill Exchange

**Learn. Teach. Exchange. Grow.**

Campus Skill Exchange is a planned peer-to-peer skill exchange platform for students and users. The repository currently contains the Foundation only: application shells, infrastructure contracts, database migration infrastructure, a minimal outbox table, accessible UI primitives, tests, CI, and documentation.

No product feature or external provider integration is implemented yet.

## Architecture summary

- TypeScript monorepo using npm workspaces
- Next.js web application
- NestJS modular API with Fastify
- PostgreSQL with Prisma migrations
- Shared API/error/pagination/event contracts
- Transactional outbox foundation
- OIDC-first authentication interfaces without login implementation
- One `User` identity with only `USER` and `ADMIN` system authorization roles

## Repository structure

```text
apps/
  api/       NestJS API foundation
  web/       Next.js web foundation
packages/
  config/    Shared configuration primitives
  contracts/ Shared schemas and transport contracts
  ui/        Accessible design-system primitives
database/
  prisma/    Prisma schema and migrations
docs/        Project and architecture documentation
 tests/      Reserved for cross-package foundation tests
```

## Requirements

- Node.js 24 LTS or a compatible supported Node 24 release
- npm 11 or compatible
- PostgreSQL for database commands and readiness checks

The current development environment has Node.js and npm but did not initially have Git, PostgreSQL, or Docker. Install or provision those tools before running database workflows.

## Local setup

```bash
npm install
copy .env.example .env
```

Update `.env` with local PostgreSQL credentials. Never commit `.env`.

Start the application shells after dependencies are installed:

```bash
npm run dev
```

The web shell runs at `http://localhost:3000`. The API runs at `http://localhost:3001`.

## Commands

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run db:validate
npm run db:generate
npm run db:deploy
```

Use `npm run db:migrate` only for reviewed development migrations. Use `npm run db:reset` only against a disposable development database.

## Health endpoints

- `GET /api/v1/health` checks API process liveness.
- `GET /api/v1/ready` checks PostgreSQL readiness.
- `GET /api/docs` exposes Foundation API documentation.

## Documentation

- [AGENTS.md](./AGENTS.md)
- [PROJECT_CONTRACT.md](./PROJECT_CONTRACT.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE.md](./DATABASE.md)
- [API_CONTRACT.md](./API_CONTRACT.md)
- [MODULE_BOUNDARIES.md](./MODULE_BOUNDARIES.md)
- [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md)
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
- [Architecture decisions](./docs/adr/)

## Git workflow

`main` is stable, `develop` is the integration branch, and feature work uses focused branches such as `feature/AUTH-01`. Open a pull request into `develop` after tests and documentation pass.

## Current boundary

The following are intentionally absent: authentication flows, profiles, skills, goals, availability, certifications, projects, discovery, matching, exchanges, requests, sessions, meetings, ratings, assessments, badges, reputation, payments, transactions, notifications, dashboards, admin workflows, reports, analytics, and AI.
