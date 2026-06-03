import { useMemo, useState } from "react";
import { useAppFocus } from "@/contexts/AppFocusContext";
import { useTimeRange } from "@/contexts/TimeRangeContext";
import { parseFuzzyDate } from "@/lib/fuzzy-date";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  ClipboardCheck,
  FileSearch,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Server,
  Activity,
  Clock,
  CopyCheck,
  Lightbulb,
} from "lucide-react";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

// ──────────────────────────────────────────────────────────────────────
// PCR (Post Change Review) dataset — completed changes awaiting closure
// review by the Application Support team. Each record carries the impacted
// CIs, observed incidents post-change, and the current PCR status that
// the engine evaluates and recommends updates for.
// ──────────────────────────────────────────────────────────────────────
type PcrStatus = "Pending Review" | "Successful" | "Successful w/ Issues" | "Failed" | "Backed Out";

type PcrRecord = {
  id: string;
  title: string;
  application: string;
  team: string;
  implementer: string;
  closedAt: string;
  windowHours: number;
  cis: string[];
  ciCriticality: "Tier 1" | "Tier 2" | "Tier 3";
  postIncidents: number;
  postIncidentSeverity: "None" | "Low" | "High" | "Critical";
  slaBreached: boolean;
  rollbackInvoked: boolean;
  monitoringClean: boolean; // golden signals clean for 24h
  currentStatus: PcrStatus;
  implementerNotes: string;
};

const PCR_RECORDS: PcrRecord[] = [
  {
    id: "CHG0097812", title: "Billing engine v4.1 cutover", application: "Billing Engine", team: "App Support — Finance", implementer: "j.adams",
    closedAt: "Mon 04:12", windowHours: 6, cis: ["billing-svc-01", "billing-svc-02", "billing-db-primary"], ciCriticality: "Tier 1",
    postIncidents: 2, postIncidentSeverity: "High", slaBreached: true, rollbackInvoked: false, monitoringClean: false,
    currentStatus: "Successful",
    implementerNotes: "All steps completed in window. No rollback. Closing as successful.",
  },
  {
    id: "CHG0097830", title: "Payments API gateway patch", application: "Payments API", team: "App Support — Payments", implementer: "m.singh",
    closedAt: "Tue 02:40", windowHours: 4, cis: ["pay-gw-01", "pay-gw-02"], ciCriticality: "Tier 1",
    postIncidents: 0, postIncidentSeverity: "None", slaBreached: false, rollbackInvoked: false, monitoringClean: true,
    currentStatus: "Pending Review",
    implementerNotes: "Patch applied to both nodes. Validated /health probe.",
  },
  {
    id: "CHG0097855", title: "CRM index rebuild", application: "CRM Portal", team: "App Support — CRM", implementer: "l.cheng",
    closedAt: "Tue 05:55", windowHours: 2, cis: ["crm-index-svc"], ciCriticality: "Tier 2",
    postIncidents: 0, postIncidentSeverity: "None", slaBreached: false, rollbackInvoked: false, monitoringClean: true,
    currentStatus: "Pending Review",
    implementerNotes: "Reindex completed in 1h45m. Query latency improved.",
  },
  {
    id: "CHG0097872", title: "DNS resolver failover swap", application: "Core DNS", team: "App Support — Platform", implementer: "r.osei",
    closedAt: "Wed 20:18", windowHours: 1, cis: ["dns-resolver-01", "dns-resolver-02", "dns-cache-fleet"], ciCriticality: "Tier 1",
    postIncidents: 1, postIncidentSeverity: "Critical", slaBreached: true, rollbackInvoked: true, monitoringClean: false,
    currentStatus: "Successful",
    implementerNotes: "Failover triggered cascading NXDOMAIN spike. Rolled back at 20:42.",
  },
  {
    id: "CHG0097890", title: "Warehouse ETL schema bump", application: "Data Warehouse", team: "App Support — Data", implementer: "k.varma",
    closedAt: "Thu 23:50", windowHours: 3, cis: ["dwh-etl-orchestrator", "dwh-stage-db"], ciCriticality: "Tier 2",
    postIncidents: 1, postIncidentSeverity: "Low", slaBreached: false, rollbackInvoked: false, monitoringClean: true,
    currentStatus: "Successful",
    implementerNotes: "Single nightly job lag, self-resolved.",
  },
  {
    id: "CHG0097901", title: "Auth service TLS rotation", application: "Auth Service", team: "App Support — Identity", implementer: "s.patel",
    closedAt: "Fri 22:10", windowHours: 2, cis: ["auth-svc-01", "auth-svc-02", "auth-lb"], ciCriticality: "Tier 1",
    postIncidents: 0, postIncidentSeverity: "None", slaBreached: false, rollbackInvoked: false, monitoringClean: true,
    currentStatus: "Pending Review",
    implementerNotes: "Cert rotated, handshake verified across 3 regions.",
  },
  {
    id: "CHG0097918", title: "Legacy ESB endpoint retirement", application: "Integration ESB", team: "App Support — Integration", implementer: "d.lee",
    closedAt: "Sat 00:30", windowHours: 5, cis: ["esb-broker-01", "esb-broker-02", "esb-router"], ciCriticality: "Tier 1",
    postIncidents: 3, postIncidentSeverity: "High", slaBreached: true, rollbackInvoked: true, monitoringClean: false,
    currentStatus: "Successful w/ Issues",
    implementerNotes: "Endpoint deprecation broke 2 downstream consumers. Re-enabled endpoint.",
  },
  {
    id: "CHG0097935", title: "Order service hotfix", application: "Order Service", team: "App Support — Commerce", implementer: "a.morales",
    closedAt: "Sat 21:45", windowHours: 1, cis: ["order-svc-01"], ciCriticality: "Tier 1",
    postIncidents: 0, postIncidentSeverity: "None", slaBreached: false, rollbackInvoked: false, monitoringClean: true,
    currentStatus: "Pending Review",
    implementerNotes: "Hotfix deployed via canary, full rollout at 21:30.",
  },
];

