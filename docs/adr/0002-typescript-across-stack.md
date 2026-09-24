# ADR 0002: Use TypeScript across the stack

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

The project needs shared API contracts, event envelopes, database tooling, web components, and backend services. Static types reduce integration mistakes across a team and future coding agents.

## Decision

Use TypeScript for the web application, API, shared packages, database tooling, and configuration. Enable strict compiler settings and pin a compatible TypeScript version in the lockfile.

## Consequences

- Shared contracts can be checked at compile time.
- Contributors need TypeScript tooling and conventions.
- Runtime validation remains necessary at all external boundaries; TypeScript does not replace Zod or authorization.
