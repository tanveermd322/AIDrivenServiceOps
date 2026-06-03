import { useMemo, useState } from "react";
import { useAppFocus } from "@/contexts/AppFocusContext";
import { useTimeRange } from "@/contexts/TimeRangeContext";
import { parseFuzzyDate } from "@/lib/fuzzy-date";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { renderPieValueLabel } from "@/lib/chart-utils";
import {
  ShieldCheck,
  Gauge,
  Users,
  TrendingDown,
  TrendingUp,
  CalendarClock,
  AlertOctagon,
  CheckCircle2,
  ClipboardCheck,
  Activity,
  Sparkles,
  Compass,
} from "lucide-react";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

// ──────────────────────────────────────────────────────────────────────
// Synthetic CAB dataset — designed for Architects + Change Managers.
// Mirrors what a CAB would see prior to weekly approval ceremonies.
// ──────────────────────────────────────────────────────────────────────
type CabChange = {
  id: string;
  title: string;
  application: string;
  criticality: "Tier 1" | "Tier 2" | "Tier 3";
  type: "Standard" | "Normal" | "Emergency";
  risk: "Low" | "Medium" | "High";
  healthScore: number; // 0..100
  ciCount: number;
  windowHours: number;
  peerReviewed: boolean;
  rollbackTested: boolean;
  submittedBy: string;
  scheduled: string;
  conflicts: number;
  cabDecision: "Pending" | "Approved" | "Rejected" | "Deferred";
};

const PIPELINE: CabChange[] = [
  { id: "CHG0098231", title: "Billing engine v4.2 cutover", application: "Billing Engine", criticality: "Tier 1", type: "Normal", risk: "High", healthScore: 58, ciCount: 14, windowHours: 6, peerReviewed: true, rollbackTested: false, submittedBy: "j.adams", scheduled: "Fri 22:00", conflicts: 2, cabDecision: "Pending" },
  { id: "CHG0098245", title: "Payments API gateway patch", application: "Payments API", criticality: "Tier 1", type: "Normal", risk: "Medium", healthScore: 78, ciCount: 8, windowHours: 4, peerReviewed: true, rollbackTested: true, submittedBy: "m.singh", scheduled: "Sat 01:00", conflicts: 0, cabDecision: "Pending" },
  { id: "CHG0098260", title: "CRM index rebuild", application: "CRM Portal", criticality: "Tier 2", type: "Standard", risk: "Low", healthScore: 92, ciCount: 3, windowHours: 2, peerReviewed: true, rollbackTested: true, submittedBy: "l.cheng", scheduled: "Sun 03:00", conflicts: 0, cabDecision: "Approved" },
  { id: "CHG0098271", title: "DNS resolver failover swap", application: "Core DNS", criticality: "Tier 1", type: "Emergency", risk: "High", healthScore: 49, ciCount: 6, windowHours: 1, peerReviewed: false, rollbackTested: false, submittedBy: "r.osei", scheduled: "Today 19:30", conflicts: 1, cabDecision: "Pending" },
  { id: "CHG0098288", title: "Warehouse ETL schema bump", application: "Data Warehouse", criticality: "Tier 2", type: "Normal", risk: "Medium", healthScore: 71, ciCount: 5, windowHours: 3, peerReviewed: true, rollbackTested: true, submittedBy: "k.varma", scheduled: "Sat 23:00", conflicts: 0, cabDecision: "Approved" },
  { id: "CHG0098299", title: "Mobile app feature flag rollout", application: "Mobile App", criticality: "Tier 2", type: "Standard", risk: "Low", healthScore: 88, ciCount: 2, windowHours: 1, peerReviewed: true, rollbackTested: true, submittedBy: "n.khan", scheduled: "Mon 10:00", conflicts: 0, cabDecision: "Approved" },
  { id: "CHG0098311", title: "Auth service TLS rotation", application: "Auth Service", criticality: "Tier 1", type: "Normal", risk: "Medium", healthScore: 74, ciCount: 4, windowHours: 2, peerReviewed: true, rollbackTested: true, submittedBy: "s.patel", scheduled: "Sat 22:00", conflicts: 0, cabDecision: "Pending" },
  { id: "CHG0098320", title: "Search cluster reindex", application: "Search Service", criticality: "Tier 3", type: "Standard", risk: "Low", healthScore: 95, ciCount: 2, windowHours: 4, peerReviewed: true, rollbackTested: true, submittedBy: "t.brown", scheduled: "Sun 06:00", conflicts: 0, cabDecision: "Approved" },
  { id: "CHG0098334", title: "Legacy ESB endpoint retirement", application: "Integration ESB", criticality: "Tier 1", type: "Normal", risk: "High", healthScore: 54, ciCount: 11, windowHours: 5, peerReviewed: false, rollbackTested: true, submittedBy: "d.lee", scheduled: "Fri 23:00", conflicts: 3, cabDecision: "Deferred" },
  { id: "CHG0098350", title: "Order service hotfix", application: "Order Service", criticality: "Tier 1", type: "Emergency", risk: "Medium", healthScore: 66, ciCount: 3, windowHours: 1, peerReviewed: true, rollbackTested: false, submittedBy: "a.morales", scheduled: "Today 21:00", conflicts: 0, cabDecision: "Pending" },
];

