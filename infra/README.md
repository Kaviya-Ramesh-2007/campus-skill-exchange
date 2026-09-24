# Local infrastructure

`docker-compose.yml` provides a PostgreSQL 16 development database when Docker Desktop is available.

```bash
docker compose -f infra/docker-compose.yml up -d postgres
npm run db:validate
npm run db:deploy
```

The compose file contains development placeholders only. For a managed or locally installed PostgreSQL instance, set `DATABASE_URL` in `.env` instead. Do not commit real passwords.
