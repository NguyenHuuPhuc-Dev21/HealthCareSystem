# Local Infrastructure & Docker Compose

Contains local container definitions for developing against real PostgreSQL 16 and Redis services.

## Starting Local Services

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

- **PostgreSQL 16:** `localhost:5432`, Database: `healthcare_dev`, User: `postgres`, Password: `postgrespassword`
- **Redis 7:** `localhost:6379`
