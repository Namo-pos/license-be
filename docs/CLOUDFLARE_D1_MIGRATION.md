# Cloudflare D1 Migration Guide — NAMO License System

## 1. Overview & Architecture

The NAMO License System is migrating from Supabase PostgreSQL to **Cloudflare D1** (Serverless SQLite).
The Prisma schema (`prisma/schema.prisma`) serves as the single source of truth for the database models.

```text
NAMO Client (Tauri POS / Desktop)
        ↓ HTTPS
Cloudflare Worker (POS-License API)
        ↓
Prisma D1 Adapter (@prisma/adapter-d1)
        ↓
Cloudflare D1 (namo-license-db)
```

> **Security Rule**: The desktop Tauri application communicates only with the backend Worker API over HTTPS. No direct database credentials or Cloudflare API tokens are ever distributed to client applications.

---

## 2. Configuration & Locations

| Component | Path / Value |
|---|---|
| **D1 Database Name** | `namo-license-db` |
| **D1 Binding Name** | `DB` |
| **Wrangler Config** | `wrangler.json` |
| **Prisma Schema** | `prisma/schema.prisma` |
| **Migration Directory** | `migrations/` |
| **Initial Migration File** | `migrations/0001_init_namo_license_schema.sql` |

### `wrangler.json` Binding Structure
```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "pos-license",
  "compatibility_date": "2024-09-25",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "namo-license-db",
      "database_id": "b9ddc5cd-83f3-4d24-ae1a-5adb2b62e7b8"
    }
  ]
}
```

---

## 3. Schema & D1 Compatibility Analysis

The Prisma schema defines three models:
1. `LICENSE` (`@@map("LICENSE")`): Stores license keys, plan types, config JSON, active status, timestamps.
2. `USER` (`@@map("USER")`): Stores administrative users, hashed passwords, master keys, and links to `LICENSE` via foreign key with `ON DELETE CASCADE`.
3. `LICENSE_MASTER` (`@@map("LICENSE_MASTER")`): Master benefit configurations for license plans.

### Compatibility Highlights:
- **Datasource Provider**: Changed from `postgresql` to `sqlite` for Cloudflare D1 compatibility. All model definitions, columns, relations, and defaults are 100% preserved.
- **Foreign Keys**: SQLite / D1 requires foreign keys to be declared inline inside `CREATE TABLE`, which the generated migration script adheres to.
- **UUID & Strings**: Primary keys and UUIDs are stored as `TEXT`.
- **JSON**: Stored as text `JSON` (`TEXT` in SQLite), compatible with D1.
- **Prisma Query Compatibility**: PostgreSQL-specific query argument `mode: 'insensitive'` was removed from `findUserByUsername` in `supabase.database.ts`, as SQLite handles case-matching appropriately and Prisma's SQLite driver does not support `mode: 'insensitive'`.

---

## 4. Migration Commands

### Local Development / Testing
```bash
# Apply pending migrations to local D1
npm run db:migrate:local
# Or directly via wrangler:
npx wrangler d1 migrations apply namo-license-db --local

# List migration history on local D1
npm run db:migrations:local
# Or directly via wrangler:
npx wrangler d1 migrations list namo-license-db --local
```

### Remote / Production Deployment
```bash
# 1. Verify Cloudflare Authentication
npx wrangler whoami

# 2. Check pending migrations on remote D1
npm run db:migrations:remote

# 3. Apply migrations to remote D1
npm run db:migrate:remote
# Or directly via wrangler:
npx wrangler d1 migrations apply namo-license-db --remote
```

---

## 5. Verification Commands

### Local Verification
```bash
# Verify tables and indexes
npx wrangler d1 execute namo-license-db --local --command "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY type, name;"

# Verify foreign keys
npx wrangler d1 execute namo-license-db --local --command "PRAGMA foreign_key_list('USER');"

# Run license service test suite
npm run test:license
```

### Remote Verification
```bash
# Verify applied migration history
npx wrangler d1 migrations list namo-license-db --remote

# Verify remote tables
npx wrangler d1 execute namo-license-db --remote --command "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY type, name;"

# Verify remote foreign keys
npx wrangler d1 execute namo-license-db --remote --command "PRAGMA foreign_key_list('USER');"
```

---

## 6. Pre-Migration Remote Backup

If the remote D1 database already contains schema or data before applying a new migration:

```bash
# Export full remote database backup (schema + data)
npx wrangler d1 export namo-license-db --remote --output backups/namo-license-db-pre-migration.sql
```

> **Note**: `backups/` and `*.sqlite` / `*.db` are configured in `.gitignore` to prevent committing production data to source control.

---

## 7. Failure Recovery Procedure

If a remote migration fails during execution:
1. **DO NOT** delete or recreate the production database.
2. **DO NOT** drop tables manually or run destructive SQL without investigation.
3. Check the exact error in the Wrangler CLI log output.
4. Cloudflare D1 migrations execute in transactions per migration file; any uncommitted statements will roll back automatically.
5. Fix the migration SQL file or issue.
6. Verify locally first using `npm run db:migrate:local`.
7. Once verified, re-run `npm run db:migrate:remote`.

---

## 8. Procedure for Future Schema Changes

When modifying the database schema in the future:

1. **Edit `prisma/schema.prisma`** with the required changes.
2. **Create a new numbered migration**:
   ```bash
   npx wrangler d1 migrations create namo-license-db <migration_name>
   ```
   *(e.g., `migrations/0002_add_field_example.sql`)*
3. **Generate migration diff SQL**:
   ```bash
   npx prisma migrate diff \
     --from-local-d1 \
     --to-schema-datamodel ./prisma/schema.prisma \
     --script \
     --output migrations/0002_add_field_example.sql
   ```
4. **Review the generated SQL** thoroughly (ensure no unexpected `DROP` statements).
5. **Apply locally**:
   ```bash
   npm run db:migrate:local
   ```
6. **Run tests**:
   ```bash
   npm run test:license
   ```
7. **Backup remote D1** (if production contains data):
   ```bash
   npx wrangler d1 export namo-license-db --remote --output backups/backup-pre-0002.sql
   ```
8. **Apply to remote**:
   ```bash
   npm run db:migrate:remote
   ```
9. **Verify remote state**:
   ```bash
   npm run db:migrations:remote
   ```
