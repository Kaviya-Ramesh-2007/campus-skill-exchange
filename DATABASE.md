# Database Guide

## Current database foundation

PostgreSQL is the only supported relational database. The Foundation schema contained one product-independent platform table:

- `outbox_events`

Prompt 1 adds the minimum identity/session tables:

- `users`
- `user_roles`
- `auth_identities`
- `password_credentials`
- `sessions`

Prompt 2 adds the profile foundation table:

- `profiles`

Prompt 3 adds the skill catalog and user-skill association tables:

- `skills`
- `user_skills`

Prompt 4 adds the user-owned development and portfolio tables:

- `learning_goals`
- `availability`
- `certifications`
- `projects`

The Session Request data store adds:

- `session_requests`

The Session Core data store adds:

- `learning_sessions`

The Session Reminder data store adds:

- `session_reminders`

The Google integration adds:

- `google_connections`
- Google Calendar/Meet identifiers on `learning_sessions`

The Rating API adds:

- `ratings`

The Badge data store adds:

- `badge_definitions`
- `user_badges`

The Prisma schema is at `database/prisma/schema.prisma`. Foundation, identity, profile, skill, development, Session Request, Session Core, Session Reminder, Google integration, Rating, and Badge migrations are committed under `database/prisma/migrations/`; the Session Request migration is `20260929000000_session_request_foundation/migration.sql`, the Session Core migration is `20260930000000_learning_session_core/migration.sql`, the Session Reminder migration is `20260930010000_session_reminders/migration.sql`, the Google integration migration is `20260930020000_google_meet_integration/migration.sql`, the Rating migration is `20260930030000_rating_foundation/migration.sql`, and the Badge migration is `20260930040000_badge_data_store/migration.sql`.

The `sessions` table remains the authentication cookie-token store. Additional scheduling features, assessments, payments, notifications, and reports are introduced incrementally by their owning feature prompts.

## Configuration

Copy `.env.example` to `.env` and set `DATABASE_URL` to a local PostgreSQL database. Example placeholder:

```text
postgresql://campus_skill_exchange:change-me@localhost:5432/campus_skill_exchange?schema=public
```

Never commit real credentials.

## Identity and session tables

Prompt 1 uses normalized lowercase email storage with a database check constraint and unique index. `UserRole` stores server-managed `USER` and `ADMIN` permissions. `AuthIdentity` separates provider identity from the internal user, and `PasswordCredential` stores only Argon2id hashes. `Session` stores only a SHA-256 hash of an opaque cookie token, with expiration and revocation timestamps.

Registration never accepts a role from the request. The server creates the `USER` role in the same transaction as the local identity and credential.

## Profile table

`profiles` is a one-to-one presentation record for an existing `users` row. The `user_id` foreign key is unique and cascades only when the owning identity is removed. `public_display_name` is an optional public presentation name; when it is absent, the API uses the existing `User.displayName`. Authentication fields, sessions, account status, and system roles are not stored in `profiles`.

Profile URLs are stored as bounded `VARCHAR(2048)` references and are validated as HTTP/HTTPS URLs by the API. `interests` is a bounded PostgreSQL text array, normalized and de-duplicated by the application. `visibility` controls whether the public profile route exposes the record. A successful profile update and its `PROFILE_UPDATED` outbox row are committed in one transaction.

## Session Request table

`session_requests` stores direct requests between two existing `users` without introducing a product Session or scheduling workflow. The requester and recipient foreign keys cascade when a User is removed; the optional Skill foreign key uses `SET NULL` so a request remains valid when its referenced Skill is removed. A database check prevents a requester and recipient from being the same User. Composite indexes cover requester/status/created-at and recipient/status/created-at lookups, and a partial unique index prevents duplicate `PENDING` or `ACCEPTED` requests for the same requester, recipient, and optional Skill.

## Learning Session table

`learning_sessions` stores the core schedule for an accepted `session_requests` row and is intentionally separate from the authentication `sessions` table. It enforces one Session per SessionRequest, distinct host and participant Users, a positive time range, and a non-empty timezone. Host/participant and schedule indexes support participant access and chronological queries. Meeting URLs and location details are stored only as bounded references/text; no offline-location or notification integration is included.

## Rating table

