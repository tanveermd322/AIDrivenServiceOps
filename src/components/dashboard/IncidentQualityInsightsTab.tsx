import { useMemo, useState } from "react";
import { useTimeRange } from "@/contexts/TimeRangeContext";
import { useAppFocus } from "@/contexts/AppFocusContext";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { renderPieValueLabel } from "@/lib/chart-utils";
import {
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Tag,
  Link2,
  Users,
  Lightbulb,
  CheckCircle2,
  Landmark,
  Wrench,
  TimerReset,
} from "lucide-react";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

// ──────────────────────────────────────────────────────────────────────
// Sample incident records pulled from ServiceNow with quality-relevant
// fields. In banking, regulators (e.g. FCA OpRes, DORA, MAS TRM) expect
// auditable, complete and well-classified incident data.
// ──────────────────────────────────────────────────────────────────────
type IncidentRecord = {
  id: string;
  shortDescription: string;
  description: string;
  category: string | null;
  subcategory: string | null;
  priority: "P1" | "P2" | "P3" | "P4";
  state: "Open" | "In Progress" | "Resolved" | "Closed";
  cmdbCi: string | null;
  assignmentGroup: string | null;
  assignedTo: string | null;
  resolutionCode: string | null;
  resolutionNotes: string | null;
  customerImpact: string | null;
  businessService: string | null;
  linkedProblem: string | null;
  linkedChange: string | null;
  workNotesCount: number;
  reopenedCount: number;
  openedAt: string;
  resolvedAt: string | null;
  slaTarget: string;
  slaBreached: boolean;
};

