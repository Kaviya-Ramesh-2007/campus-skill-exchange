# API Contract

## Base path and versioning

All application API routes are versioned under:

```text
/api/v1
```

Foundation and Prompt 1 expose infrastructure and local authentication routes. Other product routes listed in the architecture plan are not implemented and must not be treated as existing endpoints.

## Current routes

| Method | Route                   | Purpose                                     |
| ------ | ----------------------- | ------------------------------------------- |
| `GET`  | `/api/v1/health`        | Process liveness check                      |
| `GET`  | `/api/v1/ready`         | PostgreSQL readiness check                  |
| `GET`  | `/api/docs`             | Swagger UI for currently implemented routes |
| `POST` | `/api/v1/auth/register` | Create a local account and session          |
| `POST` | `/api/v1/auth/login`    | Authenticate with email/password            |
| `POST` | `/api/v1/auth/logout`   | Revoke the current session                  |
| `GET`  | `/api/v1/auth/me`       | Return the current authenticated user       |

The health response is generated from actual process state. Readiness executes a real PostgreSQL `SELECT 1` check and returns `503` with the shared error envelope when the database is unavailable.

## HTTP conventions

- Use resource-oriented nouns.
- Use explicit command endpoints for state transitions, such as `/accept`, `/cancel`, or `/complete`.
- Do not allow arbitrary status updates through generic PATCH requests.
- Use `201` for creation, `204` for successful no-content operations, and appropriate `4xx`/`5xx` statuses for failures.
- Use request IDs for correlation.
- Use `Idempotency-Key` for retryable creation and payment commands.
- Use optimistic concurrency/version checks for editable resources.

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

Foundation stores only the minimal outbox structure; it does not expose a public event-processing API.

## Future route groups

Future prompts may add `/users`, `/skills`, `/user-skills`, `/learning-goals`, `/availability`, `/certifications`, `/projects`, `/matching`, `/exchanges`, `/requests`, `/sessions`, `/ratings`, `/assessments`, `/badges`, `/payments`, `/transactions`, `/notifications`, `/reports`, `/admin`, and `/analytics` only when their feature is implemented and documented.
