import { useMemo, useState } from "react";
import { useAppFocus } from "@/contexts/AppFocusContext";
import { useTimeRange } from "@/contexts/TimeRangeContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Moon,
  ShieldAlert,
  Search,
  Server,
  Network,
  ListChecks,
  GitBranch,
  Sparkles,
  XCircle,
  Clock,
} from "lucide-react";

// ── Demo change requests ───────────────────────────────────────────────
type ChangeTask = {
  number: string;
  short_description: string;
  has_rollback: boolean;
  has_validation: boolean;
  duration_min: number;
  automated: boolean;
};

type ChangeRequest = {
  number: string;
  short_description: string;
  type: "Standard" | "Normal" | "Emergency";
  risk: "Low" | "Moderate" | "High";
  state: "New" | "Assess" | "Authorize" | "Scheduled" | "Implement";
  assignment_group: string;
  requested_by: string;
  planned_start: string;
  planned_end: string;
  cis: string[];
  dependent_apps: string[];
  tasks: ChangeTask[];
  has_backout_plan: boolean;
  has_test_plan: boolean;
  has_communication_plan: boolean;
  peer_reviewed: boolean;
  cab_approved: boolean;
  business_hours_only: boolean;
  description: string;
};

const DEMO_CHANGES: ChangeRequest[] = [
  {
    number: "CHG0030115",
    short_description: "Patch api-gateway-03 to v4.12.1 — security CVE fix",
    type: "Normal",
    risk: "Moderate",
    state: "Scheduled",
    assignment_group: "Cloud-SRE",
    requested_by: "j.morales@company.com",
    planned_start: "2026-05-30T22:00:00Z",
    planned_end: "2026-05-31T00:30:00Z",
    cis: ["api-gateway-03", "lb-edge-05"],
    dependent_apps: ["Checkout Service", "Customer Portal", "Mobile API"],
    tasks: [
      { number: "CTASK0101", short_description: "Snapshot current config & take backup", has_rollback: true, has_validation: true, duration_min: 15, automated: true },
      { number: "CTASK0102", short_description: "Drain traffic on lb-edge-05", has_rollback: true, has_validation: true, duration_min: 10, automated: true },
      { number: "CTASK0103", short_description: "Apply patch v4.12.1 on api-gateway-03", has_rollback: true, has_validation: true, duration_min: 30, automated: false },
      { number: "CTASK0104", short_description: "Smoke tests + synthetic checks", has_rollback: false, has_validation: true, duration_min: 20, automated: true },
      { number: "CTASK0105", short_description: "Re-enable traffic & monitor 30 min", has_rollback: true, has_validation: true, duration_min: 45, automated: false },
    ],
    has_backout_plan: true,
    has_test_plan: true,
    has_communication_plan: true,
    peer_reviewed: true,
    cab_approved: true,
    business_hours_only: false,
    description:
      "Apply critical security patch addressing CVE-2026-1183. Rolling restart with traffic drain. Validated on staging on 2026-05-27.",
  },
  {
    number: "CHG0030122",
    short_description: "Database failover test — db-primary-02 to db-replica-02",
    type: "Normal",
    risk: "High",
    state: "Authorize",
    assignment_group: "Database-Admin",
    requested_by: "s.patel@company.com",
    planned_start: "2026-06-01T23:00:00Z",
    planned_end: "2026-06-02T02:00:00Z",
    cis: ["db-primary-02", "db-replica-02", "storage-nas-04"],
    dependent_apps: ["Order Service", "Billing", "Reporting", "Auth Service", "Inventory"],
    tasks: [
      { number: "CTASK0201", short_description: "Verify replica lag < 1s", has_rollback: false, has_validation: true, duration_min: 10, automated: true },
      { number: "CTASK0202", short_description: "Initiate failover to db-replica-02", has_rollback: true, has_validation: true, duration_min: 20, automated: false },
      { number: "CTASK0203", short_description: "Validate app reconnections", has_rollback: false, has_validation: true, duration_min: 30, automated: false },
    ],
    has_backout_plan: true,
    has_test_plan: false,
    has_communication_plan: true,
    peer_reviewed: false,
    cab_approved: true,
    business_hours_only: false,
    description:
      "Planned DR failover exercise. Note: 5 dependent applications. Test plan not yet attached.",
  },
  {
    number: "CHG0030140",
    short_description: "Rotate TLS certificate on auth-svc-02",
    type: "Standard",
    risk: "Low",
    state: "Scheduled",
    assignment_group: "Security-Ops",
    requested_by: "r.kim@company.com",
    planned_start: "2026-05-30T20:00:00Z",
    planned_end: "2026-05-30T20:45:00Z",
    cis: ["auth-svc-02"],
    dependent_apps: ["SSO", "Mobile API"],
    tasks: [
      { number: "CTASK0301", short_description: "Pre-stage new certificate", has_rollback: true, has_validation: true, duration_min: 10, automated: true },
      { number: "CTASK0302", short_description: "Hot-reload cert on auth-svc-02", has_rollback: true, has_validation: true, duration_min: 5, automated: true },
      { number: "CTASK0303", short_description: "Verify TLS chain & expiry", has_rollback: false, has_validation: true, duration_min: 10, automated: true },
    ],
    has_backout_plan: true,
    has_test_plan: true,
    has_communication_plan: true,
    peer_reviewed: true,
    cab_approved: true,
    business_hours_only: false,
    description:
      "Standard pre-approved certificate rotation. Fully automated runbook used 14 times previously without incident.",
  },
  {
    number: "CHG0030158",
    short_description: "Kafka cluster upgrade — queue-kafka-01 to 3.7.0",
    type: "Normal",
    risk: "High",
    state: "Assess",
    assignment_group: "Platform-Eng",
    requested_by: "n.osei@company.com",
    planned_start: "2026-06-03T22:30:00Z",
    planned_end: "2026-06-04T04:00:00Z",
    cis: ["queue-kafka-01", "queue-kafka-02", "queue-kafka-03", "monitoring-hub"],
    dependent_apps: ["Order Service", "Notifications", "Audit Log", "Search Indexer", "Analytics Pipeline", "Fraud Detection"],
    tasks: [
      { number: "CTASK0401", short_description: "Upgrade broker 1", has_rollback: false, has_validation: false, duration_min: 60, automated: false },
      { number: "CTASK0402", short_description: "Upgrade broker 2 and 3", has_rollback: false, has_validation: false, duration_min: 120, automated: false },
    ],
    has_backout_plan: false,
    has_test_plan: false,
    has_communication_plan: false,
    peer_reviewed: false,
    cab_approved: false,
    business_hours_only: false,
    description:
      "Rolling upgrade of Kafka cluster. Backout plan and test plan missing. Tasks are vague and lack validation steps.",
  },
  {
    number: "CHG0030163",
    short_description: "Add new firewall rule for partner VPN",
    type: "Standard",
    risk: "Low",
    state: "Scheduled",
    assignment_group: "Network-Eng",
    requested_by: "t.nguyen@company.com",
    planned_start: "2026-05-30T21:00:00Z",
    planned_end: "2026-05-30T21:30:00Z",
    cis: ["fw-edge-02"],
    dependent_apps: ["Partner Portal"],
    tasks: [
      { number: "CTASK0501", short_description: "Add rule via IaC pipeline", has_rollback: true, has_validation: true, duration_min: 5, automated: true },
      { number: "CTASK0502", short_description: "Verify connectivity from partner endpoint", has_rollback: false, has_validation: true, duration_min: 10, automated: true },
    ],
    has_backout_plan: true,
    has_test_plan: true,
    has_communication_plan: true,
    peer_reviewed: true,
    cab_approved: true,
    business_hours_only: false,
    description:
      "Standard pre-approved firewall change executed via IaC. Single CI impacted, single dependent app.",
  },
  {
    number: "CHG0030171",
    short_description: "Emergency restart of cache-redis-01 cluster",
    type: "Emergency",
    risk: "High",
    state: "Implement",
    assignment_group: "Cloud-SRE",
    requested_by: "a.gomez@company.com",
    planned_start: "2026-05-29T23:00:00Z",
    planned_end: "2026-05-30T00:00:00Z",
    cis: ["cache-redis-01"],
    dependent_apps: ["Session Service", "Cart Service", "Pricing Service", "Checkout Service"],
    tasks: [
      { number: "CTASK0601", short_description: "Restart redis primary", has_rollback: false, has_validation: true, duration_min: 10, automated: false },
      { number: "CTASK0602", short_description: "Validate session continuity", has_rollback: false, has_validation: true, duration_min: 15, automated: false },
    ],
    has_backout_plan: false,
    has_test_plan: false,
    has_communication_plan: true,
    peer_reviewed: false,
    cab_approved: true,
    business_hours_only: false,
    description:
      "Emergency change to address memory pressure. Limited validation. High blast radius across checkout flow.",
  },
];