`ratings` stores one optional-feedback rating from a session participant to the other participant after a `COMPLETED` `learning_sessions` row. Ratings are constrained to integer values from 1 through 5, reject self-ratings, and use a unique `(session_id, rater_user_id)` boundary. Rating foreign keys restrict ordinary deletion of a referenced User or Session so rating history is not removed by a cascade. The API derives the rater from the authenticated session, limits access to session participants, and returns only safe display identities and rating content. A successful rating and its versioned `RATING_SUBMITTED` outbox event are written in one transaction.

## Badge data store

`badge_definitions` stores the system-owned badge catalog, with a unique stable `code`, bounded presentation fields, and an optional externally managed `icon_url` reference. `user_badges` records one award per User and BadgeDefinition, with `awarded_at` and a unique `(user_id, badge_definition_id)` boundary. User foreign keys cascade with the owning account; badge-definition foreign keys restrict deletion so awarded history cannot be silently removed. The Badge service exposes controlled future awarding; no eligibility rules, public award route, UI, reputation, or notification workflow is included. A newly created award writes a `BADGE_EARNED` outbox event in the same transaction, while an existing award is idempotent and emits no second event.

## Session Reminder table

`session_reminders` stores future reminder records for scheduled `learning_sessions`. The unique `(session_id, reminder_type)` boundary prevents duplicates, and the status/scheduled-for index supports a future dispatcher. Reminder records are created and rescheduled transactionally with the Session, and pending reminders are cancelled when the Session is no longer scheduled. Reminder rows and outbox events do not claim delivery; no email, push, or SMS worker is implemented.

## Google integration storage

`google_connections` stores one server-side Google authorization per User, including the refresh-capable token set. Tokens are never returned by the API. `learning_sessions` stores only the Google Calendar event ID, conference ID/status, and a Meet URL received from Google; a URL is never constructed locally. Conference creation may remain `PENDING` until Google returns a real URL.

## Prisma workflow

From the repository root:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:studio
```

Use `db:migrate` for reviewed development schema changes. Use `db:deploy` in CI or deployment environments. Do not use `prisma db push` for shared environments.

The generated Prisma client is produced from `database/prisma/schema.prisma`. The database package is backend-only; the web application must not import Prisma.

## Reset procedure

`npm run db:reset` is destructive and is allowed only for a disposable development database. Confirm the target connection string before running it.

## Migration rules

- Commit schema and migration files together.
- Never edit an already-applied migration without understanding the consequences.
- Prefer additive, backward-compatible migrations for parallel feature branches.
- Use explicit expand/contract changes when a migration must be deployed in stages.
- Never use `prisma db push` as a substitute for migration history.
- Review indexes, foreign keys, uniqueness constraints, and data-retention implications.
- Do not add product tables speculatively.

## Naming and types

- Table and column names use plural `snake_case` where appropriate.
- IDs are UUIDs generated by the application and stored as PostgreSQL UUIDs.
- Timestamps use `timestamptz` and UTC.
- Every mutable record has `created_at` and `updated_at` where appropriate.
- Money will use integer minor units and an ISO currency code.
- Core relationships use foreign keys and explicit join tables.
- JSONB is reserved for flexible event/provider metadata, not a replacement for core relationships.

## Outbox foundation

The `outbox_events` table is a minimal durable hand-off for future domain events. It includes an event type/idempotency-key uniqueness boundary so a retried producer cannot create the same logical event twice. A future domain transaction will:

1. Change domain state.
2. Insert an event record in the same transaction.
3. Commit both atomically.
4. Allow a future dispatcher/consumer to process the event idempotently.

The Foundation does not implement event dispatch, retries, notifications, reputation, analytics, or business event producers. Prompt 2 adds a versioned `PROFILE_UPDATED` producer backed by the same transactional outbox, the Rating API adds a versioned `RATING_SUBMITTED` producer, and the Badge service adds a versioned `BADGE_EARNED` producer; these modules do not implement a dispatcher or consumer.

## Future module ownership

Future migrations should be owned by the module that owns the data. Cross-module access must use public services or read models, not direct repository access. Financial, audit, assessment, rating, and event history should not be deleted through ordinary cascading deletes.

## Transaction rules

- Use explicit transactions for multi-step state changes.
- Use idempotency keys for commands that can be retried.
- Use row-level locking or optimistic versions for concurrent workflow transitions.
- Do not perform network calls inside database transactions.
- Keep provider webhook handling idempotent and outside application locks.