const INCIDENTS: IncidentRecord[] = [
  {
    id: "INC0042118",
    shortDescription: "issue with payments",
    description: "user reported a problem.",
    category: null,
    subcategory: null,
    priority: "P1",
    state: "Resolved",
    cmdbCi: null,
    assignmentGroup: "App-Support",
    assignedTo: "s.patel",
    resolutionCode: null,
    resolutionNotes: "fixed",
    customerImpact: null,
    businessService: "Retail Payments",
    linkedProblem: null,
    linkedChange: null,
    workNotesCount: 1,
    reopenedCount: 1,
    openedAt: "2026-05-14T08:12:00Z",
    resolvedAt: "2026-05-14T13:02:00Z",
    slaTarget: "4h",
    slaBreached: true,
  },
  {
    id: "INC0042205",
    shortDescription: "SWIFT MT103 failures spike on payment-gateway-eu1 — 14% rejection rate",
    description: "Between 09:40 and 10:25 UTC, SWIFT MT103 outbound rejections spiked from baseline 0.4% to 14% on payment-gateway-eu1. Root cause traced to expired ISO20022 schema cache. Mitigated by forcing cache refresh.",
    category: "Payments",
    subcategory: "SWIFT",
    priority: "P1",
    state: "Closed",
    cmdbCi: "payment-gateway-eu1",
    assignmentGroup: "Payments-Ops",
    assignedTo: "n.iyer",
    resolutionCode: "Configuration — Cache refresh",
    resolutionNotes: "Forced ISO20022 schema cache refresh on all 4 nodes. Added monitor for schema TTL. Permanent fix tracked under PRB0019842.",
    customerImpact: "Corporate clients — delayed settlements 45min",
    businessService: "Wholesale Payments",
    linkedProblem: "PRB0019842",
    linkedChange: "CHG0098112",
    workNotesCount: 12,
    reopenedCount: 0,
    openedAt: "2026-05-12T09:42:00Z",
    resolvedAt: "2026-05-12T11:18:00Z",
    slaTarget: "2h",
    slaBreached: false,
  },
  {
    id: "INC0042310",
    shortDescription: "card auth latency",
    description: "Cards auth slow.",
    category: "Cards",
    subcategory: null,
    priority: "P2",
    state: "Resolved",
    cmdbCi: "card-auth-svc-02",
    assignmentGroup: "Cards-Ops",
    assignedTo: null,
    resolutionCode: "Workaround",
    resolutionNotes: "rebooted",
    customerImpact: null,
    businessService: "Card Issuing",
    linkedProblem: null,
    linkedChange: null,
    workNotesCount: 2,
    reopenedCount: 0,
    openedAt: "2026-05-18T14:22:00Z",
    resolvedAt: "2026-05-18T19:08:00Z",
    slaTarget: "4h",
    slaBreached: true,
  },
  {
    id: "INC0042388",
    shortDescription: "Mobile banking login outage — iOS clients, EU region",
    description: "iOS mobile clients in EU region unable to login between 06:00–06:35 UTC. Identity service auth-svc-eu2 returned 503 for OAuth token endpoint due to thread pool exhaustion after deploy CHG0098201.",
    category: "Authentication",
    subcategory: "Mobile",
    priority: "P1",
    state: "Closed",
    cmdbCi: "auth-svc-eu2",
    assignmentGroup: "Identity",
    assignedTo: "j.adams",
    resolutionCode: "Rollback — Failed change",
    resolutionNotes: "Rolled back CHG0098201. Restored capacity. Post-incident: thread-pool sizing missing in pre-prod test plan; raised PRB0019844.",
    customerImpact: "≈ 38,000 retail customers — login failure 35 min",
    businessService: "Retail Mobile Banking",
    linkedProblem: "PRB0019844",
    linkedChange: "CHG0098201",
    workNotesCount: 18,
    reopenedCount: 0,
    openedAt: "2026-05-22T06:04:00Z",
    resolvedAt: "2026-05-22T06:48:00Z",
    slaTarget: "1h",
    slaBreached: false,
  },
  {
    id: "INC0042401",
    shortDescription: "issue",
    description: "see ticket",
    category: null,
    subcategory: null,
    priority: "P3",
    state: "Closed",
    cmdbCi: null,
    assignmentGroup: null,
    assignedTo: "tech7",
    resolutionCode: null,
    resolutionNotes: null,
    customerImpact: null,
    businessService: null,
    linkedProblem: null,
    linkedChange: null,
    workNotesCount: 0,
    reopenedCount: 2,
    openedAt: "2026-05-20T10:00:00Z",
    resolvedAt: "2026-05-21T16:00:00Z",
    slaTarget: "8h",
    slaBreached: true,
  },
  {
    id: "INC0042455",
    shortDescription: "ATM cash dispense fault — branch 0412 Frankfurt",
    description: "ATM unit FFM-0412-03 reported cassette-3 jam. Engineer dispatched, jam cleared, cassette reseated. No customer cash discrepancy after reconciliation.",
    category: "Channels",
    subcategory: "ATM",
    priority: "P3",
    state: "Closed",
    cmdbCi: "atm-ffm-0412-03",
    assignmentGroup: "ATM-Field-Ops",
    assignedTo: "d.lee",
    resolutionCode: "Hardware — Field repair",
    resolutionNotes: "Cleared cassette-3 jam; ran 50-note test cycle clean. Reconciled $0 variance.",
    customerImpact: "Single ATM offline 2h",
    businessService: "ATM Channel",
    linkedProblem: null,
    linkedChange: null,
    workNotesCount: 6,
    reopenedCount: 0,
    openedAt: "2026-05-19T11:30:00Z",
    resolvedAt: "2026-05-19T13:25:00Z",
    slaTarget: "4h",
    slaBreached: false,
  },
  {
    id: "INC0042502",
    shortDescription: "AML batch failed",
    description: "AML batch failed last night, rerun.",
    category: "Compliance",
    subcategory: null,
    priority: "P2",
    state: "Closed",
    cmdbCi: "aml-batch-01",
    assignmentGroup: "Compliance-Eng",
    assignedTo: "k.varma",
    resolutionCode: null,
    resolutionNotes: "reran ok",
    customerImpact: null,
    businessService: "AML / KYC",
    linkedProblem: null,
    linkedChange: null,
    workNotesCount: 3,
    reopenedCount: 1,
    openedAt: "2026-05-17T02:10:00Z",
    resolvedAt: "2026-05-17T09:40:00Z",
    slaTarget: "6h",
    slaBreached: true,
  },
  {
    id: "INC0042560",
    shortDescription: "Online banking session drops — corp portal",
    description: "Corporate online banking users intermittently logged out mid-session. Traced to load balancer lb-corp-04 sticky-session misconfig after CHG0098230.",
    category: "Channels",
    subcategory: "Online Banking",
    priority: "P2",
    state: "Closed",
    cmdbCi: "lb-corp-04",
    assignmentGroup: "Network-Eng",
    assignedTo: "m.singh",
    resolutionCode: "Configuration — LB stickiness",
    resolutionNotes: "Re-enabled cookie-based stickiness; validated 30min session retention across 4 backends. PRB raised for change-control gap.",
    customerImpact: "≈ 1,200 corporate users session interruptions",
    businessService: "Corporate Online Banking",
    linkedProblem: "PRB0019850",
    linkedChange: "CHG0098230",
    workNotesCount: 9,
    reopenedCount: 0,
    openedAt: "2026-05-23T15:00:00Z",
    resolvedAt: "2026-05-23T16:48:00Z",
    slaTarget: "4h",
    slaBreached: false,
  },
  {
    id: "INC0042611",
    shortDescription: "db slow",
    description: "db is slow on core banking, please check",
    category: null,
    subcategory: null,
    priority: "P1",
    state: "Open",
    cmdbCi: null,
    assignmentGroup: "Database-Admin",
    assignedTo: null,
    resolutionCode: null,
    resolutionNotes: null,
    customerImpact: null,
    businessService: "Core Banking",
    linkedProblem: null,
    linkedChange: null,
    workNotesCount: 0,
    reopenedCount: 0,
    openedAt: "2026-05-27T08:00:00Z",
    resolvedAt: null,
    slaTarget: "1h",
    slaBreached: true,
  },
  {
    id: "INC0042702",
    shortDescription: "FX rate feed stale — Reuters channel timeout on fx-feed-prod-02",
    description: "Reuters FX rate feed on fx-feed-prod-02 went stale at 13:14 UTC due to upstream TCP timeout. Failover to Bloomberg feed activated automatically. No quoted prices breached tolerance.",
    category: "Markets",
    subcategory: "FX Feeds",
    priority: "P2",
    state: "Closed",
    cmdbCi: "fx-feed-prod-02",
    assignmentGroup: "Markets-Ops",
    assignedTo: "a.morales",
    resolutionCode: "Failover — Automatic",
    resolutionNotes: "Bloomberg failover engaged within 12s. Reuters channel restored 14:02 UTC. Added alert for >5s stale on primary.",
    customerImpact: "None — auto-failover absorbed",
    businessService: "FX Trading",
    linkedProblem: null,
    linkedChange: null,
    workNotesCount: 7,
    reopenedCount: 0,
    openedAt: "2026-05-21T13:14:00Z",
    resolvedAt: "2026-05-21T14:10:00Z",
    slaTarget: "2h",
    slaBreached: false,
  },
  {
    id: "INC0042745",
    shortDescription: "test ticket pls ignore",
    description: "test",
    category: "Application",
    subcategory: null,
    priority: "P4",
    state: "Closed",
    cmdbCi: null,
    assignmentGroup: "App-Support",
    assignedTo: "s.patel",
    resolutionCode: "Other",
    resolutionNotes: "test",
    customerImpact: null,
    businessService: null,
    linkedProblem: null,
    linkedChange: null,
    workNotesCount: 1,
    reopenedCount: 0,
    openedAt: "2026-05-24T12:00:00Z",
    resolvedAt: "2026-05-24T12:05:00Z",
    slaTarget: "24h",
    slaBreached: false,
  },
  {
    id: "INC0042780",
    shortDescription: "loan origination 500 errors",
    description: "loan-orig-api throwing 500s, check",
    category: "Application",
    subcategory: null,
    priority: "P2",
    state: "Resolved",
    cmdbCi: "loan-orig-api-01",
    assignmentGroup: "Lending-Ops",
    assignedTo: "r.osei",
    resolutionCode: null,
    resolutionNotes: "restarted pod",
    customerImpact: null,
    businessService: "Lending",
    linkedProblem: null,
    linkedChange: null,
    workNotesCount: 2,
    reopenedCount: 0,
    openedAt: "2026-05-25T09:20:00Z",
    resolvedAt: "2026-05-25T10:15:00Z",
    slaTarget: "4h",
    slaBreached: false,
  },
];