// ──────────────────────────────────────────────────────────────────────
// Recommendation engine — derives the suggested PCR status + notes from
// CI impact, post-change incidents, SLA breach, rollback and monitoring.
// ──────────────────────────────────────────────────────────────────────
type Recommendation = {
  suggestedStatus: PcrStatus;
  confidence: number; // 0..100
  rationale: string[];
  suggestedNotes: string;
  divergent: boolean; // true if recommendation differs from current status
};

const recommendFor = (r: PcrRecord): Recommendation => {
  const rationale: string[] = [];
  let suggested: PcrStatus = "Successful";
  let confidence = 85;

  if (r.rollbackInvoked) {
    suggested = "Backed Out";
    confidence = 95;
    rationale.push("Rollback was invoked during the change window.");
  } else if (r.postIncidentSeverity === "Critical" || (r.postIncidents >= 2 && r.postIncidentSeverity === "High")) {
    suggested = "Failed";
    confidence = 90;
    rationale.push(`${r.postIncidents} post-change incident(s) of ${r.postIncidentSeverity} severity within 24h.`);
  } else if (r.postIncidents > 0 || r.slaBreached || !r.monitoringClean) {
    suggested = "Successful w/ Issues";
    confidence = 80;
    if (r.postIncidents > 0) rationale.push(`${r.postIncidents} post-change incident(s) observed (${r.postIncidentSeverity}).`);
    if (r.slaBreached) rationale.push("SLA breached on impacted services.");
    if (!r.monitoringClean) rationale.push("Golden signals not clean for 24h post-change.");
  } else {
    suggested = "Successful";
    confidence = 92;
    rationale.push("No post-change incidents, no SLA breach, golden signals clean.");
  }

  // CI weighting
  if (r.ciCriticality === "Tier 1" && r.cis.length >= 3) {
    rationale.push(`High blast radius — ${r.cis.length} Tier-1 CIs touched.`);
    confidence = Math.min(99, confidence + 3);
  }

  const noteParts = [
    `Impacted CIs (${r.cis.length}): ${r.cis.join(", ")}.`,
    `Criticality: ${r.ciCriticality}.`,
    r.postIncidents > 0
      ? `${r.postIncidents} incident(s) raised within 24h (${r.postIncidentSeverity}).`
      : "No incidents raised within 24h.",
    r.slaBreached ? "SLA breach recorded." : "SLA respected.",
    r.rollbackInvoked ? "Rollback executed." : "No rollback required.",
    r.monitoringClean ? "Monitoring confirms steady-state signals." : "Monitoring shows continued anomalies — investigate before closure.",
  ];

  return {
    suggestedStatus: suggested,
    confidence,
    rationale,
    suggestedNotes: noteParts.join(" "),
    divergent: suggested !== r.currentStatus,
  };
};