// ── Quality scoring ────────────────────────────────────────────────────
type QualityBreakdown = {
  total: number;
  scope: number;
  planning: number;
  tasks: number;
  governance: number;
  rationale: string[];
  risks: string[];
};

function scoreChange(cr: ChangeRequest): QualityBreakdown {
  const risks: string[] = [];
  const rationale: string[] = [];

  // Scope (25): fewer CIs + dependent apps = better
  const ciCount = cr.cis.length;
  const appCount = cr.dependent_apps.length;
  let scope = 25;
  if (ciCount > 3) { scope -= 6; risks.push(`Touches ${ciCount} CIs — wide blast radius`); }
  if (appCount > 4) { scope -= 10; risks.push(`${appCount} dependent applications impacted`); }
  else if (appCount > 2) scope -= 4;
  if (ciCount <= 2 && appCount <= 2) rationale.push("Narrow scope — limited blast radius");
  scope = Math.max(0, scope);

  // Planning (25)
  let planning = 0;
  if (cr.has_backout_plan) { planning += 10; rationale.push("Backout plan attached"); }
  else risks.push("No backout plan");
  if (cr.has_test_plan) { planning += 8; rationale.push("Test plan validated"); }
  else risks.push("No test plan");
  if (cr.has_communication_plan) planning += 7;
  else risks.push("No communication plan");

  // Tasks (30) — granularity, rollback per step, validation, automation
  let tasks = 0;
  const t = cr.tasks;
  if (t.length >= 3) tasks += 8;
  else risks.push(`Only ${t.length} change task(s) — likely missing steps`);
  const rollbackPct = t.length ? t.filter((x) => x.has_rollback).length / t.length : 0;
  tasks += Math.round(rollbackPct * 10);
  if (rollbackPct < 0.5) risks.push("Most tasks lack rollback steps");
  const validationPct = t.length ? t.filter((x) => x.has_validation).length / t.length : 0;
  tasks += Math.round(validationPct * 8);
  if (validationPct < 0.5) risks.push("Most tasks lack validation steps");
  const automatedPct = t.length ? t.filter((x) => x.automated).length / t.length : 0;
  tasks += Math.round(automatedPct * 4);
  if (automatedPct > 0.6) rationale.push("Highly automated runbook");

  // Governance (20)
  let governance = 0;
  if (cr.peer_reviewed) { governance += 7; rationale.push("Peer reviewed"); }
  else risks.push("Not peer reviewed");
  if (cr.cab_approved) governance += 8;
  else risks.push("CAB approval pending");
  if (cr.type === "Standard") { governance += 5; rationale.push("Standard pre-approved change"); }
  else if (cr.type === "Emergency") risks.push("Emergency change — reduced review window");

  const total = Math.min(100, scope + planning + tasks + governance);
  return { total, scope, planning, tasks, governance, rationale, risks };
}

