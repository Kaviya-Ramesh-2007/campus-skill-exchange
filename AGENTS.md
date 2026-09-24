# AGENTS.md

## Mission

You are working on Campus Skill Exchange, a professional peer-to-peer skill exchange platform. Foundation is infrastructure only. Product features belong to their assigned future prompts.

## Required workflow

1. Inspect the repository and read this file before modifying anything.
2. Read the relevant documents in `docs/` and the package-local README/configuration.
3. Check Git status and preserve existing work.
4. Keep changes focused on the assigned task and module.
5. Add or update tests for behavior you change.
6. Update documentation when an architectural contract changes.
7. Run the relevant lint, typecheck, test, and build commands before reporting completion.

## Architecture rules

- Use the modular monolith. Do not introduce microservices, Kafka, RabbitMQ, Kubernetes, or service meshes without an approved architecture decision.
- Use one participant identity: `User`.
- The only initial system authorization roles are `USER` and `ADMIN`.
- Never introduce permanent `TEACHER`, `STUDENT`, `MENTOR`, `TUTOR`, `INSTRUCTOR`, or `LEARNER` identities.
- Teaching, learning, exchanging, hosting, attending, assessing, receiving assessments, paying, and receiving payment are contextual activities represented by relationships and capabilities.
- Keep future domain modules behind their owning module. Do not import another module's repository or Prisma model directly.
- Use PostgreSQL and reviewed Prisma migrations. Never use `prisma db push` for shared environments.
- Use the shared contracts and error/pagination conventions.
- Use the transactional outbox for future reliable event publication; do not build a queue system during Foundation.
- Use provider abstractions for OIDC, storage, meetings, payments, email, and AI. Never fake provider success.
- Never commit `.env`, secrets, API keys, tokens, passwords, or payment credentials.
- Do not add fake users, ratings, matches, sessions, payments, notifications, analytics, or certifications.
- Do not implement product features during Foundation.
- Reuse existing components, services, and contracts instead of creating duplicates.
- Do not rewrite working architecture unnecessarily.

## Shared-file caution

Treat these as high-risk shared files:

- root `package.json`, `package-lock.json`, and workspace configuration;
- TypeScript, ESLint, Prettier, and CI configuration;
- API bootstrap, global filters, validation, and guards;
- Prisma schema and migrations;
- shared contracts and generated API documentation;
- UI tokens, package exports, and root layouts;
- architecture and project-contract documents.

Keep shared changes small, review them explicitly, and communicate breaking changes before merging.

## Foundation boundary

The current Foundation may establish shells, contracts, infrastructure tables, health/readiness behavior, design primitives, tests, CI, and documentation. It must not add working product authentication, profiles, skills, matching, exchanges, requests, sessions, ratings, assessments, badges, reputation, payments, notifications, dashboards, admin workflows, reports, analytics, or AI.

## Completion checklist

- No secrets or fake data were introduced.
- The One-User rule remains intact.
- Tests cover real foundation behavior.
- Lint, typecheck, tests, and builds pass.
- Git status and changed files are reviewed.
- Documentation matches the implementation.
