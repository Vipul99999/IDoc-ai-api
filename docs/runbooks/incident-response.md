# Incident Response Runbook

## Severity Levels

- SEV1: data exposure, sustained outage, destructive processing bug.
- SEV2: degraded OCR/search/translation for paying customers.
- SEV3: isolated workflow failure.

## First Response

1. Confirm impact.
2. Stop affected queues if corruption risk exists.
3. Preserve audit logs.
4. Notify stakeholders.
5. Restore from backup if required.
6. Publish post-incident review.
