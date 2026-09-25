# Shared contracts

This package contains transport and infrastructure contracts: API envelopes, error codes, pagination, IDs, system roles, identity interfaces, profile DTOs, and versioned event conventions.

Prompt 2 adds strict profile create/update schemas, a privacy-safe profile response, public/private visibility, and the `PROFILE_UPDATED` event definition. Product domain tables remain owned by their feature modules; the contracts package does not import Prisma or expose database entities.
