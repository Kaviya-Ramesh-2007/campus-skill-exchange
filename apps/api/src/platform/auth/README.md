# Authentication and authorization boundary

This directory contains provider and authorization interfaces. Prompt 1 implements local email/password credentials, an opaque revocable session store, current-user context, and reusable role guards while preserving the OIDC abstraction for a later provider adapter.

The system role vocabulary is limited to `USER` and `ADMIN`. No participant role is defined here.
