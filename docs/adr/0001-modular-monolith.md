# ADR 0001: Use a modular monolith

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Campus Skill Exchange has many future business modules and a college-sized development team. Microservices would add deployment, networking, observability, and consistency costs before the product boundaries are proven.

## Decision

Use one Git repository and one modular NestJS backend. Keep web and API as separate deployable processes, with clear module boundaries and public services. Do not introduce microservices, queues, or distributed service discovery during Foundation.

## Consequences

- Business transactions remain straightforward and testable.
- Module extraction remains possible later through explicit interfaces.
- The team must actively enforce module ownership and avoid shared repositories.
- Deployment complexity remains lower while the product is evolving.
