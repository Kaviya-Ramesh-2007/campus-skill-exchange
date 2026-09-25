# ADR 0011: Use local Argon2id credentials and opaque server-side sessions

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Prompt 1 must provide a real local authentication flow while preserving the approved OIDC-first direction. The browser needs a session that can survive navigation and be invalidated without exposing user data or credentials.

## Decision

Implement local email/password authentication with Argon2id. Store a provider-neutral `AuthIdentity`, a separate `PasswordCredential`, and a revocable `Session`. The local session service implements the Foundation `SessionStore` boundary. Generate a cryptographically random opaque session token, place it in an HttpOnly cookie, and persist only its SHA-256 hash. Use configurable expiration, production Secure cookies, SameSite, origin checks, and server-side current-user context.

Registration always creates the server-managed `USER` role. The request cannot assign roles. OIDC remains an adapter boundary for a future prompt; no external provider is simulated or claimed.

## Consequences

- Passwords are never stored, returned, or logged in plaintext.
- Session invalidation is immediate and auditable through the session record.
- The database does not need to understand a specific OIDC vendor.
- A future OIDC adapter can create an `AuthIdentity` for an existing `User` without changing participant identity semantics.
- Local authentication still requires careful CSRF/origin protection, secure cookie deployment, rate limiting, and production secret management before launch.
