import { useMemo, useState } from "react";
import { SectionCard } from "./SectionCard";
import { KpiCard } from "./KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Sparkles, Target,
  TrendingUp, FileText, Building2, Layers, Server, BookOpen, Gauge,
  History, ArrowRight, Lightbulb, XCircle,
} from "lucide-react";
import { useTimeRange } from "@/contexts/TimeRangeContext";
import { useAppFocus } from "@/contexts/AppFocusContext";
import {
  RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell,
} from "recharts";

type RiskLevel = "Low" | "Medium" | "High" | "Critical";

interface HistoricalChange {
  id: string;
  title: string;
  application: string;
  criticality: "Tier 1" | "Tier 2" | "Tier 3";
  outcome: "Successful" | "Failed" | "Backed Out";
  rftScore: number;
  date: string;
  rootCause?: string;
}

interface PolicyRule {
  id: string;
  level: "Organisation" | "Application Criticality" | "Application";
  scope: string;
  rule: string;
  rationale: string;
  enforced: boolean;
  derivedFrom: number; // count of historical changes
}

const HISTORICAL: HistoricalChange[] = [
  { id: "CHG0045123", title: "Apply OS patch to web-prod cluster", application: "Customer Portal", criticality: "Tier 1", outcome: "Successful", rftScore: 92, date: "2026-04-22" },
  { id: "CHG0045088", title: "DB schema migration v2.4", application: "Billing Engine", criticality: "Tier 1", outcome: "Failed", rftScore: 41, date: "2026-04-18", rootCause: "Missing rollback step, no peer review" },
  { id: "CHG0044901", title: "Firewall rule update — DMZ", application: "Edge Network", criticality: "Tier 1", outcome: "Backed Out", rftScore: 55, date: "2026-04-11", rootCause: "Dependent CI not in plan" },
  { id: "CHG0044812", title: "Add memory to auth-svc-02", application: "Identity Platform", criticality: "Tier 2", outcome: "Successful", rftScore: 88, date: "2026-04-08" },
  { id: "CHG0044766", title: "Kafka broker rolling restart", application: "Event Bus", criticality: "Tier 1", outcome: "Successful", rftScore: 85, date: "2026-04-05" },
  { id: "CHG0044701", title: "Storage NAS firmware upgrade", application: "Shared Storage", criticality: "Tier 2", outcome: "Failed", rftScore: 38, date: "2026-04-01", rootCause: "Implementation window too short" },
  { id: "CHG0044655", title: "Cert renewal for api-gateway", application: "API Gateway", criticality: "Tier 1", outcome: "Successful", rftScore: 95, date: "2026-03-28" },
  { id: "CHG0044588", title: "Move DNS resolver to new VLAN", application: "Internal DNS", criticality: "Tier 1", outcome: "Backed Out", rftScore: 49, date: "2026-03-25", rootCause: "Insufficient testing in pre-prod" },
];

const POLICIES: PolicyRule[] = [
  // Organisation
  { id: "ORG-01", level: "Organisation", scope: "All changes", rule: "Peer-reviewed implementation plan required", rationale: "32% of failed changes in last 90 days lacked peer review", enforced: true, derivedFrom: 124 },
  { id: "ORG-02", level: "Organisation", scope: "All changes", rule: "Rollback plan mandatory with verification steps", rationale: "Failed changes without rollback took 3.4× longer to recover", enforced: true, derivedFrom: 124 },
  { id: "ORG-03", level: "Organisation", scope: "All changes", rule: "CI dependency map attached for changes touching >2 CIs", rationale: "62% of backouts traced to undocumented dependencies", enforced: false, derivedFrom: 124 },
  // Application Criticality
  { id: "CRIT-T1-01", level: "Application Criticality", scope: "Tier 1", rule: "Implementation window ≥ 4 hours; outside business hours only", rationale: "Tier 1 changes in short windows failed 2.1× more often", enforced: true, derivedFrom: 58 },
  { id: "CRIT-T1-02", level: "Application Criticality", scope: "Tier 1", rule: "Pre-prod soak test ≥ 48h with synthetic traffic", rationale: "All 4 Tier-1 backouts in Q1 skipped pre-prod soak", enforced: true, derivedFrom: 58 },
  { id: "CRIT-T2-01", level: "Application Criticality", scope: "Tier 2", rule: "Smoke tests must include dependent upstream apps", rationale: "Tier 2 failures cascaded to Tier 1 in 18% of cases", enforced: false, derivedFrom: 42 },
  // Application
  { id: "APP-BILL-01", level: "Application", scope: "Billing Engine", rule: "DB schema changes require DBA sign-off + dry-run on shadow DB", rationale: "2 of last 3 Billing schema changes failed", enforced: true, derivedFrom: 11 },
  { id: "APP-EDGE-01", level: "Application", scope: "Edge Network", rule: "Firewall changes require packet-capture diff before/after", rationale: "Edge Network backouts trace to unmodeled flows", enforced: true, derivedFrom: 9 },
  { id: "APP-DNS-01", level: "Application", scope: "Internal DNS", rule: "DNS topology changes need 7-day notice + canary site", rationale: "DNS changes have 67% RFT failure rate", enforced: false, derivedFrom: 7 },
];

