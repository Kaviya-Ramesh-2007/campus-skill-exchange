# ADR 0004: Use PostgreSQL as the relational database

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

The domain is relational and requires foreign keys, transactions, status constraints, concurrency-safe workflow transitions, search, and event outbox support.

## Decision

Use PostgreSQL as the only supported relational database. Local development may use a local installation, Docker, or a managed PostgreSQL service. Do not silently substitute SQLite.

## Consequences

- The project gains strong integrity and concurrency semantics.
- Developers need a PostgreSQL development database for migration and readiness checks.
- Future modules must use reviewed migrations and explicit indexes.
