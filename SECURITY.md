# Security Policy

## Foundation security rules

- Never commit `.env`, provider credentials, access tokens, passwords, or payment data.
- Keep OIDC, storage, meeting, payment, email, and AI secrets server-side.
- Use backend authorization for every protected operation.
- Do not log passwords, authorization headers, cookies, access tokens, or sensitive personal data.
- Use reviewed migrations and least-privilege database credentials.
- Keep the API liveness endpoint free of secrets and make readiness errors safe for clients.
- Report suspected vulnerabilities privately to the project maintainers; do not include real credentials in reports.

This is a college project Foundation. Production security ownership, disclosure contacts, and retention policies must be confirmed before launch.
