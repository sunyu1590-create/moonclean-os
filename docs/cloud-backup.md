# Cloud backup and migration

## Create a backup

Sign in as a store Owner and open **Settings → Data Management → Back up all cloud data**. The download is a versioned JSON archive containing every store owned by the signed-in account and all rows visible for those stores. Large tables are fetched in ordered 500-row pages.

The archive includes the store records, member links, product and SKU catalog, historical costs, daily and advertising metrics, product sales, audit and migration records, platform sync data, inventory, and tasks. `rowCounts` records the exported row total for each table. `format` and `formatVersion` identify the archive format for future restore tooling.

### Separate after-sales attachment archive

Owners can use **Settings → Data Management → Separately export after-sales attachments** to create a versioned ZIP archive. It contains the private Storage objects and a manifest with their original store, case, and object paths. **Import attachment archive** lets an owner map each source store to a destination store and restores the file relationship on the matching case. The destination database must already contain those case IDs (for example, after restoring the JSON records); unmatched cases are reported and skipped. Existing objects are never overwritten. Keep the ZIP private because it contains customer-provided files.

## Sensitive data not included

The export deliberately excludes Supabase Auth password hashes and sessions, and the private `platform_credentials` table containing platform client secrets and access/refresh tokens. The archive contains account and member UUIDs so relationships can be mapped during migration. Users must be invited or reset their passwords on the destination auth service, and platform connections must be authorized again.

## Restoring on a self-hosted database

The JSON archive is a data export, not a PostgreSQL `pg_dump` file. Use the matching schema migrations in `supabase/migrations` to create the database before importing rows. A restore tool should import parent records before foreign-key dependents and map old auth user UUIDs to the destination user UUIDs. Attachment ZIP restore is available in the browser, but business-row restore remains an external database migration; import those rows before restoring the attachments. Keep both source archives unchanged and verify row counts and totals after migration.

Backups include operational and financial records. Save the downloaded file somewhere private and retain multiple dated copies. Supabase Free does not provide automatic database backups.
