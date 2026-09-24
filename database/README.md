# Database package

This package owns the Prisma schema, migrations, and generated database client. It is backend-only.

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Client entry point: `src/index.ts`

The Foundation schema contains only the minimal `outbox_events` platform table. Product entities will be added by later feature prompts.
