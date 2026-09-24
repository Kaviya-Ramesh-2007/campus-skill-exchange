# ADR 0007: Use OIDC-first provider abstraction

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Authentication must be secure and replaceable. Campus deployments may use different identity providers, and the frontend must never receive provider secrets.

## Decision

Define an `IdentityProvider` and token verification boundary in shared contracts. Prompt 1 will implement an OIDC-compatible provider adapter, server-side sessions, and optional local credentials only if explicitly required.

Foundation does not implement registration, login, password reset, social login, or session routes.

## Prompt 1 implementation note

Prompt 1 implements the secure local credential/session path and preserves the `IdentityProvider` and token-verification boundaries. It does not add a real Google, Microsoft, or other OIDC adapter because no provider is configured or tested in this repository. A later prompt must implement and test an external adapter before any provider login can be claimed. This preserves the OIDC-first direction without simulating provider success.

## Consequences

- The domain does not depend on a specific identity vendor.
- Provider configuration remains server-side.
- Prompt 1 completes the local authentication security design before enabling login.
- External OIDC integration remains an explicit follow-up with its own configuration and threat-model review.
