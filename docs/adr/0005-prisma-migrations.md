# ADR 0005: Use Prisma with reviewed migrations

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

The team needs typed database access and a repeatable migration workflow. Foundation must not create speculative product tables.

## Decision

Use Prisma 6.12.0 for the initial foundation. Keep the schema in `database/prisma/schema.prisma`, commit generated migration SQL, and use reviewed `migrate dev`/`migrate deploy` workflows. Use explicit SQL migrations when Prisma cannot express a database constraint clearly.

The Prisma version is pinned deliberately for the stable classic generator and migration workflow available at Foundation, and the current CLI dependency audit does not report the high-severity issue present in newer 6.x CLI releases. Upgrading to a newer major requires an ADR and migration rehearsal.

## Consequences

- Developers get a typed client and readable schema.
- Database-specific constraints may require SQL migration steps.
- `db push` is prohibited for shared environments.
- Product tables will be added incrementally by feature prompts.
