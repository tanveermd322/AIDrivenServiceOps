/**
 * Demo / mock data used while the live Databricks ServiceNow schema is not
 * wired up (USE_LIVE_DATA = false in index.ts). Rows are already in
 * canonical UI shape — no adapter translation needed.
 */

import type { QueryKey } from "./types";

function days(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const PRIORITIES = ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"];
const STATES = ["Open", "In Progress", "Resolved", "Closed", "Pending"];
const CATEGORIES = ["Network", "Hardware", "Software", "Database", "Security", "Cloud Infrastructure", "Application", "Storage", "Authentication", "DNS"];
const SUBCATEGORIES = ["Timeout", "Crash", "Latency", "Disk Full", "Memory Leak", "CPU Spike", "Connection Refused", "Certificate Expired"];
const GROUPS = ["Infra-Ops", "Cloud-SRE", "Database-Admin", "Network-Eng", "Security-Ops", "App-Support", "DevOps", "Platform-Eng"];
const CIS = ["web-prod-01", "api-gateway-03", "db-primary-02", "cache-redis-01", "lb-edge-05", "auth-svc-02", "queue-kafka-01", "storage-nas-04", "dns-resolver-01", "monitoring-hub"];
const SOURCES = ["Dynatrace", "Manual", "Email", "ServiceDesk", "Dynatrace", "Dynatrace", "Manual", "Monitoring"];

function makeDemoIncidents() {
  const incidents: any[] = [];
  for (let i = 0; i < 120; i++) {
    const pri = PRIORITIES[i % 4];
    const stateIdx = i < 20 ? 0 : i < 40 ? 1 : i < 80 ? 2 : i < 100 ? 3 : 4;
    const opened = days(Math.floor(i * 0.25));
    const resolved = stateIdx >= 2 ? days(Math.floor(i * 0.25) - 1) : null;
    incidents.push({
      number: `INC${String(100000 + i)}`,
      short_description: `${CATEGORIES[i % CATEGORIES.length]} issue on ${CIS[i % CIS.length]} — ${SUBCATEGORIES[i % SUBCATEGORIES.length]}`,
      priority: pri,
      severity: String((i % 4) + 1),
      state: STATES[stateIdx],
      category: CATEGORIES[i % CATEGORIES.length],
      subcategory: SUBCATEGORIES[i % SUBCATEGORIES.length],
      assignment_group: GROUPS[i % GROUPS.length],
      assigned_to: `tech${(i % 12) + 1}@company.com`,
      cmdb_ci: CIS[i % CIS.length],
      source: SOURCES[i % SOURCES.length],
      impact: String((i % 3) + 1),
      urgency: String((i % 3) + 1),
      opened_at: opened,
      resolved_at: resolved,
      closed_at: stateIdx === 3 ? resolved : null,
    });
  }
  return incidents;
}

const DEMO_INCIDENTS = makeDemoIncidents();

export const DEMO: Record<QueryKey, any[]> = {
  incident_kpis: [
    { total_incidents: 120, resolved: 60, open_incidents: 20, critical_count: 30, dynatrace_alerts: 45, avg_resolution_hours: 8.3 },
  ],
  incidents: DEMO_INCIDENTS,
  by_priority: PRIORITIES.map((p, i) => ({ priority: p, count: [30, 30, 30, 30][i] })),
  by_category: CATEGORIES.map((c, i) => ({ category: c, count: 12 + (i % 5) * 3 })),
  by_state: [
    { state: "Open", count: 20 },
    { state: "In Progress", count: 20 },
    { state: "Resolved", count: 40 },
    { state: "Closed", count: 20 },
    { state: "Pending", count: 20 },
  ],
  trend_daily: Array.from({ length: 30 }, (_, i) => ({
    date: days(29 - i),
    count: 3 + Math.floor(Math.abs(Math.sin(i * 0.5)) * 8),
    critical_high: 1 + Math.floor(Math.abs(Math.cos(i * 0.7)) * 4),
  })),
  top_cis: CIS.map((ci, i) => ({
    cmdb_ci: ci,
    incident_count: 12 - i,
    critical_count: Math.max(0, 5 - i),
    dynatrace_count: Math.max(0, 6 - i),
  })),
  dynatrace_patterns: [
    { category: "Network", subcategory: "Timeout", cmdb_ci: "api-gateway-03", occurrence_count: 8, first_seen: days(28), last_seen: days(1), avg_duration_hours: 3.2 },
    { category: "Database", subcategory: "Latency", cmdb_ci: "db-primary-02", occurrence_count: 6, first_seen: days(25), last_seen: days(2), avg_duration_hours: 5.1 },
    { category: "Cloud Infrastructure", subcategory: "CPU Spike", cmdb_ci: "web-prod-01", occurrence_count: 5, first_seen: days(20), last_seen: days(3), avg_duration_hours: 2.8 },
    { category: "Application", subcategory: "Memory Leak", cmdb_ci: "auth-svc-02", occurrence_count: 4, first_seen: days(18), last_seen: days(5), avg_duration_hours: 6.7 },
    { category: "Storage", subcategory: "Disk Full", cmdb_ci: "storage-nas-04", occurrence_count: 3, first_seen: days(15), last_seen: days(7), avg_duration_hours: 1.5 },
  ],
  repeat_patterns: [
    { cmdb_ci: "api-gateway-03", category: "Network", short_description: "Network issue on api-gateway-03 — Timeout", repeat_count: 8, first_occurrence: days(28), latest_occurrence: days(1) },
    { cmdb_ci: "db-primary-02", category: "Database", short_description: "Database issue on db-primary-02 — Latency", repeat_count: 6, first_occurrence: days(25), latest_occurrence: days(2) },
    { cmdb_ci: "web-prod-01", category: "Cloud Infrastructure", short_description: "Cloud Infrastructure issue on web-prod-01 — CPU Spike", repeat_count: 5, first_occurrence: days(20), latest_occurrence: days(3) },
    { cmdb_ci: "auth-svc-02", category: "Application", short_description: "Application issue on auth-svc-02 — Memory Leak", repeat_count: 4, first_occurrence: days(18), latest_occurrence: days(5) },
  ],
  group_workload: GROUPS.map((g, i) => ({
    assignment_group: g,
    total: 15 - i,
    open_count: Math.max(1, 5 - i),
    avg_hours: +(4 + i * 1.2).toFixed(1),
  })),
  root_cause_candidates: CIS.slice(0, 8).map((ci, i) => ({
    cmdb_ci: ci,
    total_incidents: 12 - i,
    dynatrace_triggered: Math.max(1, 8 - i),
    distinct_categories: Math.min(4, 2 + i),
    high_sev_count: Math.max(1, 6 - i),
    first_incident: days(29),
    latest_incident: days(i),
    avg_resolution_hours: +(3 + i * 0.9).toFixed(1),
  })),
  by_source: [
    { source: "Dynatrace", count: 45 },
    { source: "Manual", count: 35 },
    { source: "Email", count: 20 },
    { source: "ServiceDesk", count: 12 },
    { source: "Monitoring", count: 8 },
  ],
};
