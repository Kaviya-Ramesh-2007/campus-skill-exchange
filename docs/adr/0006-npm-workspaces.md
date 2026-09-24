# ADR 0006: Use npm workspaces

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

The approved stack calls for a monorepo. The development environment has npm but did not have pnpm or Yarn.

## Decision

Use npm workspaces with `apps/*`, `packages/*`, and the database package. Commit `package-lock.json` and pin package versions.

## Consequences

- A clean checkout can install with the available npm toolchain.
- The team has one lockfile and straightforward workspace scripts.
- A future package-manager migration would require an ADR and lockfile migration.
