# Security and Compliance

## Implemented Baseline

- Request validation at API boundaries.
- Upload extension and size checks.
- Retention metadata.
- Audit log events for upload, OCR, translation, and formatting.
- Rate limiting in the API gateway boundary.
- JWT-ready authorization boundary.

## Production Controls

- JWT with rotating signing keys.
- OAuth and SSO through organization identity providers.
- RBAC and tenant scoping on every repository method.
- Signed object storage URLs.
- Malware scanning with ClamAV or a managed scanner.
- TLS at ingress.
- Encryption at rest for object storage and PostgreSQL.
- Audit log immutability using append-only storage.
- GDPR deletion/export workflows.
- SOC 2 evidence collection through runbooks, change logs, access reviews, and incident records.
