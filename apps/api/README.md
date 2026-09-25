# API application

NestJS modular API with infrastructure, local authentication, and professional User Profile routes:

- `GET /api/v1/health`
- `GET /api/v1/ready`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/profile`
- `POST /api/v1/profile`
- `PATCH /api/v1/profile`
- `GET /api/v1/users/:userId/profile`
- `PATCH /api/v1/users/:userId/profile`

The `users` module owns profile presentation data and enforces owner-or-`ADMIN` authorization through the existing authentication boundary. Profile updates write a versioned `PROFILE_UPDATED` outbox event in the same transaction. No file upload, external identity provider, or downstream event consumer is implemented. See the root API contract and module-boundary documents before adding a feature.
