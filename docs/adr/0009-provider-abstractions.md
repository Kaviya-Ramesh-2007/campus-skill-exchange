# ADR 0009: Use provider abstractions for external services

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

OIDC, file storage, email, video meetings, payments, and AI will be external dependencies. Provider-specific success must not be simulated in core domain code.

## Decision

Keep provider-specific credentials and SDK calls behind interfaces owned by platform or integration modules. Core modules depend on capabilities, not vendor SDKs. Foundation establishes boundaries only.

## Consequences

- Providers can be changed or tested independently.
- Real integrations require separate feature prompts, webhook verification, and failure handling.
- No provider is connected or represented as operational during Foundation.
