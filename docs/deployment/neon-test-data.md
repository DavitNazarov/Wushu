# Local PostgreSQL to Neon test data

This repo includes small helper scripts to copy local PostgreSQL data into a Neon test database for deployment testing.

You need PostgreSQL client tools installed locally so `pg_dump` and `pg_restore` are available in `PATH`.

## Required environment variables

- `LOCAL_DATABASE_URL`: connection string for your local PostgreSQL database
- `TARGET_DATABASE_URL`: direct Neon connection string for the target test database
- `CONFIRM_RESET=yes`: required only for import, because restore may drop or replace existing target objects
- `DUMP_FILE`: optional path for the dump file; relative paths resolve from `backend/`

Default `DUMP_FILE`:

```bash
backend/tmp/local.dump
```

## Important Neon connection rule

Use a direct Neon connection string for `TARGET_DATABASE_URL`, not a pooled one.

- Safe for app runtime: pooled Neon URLs can still be used where your app expects them
- Safe for manual restore: this import flow should use the direct Neon host, which does not contain `-pooler`

Neon explicitly warns against using `pg_dump` over a pooled connection string and documents `pg_dump` + `pg_restore` as the manual migration path:

- [Neon migration overview](https://neon.com/migration)
- [Neon docs: migrate data from another Neon project](https://neon.com/docs/import/migrate-from-neon)

## Export local data

From the repo root:

```bash
LOCAL_DATABASE_URL="postgresql://geo:geo123@localhost:5432/geo_wushu" \
npm run db:dump:local
```

Or from `backend/`:

```bash
LOCAL_DATABASE_URL="postgresql://geo:geo123@localhost:5432/geo_wushu" \
npm run db:dump:local
```

## Import into Neon test database

Use the direct Neon URL for the target branch or test database. The script refuses pooled Neon URLs and refuses to run unless `CONFIRM_RESET=yes` is set.

From the repo root:

```bash
TARGET_DATABASE_URL="postgresql://USER:PASSWORD@ep-...neon.tech/neondb?sslmode=require" \
CONFIRM_RESET=yes \
npm run db:restore:neon
```

Or from `backend/`:

```bash
TARGET_DATABASE_URL="postgresql://USER:PASSWORD@ep-...neon.tech/neondb?sslmode=require" \
CONFIRM_RESET=yes \
npm run db:restore:neon
```

If you exported to a non-default path, also set `DUMP_FILE=/absolute/path/to.dump` or a path relative to `backend/`, such as `DUMP_FILE=tmp/test-data.dump`.

## Point Railway to the Neon test database afterwards

For this repo, the backend runtime uses `DATABASE_URL`.

To test against the copied data safely:

1. Create or choose a Neon test branch/database.
2. Import the dump into that test target.
3. In the Railway backend service used for testing, update `DATABASE_URL` to that Neon test database connection string.
4. Redeploy the Railway backend service.
5. Verify the backend against `/api/health` and a simple public route before testing auth flows.

Do this on a test Railway service or test environment, not on production.

## Safety warning

- Do not point `TARGET_DATABASE_URL` at production unless you really intend to replace data there.
- The restore command uses `--clean --if-exists`, so existing objects from the dump may be dropped and recreated.
- Keep production and test Neon branches clearly separated.
