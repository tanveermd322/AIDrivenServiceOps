import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchServiceNow } from "@/lib/servicenow";
import { useTimeRange } from "@/contexts/TimeRangeContext";
import { useAppFocus } from "@/contexts/AppFocusContext";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  Bot,
  Workflow,
  Gauge,
  Sparkles,
  PlayCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

// ──────────────────────────────────────────────────────────────────────
// Golden Path catalogue — reusable automation patterns mined from
// historical ServiceNow incident signatures (category + subcategory).
// Each one represents a sequence of validated remediation steps that
// can be triggered by automation specialists.
// ──────────────────────────────────────────────────────────────────────
type GoldenPath = {
  id: string;
  name: string;
  category: string;
  subcategoryMatch: string[];
  triggers: string[];
  steps: string[];
  avgManualMins: number;
  avgAutomatedMins: number;
  successRate: number; // 0..100
  status: "Production" | "Pilot" | "Draft";
  owner: string;
  runbook: string;
};

const GOLDEN_PATHS: GoldenPath[] = [
  {
    id: "GP-NET-01",
    name: "Network timeout self-heal",
    category: "Network",
    subcategoryMatch: ["Timeout", "Connection Refused"],
    triggers: ["Dynatrace: API latency > 2s", "Repeat incidents on api-gateway-*"],
    steps: [
      "Validate upstream DNS resolution",
      "Drain affected node from load balancer",
      "Recycle gateway pod / process",
      "Re-add to LB after 3 healthy probes",
      "Post resolution note to incident",
    ],
    avgManualMins: 42,
    avgAutomatedMins: 6,
    successRate: 92,
    status: "Production",
    owner: "Network-Eng",
    runbook: "RB-NET-001",
  },
  {
    id: "GP-DB-01",
    name: "Database latency mitigation",
    category: "Database",
    subcategoryMatch: ["Latency", "Connection Refused"],
    triggers: ["Dynatrace: DB response time SLO breach", "Repeat on db-primary-*"],
    steps: [
      "Capture top 5 long-running queries",
      "Kill queries above threshold (with approval policy)",
      "Flush query plan cache on replica",
      "Failover read traffic to replica",
      "Attach evidence + auto-resolve incident",
    ],
    avgManualMins: 65,
    avgAutomatedMins: 9,
    successRate: 86,
    status: "Production",
    owner: "Database-Admin",
    runbook: "RB-DB-014",
  },
  {
    id: "GP-STG-01",
    name: "Storage disk-full reclaim",
    category: "Storage",
    subcategoryMatch: ["Disk Full"],
    triggers: ["Dynatrace: filesystem > 90%", "Recurring on storage-nas-*"],
    steps: [
      "Identify largest growing directories",
      "Rotate / compress eligible log files",
      "Purge tmp older than 7 days",
      "Trigger snapshot prune policy",
      "Verify free space > 25%",
    ],
    avgManualMins: 35,
    avgAutomatedMins: 4,
    successRate: 95,
    status: "Production",
    owner: "Infra-Ops",
    runbook: "RB-STG-007",
  },
  {
    id: "GP-APP-01",
    name: "Memory leak recycle",
    category: "Application",
    subcategoryMatch: ["Memory Leak", "Crash"],
    triggers: ["Dynatrace: heap > 85% for 10m", "Repeat on auth-svc-*"],
    steps: [
      "Capture heap dump to artifact store",
      "Trigger rolling restart (canary first)",
      "Validate health endpoints",
      "Open follow-up problem ticket with dump link",
    ],
    avgManualMins: 50,
    avgAutomatedMins: 8,
    successRate: 88,
    status: "Pilot",
    owner: "App-Support",
    runbook: "RB-APP-022",
  },
  {
    id: "GP-CLD-01",
    name: "CPU spike auto-scale",
    category: "Cloud Infrastructure",
    subcategoryMatch: ["CPU Spike"],
    triggers: ["Dynatrace: CPU > 90% sustained 5m"],
    steps: [
      "Verify ASG / HPA headroom",
      "Scale out by +2 replicas",
      "Cordon noisiest node if pattern persists",
      "Annotate incident with scaling action",
    ],
    avgManualMins: 28,
    avgAutomatedMins: 3,
    successRate: 94,
    status: "Production",
    owner: "Cloud-SRE",
    runbook: "RB-CLD-003",
  },
  {
    id: "GP-SEC-01",
    name: "Expired certificate rotation",
    category: "Security",
    subcategoryMatch: ["Certificate Expired"],
    triggers: ["Dynatrace: TLS handshake failure", "Cert expiry < 24h"],
    steps: [
      "Pull renewed cert from vault",
      "Deploy to load balancer + sidecars",
      "Reload listeners with zero-downtime",
      "Verify endpoint TLS chain",
    ],
    avgManualMins: 55,
    avgAutomatedMins: 7,
    successRate: 90,
    status: "Pilot",
    owner: "Security-Ops",
    runbook: "RB-SEC-011",
  },
  {
    id: "GP-DNS-01",
    name: "DNS resolver failover",
    category: "DNS",
    subcategoryMatch: ["Timeout", "Connection Refused"],
    triggers: ["Resolver health probe fail", "Spike in NXDOMAIN"],
    steps: [
      "Switch downstream services to secondary resolver",
      "Restart primary resolver",
      "Validate forward + reverse lookups",
      "Restore primary after 5m clean window",
    ],
    avgManualMins: 38,
    avgAutomatedMins: 5,
    successRate: 89,
    status: "Draft",
    owner: "Network-Eng",
    runbook: "RB-DNS-004",
  },
];

