# Campus Skill Exchange Project Contract

## Product identity

**Campus Skill Exchange** is a peer-to-peer skill exchange platform for students and users.

**Tagline:** Learn. Teach. Exchange. Grow.

The platform is designed to support professional profiles, skills people can share, skills people want to learn, evidence, discovery, explainable matching, exchanges, requests, sessions, feedback, trust signals, optional commerce, notifications, administration, safety, and analytics.

## Architectural principles

- Start as a modular monolith, not microservices.
- Use TypeScript across web, API, contracts, and tooling.
- Use Next.js for the web application and NestJS for the API.
- Use PostgreSQL as the relational source of truth and Prisma for schema management.
- Keep domain modules explicit and independently testable.
- Use REST under `/api/v1` with shared validation, error, pagination, and authorization conventions.
- Use a transactional outbox for future event-driven consumers.
- Use provider abstractions for external services.
- Prefer explainable, evidence-based matching over opaque scores.
- Keep privacy, security, auditability, and accessibility part of the foundation.

## The One-User rule

> Every participant is a User. Teaching, learning, exchanging, hosting, attending, assessing, and receiving assessments are contextual activities of a User. They must not become permanent participant roles.

The database and API must not contain permanent `Teacher`, `Student`, `Mentor`, `Tutor`, `Instructor`, or `Learner` identities.

The only initial system authorization roles are:

- `USER`
- `ADMIN`

`ADMIN` is a system permission role, not a description of a participant's activity. Any future role requires an explicit architectural decision and migration plan.

Prompt 1 security rules:

- Local passwords use Argon2id and are never returned or logged.
- Authentication uses revocable opaque server-side sessions stored as token hashes.
- The server is authoritative for the current user ID.
- Public registration cannot assign `ADMIN`.
- OIDC remains a provider abstraction; no external provider is claimed as connected.

## Current scope

The Foundation established the following infrastructure, and Prompt 1 adds the narrowly scoped authentication/identity implementation:

- npm workspace structure;
- TypeScript, ESLint, Prettier, test, and build tooling;
- Next.js and NestJS application shells;
- shared contracts for errors, pagination, IDs, roles, and event envelopes;
- configuration validation and structured logging;
- health and readiness infrastructure;
- PostgreSQL/Prisma migration infrastructure;
- a minimal outbox table and the Prompt 1 identity/session tables;
- authentication and authorization interfaces, now extended by Prompt 1 with secure local registration, login, opaque server-side sessions, current-user retrieval, logout, and reusable role guards;
- accessible UI primitives and application route boundaries;
- tests, CI, Git workflow, and project documentation.

## Prohibited shortcuts

- No fake product data.
- No fake provider success responses.
- No secrets in source control or frontend bundles.
- No unvalidated status updates.
- No direct cross-module repository access.
- No production database schema for future product entities during Foundation.
- No feature implementation disguised as scaffolding.
- No arbitrary rewrites of working architecture.

## Quality expectations

Every feature must include appropriate tests, validation, error handling, accessibility considerations, security review, and documentation updates. Shared behavior changes require contract and migration review.

## Git workflow

`main` is stable. `develop` is the integration branch. Work is delivered through focused branches such as `feature/AUTH-01` and merged through reviewed pull requests. Feature branches must be based on the latest `develop`, tested, documented, and kept small.

## Change policy

Architecture changes require an ADR under `docs/adr/`, an updated affected document, and review from the team. A future coding agent must preserve valid existing work and make the smallest change that solves the assigned problem.