const statusColors: Record<PcrStatus, string> = {
  "Pending Review": "bg-amber-100 text-amber-700 border-amber-300",
  "Successful": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Successful w/ Issues": "bg-orange-100 text-orange-700 border-orange-300",
  "Failed": "bg-destructive/10 text-destructive border-destructive/30",
  "Backed Out": "bg-secondary text-muted-foreground border-border",
};
const statusBadge = (s: PcrStatus) => (
  <Badge variant="outline" className={`text-[11px] ${statusColors[s]}`}>{s}</Badge>
);

type KpiKey = null | "pending" | "divergent" | "highImpact" | "accuracy";

export const PcrRecommendationTab = () => {
  const [kpiDrill, setKpiDrill] = useState<KpiKey>(null);
  const [selected, setSelected] = useState<PcrRecord | null>(null);
  const [appliedNotes, setAppliedNotes] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState<Record<string, PcrStatus>>({});

  const { matchesApp } = useAppFocus();
  const { isInRange } = useTimeRange();
  const enriched = useMemo(
    () =>
      PCR_RECORDS.filter((r) => {
        if (!matchesApp(r.application)) return false;
        const iso = parseFuzzyDate(r.closedAt);
        return iso ? isInRange(iso) : true;
      }).map((r) => ({ record: r, rec: recommendFor(r) })),
    [matchesApp, isInRange],
  );

  const totals = useMemo(() => {
    const pending = enriched.filter((e) => e.record.currentStatus === "Pending Review").length;
    const divergent = enriched.filter((e) => e.rec.divergent).length;
    const highImpact = enriched.filter(
      (e) => e.record.ciCriticality === "Tier 1" && e.record.cis.length >= 3,
    ).length;
    const accuracyBase = enriched.length;
    const wouldBeAccurate = enriched.filter((e) => !e.rec.divergent).length;
    const accuracy = Math.round((wouldBeAccurate / accuracyBase) * 100);
    return { pending, divergent, highImpact, accuracy };
  }, [enriched]);

  const statusMix = useMemo(() => {
    const out: Record<string, number> = {};
    enriched.forEach((e) => {
      out[e.rec.suggestedStatus] = (out[e.rec.suggestedStatus] ?? 0) + 1;
    });
    return Object.entries(out).map(([status, count]) => ({ status, count }));
  }, [enriched]);

  const byApplication = useMemo(() => {
    const map = new Map<string, { application: string; reviews: number; divergent: number }>();
    enriched.forEach((e) => {
      const ex = map.get(e.record.application);
      if (ex) {
        ex.reviews += 1;
        if (e.rec.divergent) ex.divergent += 1;
      } else {
        map.set(e.record.application, {
          application: e.record.application,
          reviews: 1,
          divergent: e.rec.divergent ? 1 : 0,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.divergent - a.divergent);
  }, [enriched]);

  const drillTitle: Record<Exclude<KpiKey, null>, string> = {
    pending: "PCRs awaiting review",
    divergent: "Recommendations that diverge from the implementer's status",
    highImpact: "High-impact changes — Tier 1 with ≥3 CIs",
    accuracy: "Recommendation alignment vs current PCR status",
  };

  const drillRecords = (key: Exclude<KpiKey, null>) =>
    enriched.filter((e) => {
      if (key === "pending") return e.record.currentStatus === "Pending Review";
      if (key === "divergent") return e.rec.divergent;
      if (key === "highImpact") return e.record.ciCriticality === "Tier 1" && e.record.cis.length >= 3;
      return true; // accuracy → all
    });

  const statusColorFor = (s: string) => {
    if (s === "Successful") return "hsl(142 55% 38%)";
    if (s === "Successful w/ Issues") return "hsl(25 95% 53%)";
    if (s === "Failed") return "hsl(0 72% 51%)";
    if (s === "Backed Out") return "hsl(215 35% 42%)";
    return "hsl(38 92% 50%)";
  };

  const acceptRecommendation = (r: PcrRecord, rec: Recommendation) => {
    setAccepted((p) => ({ ...p, [r.id]: rec.suggestedStatus }));
    setAppliedNotes((p) => ({ ...p, [r.id]: rec.suggestedNotes }));
  };

  return (
    <div className="space-y-6">
      {/* Persona / value banner */}
      <SectionCard
        title="PCR Recommendation"
        description="For the Application Support team — improve PCR accuracy with recommended statuses and notes derived from CI impact and post-change analysis."
      >
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Target persona</p>
            <p className="text-muted-foreground mt-1">Application Support engineers closing Post Change Reviews after implementation.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Business value</p>
            <p className="text-muted-foreground mt-1">Improved accuracy of PCR closure — fewer mislabelled "successful" changes hiding latent issues.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> How it works</p>
            <p className="text-muted-foreground mt-1">Engine reads impacted CIs + post-change incidents → recommends status + drafts review notes.</p>
          </div>
        </div>
      </SectionCard>

      {/* Interactive KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="PCRs awaiting review"
          value={totals.pending}
          icon={ClipboardCheck}
          accent
          onClick={() => setKpiDrill("pending")}
        />
        <KpiCard
          label="Divergent recommendations"
          value={totals.divergent}
          icon={AlertTriangle}
          accent
          hint="engine ≠ implementer"
          onClick={() => setKpiDrill("divergent")}
        />
        <KpiCard
          label="High-impact changes"
          value={totals.highImpact}
          icon={Server}
          hint="Tier 1, ≥3 CIs"
          onClick={() => setKpiDrill("highImpact")}
        />
        <KpiCard
          label="Recommendation alignment"
          value={`${totals.accuracy}%`}
          icon={CopyCheck}
          hint="vs current status"
          onClick={() => setKpiDrill("accuracy")}
        />
      </section>

      {/* Charts */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <SectionCard title="Recommended status mix" description="Click a slice to drill into reviews">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusMix}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                label={renderPieValueLabel}
                labelLine={false}
                onClick={() => setKpiDrill("divergent")}
                className="cursor-pointer"
              >
                {statusMix.map((d, i) => (
                  <Cell key={i} fill={statusColorFor(d.status)} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {statusMix.map((d) => (
              <div key={d.status} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColorFor(d.status) }} />
                  {d.status}
                </span>
                <span className="tabular-nums text-muted-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Reviews per application" description="Total PCRs awaiting closure per application">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byApplication} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="application" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="reviews" name="Reviews" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Recommendation confidence" description="Average engine confidence across all PCRs">
          <div className="flex flex-col items-center justify-center h-[220px]">
            <p className="text-6xl font-bold text-primary">{enriched.length ? Math.round(enriched.reduce((s, e) => s + e.rec.confidence, 0) / enriched.length) : 0}<span className="text-2xl text-muted-foreground">%</span></p>
            <p className="text-xs text-muted-foreground mt-2">Average across {enriched.length} review{enriched.length === 1 ? "" : "s"}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{totals.divergent} divergent · {enriched.length - totals.divergent} aligned</p>
          </div>
        </SectionCard>
      </section>


      {/* PCR table */}
      <SectionCard
        title="PCR recommendations"
        description="Click any row to inspect impacted CIs, post-change signals and accept/override the recommendation"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Change</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Impacted CIs</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Recommended</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enriched.map(({ record, rec }) => {
                const effectiveStatus = accepted[record.id] ?? record.currentStatus;
                return (
                  <TableRow key={record.id} className="cursor-pointer" onClick={() => setSelected(record)}>
                    <TableCell>
                      <div className="font-mono text-xs">{record.id}</div>
                      <div className="text-xs text-muted-foreground">{record.title}</div>
                    </TableCell>
                    <TableCell className="text-xs">{record.application}</TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium">{record.cis.length}</span>
                      <span className="text-muted-foreground"> · {record.ciCriticality}</span>
                    </TableCell>
                    <TableCell>{statusBadge(effectiveStatus)}</TableCell>
                    <TableCell>
                      {statusBadge(rec.suggestedStatus)}
                      {rec.divergent && effectiveStatus !== rec.suggestedStatus && (
                        <span className="ml-1 text-[10px] text-destructive font-semibold">·divergent</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs tabular-nums">{rec.confidence}%</span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={(e) => { e.stopPropagation(); setSelected(record); }}>
                        <FileSearch className="h-3.5 w-3.5" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {/* KPI drilldown */}
      <Dialog open={!!kpiDrill} onOpenChange={(o) => !o && setKpiDrill(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {kpiDrill && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-primary" />{drillTitle[kpiDrill]}</DialogTitle>
                <DialogDescription>Reviews matching this KPI — click a row to open the full recommendation.</DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Change</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>CIs</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Recommended</TableHead>
                    <TableHead className="text-right">Conf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillRecords(kpiDrill).map(({ record, rec }) => (
                    <TableRow key={record.id} className="cursor-pointer" onClick={() => { setKpiDrill(null); setSelected(record); }}>
                      <TableCell>
                        <div className="font-mono text-xs">{record.id}</div>
                        <div className="text-xs text-muted-foreground">{record.title}</div>
                      </TableCell>
                      <TableCell className="text-xs">{record.application}</TableCell>
                      <TableCell className="text-xs">{record.cis.length} · {record.ciCriticality}</TableCell>
                      <TableCell>{statusBadge(accepted[record.id] ?? record.currentStatus)}</TableCell>
                      <TableCell>{statusBadge(rec.suggestedStatus)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{rec.confidence}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* PCR detail + recommendation */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (() => {
            const rec = recommendFor(selected);
            const effectiveStatus = accepted[selected.id] ?? selected.currentStatus;
            const notes = appliedNotes[selected.id] ?? selected.implementerNotes;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    {selected.id} — {selected.title}
                  </DialogTitle>
                  <DialogDescription>
                    {selected.application} · {selected.team} · closed {selected.closedAt}
                  </DialogDescription>
                </DialogHeader>

                {/* Header chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">CIs impacted</p>
                    <p className="text-xl font-bold">{selected.cis.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Criticality</p>
                    <p className="text-xl font-bold">{selected.ciCriticality}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Post incidents</p>
                    <p className="text-xl font-bold">{selected.postIncidents}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Window</p>
                    <p className="text-xl font-bold">{selected.windowHours}h</p>
                  </div>
                </div>

                {/* CI list */}
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1"><Server className="h-3.5 w-3.5" /> Impacted configuration items</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.cis.map((ci) => (
                      <Badge key={ci} variant="outline" className="font-mono text-[11px]">{ci}</Badge>
                    ))}
                  </div>
                </div>

                {/* Change impact analysis */}
                <div className="rounded-lg border border-border/60 p-3 space-y-1.5 text-xs">
                  <p className="font-semibold mb-1 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Change impact analysis</p>
                  <div className="flex items-center gap-2">
                    {selected.slaBreached
                      ? <XCircle className="h-3.5 w-3.5 text-destructive" />
                      : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                    SLA {selected.slaBreached ? "breached" : "respected"} on impacted services
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.monitoringClean
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                    Golden signals {selected.monitoringClean ? "clean for 24h" : "still anomalous"}
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.rollbackInvoked
                      ? <XCircle className="h-3.5 w-3.5 text-destructive" />
                      : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                    Rollback {selected.rollbackInvoked ? "was invoked" : "not required"}
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.postIncidents === 0
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                    {selected.postIncidents} incident(s) raised within 24h ({selected.postIncidentSeverity})
                  </div>
                </div>

                {/* Recommendation */}
                <div className={`rounded-lg border p-3 space-y-2 ${rec.divergent ? "border-amber-300 bg-amber-50/40" : "border-emerald-300 bg-emerald-50/40"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Engine recommendation</p>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> confidence {rec.confidence}%</span>
                  </div>
                  <Progress value={rec.confidence} />
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Current:</span> {statusBadge(effectiveStatus)}
                    <span className="text-muted-foreground">→ Suggested:</span> {statusBadge(rec.suggestedStatus)}
                  </div>
                  <ul className="text-xs list-disc list-inside text-muted-foreground space-y-0.5">
                    {rec.rationale.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>

                {/* Suggested notes (editable) */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold">Suggested PCR notes</p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setAppliedNotes((p) => ({ ...p, [selected.id]: e.target.value }))}
                    rows={4}
                    className="text-xs"
                  />
                </div>

                <div className="flex flex-wrap gap-2 justify-end pt-1">
                  <Button size="sm" variant="ghost" onClick={() => { setAppliedNotes((p) => ({ ...p, [selected.id]: rec.suggestedNotes })); }}>
                    Use suggested notes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                    Keep current
                  </Button>
                  <Button size="sm" onClick={() => { acceptRecommendation(selected, rec); setSelected(null); }}>
                    Apply recommendation
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