// ──────────────────────────────────────────────────────────────────────
// Quality engine — banking-domain rule set
// ──────────────────────────────────────────────────────────────────────
type Gap =
  | "Vague description"
  | "Missing classification"
  | "Missing CI"
  | "Missing assignee"
  | "Weak resolution"
  | "No customer impact"
  | "No problem link (P1/P2)"
  | "No change link (failed change)"
  | "Reopened"
  | "Audit trail thin"
  | "Test/Noise record";

type Grade = "Excellent" | "Good" | "Needs work" | "Poor";

type Recommendation = {
  score: number; // 0–100
  grade: Grade;
  gaps: Gap[];
  rationale: string[];
  bestPractice: string[];
  suggestedShortDescription?: string;
  suggestedResolutionNotes?: string;
};

const VAGUE_TOKENS = ["issue", "problem", "slow", "broken", "fix", "test", "pls", "please check", "see ticket"];

const isVague = (text: string) => {
  const t = (text ?? "").trim().toLowerCase();
  if (t.length < 25) return true;
  const wordCount = t.split(/\s+/).length;
  if (wordCount < 5) return true;
  if (VAGUE_TOKENS.some((tok) => t === tok || t.startsWith(tok + " ") || t.endsWith(" " + tok))) return true;
  return false;
};

