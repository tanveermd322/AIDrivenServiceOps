/**
 * Canonical types consumed by the UI layer.
 *
 * These shapes are STABLE — UI components depend on these field names.
 * When the source ServiceNow schema changes in Databricks, do NOT change
 * this file. Instead, update `schema.config.json` and (if needed) the
 * adapter in `adapter.ts` so the raw rows are normalized into these shapes.
 */

export type QueryKey =
  | "incident_kpis"
  | "incidents"
  | "by_priority"
  | "by_category"
  | "by_state"
  | "trend_daily"
  | "top_cis"
  | "dynatrace_patterns"
  | "repeat_patterns"
  | "group_workload"
  | "root_cause_candidates"
  | "by_source";

export interface Incident {
  number: string;
  short_description: string;
  priority: string;
  severity: string;
  state: string;
  category: string;
  subcategory: string | null;
  assignment_group: string | null;
  assigned_to: string | null;
  cmdb_ci: string | null;
  source: string;
  impact: string | null;
  urgency: string | null;
  opened_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface IncidentKpis {
  total_incidents: number;
  resolved: number;
  open_incidents: number;
  critical_count: number;
  dynatrace_alerts: number;
  avg_resolution_hours: number;
}

export interface CountByKey { count: number; [k: string]: any; }
export interface TrendPoint { date: string; count: number; critical_high: number; }
export interface TopCi { cmdb_ci: string; incident_count: number; critical_count: number; dynatrace_count: number; }
export interface PatternRow { cmdb_ci: string; category: string; [k: string]: any; }
export interface GroupWorkload { assignment_group: string; total: number; open_count: number; avg_hours: number; }
export interface RootCauseCandidate {
  cmdb_ci: string;
  total_incidents: number;
  dynatrace_triggered: number;
  distinct_categories: number;
  high_sev_count: number;
  first_incident: string;
  latest_incident: string;
  avg_resolution_hours: number;
}

export type QueryResult<K extends QueryKey> =
  K extends "incident_kpis" ? IncidentKpis[] :
  K extends "incidents" ? Incident[] :
  K extends "trend_daily" ? TrendPoint[] :
  K extends "top_cis" ? TopCi[] :
  K extends "group_workload" ? GroupWorkload[] :
  K extends "root_cause_candidates" ? RootCauseCandidate[] :
  K extends "dynatrace_patterns" | "repeat_patterns" ? PatternRow[] :
  CountByKey[];
