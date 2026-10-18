# Cloud backup and migration

## Create a backup

Sign in as a store Owner and open **Settings → Data Management → Back up all cloud data**. The download is a versioned JSON archive containing every store owned by the signed-in account and all rows visible for those stores. Large tables are fetched in ordered 500-row pages.

The archive includes the store records, member links, product and SKU catalog, historical costs, daily and advertising metrics, product sales, audit and migration records, platform sync data, inventory, and tasks. `rowCounts` records the exported row total for each table. `format` and `formatVersion` identify the archive format for future restore tooling.

## Sensitive data not included

The export deliberately excludes Supabase Auth password hashes and sessions, and the private `platform_credentials` table containing platform client secrets and access/refresh tokens. The archive contains account and member UUIDs so relationships can be mapped during migration. Users must be invited or reset their passwords on the destination auth service, and platform connections must be authorized again.

## Restoring on a self-hosted database

The JSON archive is a data export, not a PostgreSQL `pg_dump` file. Use the matching schema migrations in `supabase/migrations` to create the database before importing rows. A restore tool should import parent records before foreign-key dependents and map old auth user UUIDs to the destination user UUIDs. MoonClean OS does not yet provide a browser restore action; keep the source archive unchanged and verify row counts and totals after any restore.

Backups include operational and financial records. Save the downloaded file somewhere private and retain multiple dated copies. Supabase Free does not provide automatic database backups.
