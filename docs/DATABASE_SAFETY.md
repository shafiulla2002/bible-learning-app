# Database Safety Rules

These rules apply to every developer and every AI agent working on this repository.

## Forbidden without the owner's explicit written approval

- `prisma migrate reset`
- `prisma db push` (any form) against a shared, staging or production database
- `--accept-data-loss` on any command
- `DROP`, `TRUNCATE`, or `DELETE` without a `WHERE` clause on any shared database
- Migrations that drop or rename columns/tables, or change column types in a lossy way
- Disabling Row-Level Security policies

## Required workflow for schema changes

1. Change `apps/api/prisma/schema.prisma`.
2. Generate the migration locally with `prisma migrate dev --create-only` and **review the SQL**.
3. Destructive steps (drop/rename/narrow type) are split into a separate migration and need owner approval.
4. Before applying to any shared database: take a backup (`BackupRun` kind `PRE_MIGRATION`) and record its location.
5. Apply with `prisma migrate deploy` only.
6. Verify the application and record the result in `IMPLEMENTATION_PROGRESS.md`.

## Secrets

- Connection strings, passwords and service-account keys live only in `.env` files or the hosting provider's secret manager.
- `.env` and service-account JSON files are git-ignored. Never paste them into chats, issues or commits.
- The app's database user is not a superuser and cannot update or delete `audit_log` rows.

## Backups

- Managed point-in-time recovery enabled on the database instance.
- Nightly encrypted logical dump to a separate bucket (30 daily / 12 monthly).
- Monthly restore drill into a scratch database, result recorded.
