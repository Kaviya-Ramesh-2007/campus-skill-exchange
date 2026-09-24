# ADR 0008: Establish a minimal transactional outbox

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Notifications, analytics, badges, reputation, and administration will need reliable knowledge of real state changes. Updating a domain record and publishing an event as unrelated operations can lose events.

## Decision

Create one minimal `outbox_events` table now. Future domain transactions will write the state change and outbox record atomically. Event processing and queues will be introduced only when a feature requires them.

## Consequences

- Future event consumers have a durable hand-off.
- Foundation has no dispatcher or business event producers.
- Consumers must eventually be idempotent and event payloads must avoid unnecessary sensitive data.
