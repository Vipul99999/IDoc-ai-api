# Deployment Runbook

## Local

```powershell
npm install
npm run dev
```

## Docker

```powershell
docker compose up --build
```

## Production Checklist

- Set `DATA_ROOT`, `RETENTION_DAYS`, `MAX_UPLOAD_MB`.
- Configure PostgreSQL and run `database/migrations/001_initial_schema.sql`.
- Configure MinIO or S3 buckets.
- Enable antivirus scanning.
- Configure JWT/OAuth secrets.
- Enable backups for database and object storage.
- Configure centralized logs and alerts.