// 8-week trend of CAB golden signals
const GOLDEN_TREND = [
  { week: "W-8", successRate: 86, changeFailureRate: 14, leadTimeHrs: 38, mttrHrs: 4.8, emergencyShare: 18, peerReviewPct: 78 },
  { week: "W-7", successRate: 88, changeFailureRate: 12, leadTimeHrs: 36, mttrHrs: 4.5, emergencyShare: 16, peerReviewPct: 80 },
  { week: "W-6", successRate: 87, changeFailureRate: 13, leadTimeHrs: 34, mttrHrs: 4.2, emergencyShare: 17, peerReviewPct: 81 },
  { week: "W-5", successRate: 89, changeFailureRate: 11, leadTimeHrs: 33, mttrHrs: 4.0, emergencyShare: 15, peerReviewPct: 83 },
  { week: "W-4", successRate: 90, changeFailureRate: 10, leadTimeHrs: 31, mttrHrs: 3.8, emergencyShare: 14, peerReviewPct: 84 },
  { week: "W-3", successRate: 91, changeFailureRate: 9, leadTimeHrs: 30, mttrHrs: 3.6, emergencyShare: 13, peerReviewPct: 85 },
  { week: "W-2", successRate: 92, changeFailureRate: 8, leadTimeHrs: 28, mttrHrs: 3.4, emergencyShare: 12, peerReviewPct: 86 },
  { week: "W-1", successRate: 93, changeFailureRate: 7, leadTimeHrs: 27, mttrHrs: 3.2, emergencyShare: 11, peerReviewPct: 86 },
];

// Golden signals catalogue surfaced to architects & change managers
const GOLDEN_SIGNALS = [
  { id: "GS-01", name: "Change Success Rate", current: 93, target: 95, trend: "up", description: "% of changes completed without rollback or incident in the next 24h." },
  { id: "GS-02", name: "Change Failure Rate", current: 7, target: 5, trend: "down", description: "% of changes causing P1/P2 incident within 24h of implementation." },
  { id: "GS-03", name: "Lead Time for Change", current: 27, target: 24, trend: "down", description: "Hours from submission to CAB approval — measures governance friction." },
  { id: "GS-04", name: "MTTR after change", current: 3.2, target: 3.0, trend: "down", description: "Mean hours to restore service when a change-induced incident occurs." },
  { id: "GS-05", name: "Emergency Change %", current: 11, target: 10, trend: "down", description: "Share of total changes that bypass standard CAB cadence." },
  { id: "GS-06", name: "Peer Review Coverage", current: 86, target: 90, trend: "up", description: "% of changes with documented peer review before CAB submission." },
];

const riskColors: Record<CabChange["risk"], string> = {
  Low: "bg-emerald-100 text-emerald-700 border-emerald-300",
  Medium: "bg-amber-100 text-amber-700 border-amber-300",
  High: "bg-destructive/10 text-destructive border-destructive/30",
};
const decisionColors: Record<CabChange["cabDecision"], string> = {
  Pending: "bg-amber-100 text-amber-700 border-amber-300",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-300",
  Rejected: "bg-destructive/10 text-destructive border-destructive/30",
  Deferred: "bg-secondary text-muted-foreground border-border",
};