type ShiftRec = {
  verdict: "Recommended" | "Caution" | "Not recommended";
  reason: string;
  needs: string[];
};

function eveningShiftRecommendation(cr: ChangeRequest, q: QualityBreakdown): ShiftRec {
  const needs: string[] = [];
  if (!cr.has_backout_plan) needs.push("Attach backout plan");
  if (!cr.has_test_plan) needs.push("Attach test plan with success criteria");
  if (cr.tasks.length < 3) needs.push("Break down into granular change tasks");
  if (cr.tasks.some((t) => !t.has_rollback)) needs.push("Add rollback step to every task");
  if (cr.tasks.some((t) => !t.has_validation)) needs.push("Add validation step to every task");
  if (cr.dependent_apps.length > 4) needs.push("Notify owners of all dependent applications");
  if (!cr.peer_reviewed) needs.push("Request peer review before handover");

  if (cr.type === "Emergency" || cr.risk === "High") {
    if (q.total < 75) return { verdict: "Not recommended", reason: "High-risk / Emergency change with quality gaps — keep on day shift with senior on-call.", needs };
    return { verdict: "Caution", reason: "High-risk change — proceed only with senior engineer paired with evening operator.", needs };
  }

  if (q.total >= 80 && needs.length === 0) {
    return { verdict: "Recommended", reason: "Well-scoped, fully documented, automated runbook — safe for evening shift execution.", needs };
  }
  if (q.total >= 65) {
    return { verdict: "Caution", reason: "Acceptable quality but address gaps below before evening handover.", needs };
  }
  return { verdict: "Not recommended", reason: "Quality below evening-shift threshold. Resolve gaps and re-evaluate.", needs };
}