const statusBadge = (s: GoldenPath["status"]) => {
  const map: Record<GoldenPath["status"], string> = {
    Production: "bg-emerald-100 text-emerald-700 border-emerald-300",
    Pilot: "bg-amber-100 text-amber-700 border-amber-300",
    Draft: "bg-secondary text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={`text-[11px] ${map[s]}`}>{s}</Badge>;
};

export const AutomationPatternInsightsTab = () => {
  const incidents = useQuery({ queryKey: ["sn", "incidents"], queryFn: () => fetchServiceNow("incidents") });
  const repeatPatterns = useQuery({ queryKey: ["sn", "repeat_patterns"], queryFn: () => fetchServiceNow("repeat_patterns") });
  const dynatracePatterns = useQuery({ queryKey: ["sn", "dynatrace_patterns"], queryFn: () => fetchServiceNow("dynatrace_patterns") });

  const { isInRange } = useTimeRange();
  const { matchesApp } = useAppFocus();
  const matchAny = (...vals: (string | undefined | null)[]) => matchesApp(vals.filter(Boolean).join(" "));
  // Time-bounded + application-scoped views — everything downstream uses these
  const incidentsInRange = useMemo(
    () =>
      ((incidents.data ?? []) as any[]).filter(
        (i) => isInRange(i.opened_at) && matchAny(i.short_description, i.cmdb_ci, i.category, i.assignment_group),
      ),
    [incidents.data, isInRange, matchesApp],
  );
  const repeatInRange = useMemo(
    () =>
      ((repeatPatterns.data ?? []) as any[]).filter(
        (p) => isInRange(p.latest_occurrence) && matchAny(p.short_description, p.cmdb_ci, p.category),
      ),
    [repeatPatterns.data, isInRange, matchesApp],
  );
  const dynaInRange = useMemo(
    () =>
      ((dynatracePatterns.data ?? []) as any[]).filter(
        (p) => isInRange(p.last_seen) && matchAny(p.short_description, p.cmdb_ci, p.category),
      ),
    [dynatracePatterns.data, isInRange, matchesApp],
  );

  const [selectedPath, setSelectedPath] = useState<GoldenPath | null>(null);
  const [kpiDrill, setKpiDrill] = useState<null | "automatable" | "savings" | "paths" | "candidates">(null);

  // Match incident signatures to golden paths
  const enriched = useMemo(() => {
    const incList = incidentsInRange;
    return GOLDEN_PATHS.map((gp) => {
      const matches = incList.filter(
        (i) => i.category === gp.category && gp.subcategoryMatch.includes(i.subcategory),
      );
      const minsSaved = matches.length * (gp.avgManualMins - gp.avgAutomatedMins);
      return { gp, matchCount: matches.length, matches, minsSaved };
    });
  }, [incidentsInRange]);

  // Candidate patterns: repeat incident signatures NOT yet covered by a golden path
  const candidates = useMemo(() => {
    const rep = repeatInRange;
    const dyn = dynaInRange;
    const covered = new Set(
      GOLDEN_PATHS.flatMap((gp) => gp.subcategoryMatch.map((sc) => `${gp.category}|${sc}`)),
    );
    const rows: { signature: string; ci: string; category: string; subcategory: string; occurrences: number; source: string }[] = [];
    rep.forEach((r) => {
      const sc = (r.short_description?.split("— ")[1] ?? "").trim();
      const key = `${r.category}|${sc}`;
      if (!covered.has(key)) {
        rows.push({
          signature: `${r.category} · ${sc || "Unclassified"}`,
          ci: r.cmdb_ci,
          category: r.category,
          subcategory: sc || "—",
          occurrences: r.repeat_count ?? 0,
          source: "Repeat pattern",
        });
      }
    });
    dyn.forEach((d) => {
      const key = `${d.category}|${d.subcategory}`;
      if (!covered.has(key)) {
        rows.push({
          signature: `${d.category} · ${d.subcategory}`,
          ci: d.cmdb_ci,
          category: d.category,
          subcategory: d.subcategory,
          occurrences: d.occurrence_count ?? 0,
          source: "Dynatrace pattern",
        });
      }
    });
    return rows.sort((a, b) => b.occurrences - a.occurrences);
  }, [repeatInRange, dynaInRange]);

  const totals = useMemo(() => {
    const totalIncidents = incidentsInRange.length;
    const automatable = enriched.reduce((s, e) => s + e.matchCount, 0);
    const minsSaved = enriched.reduce((s, e) => s + e.minsSaved, 0);
    const inProduction = GOLDEN_PATHS.filter((g) => g.status === "Production").length;
    const avgSuccess = Math.round(
      GOLDEN_PATHS.reduce((s, g) => s + g.successRate, 0) / GOLDEN_PATHS.length,
    );
    return {
      totalIncidents,
      automatable,
      pctAutomatable: totalIncidents ? Math.round((automatable / totalIncidents) * 100) : 0,
      hoursSaved: Math.round(minsSaved / 60),
      inProduction,
      totalPaths: GOLDEN_PATHS.length,
      avgSuccess,
      candidateCount: candidates.length,
    };
  }, [enriched, incidentsInRange, candidates]);

  const chartData = enriched
    .filter((e) => e.matchCount > 0)
    .map((e) => ({
      name: e.gp.id,
      label: e.gp.name,
      incidents: e.matchCount,
      hoursSaved: Math.round(e.minsSaved / 60),
    }));

  return (
    <div className="space-y-6">
      {/* Persona / value banner */}
      <SectionCard
        title="Automation Pattern Insights"
        description="For IT Automation Specialists — mine ServiceNow incident signatures, codify them as golden-path runbooks, and drive faster resolution through reusable automation."
      >
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" /> Target persona</p>
            <p className="text-muted-foreground mt-1">IT Automation Specialists building reusable remediation flows.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> Business value</p>
            <p className="text-muted-foreground mt-1">Faster MTTR via predefined golden paths triggered from incident signatures.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Workflow className="h-3.5 w-3.5" /> How it works</p>
            <p className="text-muted-foreground mt-1">Cluster repeat + Dynatrace patterns → match to runbooks → one-click execute.</p>
          </div>
        </div>
      </SectionCard>

      {/* KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="% Automatable incidents"
          value={`${totals.pctAutomatable}%`}
          icon={Sparkles}
          accent
          onClick={() => setKpiDrill("automatable")}
        />
        <KpiCard
          label="Hours saved (est.)"
          value={totals.hoursSaved}
          icon={Clock}
          onClick={() => setKpiDrill("savings")}
        />
        <KpiCard
          label="Golden paths"
          value={`${totals.inProduction}/${totals.totalPaths}`}
          icon={Workflow}
          onClick={() => setKpiDrill("paths")}
        />
        <KpiCard
          label="Pattern candidates"
          value={totals.candidateCount}
          icon={AlertTriangle}
          accent
          onClick={() => setKpiDrill("candidates")}
        />
      </section>

      {/* Chart */}
      <SectionCard title="Incidents addressable by golden path" description="Volume of ServiceNow incidents whose signature maps to an existing reusable runbook">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="incidents" radius={[6, 6, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="hsl(var(--chart-1))" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Golden paths table */}
      <SectionCard title="Golden path catalogue" description="Reusable automation patterns derived from historical ServiceNow incidents">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Pattern</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Matched incidents</TableHead>
                <TableHead className="text-right">MTTR (manual → auto)</TableHead>
                <TableHead className="text-right">Success</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enriched.map(({ gp, matchCount }) => (
                <TableRow
                  key={gp.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedPath(gp)}
                >
                  <TableCell className="font-mono text-xs">{gp.id}</TableCell>
                  <TableCell className="font-medium">{gp.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{gp.category}</TableCell>
                  <TableCell>{statusBadge(gp.status)}</TableCell>
                  <TableCell className="text-right tabular-nums">{matchCount}</TableCell>
                  <TableCell className="text-right text-xs">
                    <span className="text-muted-foreground">{gp.avgManualMins}m</span>
                    <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                    <span className="font-semibold text-emerald-600">{gp.avgAutomatedMins}m</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{gp.successRate}%</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                      <PlayCircle className="h-3.5 w-3.5" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {/* Candidate new patterns */}
      <SectionCard
        title="Candidate patterns to codify"
        description="High-frequency incident signatures with no golden path yet — strong candidates for new automation"
      >
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every recurring pattern is covered by a golden path. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signature</TableHead>
                  <TableHead>CI</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Occurrences</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.slice(0, 10).map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.signature}</TableCell>
                    <TableCell className="font-mono text-xs">{c.ci}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.source}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.occurrences}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Golden path detail */}
      <Dialog open={!!selectedPath} onOpenChange={(o) => !o && setSelectedPath(null)}>
        <DialogContent className="max-w-2xl">
          {selectedPath && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-primary" />
                  {selectedPath.name}
                  <span className="ml-1">{statusBadge(selectedPath.status)}</span>
                </DialogTitle>
                <DialogDescription>
                  {selectedPath.id} · Owned by {selectedPath.owner} · Runbook {selectedPath.runbook}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground">Manual MTTR</p>
                  <p className="text-lg font-semibold">{selectedPath.avgManualMins}m</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground">Automated MTTR</p>
                  <p className="text-lg font-semibold text-emerald-600">{selectedPath.avgAutomatedMins}m</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground">Success rate</p>
                  <p className="text-lg font-semibold">{selectedPath.successRate}%</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Triggers</p>
                <ul className="space-y-1">
                  {selectedPath.triggers.map((t, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Golden path steps</p>
                <ol className="space-y-2">
                  {selectedPath.steps.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedPath(null)}>Close</Button>
                <Button size="sm" className="gap-1.5">
                  <PlayCircle className="h-4 w-4" /> Simulate run
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* KPI drilldowns */}
      <Dialog open={!!kpiDrill} onOpenChange={(o) => !o && setKpiDrill(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {kpiDrill === "automatable" && (
            <>
              <DialogHeader>
                <DialogTitle>Automatable ServiceNow incidents</DialogTitle>
                <DialogDescription>
                  {totals.automatable} of {totals.totalIncidents} incidents match a golden path signature.
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead className="text-right">Matched incidents</TableHead>
                    <TableHead className="text-right">Coverage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enriched.map((e) => (
                    <TableRow key={e.gp.id}>
                      <TableCell>{e.gp.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.matchCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.totalIncidents ? Math.round((e.matchCount / totals.totalIncidents) * 100) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {kpiDrill === "savings" && (
            <>
              <DialogHeader>
                <DialogTitle>Estimated time saved by automation</DialogTitle>
                <DialogDescription>
                  Based on manual vs automated MTTR for each matched incident.
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead className="text-right">Incidents</TableHead>
                    <TableHead className="text-right">Mins saved / incident</TableHead>
                    <TableHead className="text-right">Total hours saved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enriched.map((e) => (
                    <TableRow key={e.gp.id}>
                      <TableCell>{e.gp.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.matchCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.gp.avgManualMins - e.gp.avgAutomatedMins}m</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{Math.round(e.minsSaved / 60)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {kpiDrill === "paths" && (
            <>
              <DialogHeader>
                <DialogTitle>Golden path lifecycle</DialogTitle>
                <DialogDescription>
                  {totals.inProduction} in Production · avg success rate {totals.avgSuccess}%
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {GOLDEN_PATHS.map((gp) => (
                    <TableRow key={gp.id}>
                      <TableCell className="font-mono text-xs">{gp.id}</TableCell>
                      <TableCell>{gp.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{gp.owner}</TableCell>
                      <TableCell>{statusBadge(gp.status)}</TableCell>
                      <TableCell className="text-right tabular-nums">{gp.successRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {kpiDrill === "candidates" && (
            <>
              <DialogHeader>
                <DialogTitle>Pattern candidates to codify</DialogTitle>
                <DialogDescription>
                  Recurring ServiceNow signatures not yet covered by automation.
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Signature</TableHead>
                    <TableHead>CI</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Occurrences</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell>{c.signature}</TableCell>
                      <TableCell className="font-mono text-xs">{c.ci}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.source}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.occurrences}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
