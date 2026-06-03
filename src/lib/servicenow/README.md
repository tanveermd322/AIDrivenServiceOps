# ServiceNow Interface Layer

This folder isolates **all** knowledge of the source ServiceNow schema in
Databricks from the React UI. The UI imports only `fetchServiceNow` and the
canonical types from `@/lib/servicenow` — it never sees raw source rows.

## Files

| File | Purpose | Edit when… |
|------|---------|-----------|
| `schema.config.json` | JSON map of source table/column/value → canonical UI field | **The target Databricks ServiceNow schema differs from the current one.** |
| `types.ts` | Canonical row shapes consumed by the UI | A *new* field is required by the UI (rare). Never rename existing fields. |
| `adapter.ts` | Reads `schema.config.json` and normalizes raw rows | A transformation can't be expressed via simple field/value mapping. |
| `demo-data.ts` | Mock rows (already canonical) used until live data is wired up | Demo data needs to change. |
| `index.ts` | Public `fetchServiceNow(key)` entry point + `USE_LIVE_DATA` flag | Flip `USE_LIVE_DATA = true` once Databricks is wired up. |

The edge function `supabase/functions/servicenow-query/index.ts` issues the
SQL against Databricks. Its SQL aliases all output columns to the **canonical
names** (see `types.ts`), so the adapter only has to re-map columns when the
edge function returns source-named columns. Mirror any schema change there
using `schema.config.json` as the source of truth for table & column names.

## Retargeting checklist (when the source schema changes)

1. Open `schema.config.json`.
2. Update `source.catalog`, `source.schema`, and `source.tables.incidents`.
3. Under `fieldMappings.incidents`, set each canonical field to the matching
   source column name (or SQL expression).
4. Under `valueMappings`, add any code→label translations
   (e.g. ServiceNow's integer priority codes).
5. Update the SQL in `supabase/functions/servicenow-query/index.ts` to read
   from the new table and alias outputs back to canonical names.
6. In `src/lib/servicenow/index.ts` flip `USE_LIVE_DATA = true`.
7. Done — **no UI file changes required.**
