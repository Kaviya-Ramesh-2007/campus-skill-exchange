# API Contract

## Base path and versioning

All application API routes are versioned under:

```text
/api/v1
```

Foundation, Prompt 1, and Prompt 2 expose infrastructure, local authentication, and professional profile routes. Other product routes listed in the architecture plan are not implemented and must not be treated as existing endpoints.

## Current routes

| Method  | Route                           | Purpose                                     |
| ------- | ------------------------------- | ------------------------------------------- |
| `GET`   | `/api/v1/health`                | Process liveness check                      |
| `GET`   | `/api/v1/ready`                 | PostgreSQL readiness check                  |
| `GET`   | `/api/docs`                     | Swagger UI for currently implemented routes |
| `POST`  | `/api/v1/auth/register`         | Create a local account and session          |
| `POST`  | `/api/v1/auth/login`            | Authenticate with email/password            |
| `POST`  | `/api/v1/auth/logout`           | Revoke the current session                  |
| `GET`   | `/api/v1/auth/me`               | Return the current authenticated user       |
| `GET`   | `/api/v1/profile`               | Get the current user's profile              |
| `POST`  | `/api/v1/profile`               | Initialize the current user's profile       |
| `PATCH` | `/api/v1/profile`               | Update the current user's profile           |
| `GET`   | `/api/v1/users/:userId/profile` | Get another user's public profile           |
| `PATCH` | `/api/v1/users/:userId/profile` | Update an owned or ADMIN-authorized profile |
| `GET`   | `/api/v1/badges`                | List available BadgeDefinitions             |
| `GET`   | `/api/v1/badges/users/:userId`  | List badges earned by an authorized User    |

The health response is generated from actual process state. Readiness executes a real PostgreSQL `SELECT 1` check and returns `503` with the shared error envelope when the database is unavailable.

## HTTP conventions

- Use resource-oriented nouns.
- Use explicit command endpoints for state transitions, such as `/accept`, `/cancel`, or `/complete`.
- Do not allow arbitrary status updates through generic PATCH requests.
- Use `201` for creation, `204` for successful no-content operations, and appropriate `4xx`/`5xx` statuses for failures.
- Use request IDs for correlation.
- Use `Idempotency-Key` for retryable creation and payment commands.
- Use optimistic concurrency/version checks for editable resources when the owning module defines a concurrency contract. Prompt 2 profile updates are explicitly last-write-wins; a future profile revision may add an `expectedVersion` precondition without changing the profile ownership model.

## Success envelope

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "optional-request-id"
  }
}
```

## Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {},
    "meta": {
      "requestId": "request-id"
    }
  }
}
```

Stack traces, database messages, provider payloads, secrets, and internal file paths must never be returned to clients.

## Error codes

| Code                        | Typical status | Meaning                                |
| --------------------------- | -------------: | -------------------------------------- |
| `VALIDATION_ERROR`          |            400 | Request schema validation failed       |
| `BAD_REQUEST`               |            400 | Malformed or unsupported request       |
| `AUTHENTICATION_REQUIRED`   |            401 | No valid identity was established      |
| `AUTH_INVALID_CREDENTIALS`  |            401 | Login credentials are invalid          |
| `AUTH_SESSION_REQUIRED`     |            401 | A valid session is missing or revoked  |
| `AUTH_SESSION_EXPIRED`      |            401 | The session has expired                |
| `AUTH_ACCOUNT_SUSPENDED`    |            403 | The account is suspended               |
| `AUTH_EMAIL_ALREADY_EXISTS` |            409 | Normalized email is already registered |
| `AUTH_INVALID_INPUT`        |            400 | Authentication input is invalid        |
| `AUTH_FORBIDDEN`            |            403 | System role or origin is not permitted |
| `PROFILE_INVALID_INPUT`     |            400 | Profile data or URL is invalid         |
| `PROFILE_NOT_FOUND`         |            404 | Profile is missing or not public       |
| `PROFILE_ALREADY_EXISTS`    |            409 | The user already has a profile         |
| `PROFILE_FORBIDDEN`         |            403 | Caller does not own the profile        |
| `FORBIDDEN`                 |            403 | Identity lacks resource permission     |
| `NOT_FOUND`                 |            404 | Resource is unavailable                |
| `CONFLICT`                  |            409 | State or uniqueness conflict           |
| `RATE_LIMITED`              |            429 | Request limit exceeded                 |
| `DEPENDENCY_UNAVAILABLE`    |            503 | Required infrastructure is unavailable |
| `INTERNAL_ERROR`            |            500 | Unexpected server failure              |

## Pagination

The initial shared convention is page-based pagination:

- `page`: positive integer, default `1`;
- `pageSize`: integer from `1` to `100`, default `20`;
- response metadata includes `page`, `pageSize`, `total`, and `totalPages`.

High-volume activity feeds may introduce cursor pagination through a documented contract revision rather than silently changing this convention.

## Validation and DTOs

- Validate all external input at the boundary.
- Use Zod schemas in `packages/contracts` for shared transport schemas.
- The API global validation pipe is ready for Zod DTO metadata.
- Reject unknown fields for sensitive commands.
- Do not expose database entities directly as response objects; use explicit DTOs/serializers.

## User profile boundary

Profiles are presentation data owned by the `users` module and are associated one-to-one with the existing `User`. Authentication credentials, sessions, account status, and system roles are not copied into a profile. The account's existing `User.displayName` is the fallback display name; the optional profile `displayName` is a separately editable public presentation name.

### `GET /api/v1/profile`

Requires the current session. Returns the current user's profile, or `PROFILE_NOT_FOUND` when it has not been initialized. The response contains only profile data, a safe display name, visibility, and profile timestamps.

### `POST /api/v1/profile`