const riskBadge = (r: CabChange["risk"]) => (
  <Badge variant="outline" className={`text-[11px] ${riskColors[r]}`}>{r}</Badge>
);
const decisionBadge = (d: CabChange["cabDecision"]) => (
  <Badge variant="outline" className={`text-[11px] ${decisionColors[d]}`}>{d}</Badge>
);

const policyViolations = (c: CabChange): string[] => {
  const v: string[] = [];
  if (!c.peerReviewed) v.push("Peer review");
  if (!c.rollbackTested) v.push("Rollback test");
  if (c.conflicts > 0) v.push("Schedule conflict");
  if (c.type === "Emergency") v.push("Emergency justification");
  if (c.risk === "High" && c.windowHours < 2) v.push("Risk-window mismatch");
  return v;
};

type KpiKey = null | "successRate" | "failureRate" | "leadTime" | "emergency" | "pending" | "conflicts";
type SignalDrill = null | typeof GOLDEN_SIGNALS[number];

export const CabDashboardInsightsTab = () => {
  const [kpiDrill, setKpiDrill] = useState<KpiKey>(null);
  const [selectedChange, setSelectedChange] = useState<CabChange | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<SignalDrill>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  const { matchesApp } = useAppFocus();
  const { isInRange } = useTimeRange();
  const pipeline = useMemo(
    () =>
      PIPELINE.filter((c) => {
        if (!matchesApp(c.application)) return false;
        const iso = parseFuzzyDate(c.scheduled);
        return iso ? isInRange(iso) : true;
      }),
    [matchesApp, isInRange],
  );

  const totals = useMemo(() => {
    const pending = pipeline.filter((c) => c.cabDecision === "Pending").length;
    const approved = pipeline.filter((c) => c.cabDecision === "Approved").length;
    const emergency = pipeline.filter((c) => c.type === "Emergency").length;
    const highRisk = pipeline.filter((c) => c.risk === "High").length;
    const conflicts = pipeline.reduce((s, c) => s + c.conflicts, 0);
    const avgHealth = pipeline.length
      ? Math.round(pipeline.reduce((s, c) => s + c.healthScore, 0) / pipeline.length)
      : 0;
    const latest = GOLDEN_TREND[GOLDEN_TREND.length - 1];
    return { pending, approved, emergency, highRisk, conflicts, avgHealth, latest };
  }, [pipeline]);

  const byApp = useMemo(() => {
    const map = new Map<string, { application: string; count: number; avgHealth: number; highRisk: number; tier: string }>();
    pipeline.forEach((c) => {
      const ex = map.get(c.application);
      if (ex) {
        ex.count += 1;
        ex.avgHealth = Math.round((ex.avgHealth + c.healthScore) / 2);
        if (c.risk === "High") ex.highRisk += 1;
      } else {
        map.set(c.application, { application: c.application, count: 1, avgHealth: c.healthScore, highRisk: c.risk === "High" ? 1 : 0, tier: c.criticality });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [pipeline]);

  const riskMix = useMemo(() => {
    const out: Record<string, number> = { Low: 0, Medium: 0, High: 0 };
    pipeline.forEach((c) => (out[c.risk] += 1));
    return Object.entries(out).map(([risk, count]) => ({ risk, count }));
  }, [pipeline]);


  const radialData = [
    { name: "Health", value: totals.avgHealth, fill: "hsl(var(--chart-1))" },
  ];

  const drillTitle: Record<Exclude<KpiKey, null>, string> = {
    successRate: "Change success rate — golden signal drilldown",
    failureRate: "Change failure rate — change-induced P1/P2 incidents",
    leadTime: "Lead time for change — submission to CAB approval",
    emergency: "Emergency changes in the active pipeline",
    pending: "Changes awaiting CAB decision",
    conflicts: "Scheduling & CI conflicts to resolve",
  };

  return (
    <div className="space-y-6">
      {/* Persona / value banner */}
      <SectionCard
        title="CAB Dashboard Insights"
        description="For Architects and Change Managers — data-driven CAB governance powered by golden signals and change health indicators."
      >
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Target persona</p>
            <p className="text-muted-foreground mt-1">Architects + Change Managers chairing the Change Approval Board.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Business value</p>
            <p className="text-muted-foreground mt-1">Better governance — every approval backed by golden signals and risk evidence.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Compass className="h-3.5 w-3.5" /> How it works</p>
            <p className="text-muted-foreground mt-1">Pipeline health, golden signals and conflicts — all drillable to the change.</p>
          </div>
        </div>
      </SectionCard>

      {/* Interactive KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Change success rate" value={`${totals.latest.successRate}%`} icon={CheckCircle2} hint="last 7 days" onClick={() => setKpiDrill("successRate")} />
        <KpiCard label="Change failure rate" value={`${totals.latest.changeFailureRate}%`} icon={AlertOctagon} accent hint="P1/P2 within 24h" onClick={() => setKpiDrill("failureRate")} />
        <KpiCard label="Lead time (hrs)" value={totals.latest.leadTimeHrs} icon={CalendarClock} hint="submit → CAB" onClick={() => setKpiDrill("leadTime")} />
        <KpiCard label="Emergency changes" value={totals.emergency} icon={Activity} accent hint="in pipeline" onClick={() => setKpiDrill("emergency")} />
        <KpiCard label="MTTR after change" value={`${totals.latest.mttrHrs}h`} icon={Gauge} hint="change-induced incidents" onClick={() => setSelectedSignal(GOLDEN_SIGNALS.find(g => g.id === "GS-04") || null)} />
        <KpiCard label="Peer review coverage" value={`${totals.latest.peerReviewPct}%`} icon={ShieldCheck} hint="docs signed off pre-CAB" onClick={() => setSelectedSignal(GOLDEN_SIGNALS.find(g => g.id === "GS-06") || null)} />
        <KpiCard label="Awaiting CAB" value={totals.pending} icon={ClipboardCheck} hint="pending decisions" onClick={() => setKpiDrill("pending")} />
        <KpiCard label="Schedule conflicts" value={totals.conflicts} icon={Sparkles} accent hint="CI / window clashes" onClick={() => setKpiDrill("conflicts")} />
      </section>

      {/* Charts row — equal sized */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <SectionCard title="Pipeline health score" description="Composite of risk, peer review, rollback, conflicts">
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" barSize={16} data={radialData} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--secondary))" }} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-center text-3xl font-bold -mt-32">{totals.avgHealth}</p>
          <p className="text-center text-xs text-muted-foreground mt-20">Click any change below to inspect signals</p>
        </SectionCard>

        <SectionCard title="Risk mix in active pipeline" description="Click a slice to drill into changes">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={riskMix}
                dataKey="count"
                nameKey="risk"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                label={renderPieValueLabel}
                labelLine={false}
                onClick={(d: any) => d?.risk === "High" && setKpiDrill("conflicts")}
                className="cursor-pointer"
              >
                {riskMix.map((d, i) => (
                  <Cell key={i} fill={d.risk === "High" ? "hsl(0 72% 51%)" : d.risk === "Medium" ? "hsl(38 92% 50%)" : "hsl(142 55% 38%)"} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Pipeline by application" description="Click a bar to focus the table">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byApp} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="application" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} onClick={(d: any) => setSelectedApp(d.application)} className="cursor-pointer">
                {byApp.map((d, i) => (
                  <Cell key={i} fill={d.highRisk > 0 ? "hsl(0 72% 51%)" : "hsl(var(--chart-1))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </section>


      {/* Pipeline table */}
      <SectionCard
        title={selectedApp ? `CAB pipeline — ${selectedApp}` : "CAB pipeline — all changes"}
        description="Click any row for the full change health card"
        action={
          selectedApp ? (
            <Button size="sm" variant="ghost" onClick={() => setSelectedApp(null)}>Clear filter</Button>
          ) : null
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Change</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead className="text-right">Health</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Policy non-Compliant</TableHead>
                <TableHead>CAB</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pipeline.filter((c) => !selectedApp || c.application === selectedApp).map((c) => {
                const violations = policyViolations(c);
                return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedChange(c)}>
                  <TableCell>
                    <div className="font-mono text-xs">{c.id}</div>
                    <div className="text-xs text-muted-foreground">{c.title}</div>
                  </TableCell>
                  <TableCell className="text-xs">{c.application}</TableCell>
                  <TableCell className="text-xs">{c.criticality}</TableCell>
                  <TableCell className="text-xs">{c.type}</TableCell>
                  <TableCell>{riskBadge(c.risk)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={c.healthScore < 60 ? "text-destructive font-semibold" : c.healthScore < 80 ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>
                      {c.healthScore}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.scheduled}</TableCell>
                  <TableCell>
                    {violations.length === 0 ? (
                      <Badge variant="outline" className="text-[11px] bg-emerald-100 text-emerald-700 border-emerald-300">Compliant</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {violations.map((v) => (
                          <Badge key={v} variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">{v}</Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{decisionBadge(c.cabDecision)}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {/* KPI drilldown dialog */}
      <Dialog open={!!kpiDrill} onOpenChange={(o) => !o && setKpiDrill(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {kpiDrill && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" />{drillTitle[kpiDrill]}</DialogTitle>
                <DialogDescription>Backed by the same ServiceNow pipeline driving CAB decisions.</DialogDescription>
              </DialogHeader>

              {(kpiDrill === "successRate" || kpiDrill === "failureRate" || kpiDrill === "leadTime") && (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={GOLDEN_TREND} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey={kpiDrill === "successRate" ? "successRate" : kpiDrill === "failureRate" ? "changeFailureRate" : "leadTimeHrs"}
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {(kpiDrill === "emergency" || kpiDrill === "pending" || kpiDrill === "conflicts") && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Change</TableHead>
                      <TableHead>Application</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead className="text-right">Health</TableHead>
                      <TableHead>Scheduled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pipeline.filter((c) =>
                      kpiDrill === "emergency" ? c.type === "Emergency" :
                      kpiDrill === "pending" ? c.cabDecision === "Pending" :
                      c.conflicts > 0
                    ).map((c) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => { setKpiDrill(null); setSelectedChange(c); }}>
                        <TableCell>
                          <div className="font-mono text-xs">{c.id}</div>
                          <div className="text-xs text-muted-foreground">{c.title}</div>
                        </TableCell>
                        <TableCell className="text-xs">{c.application}</TableCell>
                        <TableCell>{riskBadge(c.risk)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.healthScore}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.scheduled}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Golden signal drilldown */}
      <Dialog open={!!selectedSignal} onOpenChange={(o) => !o && setSelectedSignal(null)}>
        <DialogContent className="max-w-lg">
          {selectedSignal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{selectedSignal.name}</DialogTitle>
                <DialogDescription>{selectedSignal.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold">{selectedSignal.current}</span>
                  <span className="text-sm text-muted-foreground">target {selectedSignal.target}</span>
                </div>
                <Progress value={Math.min(100, (selectedSignal.current / (selectedSignal.target * 1.2)) * 100)} />
                <p className="text-xs text-muted-foreground">
                  Signal ID: <span className="font-mono">{selectedSignal.id}</span> · Use this signal in CAB sessions to challenge or endorse the active pipeline.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Change detail card */}
      <Dialog open={!!selectedChange} onOpenChange={(o) => !o && setSelectedChange(null)}>
        <DialogContent className="max-w-2xl">
          {selectedChange && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  {selectedChange.id} — {selectedChange.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedChange.application} · {selectedChange.criticality} · {selectedChange.type} change
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Health</p>
                    <p className="text-xl font-bold">{selectedChange.healthScore}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">CIs impacted</p>
                    <p className="text-xl font-bold">{selectedChange.ciCount}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Window</p>
                    <p className="text-xl font-bold">{selectedChange.windowHours}h</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Conflicts</p>
                    <p className="text-xl font-bold">{selectedChange.conflicts}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
                    <p className="font-semibold mb-1">Peer review</p>
                    <p className={selectedChange.peerReviewed ? "text-emerald-600" : "text-destructive"}>
                      {selectedChange.peerReviewed ? "✓ Documented" : "✗ Missing — flag for CAB"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
                    <p className="font-semibold mb-1">Rollback tested</p>
                    <p className={selectedChange.rollbackTested ? "text-emerald-600" : "text-destructive"}>
                      {selectedChange.rollbackTested ? "✓ Validated" : "✗ Not validated — high risk"}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 p-3 text-xs space-y-1">
                  <p><span className="text-muted-foreground">Submitted by:</span> <span className="font-medium">{selectedChange.submittedBy}</span></p>
                  <p><span className="text-muted-foreground">Scheduled:</span> <span className="font-medium">{selectedChange.scheduled}</span></p>
                  <p><span className="text-muted-foreground">Risk:</span> {riskBadge(selectedChange.risk)}</p>
                  <p><span className="text-muted-foreground">CAB decision:</span> {decisionBadge(selectedChange.cabDecision)}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
