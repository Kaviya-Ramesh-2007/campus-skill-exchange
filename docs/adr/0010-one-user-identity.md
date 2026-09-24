# ADR 0010: Use one User identity model

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

A person may teach one activity, learn another, assess a peer, attend a session, pay another user, and receive a rating in the same account. Permanent participant roles would incorrectly constrain those activities.

## Decision

Every participant is a `User`. The only initial system authorization roles are `USER` and `ADMIN`. Contextual relationships such as requester, recipient, participant, assessor, assessee, payer, and payee are modeled as relationships, not user types.

## Consequences

- The data model can represent reciprocal and multi-role activity without duplication.
- UI language must describe capabilities and context rather than identity.
- Any future permanent role requires an explicit architectural decision, migration plan, and review.
