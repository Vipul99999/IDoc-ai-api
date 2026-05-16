# Docker Infrastructure

The root `docker-compose.yml` runs the web product. The optional `future-infra` profile starts PostgreSQL and MinIO for production-like testing.

```powershell
docker compose up --build
docker compose --profile future-infra up --build
```
