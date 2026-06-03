/**
 * Interface Layer — Schema Adapter
 * --------------------------------------------------------------------
 * Translates raw rows coming back from the source ServiceNow table(s)
 * in Databricks into the canonical shapes defined in `types.ts`.
 *
 * The UI never calls this directly; it goes through `fetchServiceNow`
 * in `index.ts`, which applies the adapter before returning rows.
 *
 * To support a NEW target schema: edit `schema.config.json` (no code
 * changes here are usually required). If a transformation isn't
 * expressible via field/value mappings, add it inside `normalizeRow`.
 */

import schemaConfig from "./schema.config.json";
import type { QueryKey } from "./types";

type AnyRow = Record<string, any>;

const fieldMap: Record<string, Record<string, string>> =
  (schemaConfig as any).fieldMappings ?? {};
const valueMap: Record<string, Record<string, string>> =
  (schemaConfig as any).valueMappings ?? {};

/** Reverse-map: canonical UI field → source column. */
export function sourceColumn(table: string, canonicalField: string): string {
  return fieldMap[table]?.[canonicalField] ?? canonicalField;
}

/** Fully-qualified source table name (e.g. `samples.servicenow.incidents`). */
export function sourceTable(logicalName: string): string {
  const s = (schemaConfig as any).source;
  const phys = s.tables?.[logicalName] ?? logicalName;
  return [s.catalog, s.schema, phys].filter(Boolean).join(".");
}

/** Translate a single enum value if a mapping exists. */
function translateValue(field: string, value: any): any {
  if (value === null || value === undefined) return value;
  const map = valueMap[field];
  if (!map) return value;
  const key = String(value);
  // skip internal "_example_…" keys used purely as documentation
  const hit = Object.keys(map).find((k) => !k.startsWith("_") && k === key);
  return hit ? map[hit] : value;
}

/** Normalize a single row using field + value mappings for a logical table. */
export function normalizeRow(table: string, raw: AnyRow): AnyRow {
  const mapping = fieldMap[table];
  if (!mapping) return raw; // aggregated rows (kpi/trend/etc.) pass through

  const out: AnyRow = {};
  for (const canonical of Object.keys(mapping)) {
    const src = mapping[canonical];
    // Support both plain column names and SQL-expression aliases. When a SQL
    // expression is used in the query builder, the result column should be
    // aliased back to the canonical name, so we first try `canonical`, then
    // fall back to the configured source name.
    const value = raw[canonical] !== undefined ? raw[canonical] : raw[src];
    out[canonical] = translateValue(canonical, value);
  }
  return out;
}

/** Apply normalization to a result set keyed by QueryKey. */
export function adaptRows(key: QueryKey, rows: AnyRow[]): AnyRow[] {
  // Only the row-level `incidents` query carries field-level source columns
  // that may differ from canonical. Aggregations are produced by SQL with
  // canonical aliases already, so they pass through.
  if (key === "incidents") return rows.map((r) => normalizeRow("incidents", r));
  return rows;
}

export { schemaConfig };
