# ADR 0007: Use OIDC-first provider abstraction

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Authentication must be secure and replaceable. Campus deployments may use different identity providers, and the frontend must never receive provider secrets.

## Decision

Define an `IdentityProvider` and token verification boundary in shared contracts. Prompt 1 will implement an OIDC-compatible provider adapter, server-side sessions, and optional local credentials only if explicitly required.

Foundation does not implement registration, login, password reset, social login, or session routes.

## Consequences

- The domain does not depend on a specific identity vendor.
- Provider configuration remains server-side.
- Prompt 1 must complete the security design and threat model before enabling login.