const APPLICATIONS = ["Customer Portal", "Billing Engine", "Edge Network", "Identity Platform", "Event Bus", "Shared Storage", "API Gateway", "Internal DNS"];
const CIS = ["web-prod-01", "api-gateway-03", "db-primary-02", "cache-redis-01", "lb-edge-05", "auth-svc-02", "queue-kafka-01", "storage-nas-04", "dns-resolver-01"];

function scoreToRisk(score: number): RiskLevel {
  if (score >= 80) return "Low";
  if (score >= 60) return "Medium";
  if (score >= 40) return "High";
  return "Critical";
}

function riskColor(risk: RiskLevel) {
  return {
    Low: "bg-emerald-100 text-emerald-700 border-emerald-300",
    Medium: "bg-amber-100 text-amber-700 border-amber-300",
    High: "bg-orange-100 text-orange-700 border-orange-300",
    Critical: "bg-destructive/10 text-destructive border-destructive/30",
  }[risk];
}

function outcomeBadge(o: HistoricalChange["outcome"]) {
  const map: Record<string, string> = {
    Successful: "bg-emerald-100 text-emerald-700 border-emerald-300",
    Failed: "bg-destructive/10 text-destructive border-destructive/30",
    "Backed Out": "bg-orange-100 text-orange-700 border-orange-300",
  };
  return <Badge variant="outline" className={`text-[11px] ${map[o]}`}>{o}</Badge>;
}