const recommendFor = (r: IncidentRecord): Recommendation => {
  const gaps: Gap[] = [];
  const rationale: string[] = [];
  const bestPractice: string[] = [];

  const isMajor = r.priority === "P1" || r.priority === "P2";

  // Vague / test record
  if (/test|ignore/i.test(r.shortDescription) || /^test$/i.test(r.description ?? "")) {
    gaps.push("Test/Noise record");
    rationale.push("Record looks like a test/noise ticket — exclude from KPIs and close with audit note.");
    bestPractice.push("Banking audit: tag and exclude test tickets via a 'noise' close-code, never leave them in resolved counts.");
  }
  if (isVague(r.shortDescription) || isVague(r.description ?? "")) {
    gaps.push("Vague description");
    rationale.push("Short description / description lacks who/what/where/when needed for regulator-grade audit.");
    bestPractice.push("Follow the 5W1H pattern: business service · symptom · scope · time window · affected CI.");
  }
  if (!r.category || !r.subcategory) {
    gaps.push("Missing classification");
    rationale.push("Category or subcategory missing — breaks trend analysis and DORA reporting buckets.");
    bestPractice.push("All payments / channels / markets incidents must carry category + subcategory before closure.");
  }
  if (!r.cmdbCi) {
    gaps.push("Missing CI");
    rationale.push("CMDB CI not linked — impact analysis and PCR cannot trace the affected service.");
    bestPractice.push("CI is mandatory for P1/P2 in regulated services (FCA OpRes traceability).");
  }
  if (!r.assignedTo) {
    gaps.push("Missing assignee");
    rationale.push("No individual assignee — accountability and PIR ownership unclear.");
  }
  if (!r.resolutionCode || !r.resolutionNotes || (r.resolutionNotes && r.resolutionNotes.trim().length < 25)) {
    gaps.push("Weak resolution");
    rationale.push("Resolution code missing or notes too short — fails post-incident review standards.");
    bestPractice.push("Resolution notes must state cause, action taken, verification step and forward-fix reference.");
  }
  if (isMajor && !r.customerImpact) {
    gaps.push("No customer impact");
    rationale.push("Major incident without quantified customer impact — required for regulatory reporting.");
    bestPractice.push("Quantify impact: customers affected, duration, channels, monetary exposure if any.");
  }
  if (isMajor && !r.linkedProblem) {
    gaps.push("No problem link (P1/P2)");
    rationale.push("Major incident without a linked Problem record — root cause governance gap.");
    bestPractice.push("Every P1/P2 must open or link a Problem within 24h for permanent fix tracking.");
  }
  if (r.linkedChange && /Rollback|Failed change/i.test(r.resolutionCode ?? "") && !r.linkedProblem) {
    gaps.push("No change link (failed change)");
    rationale.push("Failed change identified but no Problem raised — change-quality feedback loop broken.");
  }
  if (r.reopenedCount > 0) {
    gaps.push("Reopened");
    rationale.push(`Reopened ${r.reopenedCount} time(s) — premature closure or unverified fix.`);
    bestPractice.push("Verify resolution with the requester or monitoring before closure; banking SLAs penalise re-opens.");
  }
  if (r.workNotesCount < 2 && isMajor) {
    gaps.push("Audit trail thin");
    rationale.push("Fewer than 2 work notes on a major incident — insufficient timeline for PIR/audit.");
    bestPractice.push("Capture timeline entries at detection, triage, mitigation, verification, closure.");
  }

  // Score
  const penalty = gaps.reduce((s, g) => {
    if (g === "Test/Noise record") return s + 60;
    if (g === "Vague description") return s + 18;
    if (g === "Missing classification") return s + 14;
    if (g === "Missing CI") return s + 14;
    if (g === "Weak resolution") return s + 16;
    if (g === "No customer impact") return s + 12;
    if (g === "No problem link (P1/P2)") return s + 14;
    if (g === "No change link (failed change)") return s + 10;
    if (g === "Reopened") return s + 10;
    if (g === "Audit trail thin") return s + 10;
    if (g === "Missing assignee") return s + 6;
    return s + 8;
  }, 0);
  const score = Math.max(0, 100 - penalty);
  const grade: Grade = score >= 85 ? "Excellent" : score >= 65 ? "Good" : score >= 40 ? "Needs work" : "Poor";

  // Drafts
  let suggestedShortDescription: string | undefined;
  let suggestedResolutionNotes: string | undefined;

  if (gaps.includes("Vague description")) {
    const svc = r.businessService ?? r.category ?? "<service>";
    const ci = r.cmdbCi ?? "<ci>";
    suggestedShortDescription = `${svc} — symptom on ${ci} between ${r.openedAt.slice(11, 16)}–${(r.resolvedAt ?? "").slice(11, 16) || "ongoing"} UTC (priority ${r.priority})`;
  }
  if (gaps.includes("Weak resolution")) {
    suggestedResolutionNotes = [
      `Cause: <root cause confirmed by diagnostic evidence on ${r.cmdbCi ?? "<ci>"}>.`,
      `Action: <step-by-step mitigation applied>.`,
      `Verification: <how steady-state was confirmed — monitor, synthetic, business sign-off>.`,
      `Forward fix: <Problem / Change reference for permanent remediation>.`,
      `Customer impact: <quantified scope and duration>.`,
    ].join("\n");
  }

  return { score, grade, gaps, rationale, bestPractice, suggestedShortDescription, suggestedResolutionNotes };
};

