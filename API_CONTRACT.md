# API Contract

## Base path and versioning

All application API routes are versioned under:

```text
/api/v1
```

Foundation currently exposes only infrastructure routes. Product routes listed in the architecture plan are not implemented and must not be treated as existing endpoints.

## Current routes

| Method | Route            | Purpose                                     |
| ------ | ---------------- | ------------------------------------------- |
| `GET`  | `/api/v1/health` | Process liveness check                      |
| `GET`  | `/api/v1/ready`  | PostgreSQL readiness check                  |
| `GET`  | `/api/docs`      | Swagger UI for currently implemented routes |

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

| Code                      | Typical status | Meaning                                |
| ------------------------- | -------------: | -------------------------------------- |
| `VALIDATION_ERROR`        |            400 | Request schema validation failed       |
| `BAD_REQUEST`             |            400 | Malformed or unsupported request       |
| `AUTHENTICATION_REQUIRED` |            401 | No valid identity was established      |
| `FORBIDDEN`               |            403 | Identity lacks resource permission     |
| `NOT_FOUND`               |            404 | Resource is unavailable                |
| `CONFLICT`                |            409 | State or uniqueness conflict           |
| `RATE_LIMITED`            |            429 | Request limit exceeded                 |
| `DEPENDENCY_UNAVAILABLE`  |            503 | Required infrastructure is unavailable |
| `INTERNAL_ERROR`          |            500 | Unexpected server failure              |

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

OIDC-first authentication is an interface boundary only during Foundation. Prompt 1 will implement the identity provider, session lifecycle, and protected routes. Browser clients must not receive provider secrets.

## Authorization boundary

Authorization is enforced in backend services and guards. `USER` and `ADMIN` are the only initial system roles. Resource ownership and contextual participation are separate from system roles.

## Event API conventions

The shared event envelope is defined in `packages/contracts`. Events use UPPER_SNAKE_CASE names, positive integer versions, UUID identifiers, UTC timestamps, correlation/causation IDs, and an idempotency key. Payloads must be owned and versioned by the producing module.

Foundation stores only the minimal outbox structure; it does not expose a public event-processing API.

## Future route groups

Future prompts may add `/auth`, `/users`, `/skills`, `/user-skills`, `/learning-goals`, `/availability`, `/certifications`, `/projects`, `/matching`, `/exchanges`, `/requests`, `/sessions`, `/ratings`, `/assessments`, `/badges`, `/payments`, `/transactions`, `/notifications`, `/reports`, `/admin`, and `/analytics` only when their feature is implemented and documented.
