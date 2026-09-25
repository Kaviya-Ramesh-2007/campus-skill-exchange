# Module Boundaries

## One-User rule

Every participant is a `User`. Teaching, learning, exchanging, hosting, attending, assessing, receiving assessments, paying, and receiving payment are contextual activities of a User. They must not become permanent participant roles.

The only initial system authorization roles are `USER` and `ADMIN`.

## Future domain modules

| Module           | Owns                                                    | May depend on                                                   |
| ---------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| `auth`           | Identity, session, and authorization context            | Platform, users through public interfaces                       |
| `users`          | Profiles, visibility, interests, links                  | Auth, platform                                                  |
| `skills`         | Catalog, categories, aliases, user skill associations   | Users, platform                                                 |
| `learning-goals` | Goals and target levels                                 | Users, skills                                                   |
| `availability`   | Recurring availability and exceptions                   | Users                                                           |
| `certifications` | Certification submissions and verification workflow     | Users, files, admin review                                      |
| `projects`       | Portfolio projects and demonstrated skills              | Users, skills, files                                            |
| `discovery`      | Search, filters, facets, and read models                | Public user/skill query interfaces                              |
| `matching`       | Explainable candidate generation and match explanations | Discovery, skills, goals, availability, evidence, trust signals |
| `exchanges`      | Mutual exchange proposals and lifecycle                 | Users, skills, matching                                         |
| `requests`       | Direct/exchange requests and lifecycle                  | Users, skills, exchanges                                        |
| `sessions`       | Scheduling, participants, mode, attendance, completion  | Requests, availability, integrations                            |
| `ratings`        | Eligible post-interaction ratings                       | Completed sessions                                              |
| `assessments`    | Skill assessments and endorsements                      | Completed sessions, skills                                      |
| `badges`         | Rule-driven system awards                               | Activity events, sessions                                       |
| `reputation`     | Transparent trust signals and methodology snapshots     | Ratings, sessions, evidence, events                             |
| `payments`       | Payment intents, provider status, fees                  | Sessions, payment provider                                      |
| `transactions`   | Immutable financial ledger and reconciliation           | Payments                                                        |
| `notifications`  | Event-driven user notifications                         | Events, preferences                                             |
| `reports`        | User/content/session safety reports                     | Auth, users, admin                                              |
| `admin`          | Privileged application commands and oversight           | Owning module public services                                   |
| `analytics`      | Aggregated read models and metrics                      | Events and approved projections                                 |

## Cross-cutting platform modules

`config`, `database`, `events`, `outbox`, `jobs`, `files`, `audit`, `integrations`, `idempotency`, and `observability` are infrastructure modules. They must not contain product business rules.

## Dependency rules

- Modules expose application services, commands, and event contracts.
- Modules must not import another module's repository, controller, or Prisma model.
- Direct cross-module reads should use a public query service or read model.
- Cross-module writes should use an application service or event.
- Avoid circular dependencies; extract a shared platform abstraction only when justified.
- `admin` must call owning-module services so validation and audit rules remain centralized.
- Database migrations are reviewed centrally, but feature modules own their table definitions.

## Current implementation

The repository currently implements:

- `health` infrastructure endpoints;
- `auth` local account, session, and authorization foundation;
- `users` professional profile, visibility, validation, and ownership boundaries;
- `database`/Prisma infrastructure, identity, profile migrations, and transactional outbox writes;
- platform configuration, logging, validation, and provider interfaces;
- shared contracts, profile DTOs, and the `PROFILE_UPDATED` event definition.

The `auth` module owns identity/session data and exposes safe authentication services. The `users` module reads the existing `User.displayName` through its profile query and never imports the auth repository or credential models. Profile events contain references and changed-field names, not credentials or unnecessary personal data. Skill, matching, and other product modules remain future work. Empty feature modules are intentionally avoided.

## Review checklist

When adding a module, document:

1. Its data ownership.
2. Its public interfaces.
3. Its allowed dependencies.
4. Its emitted and consumed events.
5. Its authorization policies.
6. Its migration and test requirements.
7. Its effect on shared contracts or infrastructure.