const gapColors: Record<Gap, string> = {
  "Vague description": "bg-amber-100 text-amber-700 border-amber-300",
  "Missing classification": "bg-amber-100 text-amber-700 border-amber-300",
  "Missing CI": "bg-orange-100 text-orange-700 border-orange-300",
  "Missing assignee": "bg-amber-100 text-amber-700 border-amber-300",
  "Weak resolution": "bg-orange-100 text-orange-700 border-orange-300",
  "No customer impact": "bg-orange-100 text-orange-700 border-orange-300",
  "No problem link (P1/P2)": "bg-destructive/10 text-destructive border-destructive/30",
  "No change link (failed change)": "bg-destructive/10 text-destructive border-destructive/30",
  "Reopened": "bg-destructive/10 text-destructive border-destructive/30",
  "Audit trail thin": "bg-amber-100 text-amber-700 border-amber-300",
  "Test/Noise record": "bg-secondary text-muted-foreground border-border",
};

const gradeColors: Record<Grade, string> = {
  "Excellent": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Good": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Needs work": "bg-amber-100 text-amber-700 border-amber-300",
  "Poor": "bg-destructive/10 text-destructive border-destructive/30",
};

type KpiKey = null | "poor" | "vague" | "missingCi" | "weakRes" | "majorNoProblem";

