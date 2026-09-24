# Architecture

## System shape

Campus Skill Exchange is a modular monolith in one repository:

- `apps/web`: Next.js App Router frontend.
- `apps/api`: NestJS REST API using Fastify.
- `database`: Prisma schema, migrations, and database client package.
- `packages/contracts`: shared schemas and transport types.
- `packages/ui`: accessible UI primitives and design tokens.
- `packages/config`: small shared runtime constants and configuration types.

The web and API are separate deployable processes, but the backend is one modular application. Product modules are not independently deployable services at Foundation.

## Runtime topology

```text
Browser
   |
   | same-origin /api/v1
   v
Next.js web application
   |
   v
NestJS modular API
   |          |              |                 |
   v          v              v                 v
PostgreSQL  Outbox table   Object storage   Provider adapters
                                             OIDC, email, Meet,
                                             payments, AI
```

The Next.js development server rewrites `/api/v1/*` to the API origin. This keeps browser requests same-origin and avoids credentialed wildcard CORS.

## Dependency direction

- Web depends on contracts, UI, and its own configuration.
- API depends on contracts, configuration, database, and infrastructure modules.
- Database does not depend on web or API business modules.
- Shared contracts contain transport and infrastructure concepts, not product domain tables.
- Future domain modules communicate through public application services or events.
- No module imports another module's repository or Prisma model.

## One-User rule

Every participant is a `User`. The system has only `USER` and `ADMIN` authorization roles initially. Session participation, teaching intent, learning goals, assessments, payments, and other activities are contextual relationships or capabilities, not participant identities.

## Event foundation

A future business transaction will write its domain change and an `outbox_events` record in one PostgreSQL transaction. A future dispatcher will publish the event to notification, analytics, badge, reputation, and audit consumers. Consumers must be idempotent.

The Foundation does not implement a dispatcher, queue, or business event catalog.

## External integrations

OIDC, storage, email, meeting, payment, and AI providers are represented by interfaces or boundaries. Prompt 1 implements only the local password credential path; no external identity provider is connected or simulated. Secrets remain server-side.

## Authentication boundary

The auth module owns the internal `User`, local `AuthIdentity`, `PasswordCredential`, and revocable `Session` records. The browser receives an opaque HttpOnly cookie containing a random token; PostgreSQL stores only its hash. Future OIDC adapters map provider subjects to `AuthIdentity` without changing the internal User domain.

## Deployment direction

Development uses npm workspaces, TypeScript builds, and PostgreSQL. A local PostgreSQL installation or Docker/managed PostgreSQL may be used. Deployment automation is not part of Foundation.

## Architectural decisions

See `docs/adr/` for the rationale behind the major decisions. Architecture changes require an ADR and documentation update.
