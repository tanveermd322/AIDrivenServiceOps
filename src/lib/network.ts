// Mock data layer simulating a Datalake feed:
//   - Illumio  → allowed/denied east-west flows (PCE traffic)
//   - Tufin    → firewall rule base, change requests, rule hits
//   - CMDB     → business applications, CIs, owners, load balancers
// Plus ITSM linkage: Change / Incident / Problem records per app.

export type AppCriticality = "Tier 1" | "Tier 2" | "Tier 3";
export type FlowDecision = "ALLOW" | "DENY" | "NO_TRAFFIC";

export interface EnterpriseApp {
  app_id: string;
  name: string;
  owner: string;
  criticality: AppCriticality;
  environment: "Prod" | "Pre-Prod" | "Dev";
  ci_count: number;
  load_balancers: string[];
  // Network posture (aggregated from Illumio + Tufin)
  allowed_flows: number;
  denied_flows: number;
  silent_cis: number;          // CIs in CMDB with zero traffic in 14d
  open_high_risk_rules: number; // Tufin "ANY/ANY" or overly broad rules
  // ITSM
  open_incidents: number;
  open_problems: number;
  pending_changes: number;
  last_change: string;
  health_score: number; // 0–100
}

export interface FlowEdge {
  source_ci: string;
  source_app: string;
  dest_ci: string;
  dest_app: string;
  port: number;
  protocol: "TCP" | "UDP" | "ICMP";
  decision: FlowDecision;
  bytes_24h: number;
  rule_id: string | null;
  source: "Illumio" | "Tufin";
}

export interface FirewallRule {
  rule_id: string;
  source_zone: string;
  dest_zone: string;
  service: string;
  action: "Allow" | "Deny";
  hit_count_30d: number;
  last_hit: string | null;
  risk: "High" | "Medium" | "Low";
  linked_change: string | null;
  tufin_ticket: string;
}

export interface ItsmRecord {
  id: string;
  type: "Change" | "Incident" | "Problem";
  app_id: string;
  short_description: string;
  state: string;
  priority: string;
  opened_at: string;
  linked_rule?: string | null;
}

const days = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const ENTERPRISE_APPS: EnterpriseApp[] = [
  {
    app_id: "APP-001", name: "Payments Gateway (SWIFT / SEPA / Faster Payments)", owner: "payments-platform@bank",
    criticality: "Tier 1", environment: "Prod", ci_count: 42,
    load_balancers: ["lb-payments-edge-01", "lb-payments-int-02"],
    allowed_flows: 1284, denied_flows: 312, silent_cis: 3, open_high_risk_rules: 4,
    open_incidents: 5, open_problems: 2, pending_changes: 3,
    last_change: days(2), health_score: 62,
  },
  {
    app_id: "APP-002", name: "Retail Online & Mobile Banking", owner: "digital-channels@bank",
    criticality: "Tier 1", environment: "Prod", ci_count: 38,
    load_balancers: ["lb-portal-edge-01"],
    allowed_flows: 2104, denied_flows: 88, silent_cis: 1, open_high_risk_rules: 1,
    open_incidents: 2, open_problems: 0, pending_changes: 1,
    last_change: days(5), health_score: 88,
  },
  {
    app_id: "APP-003", name: "Core Banking Ledger", owner: "core-banking@bank",
    criticality: "Tier 1", environment: "Prod", ci_count: 56,
    load_balancers: ["lb-cbs-int-01", "lb-cbs-int-02"],
    allowed_flows: 1850, denied_flows: 540, silent_cis: 7, open_high_risk_rules: 6,
    open_incidents: 8, open_problems: 3, pending_changes: 4,
    last_change: days(1), health_score: 48,
  },
  {
    app_id: "APP-004", name: "Identity, SSO & Strong Customer Auth", owner: "secops@bank",
    criticality: "Tier 1", environment: "Prod", ci_count: 18,
    load_balancers: ["lb-idp-edge-01"],
    allowed_flows: 980, denied_flows: 22, silent_cis: 0, open_high_risk_rules: 0,
    open_incidents: 1, open_problems: 0, pending_changes: 0,
    last_change: days(14), health_score: 95,
  },
  {
    app_id: "APP-005", name: "Risk & Regulatory Data Warehouse", owner: "risk-data@bank",
    criticality: "Tier 1", environment: "Prod", ci_count: 24,
    load_balancers: ["lb-dwh-int-01"],
    allowed_flows: 612, denied_flows: 145, silent_cis: 4, open_high_risk_rules: 2,
    open_incidents: 3, open_problems: 1, pending_changes: 2,
    last_change: days(7), health_score: 71,
  },
  {
    app_id: "APP-006", name: "Trading & Order Management (FIX)", owner: "markets-tech@bank",
    criticality: "Tier 1", environment: "Prod", ci_count: 22,
    load_balancers: ["lb-fix-int-01"],
    allowed_flows: 740, denied_flows: 60, silent_cis: 2, open_high_risk_rules: 1,
    open_incidents: 1, open_problems: 1, pending_changes: 1,
    last_change: days(9), health_score: 80,
  },
  {
    app_id: "APP-007", name: "Public Marketing & Rates Site", owner: "marketing@bank",
    criticality: "Tier 3", environment: "Prod", ci_count: 8,
    load_balancers: ["lb-mkt-edge-01"],
    allowed_flows: 320, denied_flows: 12, silent_cis: 0, open_high_risk_rules: 0,
    open_incidents: 0, open_problems: 0, pending_changes: 0,
    last_change: days(20), health_score: 98,
  },
  {
    app_id: "APP-008", name: "AML / Sanctions Screening", owner: "financial-crime@bank",
    criticality: "Tier 1", environment: "Prod", ci_count: 14,
    load_balancers: ["lb-aml-int-01"],
    allowed_flows: 410, denied_flows: 95, silent_cis: 2, open_high_risk_rules: 1,
    open_incidents: 2, open_problems: 0, pending_changes: 1,
    last_change: days(4), health_score: 76,
  },
];