export const IncidentQualityInsightsTab = () => {
  const [kpiDrill, setKpiDrill] = useState<KpiKey>(null);
  const [selected, setSelected] = useState<IncidentRecord | null>(null);
  const [gradeFilter, setGradeFilter] = useState<Grade | null>(null);
  const [gapFilter, setGapFilter] = useState<Gap | null>(null);
  const [accepted, setAccepted] = useState<Record<string, true>>({});

  const { isInRange } = useTimeRange();
  const { matchesApp } = useAppFocus();
  const incidentsInRange = useMemo(
    () => INCIDENTS.filter((i) => isInRange(i.openedAt) && matchesApp((i as any).application ?? (i as any).cmdb_ci ?? "")),
    [isInRange, matchesApp],
  );

  const enriched = useMemo(
    () => incidentsInRange.map((i) => ({ record: i, rec: recommendFor(i) })),
    [incidentsInRange],
  );

  const totals = useMemo(() => {
    const poor = enriched.filter((e) => e.rec.grade === "Poor" || e.rec.grade === "Needs work").length;
    const vague = enriched.filter((e) => e.rec.gaps.includes("Vague description")).length;
    const missingCi = enriched.filter((e) => e.rec.gaps.includes("Missing CI")).length;
    const weakRes = enriched.filter((e) => e.rec.gaps.includes("Weak resolution")).length;
    const majorNoProblem = enriched.filter((e) => e.rec.gaps.includes("No problem link (P1/P2)")).length;
    const avgScore = Math.round(
      enriched.reduce((s, e) => s + e.rec.score, 0) / Math.max(enriched.length, 1),
    );
    return { poor, vague, missingCi, weakRes, majorNoProblem, avgScore };
  }, [enriched]);

  const gradeMix = useMemo(() => {
    const out: Record<string, number> = {};
    enriched.forEach((e) => (out[e.rec.grade] = (out[e.rec.grade] ?? 0) + 1));
    return Object.entries(out).map(([grade, count]) => ({ grade, count }));
  }, [enriched]);

  const gapMix = useMemo(() => {
    const out: Record<string, number> = {};
    enriched.forEach((e) => e.rec.gaps.forEach((g) => (out[g] = (out[g] ?? 0) + 1)));
    return Object.entries(out)
      .map(([gap, count]) => ({ gap, count }))
      .sort((a, b) => b.count - a.count);
  }, [enriched]);

  const gradeColor = (g: string) => {
    if (g === "Excellent") return "hsl(142 55% 38%)";
    if (g === "Good") return "hsl(142 55% 50%)";
    if (g === "Needs work") return "hsl(38 92% 50%)";
    return "hsl(0 72% 51%)";
  };

  const visible = enriched.filter((e) => {
    if (gradeFilter && e.rec.grade !== gradeFilter) return false;
    if (gapFilter && !e.rec.gaps.includes(gapFilter)) return false;
    return true;
  });

  const drillTitle: Record<Exclude<KpiKey, null>, string> = {
    poor: "Poor / Needs-work incidents",
    vague: "Incidents with vague description",
    missingCi: "Incidents missing CMDB CI",
    weakRes: "Incidents with weak resolution notes",
    majorNoProblem: "Major incidents without a linked Problem",
  };

  const drillRecords = (key: Exclude<KpiKey, null>) =>
    enriched.filter((e) => {
      if (key === "poor") return e.rec.grade === "Poor" || e.rec.grade === "Needs work";
      if (key === "vague") return e.rec.gaps.includes("Vague description");
      if (key === "missingCi") return e.rec.gaps.includes("Missing CI");
      if (key === "weakRes") return e.rec.gaps.includes("Weak resolution");
      return e.rec.gaps.includes("No problem link (P1/P2)");
    });

  return (
    <div className="space-y-6">
      {/* Persona / value banner */}
      <SectionCard
        title="Incident Quality Insights"
        description="For Service Operations — detect poor-quality incident records in ServiceNow, explain the quality gaps and recommend improvements aligned with banking-domain best practices (FCA OpRes, DORA, MAS TRM)."
      >
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Target persona</p>
            <p className="text-muted-foreground mt-1">Service Operations leads, incident managers and quality assurance for ITSM.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Business value</p>
            <p className="text-muted-foreground mt-1">Improve quality of incident data — audit-ready records, sharper trend analysis, faster PIRs and stronger regulator posture.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" /> Banking lens</p>
            <p className="text-muted-foreground mt-1">Rules calibrated to payments, channels, markets and lending — mandatory CI linkage, customer-impact quantification, problem traceability on majors.</p>
          </div>
        </div>
      </SectionCard>

      {/* Interactive KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Avg quality score" value={`${totals.avgScore}/100`} icon={ClipboardCheck} hint="across all records" />
        <KpiCard label="Poor / Needs work" value={totals.poor} icon={ShieldAlert} accent hint="grade <65" onClick={() => setKpiDrill("poor")} />
        <KpiCard label="Vague descriptions" value={totals.vague} icon={FileText} hint="fail 5W1H" onClick={() => setKpiDrill("vague")} />
        <KpiCard label="Missing CI" value={totals.missingCi} icon={Tag} accent hint="no CMDB link" onClick={() => setKpiDrill("missingCi")} />
        <KpiCard label="Majors w/o Problem" value={totals.majorNoProblem} icon={Link2} accent hint="P1/P2 no PRB" onClick={() => setKpiDrill("majorNoProblem")} />
      </section>

      {/* Charts */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <SectionCard title="Quality grade mix" description="Click a slice to filter the table">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={gradeMix}
                dataKey="count"
                nameKey="grade"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                label={renderPieValueLabel}
                labelLine={false}
                onClick={(d: any) => d?.grade && setGradeFilter(d.grade as Grade)}
                className="cursor-pointer"
              >
                {gradeMix.map((d, i) => (
                  <Cell key={i} fill={gradeColor(d.grade)} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {gradeMix.map((d) => (
              <button
                key={d.grade}
                onClick={() => setGradeFilter(d.grade as Grade)}
                className="flex w-full items-center justify-between text-xs hover:bg-secondary/60 rounded px-1 py-0.5"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: gradeColor(d.grade) }} />
                  {d.grade}
                </span>
                <span className="tabular-nums text-muted-foreground">{d.count}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Top quality gaps"
          description="Click a bar to filter the table by that gap"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={gapMix} layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis dataKey="gap" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} width={160} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="count"
                fill="hsl(var(--chart-2))"
                radius={[0, 6, 6, 0]}
                className="cursor-pointer"
                onClick={(d: any) => d?.gap && setGapFilter(d.gap as Gap)}
              />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </section>

      {/* Active filters */}
      {(gradeFilter || gapFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {gradeFilter && (
            <Badge variant="outline" className="gap-1">
              Grade: {gradeFilter}
              <button onClick={() => setGradeFilter(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </Badge>
          )}
          {gapFilter && (
            <Badge variant="outline" className="gap-1">
              Gap: {gapFilter}
              <button onClick={() => setGapFilter(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </Badge>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setGradeFilter(null); setGapFilter(null); }}>Clear</Button>
        </div>
      )}

      {/* Catalogue */}
      <SectionCard title="Incident records" description="Click a row to open the quality workspace">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Short description</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Gaps</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(({ record, rec }) => (
              <TableRow key={record.id} className="cursor-pointer" onClick={() => setSelected(record)}>
                <TableCell className="font-mono text-xs">{record.id}</TableCell>
                <TableCell className="max-w-[320px] truncate">{record.shortDescription}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{record.priority}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {rec.gaps.length === 0 ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">Clean</Badge>
                    ) : (
                      rec.gaps.slice(0, 3).map((g) => (
                        <button
                          key={g}
                          onClick={(e) => { e.stopPropagation(); setGapFilter(g); }}
                          className="inline-flex"
                        >
                          <Badge variant="outline" className={`text-[10px] ${gapColors[g]}`}>{g}</Badge>
                        </button>
                      ))
                    )}
                    {rec.gaps.length > 3 && (
                      <Badge variant="outline" className="text-[10px]">+{rec.gaps.length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <button onClick={(e) => { e.stopPropagation(); setGradeFilter(rec.grade); }}>
                    <Badge variant="outline" className={`text-[11px] ${gradeColors[rec.grade]}`}>
                      {accepted[record.id] ? `${rec.grade} ✓` : rec.grade}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs font-semibold">{rec.score}</TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-6">
                  No incidents match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>

      {/* KPI drill dialog */}
      <Dialog open={kpiDrill !== null} onOpenChange={(o) => !o && setKpiDrill(null)}>
        <DialogContent className="max-w-3xl">
          {kpiDrill && (
            <>
              <DialogHeader>
                <DialogTitle>{drillTitle[kpiDrill]}</DialogTitle>
                <DialogDescription>Click a row to open the quality workspace.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Short description</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillRecords(kpiDrill).map(({ record, rec }) => (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer"
                        onClick={() => { setKpiDrill(null); setSelected(record); }}
                      >
                        <TableCell className="font-mono text-xs">{record.id}</TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate">{record.shortDescription}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{record.priority}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={`text-[11px] ${gradeColors[rec.grade]}`}>{rec.grade}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{rec.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Incident workspace dialog */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selected && (() => {
            const rec = recommendFor(selected);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" /> {selected.id} — {selected.shortDescription}
                  </DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">{selected.priority}</Badge>
                    <Badge variant="outline" className="text-[11px]">{selected.state}</Badge>
                    <Badge variant="outline" className={`text-[11px] ${gradeColors[rec.grade]}`}>
                      {rec.grade} · {rec.score}/100
                    </Badge>
                    {selected.businessService && (
                      <span className="text-[11px] text-muted-foreground">
                        <Landmark className="inline h-3 w-3 mr-1" />{selected.businessService}
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>

                {/* Gaps */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-primary" /> Quality gaps detected
                    <Badge variant="outline" className="ml-auto text-[10px]">{rec.gaps.length} flag(s)</Badge>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.gaps.length === 0 && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">No gaps — record is audit-clean</Badge>
                    )}
                    {rec.gaps.map((g) => (
                      <Badge key={g} variant="outline" className={`text-[10px] ${gapColors[g]}`}>{g}</Badge>
                    ))}
                  </div>
                  <ul className="text-xs space-y-1 mt-1">
                    {rec.rationale.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">›</span>
                        <span className="text-muted-foreground">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Banking best practices */}
                {rec.bestPractice.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5" /> Banking-domain best practices
                    </p>
                    <ul className="text-xs space-y-1">
                      {rec.bestPractice.map((b, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-600 mt-0.5">•</span>
                          <span className="text-muted-foreground">{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Field snapshot */}
                <div className="grid gap-3 sm:grid-cols-4 text-xs">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{selected.category ?? <span className="text-destructive">— missing —</span>}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">CMDB CI</p>
                    <p className="font-mono">{selected.cmdbCi ?? <span className="text-destructive">— missing —</span>}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">Assigned to</p>
                    <p className="font-medium">{selected.assignedTo ?? <span className="text-destructive">— unassigned —</span>}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">Reopened</p>
                    <p className="font-semibold tabular-nums flex items-center gap-1">
                      <TimerReset className="h-3 w-3" />{selected.reopenedCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3 sm:col-span-2">
                    <p className="text-muted-foreground">Customer impact</p>
                    <p>{selected.customerImpact ?? <span className="text-destructive">— not captured —</span>}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">Linked Problem</p>
                    <p className="font-mono">{selected.linkedProblem ?? <span className="text-destructive">— none —</span>}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">Linked Change</p>
                    <p className="font-mono">{selected.linkedChange ?? "—"}</p>
                  </div>
                </div>

                {/* Current vs suggested */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-semibold mb-1">Current description</p>
                    <p className="text-xs text-muted-foreground">{selected.description || <em>— blank —</em>}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-semibold mb-1">Current resolution notes</p>
                    <p className="text-xs text-muted-foreground">{selected.resolutionNotes || <em>— blank —</em>}</p>
                  </div>
                </div>

                {/* Suggested rewrites */}
                {(rec.suggestedShortDescription || rec.suggestedResolutionNotes) && (
                  <div className="rounded-lg border border-border/60 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5" /> Suggested improvements
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => navigator.clipboard?.writeText(
                            [rec.suggestedShortDescription, rec.suggestedResolutionNotes].filter(Boolean).join("\n\n"),
                          )}
                        >
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => setAccepted((p) => ({ ...p, [selected.id]: true }))}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Apply
                        </Button>
                      </div>
                    </div>
                    {rec.suggestedShortDescription && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Short description</p>
                        <Textarea value={rec.suggestedShortDescription} readOnly className="text-xs min-h-[60px]" />
                      </div>
                    )}
                    {rec.suggestedResolutionNotes && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Resolution notes template</p>
                        <Textarea value={rec.suggestedResolutionNotes} readOnly className="font-mono text-[11px] min-h-[140px]" />
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