export function RftChangeAdvisorTab() {
  // Draft change request state
  const [title, setTitle] = useState("");
  const [application, setApplication] = useState<string>("");
  const [criticality, setCriticality] = useState<string>("");
  const [selectedCis, setSelectedCis] = useState<string[]>([]);
  const [plan, setPlan] = useState("");
  const [rollback, setRollback] = useState("");
  const [testing, setTesting] = useState("");
  const [windowHours, setWindowHours] = useState<number>(2);
  const [peerReviewed, setPeerReviewed] = useState<"yes" | "no" | "">("");

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [policyFilter, setPolicyFilter] = useState<string>("all");
  const [selectedHistorical, setSelectedHistorical] = useState<HistoricalChange | null>(null);
  const [kpiDrill, setKpiDrill] = useState<null | "rft" | "score" | "history" | "policies">(null);

  const { isInRange, label: timeRangeLabel } = useTimeRange();
  const { matchesApp } = useAppFocus();
  const historicalInRange = useMemo(
    () => HISTORICAL.filter((h) => isInRange(`${h.date}T12:00:00Z`) && matchesApp(h.application)),
    [isInRange, matchesApp],
  );

  // Compute RFT score from inputs
  const assessment = useMemo(() => {
    let score = 100;
    const issues: { severity: RiskLevel; text: string; policy?: string }[] = [];
    const recs: string[] = [];

    if (!title) { score -= 5; issues.push({ severity: "Low", text: "Title missing" }); }
    if (!application) { score -= 10; issues.push({ severity: "Medium", text: "Target application not selected" }); }
    if (!criticality) { score -= 8; issues.push({ severity: "Medium", text: "Application criticality not classified" }); }
    if (selectedCis.length === 0) { score -= 15; issues.push({ severity: "High", text: "No Configuration Items linked", policy: "ORG-03" }); }
    if (plan.length < 80) { score -= 18; issues.push({ severity: "High", text: "Implementation plan too brief — need step-by-step tasks", policy: "ORG-01" }); recs.push("Break plan into numbered steps with owner + verification per step."); }
    if (rollback.length < 40) { score -= 20; issues.push({ severity: "Critical", text: "Rollback plan missing or incomplete", policy: "ORG-02" }); recs.push("Add explicit rollback commands and a verification checkpoint."); }
    if (testing.length < 40) { score -= 10; issues.push({ severity: "Medium", text: "Testing evidence weak", policy: "CRIT-T2-01" }); }
    if (criticality === "Tier 1" && windowHours < 4) { score -= 12; issues.push({ severity: "High", text: "Tier 1 change with implementation window < 4h", policy: "CRIT-T1-01" }); recs.push("Extend window to ≥4h and schedule outside business hours."); }
    if (peerReviewed !== "yes") { score -= 12; issues.push({ severity: "High", text: "Peer review not confirmed", policy: "ORG-01" }); recs.push("Get a peer to review and sign off on the plan."); }
    if (application === "Billing Engine" && /schema|migration|db/i.test(plan)) {
      score -= 8; issues.push({ severity: "High", text: "Billing schema change without DBA sign-off mention", policy: "APP-BILL-01" });
      recs.push("Add DBA sign-off and shadow-DB dry-run results.");
    }
    if (application === "Internal DNS") {
      score -= 6; issues.push({ severity: "Medium", text: "Internal DNS has historically high failure rate (67%)", policy: "APP-DNS-01" });
      recs.push("Schedule 7-day notice and route via canary site.");
    }

    score = Math.max(0, Math.min(100, score));
    const risk = scoreToRisk(score);

    // Find similar historical changes
    const similar = historicalInRange.filter(h =>
      (application && h.application === application) ||
      (criticality && h.criticality === criticality)
    ).slice(0, 5);

    return { score, risk, issues, recs, similar };
  }, [title, application, criticality, selectedCis, plan, rollback, testing, windowHours, peerReviewed]);

  const filteredPolicies = useMemo(
    () => policyFilter === "all" ? POLICIES : POLICIES.filter(p => p.level === policyFilter),
    [policyFilter]
  );

  // KPIs over historical data
  const kpis = useMemo(() => {
    const total = historicalInRange.length;
    const successful = historicalInRange.filter(h => h.outcome === "Successful").length;
    const rftRate = total ? Math.round((successful / total) * 100) : 0;
    const avgScore = total ? Math.round(historicalInRange.reduce((s, h) => s + h.rftScore, 0) / total) : 0;
    const enforcedPolicies = POLICIES.filter(p => p.enforced).length;
    return { total, rftRate, avgScore, enforcedPolicies };
  }, [historicalInRange]);

  const radialData = [{ name: "score", value: assessment.score, fill: assessment.score >= 80 ? "hsl(142 55% 38%)" : assessment.score >= 60 ? "hsl(38 92% 50%)" : assessment.score >= 40 ? "hsl(25 95% 53%)" : "hsl(0 72% 51%)" }];

  const outcomeBars = [
    { name: "Successful", count: historicalInRange.filter(h => h.outcome === "Successful").length, fill: "hsl(142 55% 38%)" },
    { name: "Backed Out", count: historicalInRange.filter(h => h.outcome === "Backed Out").length, fill: "hsl(25 95% 53%)" },
    { name: "Failed", count: historicalInRange.filter(h => h.outcome === "Failed").length, fill: "hsl(0 72% 51%)" },
  ];

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Right First Time (RFT) Change Advisor</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Intelligent guidance, risk & compliance scoring, and policy enforcement to raise high-quality change requests the first time.
          </p>
        </div>
      </div>

      {/* Use case banner */}
      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">RFT Change Advisor for banking change engineering</h3>
              <Badge variant="secondary" className="text-[10px]">Persona: CIO Engineers</Badge>
              <Badge variant="outline" className="text-[10px]">Business value: Improve change success rate</Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tailored for CIO engineering teams raising changes across payments rails (SWIFT, SEPA, Faster Payments, cards), core banking ledger, online & mobile channels, trading platforms, and AML/sanctions services. Combines ServiceNow change history, CMDB CI blast-radius, prior incidents/problems and banking change policies to score risk, surface required artefacts (implementation, back-out, test evidence, CAB approvals) and enforce ITIL Change Enablement guardrails aligned to FCA OpRes, DORA, PRA SS1/21 and MAS TRM — driving higher Right First Time rates and fewer failed or backed-out changes in regulated production windows.
            </p>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="RFT success rate" value={`${kpis.rftRate}%`} icon={Target} accent onClick={() => setKpiDrill("rft")} />
        <KpiCard label="Avg quality score" value={kpis.avgScore} icon={Gauge} onClick={() => setKpiDrill("score")} />
        <KpiCard label="Historical changes analysed" value={kpis.total} icon={History} onClick={() => setKpiDrill("history")} />
        <KpiCard label="Active policies" value={kpis.enforcedPolicies} icon={BookOpen} onClick={() => setKpiDrill("policies")} />
      </section>

      {/* Raise new change request — opens guided builder dialog */}
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setBuilderOpen(true)}>
          <Sparkles className="h-4 w-4" /> Raise new change request
        </Button>
      </div>

      {/* Builder + Live assessment — inside dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> New change request — guided builder
            </DialogTitle>
            <DialogDescription>
              Fill the form; the advisor analyses risk in real time against historical changes and active policies.
            </DialogDescription>
          </DialogHeader>
          <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="New change request — guided builder"
            description="Fill the form; the advisor analyses risk in real time against historical changes and active policies."
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Apply OS patch to web-prod cluster" />
                </div>
                <div>
                  <Label className="text-xs">Target application</Label>
                  <Select value={application} onValueChange={setApplication}>
                    <SelectTrigger><SelectValue placeholder="Select application" /></SelectTrigger>
                    <SelectContent>
                      {APPLICATIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Application criticality</Label>
                  <Select value={criticality} onValueChange={setCriticality}>
                    <SelectTrigger><SelectValue placeholder="Tier 1 / 2 / 3" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tier 1">Tier 1 — Mission critical</SelectItem>
                      <SelectItem value="Tier 2">Tier 2 — Business critical</SelectItem>
                      <SelectItem value="Tier 3">Tier 3 — Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Implementation window (hours)</Label>
                  <Input type="number" min={0} value={windowHours} onChange={(e) => setWindowHours(Number(e.target.value))} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Configuration Items (CIs) involved</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {CIS.map(ci => {
                      const on = selectedCis.includes(ci);
                      return (
                        <button
                          key={ci}
                          type="button"
                          onClick={() => setSelectedCis(s => on ? s.filter(x => x !== ci) : [...s, ci])}
                          className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border hover:bg-secondary/70"}`}
                        >
                          {ci}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Implementation plan / steps</Label>
                  <Textarea rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="1. Drain traffic from node...&#10;2. Apply patch...&#10;3. Verify health checks..." />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Rollback plan</Label>
                  <Textarea rows={2} value={rollback} onChange={(e) => setRollback(e.target.value)} placeholder="Steps to back out the change if verification fails..." />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Testing evidence</Label>
                  <Textarea rows={2} value={testing} onChange={(e) => setTesting(e.target.value)} placeholder="Pre-prod test results, soak test duration, smoke test coverage..." />
                </div>
                <div>
                  <Label className="text-xs">Peer reviewed?</Label>
                  <Select value={peerReviewed} onValueChange={(v) => setPeerReviewed(v as any)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes — signed off</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setTitle(""); setApplication(""); setCriticality(""); setSelectedCis([]); setPlan(""); setRollback(""); setTesting(""); setWindowHours(2); setPeerReviewed(""); }}>
                  Reset
                </Button>
                <Button size="sm" onClick={() => setAnalysisOpen(true)}>
                  <Sparkles className="h-4 w-4" /> Run deep analysis
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Live score panel */}
        <SectionCard title="Live RFT score" description="Updates as you fill the request">
          <div className="flex flex-col items-center">
            <div className="w-full h-44">
              <ResponsiveContainer>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={8} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="-mt-32 flex flex-col items-center">
              <div className="text-3xl font-bold">{assessment.score}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">RFT score</div>
            </div>
            <div className="mt-20 w-full space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Risk level</span>
                <Badge variant="outline" className={`text-[11px] ${riskColor(assessment.risk)}`}>{assessment.risk}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Compliance issues</span>
                <span className="font-medium">{assessment.issues.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Similar past changes</span>
                <span className="font-medium">{assessment.similar.length}</span>
              </div>
            </div>

            <div className="mt-4 w-full">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Top recommendations</div>
              <ul className="space-y-1.5">
                {assessment.recs.slice(0, 3).map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
                {assessment.recs.length === 0 && (
                  <li className="text-xs text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> No critical recommendations — request looks healthy.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </SectionCard>
      </section>
        </DialogContent>
      </Dialog>

      {/* Historical outcomes + policies */}
      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Historical change outcomes" description="Baseline distribution used by the advisor">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={outcomeBars} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {outcomeBars.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Similar historical changes" description="Most relevant changes to the current draft — click for root-cause details">
          <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
            {assessment.similar.length === 0 && (
              <div className="text-xs text-muted-foreground p-4 text-center">
                Select an application or criticality to surface similar past changes.
              </div>
            )}
            {assessment.similar.map(h => (
              <button
                key={h.id}
                onClick={() => setSelectedHistorical(h)}
                className="w-full text-left p-2.5 rounded-md border border-border/60 bg-card hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded shrink-0">{h.id}</code>
                    <span className="text-xs font-medium truncate">{h.title}</span>
                  </div>
                  {outcomeBadge(h.outcome)}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{h.application} · {h.criticality}</span>
                  <span>RFT {h.rftScore}</span>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>
      </section>

      {/* Policies derived from analytics */}
      <SectionCard
        title="Policies derived from historical analytics"
        description="Auto-curated guardrails at Organisation, Application Criticality, and Application levels."
        action={
          <Select value={policyFilter} onValueChange={setPolicyFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="Organisation">Organisation</SelectItem>
              <SelectItem value="Application Criticality">Application Criticality</SelectItem>
              <SelectItem value="Application">Application</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Level</TableHead>
              <TableHead className="text-[11px]">Scope</TableHead>
              <TableHead className="text-[11px]">Policy</TableHead>
              <TableHead className="text-[11px]">Rationale</TableHead>
              <TableHead className="text-[11px] text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPolicies.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    {p.level === "Organisation" && <Building2 className="h-3 w-3" />}
                    {p.level === "Application Criticality" && <Layers className="h-3 w-3" />}
                    {p.level === "Application" && <Server className="h-3 w-3" />}
                    {p.level}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs font-medium">{p.scope}</TableCell>
                <TableCell className="text-xs">{p.rule}</TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {p.rationale}
                  <div className="mt-0.5 text-[10px] flex items-center gap-1 text-muted-foreground/80">
                    <TrendingUp className="h-3 w-3" /> derived from {p.derivedFrom} changes
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {p.enforced ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Enforced
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                      Advisory
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {/* Deep analysis dialog */}
      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Deep RFT analysis
            </DialogTitle>
            <DialogDescription>
              Compliance, risk and historical-pattern assessment for the drafted change request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-3 rounded-md border border-border/60 bg-card">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">RFT score</div>
                <div className="text-2xl font-bold">{assessment.score}</div>
                <Progress value={assessment.score} className="h-1.5 mt-1.5" />
              </div>
              <div className="p-3 rounded-md border border-border/60 bg-card">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Risk</div>
                <div className="mt-1"><Badge variant="outline" className={riskColor(assessment.risk)}>{assessment.risk}</Badge></div>
                <div className="text-[11px] text-muted-foreground mt-1.5">Based on plan completeness, CI count & history.</div>
              </div>
              <div className="p-3 rounded-md border border-border/60 bg-card">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Compliance</div>
                <div className="text-2xl font-bold">{assessment.issues.length}</div>
                <div className="text-[11px] text-muted-foreground">issues against active policies</div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Issues & policy violations
              </h4>
              <div className="space-y-2">
                {assessment.issues.length === 0 && (
                  <div className="text-sm text-emerald-700 flex items-center gap-2 p-3 rounded-md border border-emerald-300 bg-emerald-50">
                    <CheckCircle2 className="h-4 w-4" /> No issues found — request meets all policies.
                  </div>
                )}
                {assessment.issues.map((iss, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-md border border-border/60 bg-card">
                    <XCircle className={`h-4 w-4 mt-0.5 shrink-0 ${iss.severity === "Critical" || iss.severity === "High" ? "text-destructive" : "text-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm">{iss.text}</span>
                        <Badge variant="outline" className={`text-[10px] ${riskColor(iss.severity)}`}>{iss.severity}</Badge>
                        {iss.policy && <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{iss.policy}</code>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" /> Recommendations to reach RFT
              </h4>
              <ul className="space-y-1.5">
                {assessment.recs.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
                {assessment.recs.length === 0 && (
                  <li className="text-sm text-muted-foreground">No additional recommendations.</li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Historical pattern match
              </h4>
              <div className="space-y-1.5">
                {assessment.similar.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-2 rounded-md border border-border/60 bg-card text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{h.id}</code>
                      <span className="truncate">{h.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">RFT {h.rftScore}</span>
                      {outcomeBadge(h.outcome)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Historical change drilldown */}
      <Dialog open={!!selectedHistorical} onOpenChange={(o) => { if (!o) setSelectedHistorical(null); }}>
        <DialogContent>
          {selectedHistorical && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> {selectedHistorical.id}
                </DialogTitle>
                <DialogDescription>{selectedHistorical.title}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-[11px] text-muted-foreground uppercase">Application</div>{selectedHistorical.application}</div>
                  <div><div className="text-[11px] text-muted-foreground uppercase">Criticality</div>{selectedHistorical.criticality}</div>
                  <div><div className="text-[11px] text-muted-foreground uppercase">RFT score</div>{selectedHistorical.rftScore}</div>
                  <div><div className="text-[11px] text-muted-foreground uppercase">Outcome</div>{outcomeBadge(selectedHistorical.outcome)}</div>
                  <div className="col-span-2"><div className="text-[11px] text-muted-foreground uppercase">Date</div>{selectedHistorical.date}</div>
                </div>
                {selectedHistorical.rootCause && (
                  <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
                    <div className="text-[11px] uppercase tracking-wider text-destructive font-semibold mb-1">Root cause</div>
                    <div className="text-sm">{selectedHistorical.rootCause}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* KPI drilldown dialog — data from ServiceNow */}
      <Dialog open={!!kpiDrill} onOpenChange={(o) => { if (!o) setKpiDrill(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {kpiDrill && (() => {
            const titles: Record<string, { title: string; desc: string; icon: any }> = {
              rft:      { title: "RFT success rate — drilldown",      desc: "Successful vs failed/backed-out changes from ServiceNow change history.",        icon: Target },
              score:    { title: "Average quality score — drilldown", desc: "Per-change RFT quality scores from ServiceNow, ranked low → high.",              icon: Gauge },
              history:  { title: "Historical changes analysed",        desc: "All change records pulled from ServiceNow used to train policies and scoring.", icon: History },
              policies: { title: "Active policies — drilldown",        desc: "Policies currently enforced by the advisor and their historical basis.",         icon: BookOpen },
            };
            const meta = titles[kpiDrill];
            const Icon = meta.icon;

            // Per-application aggregation
            const byApp = APPLICATIONS.map(app => {
              const rows = historicalInRange.filter(h => h.application === app);
              const ok = rows.filter(r => r.outcome === "Successful").length;
              return {
                application: app,
                total: rows.length,
                successful: ok,
                failed: rows.filter(r => r.outcome === "Failed").length,
                backedOut: rows.filter(r => r.outcome === "Backed Out").length,
                rftRate: rows.length ? Math.round((ok / rows.length) * 100) : 0,
                avgScore: rows.length ? Math.round(rows.reduce((s, r) => s + r.rftScore, 0) / rows.length) : 0,
              };
            }).filter(r => r.total > 0);

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /> {meta.title}</DialogTitle>
                  <DialogDescription>{meta.desc}</DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    Source: ServiceNow change_request
                  </Badge>
                  <span>Window: {timeRangeLabel} · {historicalInRange.length} records</span>
                </div>

                {kpiDrill === "rft" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-md border border-border/60 bg-card">
                        <div className="text-[11px] uppercase text-muted-foreground">Successful</div>
                        <div className="text-2xl font-bold text-emerald-600">{outcomeBars[0].count}</div>
                      </div>
                      <div className="p-3 rounded-md border border-border/60 bg-card">
                        <div className="text-[11px] uppercase text-muted-foreground">Backed Out</div>
                        <div className="text-2xl font-bold text-amber-600">{outcomeBars[1].count}</div>
                      </div>
                      <div className="p-3 rounded-md border border-border/60 bg-card">
                        <div className="text-[11px] uppercase text-muted-foreground">Failed</div>
                        <div className="text-2xl font-bold text-destructive">{outcomeBars[2].count}</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">RFT rate by application</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[11px]">Application</TableHead>
                            <TableHead className="text-[11px] text-right">Total</TableHead>
                            <TableHead className="text-[11px] text-right">Successful</TableHead>
                            <TableHead className="text-[11px] text-right">Failed</TableHead>
                            <TableHead className="text-[11px] text-right">RFT rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {byApp.sort((a, b) => b.rftRate - a.rftRate).map(r => (
                            <TableRow key={r.application}>
                              <TableCell className="text-xs font-medium">{r.application}</TableCell>
                              <TableCell className="text-xs text-right">{r.total}</TableCell>
                              <TableCell className="text-xs text-right text-emerald-600">{r.successful}</TableCell>
                              <TableCell className="text-xs text-right text-destructive">{r.failed + r.backedOut}</TableCell>
                              <TableCell className="text-xs text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <Progress value={r.rftRate} className="h-1.5 w-16" />
                                  <span className="font-medium w-8 text-right">{r.rftRate}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {kpiDrill === "score" && (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={[...historicalInRange].sort((a, b) => a.rftScore - b.rftScore)} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="id" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="rftScore" radius={[6, 6, 0, 0]}>
                          {[...historicalInRange].sort((a, b) => a.rftScore - b.rftScore).map((h, i) => (
                            <Cell key={i} fill={h.rftScore >= 80 ? "hsl(142 55% 38%)" : h.rftScore >= 60 ? "hsl(38 92% 50%)" : h.rftScore >= 40 ? "hsl(25 95% 53%)" : "hsl(0 72% 51%)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Lowest scoring changes (need attention)</h4>
                      <div className="space-y-1.5">
                        {[...historicalInRange].sort((a, b) => a.rftScore - b.rftScore).slice(0, 5).map(h => (
                          <button key={h.id} onClick={() => { setKpiDrill(null); setSelectedHistorical(h); }}
                            className="w-full text-left p-2 rounded-md border border-border/60 bg-card hover:bg-secondary/50 transition-colors flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{h.id}</code>
                              <span className="text-xs truncate">{h.title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-medium">{h.rftScore}</span>
                              {outcomeBadge(h.outcome)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {kpiDrill === "history" && (
                  <div className="space-y-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Change #</TableHead>
                          <TableHead className="text-[11px]">Title</TableHead>
                          <TableHead className="text-[11px]">Application</TableHead>
                          <TableHead className="text-[11px]">Criticality</TableHead>
                          <TableHead className="text-[11px]">Date</TableHead>
                          <TableHead className="text-[11px] text-right">RFT</TableHead>
                          <TableHead className="text-[11px] text-right">Outcome</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historicalInRange.map(h => (
                          <TableRow key={h.id} className="cursor-pointer" onClick={() => { setKpiDrill(null); setSelectedHistorical(h); }}>
                            <TableCell><code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{h.id}</code></TableCell>
                            <TableCell className="text-xs">{h.title}</TableCell>
                            <TableCell className="text-xs">{h.application}</TableCell>
                            <TableCell className="text-xs">{h.criticality}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{h.date}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{h.rftScore}</TableCell>
                            <TableCell className="text-right">{outcomeBadge(h.outcome)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {kpiDrill === "policies" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      {(["Organisation", "Application Criticality", "Application"] as const).map(lvl => {
                        const rows = POLICIES.filter(p => p.level === lvl);
                        return (
                          <div key={lvl} className="p-3 rounded-md border border-border/60 bg-card">
                            <div className="text-[11px] uppercase text-muted-foreground">{lvl}</div>
                            <div className="text-2xl font-bold">{rows.filter(r => r.enforced).length}<span className="text-sm text-muted-foreground font-normal"> / {rows.length}</span></div>
                            <div className="text-[11px] text-muted-foreground">enforced / total</div>
                          </div>
                        );
                      })}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Policy ID</TableHead>
                          <TableHead className="text-[11px]">Level</TableHead>
                          <TableHead className="text-[11px]">Scope</TableHead>
                          <TableHead className="text-[11px]">Rule</TableHead>
                          <TableHead className="text-[11px] text-right">Derived from</TableHead>
                          <TableHead className="text-[11px] text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {POLICIES.map(p => (
                          <TableRow key={p.id}>
                            <TableCell><code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{p.id}</code></TableCell>
                            <TableCell className="text-xs">{p.level}</TableCell>
                            <TableCell className="text-xs font-medium">{p.scope}</TableCell>
                            <TableCell className="text-xs">{p.rule}</TableCell>
                            <TableCell className="text-xs text-right">{p.derivedFrom}</TableCell>
                            <TableCell className="text-right">
                              {p.enforced
                                ? <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">Enforced</Badge>
                                : <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">Advisory</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