export const FLOWS: FlowEdge[] = [
  { source_ci: "web-payments-01", source_app: "APP-001", dest_ci: "api-payments-02", dest_app: "APP-001", port: 443, protocol: "TCP", decision: "ALLOW", bytes_24h: 8.2e9, rule_id: "TUF-1042", source: "Illumio" },
  { source_ci: "api-payments-02", source_app: "APP-001", dest_ci: "db-payments-01", dest_app: "APP-001", port: 5432, protocol: "TCP", decision: "ALLOW", bytes_24h: 3.4e9, rule_id: "TUF-1051", source: "Illumio" },
  { source_ci: "api-payments-02", source_app: "APP-001", dest_ci: "swift-gw-ext", dest_app: "EXT", port: 9443, protocol: "TCP", decision: "DENY", bytes_24h: 0, rule_id: null, source: "Illumio" },
  { source_ci: "web-portal-01", source_app: "APP-002", dest_ci: "api-portal-02", dest_app: "APP-002", port: 443, protocol: "TCP", decision: "ALLOW", bytes_24h: 12.1e9, rule_id: "TUF-2010", source: "Illumio" },
  { source_ci: "api-portal-02", source_app: "APP-002", dest_ci: "idp-svc-01", dest_app: "APP-004", port: 443, protocol: "TCP", decision: "ALLOW", bytes_24h: 1.1e9, rule_id: "TUF-4001", source: "Illumio" },
  { source_ci: "oms-app-03", source_app: "APP-003", dest_ci: "db-oms-01", dest_app: "APP-003", port: 1521, protocol: "TCP", decision: "ALLOW", bytes_24h: 6.7e9, rule_id: "TUF-3022", source: "Illumio" },
  { source_ci: "oms-app-03", source_app: "APP-003", dest_ci: "legacy-mq-04", dest_app: "APP-003", port: 1414, protocol: "TCP", decision: "DENY", bytes_24h: 0, rule_id: null, source: "Illumio" },
  { source_ci: "oms-batch-07", source_app: "APP-003", dest_ci: "dwh-loader-02", dest_app: "APP-005", port: 22, protocol: "TCP", decision: "ALLOW", bytes_24h: 0.8e9, rule_id: "TUF-5008", source: "Tufin" },
  { source_ci: "crm-app-02", source_app: "APP-006", dest_ci: "db-crm-01", dest_app: "APP-006", port: 1433, protocol: "TCP", decision: "ALLOW", bytes_24h: 2.2e9, rule_id: "TUF-6012", source: "Illumio" },
  { source_ci: "hr-app-01", source_app: "APP-008", dest_ci: "db-hr-01", dest_app: "APP-008", port: 5432, protocol: "TCP", decision: "ALLOW", bytes_24h: 0.4e9, rule_id: "TUF-8001", source: "Illumio" },
  { source_ci: "hr-app-01", source_app: "APP-008", dest_ci: "smtp-relay-01", dest_app: "SHARED", port: 25, protocol: "TCP", decision: "DENY", bytes_24h: 0, rule_id: null, source: "Illumio" },
  { source_ci: "db-payments-cold-09", source_app: "APP-001", dest_ci: "*", dest_app: "*", port: 0, protocol: "TCP", decision: "NO_TRAFFIC", bytes_24h: 0, rule_id: null, source: "Illumio" },
  { source_ci: "oms-archive-12", source_app: "APP-003", dest_ci: "*", dest_app: "*", port: 0, protocol: "TCP", decision: "NO_TRAFFIC", bytes_24h: 0, rule_id: null, source: "Illumio" },
];