Requires the current session. Initializes the current user's profile and returns `201`. The request is strict and accepts:

- `displayName` (maximum 120 characters);
- `department` (maximum 120);
- `academicYear` (maximum 32);
- `institution` (maximum 160);
- `bio` (maximum 2000);
- `interests` (at most 20 entries, each maximum 80 characters);
- `profileImageUrl`, `githubUrl`, and `portfolioUrl` (HTTP/HTTPS URLs only, maximum 2048 characters); and
- `visibility` (`PUBLIC` or `PRIVATE`, default `PUBLIC`).

`file:`, filesystem paths, arbitrary provider paths, and other URL schemes are rejected. The image field is a safe externally managed reference only; Prompt 2 does not implement file upload or claim that a file was stored.

Possible errors: `PROFILE_INVALID_INPUT`, `PROFILE_ALREADY_EXISTS`.

### `PATCH /api/v1/profile`

Requires the current session and updates only the current user's profile. At least one profile field is required. `null` clears an optional field. The ownership is derived from the server session; a browser cannot submit a user ID to change another profile. Prompt 2 uses last-write-wins for profile presentation updates; future revisions may add an explicit version precondition.

### `GET /api/v1/users/:userId/profile`

Public endpoint. Returns a profile only when `visibility` is `PUBLIC`. Missing and private profiles both return `PROFILE_NOT_FOUND` so the endpoint does not reveal private profile existence. It never returns email, password hashes, sessions, system roles, account status, or internal provider data.

### `PATCH /api/v1/users/:userId/profile`

Requires a session. A `USER` may update only their own profile. An `ADMIN` may use the existing system-role framework for authorized profile maintenance. The route does not accept role, account-status, credential, or session fields.

### Profile validation and events

All text is trimmed and bounded; interests are normalized and de-duplicated case-insensitively. URLs must be valid HTTP/HTTPS URLs. A successful update writes a versioned `PROFILE_UPDATED` event to `outbox_events` in the same database transaction as the profile update. The event contains references and changed-field names, not bio text, credentials, or other sensitive data.

## Authentication boundary

Prompt 1 implements secure local email/password authentication using an opaque, server-side session. OIDC remains an interface boundary for a later provider adapter. Browser clients receive only an HttpOnly session cookie; they never receive a bearer token, password hash, or credential record.

### `POST /api/v1/auth/register`

Public endpoint.

Request:

```json
{
  "displayName": "Ada Lovelace",
  "email": "ada@example.test",
  "password": "a password with at least 12 characters"
}
```

- Email is trimmed and normalized to lowercase.
- Passwords must be 12–128 characters; no arbitrary composition rule is imposed.
- The request is strict and does not accept a role.
- The server creates the `USER` role.
- The response contains only safe user/session metadata.
- The session is delivered through the `cse_session` HttpOnly cookie.

Possible errors: `AUTH_INVALID_INPUT`, `AUTH_EMAIL_ALREADY_EXISTS`.

### `POST /api/v1/auth/login`

Public endpoint.

Request:

```json
{
  "email": "ada@example.test",
  "password": "a password with at least 12 characters"
}
```

Invalid and unknown credentials return the same generic `AUTH_INVALID_CREDENTIALS` response. Suspended accounts return `AUTH_ACCOUNT_SUSPENDED` after credential verification.

### `POST /api/v1/auth/logout`

Requires the current session. Revokes the server-side session and clears the cookie. Returns `204` with no body.

### `GET /api/v1/auth/me`

Requires the current session. Returns the safe authenticated user:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "ada@example.test",
    "displayName": "Ada Lovelace",
    "status": "ACTIVE",
    "roles": ["USER"],
    "createdAt": "2026-09-24T00:00:00.000Z"
  }
}
```

The response never includes password hashes, credential records, session tokens, or internal provider data.

### Session security

- Opaque 256-bit random session token.
- Only a SHA-256 token hash is stored in PostgreSQL.
- HttpOnly cookie.
- Secure cookie in production.
- SameSite configuration from environment.
- Configurable expiration and server-side revocation.
- Same-origin/CORS checks protect unsafe requests.
- Future requests derive the user ID from the server session, never from a frontend-supplied user ID.

## Authorization boundary

Authorization is enforced in backend guards and policies. `USER` and `ADMIN` are the only initial system roles. `@Public()` and `@Roles()` are reusable NestJS decorators. Resource ownership and contextual participation are separate from system roles.

## Event API conventions

The shared event envelope is defined in `packages/contracts`. Events use UPPER_SNAKE_CASE names, positive integer versions, UUID identifiers, UTC timestamps, correlation/causation IDs, and an idempotency key. Payloads must be owned and versioned by the producing module.

The outbox stores the minimal durable event structure; Prompt 2 adds a profile event producer, the Rating API adds `RATING_SUBMITTED`, and the Badge service adds `BADGE_EARNED`, but none exposes a public event-processing API.

## Badge boundary

`GET /api/v1/badges` requires an authenticated User and returns safe BadgeDefinition catalog data. `GET /api/v1/badges/users/:userId` requires the authenticated User to be the owner or an `ADMIN`; it returns the User's earned badges. There is intentionally no public badge-award endpoint. The internal Badge service accepts only existing User and BadgeDefinition IDs, is idempotent for an existing award, and writes a `BADGE_EARNED` outbox event only when a new `UserBadge` is created. No eligibility rules are implemented yet.

## Future route groups

Future prompts may add `/skills`, `/user-skills`, `/learning-goals`, `/availability`, `/certifications`, `/projects`, `/matching`, `/exchanges`, `/requests`, `/sessions`, `/ratings`, `/assessments`, `/payments`, `/transactions`, `/notifications`, `/reports`, `/admin`, and `/analytics` only when their feature is implemented and documented.