const qualityBadge = (score: number) => {
  if (score >= 80) return { label: "Excellent", className: "bg-emerald-100 text-emerald-700 border-emerald-300" };
  if (score >= 65) return { label: "Acceptable", className: "bg-amber-100 text-amber-700 border-amber-300" };
  return { label: "Poor", className: "bg-destructive/10 text-destructive border-destructive/30" };
};

const riskBadge = (risk: string) => {
  const map: Record<string, string> = {
    Low: "bg-emerald-100 text-emerald-700 border-emerald-300",
    Moderate: "bg-amber-100 text-amber-700 border-amber-300",
    High: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={`font-medium text-[11px] ${map[risk] ?? ""}`}>{risk}</Badge>;
};

const typeBadge = (type: string) => {
  const map: Record<string, string> = {
    Standard: "bg-emerald-100 text-emerald-700 border-emerald-300",
    Normal: "bg-sky-100 text-sky-700 border-sky-300",
    Emergency: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={`font-medium text-[11px] ${map[type] ?? ""}`}>{type}</Badge>;
};

const verdictBadge = (v: ShiftRec["verdict"]) => {
  const map: Record<string, string> = {
    Recommended: "bg-emerald-100 text-emerald-700 border-emerald-300",
    Caution: "bg-amber-100 text-amber-700 border-amber-300",
    "Not recommended": "bg-destructive/10 text-destructive border-destructive/30",
  };
  const Icon = v === "Recommended" ? CheckCircle2 : v === "Caution" ? AlertTriangle : XCircle;
  return (
    <Badge variant="outline" className={`font-medium text-[11px] gap-1 ${map[v]}`}>
      <Icon className="h-3 w-3" /> {v}
    </Badge>
  );
};

export const ChangeManagementTab = () => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selected, setSelected] = useState<ChangeRequest | null>(null);
  const [kpiDrill, setKpiDrill] = useState<null | "all" | "avg" | "ready" | "caution" | "blocked">(null);

  const { matchesApp } = useAppFocus();
  const { isInRange } = useTimeRange();
  const enriched = useMemo(
    () =>
      DEMO_CHANGES.filter((c) => {
        const appOk = matchesApp(c.short_description) || c.dependent_apps.some((a) => matchesApp(a));
        if (!appOk) return false;
        return isInRange(c.planned_start);
      })
        .map((c) => ({ ...c, quality: scoreChange(c), rec: undefined as ShiftRec | undefined }))
        .map((c) => ({ ...c, rec: eveningShiftRecommendation(c, c.quality) })),
    [matchesApp, isInRange],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((c) => {
      if (q && !c.short_description.toLowerCase().includes(q) && !c.number.toLowerCase().includes(q) && !c.cis.join(" ").toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (riskFilter !== "all" && c.risk !== riskFilter) return false;
      return true;
    });
  }, [enriched, search, typeFilter, riskFilter]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const recommended = enriched.filter((c) => c.rec!.verdict === "Recommended").length;
    const caution = enriched.filter((c) => c.rec!.verdict === "Caution").length;
    const blocked = enriched.filter((c) => c.rec!.verdict === "Not recommended").length;
    const avg = Math.round(enriched.reduce((s, c) => s + c.quality.total, 0) / Math.max(1, total));
    return { total, recommended, caution, blocked, avg };
  }, [enriched]);

  const selectedQ = selected ? scoreChange(selected) : null;
  const selectedRec = selected && selectedQ ? eveningShiftRecommendation(selected, selectedQ) : null;

  const drillConfig: Record<NonNullable<typeof kpiDrill>, { title: string; description: string; rows: typeof enriched }> = {
    all: { title: "All change requests", description: "Every change request currently tracked in ServiceNow with its quality score and evening-shift verdict.", rows: enriched },
    avg: { title: "Quality score distribution", description: "Lowest-scoring change requests are most likely to slow down evening shift execution.", rows: [...enriched].sort((a, b) => a.quality.total - b.quality.total) },
    ready: { title: "Evening-shift ready", description: "Well-scoped, fully documented changes safe to hand over.", rows: enriched.filter((c) => c.rec!.verdict === "Recommended") },
    caution: { title: "Needs attention before evening handover", description: "Proceed only after addressing the highlighted low-accuracy fields.", rows: enriched.filter((c) => c.rec!.verdict === "Caution") },
    blocked: { title: "Blocked for evening shift", description: "Quality below threshold — keep on day shift until gaps are resolved.", rows: enriched.filter((c) => c.rec!.verdict === "Not recommended") },
  };

  const drill = kpiDrill ? drillConfig[kpiDrill] : null;

  // Aggregate low-accuracy fields across the drill set
  const gapSummary = useMemo(() => {
    if (!drill) return [] as { label: string; count: number }[];
    const counts = new Map<string, number>();
    drill.rows.forEach((c) => {
      [...c.quality.risks, ...c.rec!.needs].forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [drill]);

  return (
    <div className="space-y-6">
      {/* Use case banner */}
      <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 p-4 flex items-start gap-3">
        <ClipboardList className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              Change Quality Insights · Banking-grade scoring for ServiceNow change records
            </p>
            <Badge variant="outline" className="text-[10px] font-medium border-primary/40 text-primary bg-primary/5">
              Persona · Service Operations
            </Badge>
            <Badge variant="outline" className="text-[10px] font-medium border-emerald-300 text-emerald-700 bg-emerald-50">
              Business value · Improve operational efficiency
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Built for <b>Service Operations</b> running regulated banking workloads — payments rails, core
            banking, channels, cards, trading and AML. Scores every <b>ServiceNow</b> change on completeness
            of implementation &amp; back-out plans, CAB approvals, CI &amp; risk linkage, blackout-window
            adherence and evidence trail — flagging weak records before they reach the floor. ServiceOps can
            batch-approve clean changes, route weak ones back for rework and schedule into the right
            window, <b>cutting failed changes, rollback firefights and CAB churn</b> while keeping evidence
            aligned to <b>ITIL Change Enablement</b>, <b>FCA OpRes</b>, <b>DORA</b> and <b>MAS TRM</b>. Click
            any KPI, chart segment or change row to drill into the underlying record and quality gaps.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Change requests" value={kpis.total} icon={ClipboardList} onClick={() => setKpiDrill("all")} />
        <KpiCard label="Avg quality score" value={`${kpis.avg}/100`} icon={Sparkles} onClick={() => setKpiDrill("avg")} />
        <KpiCard label="Evening-shift ready" value={kpis.recommended} icon={Moon} accent onClick={() => setKpiDrill("ready")} />
        <KpiCard label="Needs attention" value={kpis.caution} icon={AlertTriangle} onClick={() => setKpiDrill("caution")} />
        <KpiCard label="Blocked for evening" value={kpis.blocked} icon={ShieldAlert} accent onClick={() => setKpiDrill("blocked")} />
      </section>


      {/* Filters */}
      <Card className="border-border/60 p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by CR number, description, CI…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="Standard">Standard</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="Emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risk</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Moderate">Moderate</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <SectionCard
        title="Change request quality assessment"
        description="Deep analysis of CIs, dependent apps, change tasks and governance — with evening-shift suitability recommendation"
      >
        <div className="overflow-auto -mx-6">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="pl-6">Change</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>CIs</TableHead>
                <TableHead>Dep. apps</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead className="pr-6">Evening shift</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const qb = qualityBadge(c.quality.total);
                return (
                  <TableRow
                    key={c.number}
                    className="cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell className="pl-6">
                      <div className="font-medium text-foreground text-sm">{c.number}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[320px]">{c.short_description}</div>
                    </TableCell>
                    <TableCell>{typeBadge(c.type)}</TableCell>
                    <TableCell>{riskBadge(c.risk)}</TableCell>
                    <TableCell className="tabular-nums text-sm">{c.cis.length}</TableCell>
                    <TableCell className="tabular-nums text-sm">{c.dependent_apps.length}</TableCell>
                    <TableCell className="tabular-nums text-sm">{c.tasks.length}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[11px] ${qb.className}`}>{c.quality.total}</Badge>
                        <span className="text-xs text-muted-foreground">{qb.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-6">{verdictBadge(c.rec!.verdict)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selected && selectedQ && selectedRec && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg">{selected.number}</DialogTitle>
                  {typeBadge(selected.type)}
                  {riskBadge(selected.risk)}
                  <Badge variant="outline" className="text-[11px]">{selected.state}</Badge>
                </div>
                <DialogDescription className="text-foreground/90">{selected.short_description}</DialogDescription>
              </DialogHeader>

              {/* Recommendation banner */}
              <Card className="border-border/60 p-4">
                <div className="flex items-start gap-3">
                  <Moon className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold">Evening shift recommendation</h4>
                      {verdictBadge(selectedRec.verdict)}
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedRec.reason}</p>
                    {selectedRec.needs.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Required before handover</p>
                        <ul className="space-y-1">
                          {selectedRec.needs.map((n, i) => (
                            <li key={i} className="text-xs flex items-start gap-1.5">
                              <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                              <span>{n}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Quality breakdown */}
              <Card className="border-border/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">Quality breakdown</h4>
                  <Badge variant="outline" className={`text-[11px] ${qualityBadge(selectedQ.total).className}`}>
                    {selectedQ.total}/100 · {qualityBadge(selectedQ.total).label}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <ScoreRow label="Scope (CIs & dependent apps)" value={selectedQ.scope} max={25} />
                  <ScoreRow label="Planning (backout / test / comms)" value={selectedQ.planning} max={25} />
                  <ScoreRow label="Task quality (granularity & validation)" value={selectedQ.tasks} max={30} />
                  <ScoreRow label="Governance (review & approvals)" value={selectedQ.governance} max={20} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/60">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Strengths</p>
                    {selectedQ.rationale.length ? (
                      <ul className="space-y-1">
                        {selectedQ.rationale.map((r, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground">None detected</p>}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Risks</p>
                    {selectedQ.risks.length ? (
                      <ul className="space-y-1">
                        {selectedQ.risks.map((r, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground">No major risks</p>}
                  </div>
                </div>
              </Card>

              {/* CIs & Dependent apps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border/60 p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><Server className="h-3.5 w-3.5" /> Configuration items ({selected.cis.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.cis.map((ci) => (
                      <Badge key={ci} variant="secondary" className="text-[11px]">{ci}</Badge>
                    ))}
                  </div>
                </Card>
                <Card className="border-border/60 p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><Network className="h-3.5 w-3.5" /> Dependent applications ({selected.dependent_apps.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.dependent_apps.map((a) => (
                      <Badge key={a} variant="outline" className="text-[11px]">{a}</Badge>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Tasks */}
              <Card className="border-border/60 p-4">
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><ListChecks className="h-3.5 w-3.5" /> Change tasks ({selected.tasks.length})</h4>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Step</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Rollback</TableHead>
                        <TableHead>Validation</TableHead>
                        <TableHead>Automated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.tasks.map((t) => (
                        <TableRow key={t.number}>
                          <TableCell className="font-medium text-xs">{t.number}</TableCell>
                          <TableCell className="text-xs">{t.short_description}</TableCell>
                          <TableCell className="text-xs tabular-nums"><Clock className="inline h-3 w-3 mr-1" />{t.duration_min}m</TableCell>
                          <TableCell>{t.has_rollback ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}</TableCell>
                          <TableCell>{t.has_validation ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}</TableCell>
                          <TableCell>{t.automated ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Meta */}
              <Card className="border-border/60 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <MetaItem label="Assignment group" value={selected.assignment_group} />
                <MetaItem label="Requested by" value={selected.requested_by} />
                <MetaItem label="Planned start" value={new Date(selected.planned_start).toLocaleString()} />
                <MetaItem label="Planned end" value={new Date(selected.planned_end).toLocaleString()} />
                <MetaItem label="Backout plan" value={selected.has_backout_plan ? "Yes" : "No"} />
                <MetaItem label="Test plan" value={selected.has_test_plan ? "Yes" : "No"} />
                <MetaItem label="Peer reviewed" value={selected.peer_reviewed ? "Yes" : "No"} />
                <MetaItem label="CAB approved" value={selected.cab_approved ? "Yes" : "No"} />
              </Card>

              <Card className="border-border/60 p-4">
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><GitBranch className="h-3.5 w-3.5" /> Description</h4>
                <p className="text-xs text-muted-foreground">{selected.description}</p>
              </Card>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* KPI drilldown dialog */}
      <Dialog open={!!kpiDrill} onOpenChange={(o) => { if (!o) setKpiDrill(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {drill && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{drill.title}</DialogTitle>
                <DialogDescription>{drill.description}</DialogDescription>
              </DialogHeader>

              {/* Top accuracy gaps slowing evening shift */}
              {gapSummary.length > 0 && (
                <Card className="border-border/60 p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Top low-accuracy fields impacting evening-shift efficiency
                  </h4>
                  <div className="space-y-2">
                    {gapSummary.map((g) => (
                      <div key={g.label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <XCircle className="h-3 w-3 text-destructive shrink-0" />
                          <span className="truncate">{g.label}</span>
                        </div>
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[11px]">
                          {g.count} {g.count === 1 ? "change" : "changes"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Change list */}
              <Card className="border-border/60 p-0 overflow-hidden">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                        <TableHead className="pl-4">Change</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Verdict</TableHead>
                        <TableHead className="pr-4">Low-accuracy fields</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drill.rows.map((c) => {
                        const qb = qualityBadge(c.quality.total);
                        const gaps = [...c.quality.risks, ...c.rec!.needs];
                        return (
                          <TableRow
                            key={c.number}
                            className="cursor-pointer align-top"
                            onClick={() => { setKpiDrill(null); setSelected(c); }}
                          >
                            <TableCell className="pl-4 py-3">
                              <div className="font-medium text-foreground text-sm">{c.number}</div>
                              <div className="text-xs text-muted-foreground max-w-[260px]">{c.short_description}</div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                {c.cis.length} CI · {c.dependent_apps.length} apps · {c.tasks.length} tasks
                              </div>
                            </TableCell>
                            <TableCell>{typeBadge(c.type)}</TableCell>
                            <TableCell>{riskBadge(c.risk)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[11px] ${qb.className}`}>{c.quality.total}</Badge>
                            </TableCell>
                            <TableCell>{verdictBadge(c.rec!.verdict)}</TableCell>
                            <TableCell className="pr-4">
                              {gaps.length === 0 ? (
                                <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> None</span>
                              ) : (
                                <ul className="space-y-0.5 max-w-[280px]">
                                  {gaps.slice(0, 3).map((g, i) => (
                                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                                      <span className="text-destructive">•</span>
                                      <span>{g}</span>
                                    </li>
                                  ))}
                                  {gaps.length > 3 && (
                                    <li className="text-[11px] text-muted-foreground italic">+{gaps.length - 3} more…</li>
                                  )}
                                </ul>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setKpiDrill(null)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};


const ScoreRow = ({ label, value, max }: { label: string; value: number; max: number }) => (
  <div>
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="text-foreground">{label}</span>
      <span className="text-muted-foreground tabular-nums">{value}/{max}</span>
    </div>
    <Progress value={(value / max) * 100} className="h-1.5" />
  </div>
);

const MetaItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-foreground">{value}</p>
  </div>
);
