/**
 * Public entry point for the ServiceNow data layer.
 *
 * UI components import ONLY from "@/lib/servicenow" and call
 * `fetchServiceNow(key)`. They never touch raw rows, the edge function,
 * or the schema config directly — that separation is what lets us swap
 * the underlying Databricks/ServiceNow schema without touching UI code.
 *
 * Layers
 * ──────────────────────────────────────────────────────────────────────
 *  UI components (React) ─────►  fetchServiceNow(key)        ◄── stable
 *                                       │
 *                                       ▼
 *                             adapter.adaptRows()             ◄── interface
 *                                       │
 *                                       ▼
 *                       demo data  OR  Supabase edge fn
 *                                       │
 *                                       ▼
 *                          Databricks (raw ServiceNow)        ◄── source
 *
 * To retarget a different ServiceNow schema:
 *   1. Edit `schema.config.json` (table + field + value mappings).
 *   2. If the source returns codes that need bespoke logic, extend
 *      `adapter.ts › normalizeRow`.
 *   3. No UI files need to change.
 */

import { supabase } from "@/integrations/supabase/client";
import { adaptRows } from "./adapter";
import type { QueryKey } from "./types";
import { DEMO } from "./demo-data";

export type { QueryKey } from "./types";
export * from "./types";
export { schemaConfig, sourceColumn, sourceTable } from "./adapter";

// Flip to `true` once the target Databricks schema is wired up via the
// edge function. Demo data lets the UI render without a live backend.
const USE_LIVE_DATA = false;

async function fetchLive<T = Record<string, any>>(key: QueryKey) {
  const { data, error } = await supabase.functions.invoke("servicenow-query", {
    body: { key },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.rows ?? []) as T[];
}

export async function fetchServiceNow<T = Record<string, any>>(key: QueryKey) {
  const rows = USE_LIVE_DATA
    ? await fetchLive<T>(key)
    : await new Promise<T[]>((r) => setTimeout(() => r((DEMO[key] ?? []) as T[]), 300));
  return adaptRows(key, rows as any) as T[];
}
