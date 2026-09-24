# Security Policy

## Authentication security rules

- Store local passwords only as Argon2id hashes; never return, serialize, or log password hashes or plaintext passwords.
- Use opaque, revocable server-side sessions. Persist only a SHA-256 hash of the session token and deliver the token only through the configured HttpOnly cookie.
- Set `Secure` in production, use an explicit `SameSite` policy, configure expiration, and clear the cookie on logout.
- Treat the server session as the source of truth for the current user; never authorize from a frontend-supplied user ID.
- Reject unsafe cross-origin browser requests using the configured credentialed-origin allowlist.
- Return generic login failures without revealing whether an account exists.

## Foundation security rules

- Never commit `.env`, provider credentials, access tokens, passwords, or payment data.
- Keep OIDC, storage, meeting, payment, email, and AI secrets server-side.
- Use backend authorization for every protected operation.
- Do not log passwords, authorization headers, cookies, access tokens, or sensitive personal data.
- Use reviewed migrations and least-privilege database credentials.
- Keep the API liveness endpoint free of secrets and make readiness errors safe for clients.
- Report suspected vulnerabilities privately to the project maintainers; do not include real credentials in reports.

This is a college project foundation. Production security ownership, disclosure contacts, rate limiting, retention policies, and deployment controls must be confirmed before launch.
