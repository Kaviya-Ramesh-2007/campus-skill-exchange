# ADR 0003: Separate Next.js and NestJS applications

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

The product needs a professional web experience and a backend with explicit domain modules, background work, policy enforcement, and provider integrations. Mixing all server responsibilities into page handlers would make boundaries harder to test and reuse.

## Decision

Use Next.js App Router for `apps/web` and NestJS with Fastify for `apps/api`. Communicate through versioned REST contracts.

## Consequences

- The frontend can provide server-rendered public pages and a clear route structure.
- The API can own authorization, validation, persistence, and integrations.
- The team must manage two build processes and keep shared contracts synchronized.
- A same-origin rewrite avoids credentialed CORS during local development.