export const FIREWALL_RULES: FirewallRule[] = [
  { rule_id: "TUF-1042", source_zone: "DMZ-Web", dest_zone: "Payments-App", service: "TCP/443", action: "Allow", hit_count_30d: 412000, last_hit: days(0), risk: "Low", linked_change: "CHG0045231", tufin_ticket: "T-9012" },
  { rule_id: "TUF-1051", source_zone: "Payments-App", dest_zone: "Payments-DB", service: "TCP/5432", action: "Allow", hit_count_30d: 188000, last_hit: days(0), risk: "Low", linked_change: "CHG0045118", tufin_ticket: "T-9009" },
  { rule_id: "TUF-9990", source_zone: "Any", dest_zone: "Payments-DB", service: "TCP/Any", action: "Allow", hit_count_30d: 24, last_hit: days(11), risk: "High", linked_change: null, tufin_ticket: "T-8821" },
  { rule_id: "TUF-3022", source_zone: "OMS-App", dest_zone: "OMS-DB", service: "TCP/1521", action: "Allow", hit_count_30d: 92000, last_hit: days(0), risk: "Low", linked_change: "CHG0045090", tufin_ticket: "T-8901" },
  { rule_id: "TUF-3300", source_zone: "OMS-App", dest_zone: "Legacy-MQ", service: "TCP/1414", action: "Deny", hit_count_30d: 540, last_hit: days(1), risk: "Medium", linked_change: null, tufin_ticket: "T-8990" },
  { rule_id: "TUF-5008", source_zone: "OMS-Batch", dest_zone: "DWH-Loader", service: "TCP/22", action: "Allow", hit_count_30d: 1200, last_hit: days(0), risk: "Medium", linked_change: "CHG0045200", tufin_ticket: "T-9020" },
  { rule_id: "TUF-7777", source_zone: "Any", dest_zone: "OMS-App", service: "TCP/Any", action: "Allow", hit_count_30d: 0, last_hit: null, risk: "High", linked_change: null, tufin_ticket: "T-8500" },
  { rule_id: "TUF-8001", source_zone: "HR-App", dest_zone: "HR-DB", service: "TCP/5432", action: "Allow", hit_count_30d: 14000, last_hit: days(0), risk: "Low", linked_change: "CHG0045010", tufin_ticket: "T-8700" },
];

export const ITSM_RECORDS: ItsmRecord[] = [
  { id: "CHG0045231", type: "Change", app_id: "APP-001", short_description: "Open TCP/443 from DMZ-Web → Payments-App", state: "Implemented", priority: "2 - High", opened_at: days(2), linked_rule: "TUF-1042" },
  { id: "INC0098771", type: "Incident", app_id: "APP-001", short_description: "Intermittent denies to SWIFT gateway (port 9443)", state: "In Progress", priority: "1 - Critical", opened_at: days(1), linked_rule: null },
  { id: "PRB0007712", type: "Problem", app_id: "APP-001", short_description: "Over-permissive rule TUF-9990 (ANY/ANY) flagged in audit", state: "Root Cause Analysis", priority: "2 - High", opened_at: days(11), linked_rule: "TUF-9990" },
  { id: "INC0098802", type: "Incident", app_id: "APP-003", short_description: "OMS → Legacy MQ blocked, batch jobs failing", state: "Open", priority: "1 - Critical", opened_at: days(1), linked_rule: "TUF-3300" },
  { id: "PRB0007720", type: "Problem", app_id: "APP-003", short_description: "Repeating MQ denies — missing firewall change", state: "Known Error", priority: "2 - High", opened_at: days(6), linked_rule: "TUF-3300" },
  { id: "CHG0045300", type: "Change", app_id: "APP-003", short_description: "Permit OMS-App → Legacy-MQ TCP/1414", state: "Scheduled", priority: "2 - High", opened_at: days(0), linked_rule: "TUF-3300" },
  { id: "INC0098830", type: "Incident", app_id: "APP-005", short_description: "DWH loader latency from OMS batch over SSH", state: "Open", priority: "3 - Medium", opened_at: days(2), linked_rule: "TUF-5008" },
  { id: "PRB0007733", type: "Problem", app_id: "APP-003", short_description: "Stale rule TUF-7777 (ANY/ANY) — zero hits in 90 days", state: "Pending Decommission", priority: "3 - Medium", opened_at: days(20), linked_rule: "TUF-7777" },
  { id: "INC0098850", type: "Incident", app_id: "APP-008", short_description: "HR app cannot reach SMTP relay (port 25 denied)", state: "Open", priority: "3 - Medium", opened_at: days(3), linked_rule: null },
  { id: "CHG0045318", type: "Change", app_id: "APP-002", short_description: "Add LB listener lb-portal-edge-01:8443", state: "Implemented", priority: "3 - Medium", opened_at: days(5), linked_rule: null },
];
