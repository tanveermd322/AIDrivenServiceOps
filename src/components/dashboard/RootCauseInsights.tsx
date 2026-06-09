import { useMemo, useState } from "react";
import { SectionCard } from "./SectionCard";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Server, Database, HardDrive, Network as NetworkIcon, Target, Timer, Activity, AlertCircle, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

export type RcCategory = "service" | "database" | "infrastructure" | "network";

export function classifyCi(ci?: string): RcCategory {
  const s = (ci ?? "").toLowerCase();
  if (/(^|[-_])(lb|dns|router|switch|firewall|gateway|edge|proxy|wan|lan|vpn)/.test(s)) return "network";
  if (/(^|[-_])(db|sql|postgres|mysql|oracle|mongo|redis|cache|kafka|queue|elastic)/.test(s)) return "database";
  if (/(^|[-_])(storage|nas|san|disk|backup|host|vm|node|server|infra|monitoring|hub)/.test(s)) return "infrastructure";
  return "service";
}

const CAT_META: Record<RcCategory, { label: string; icon: any; tone: string }> = {
  service: { label: "Service", icon: Server, tone: "from-blue-500/15 to-blue-500/5 text-blue-600 border-blue-500/30" },
  database: { label: "Database", icon: Database, tone: "from-purple-500/15 to-purple-500/5 text-purple-600 border-purple-500/30" },
  infrastructure: { label: "Infrastructure", icon: HardDrive, tone: "from-amber-500/15 to-amber-500/5 text-amber-700 border-amber-500/30" },
  network: { label: "Network", icon: NetworkIcon, tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 border-emerald-500/30" },
};

interface Props {
  rootCause: any[];
  drillTo: (opts: any) => void;
}

export const RootCauseInsights = ({ rootCause, drillTo }: Props) => {
  const [active, setActive] = useState<RcCategory | "all">("all");

  const grouped = useMemo(() => {
    const out: Record<RcCategory, any[]> = { service: [], database: [], infrastructure: [], network: [] };
    rootCause.forEach((r) => out[classifyCi(r.cmdb_ci)].push(r));
    return out;
  }, [rootCause]);

  const totals = useMemo(() => {
    const sum = (arr: any[]) => arr.reduce((s, r) => s + (r.total_incidents ?? 0), 0);
    return {
      service: { count: grouped.service.length, issues: sum(grouped.service) },
      database: { count: grouped.database.length, issues: sum(grouped.database) },
      infrastructure: { count: grouped.infrastructure.length, issues: sum(grouped.infrastructure) },
      network: { count: grouped.network.length, issues: sum(grouped.network) },
    };
  }, [grouped]);

  const cats: RcCategory[] = ["service", "database", "infrastructure", "network"];

  // Golden signal → category mapping. Click a golden signal to focus the underlying category.
  const GOLDEN_SIGNALS: { key: string; label: string; sub: string; icon: any; cat: RcCategory; tone: string }[] = [
    { key: "latency", label: "Latency", sub: "Service response time", icon: Timer, cat: "service", tone: "from-blue-500/15 to-blue-500/5 text-blue-600 border-blue-500/30" },
    { key: "traffic", label: "Traffic", sub: "Network throughput", icon: Activity, cat: "network", tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 border-emerald-500/30" },
    { key: "errors", label: "Error Rate", sub: "DB / data-tier failures", icon: AlertCircle, cat: "database", tone: "from-purple-500/15 to-purple-500/5 text-purple-600 border-purple-500/30" },
    { key: "saturation", label: "Saturation", sub: "Infra resource pressure", icon: Gauge, cat: "infrastructure", tone: "from-amber-500/15 to-amber-500/5 text-amber-700 border-amber-500/30" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
        <Target className="h-5 w-5 text-accent mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Root Cause Insights</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click any of the 4 service Golden Signals (Latency, Traffic, Error Rate, Saturation) or the category indicators to focus the candidate tables below.
          </p>
        </div>
      </div>

      {/* Service Golden Signals */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Service Golden Signals</p>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {GOLDEN_SIGNALS.map((g) => {
            const Icon = g.icon;
            const t = totals[g.cat];
            const isActive = active === g.cat;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setActive(isActive ? "all" : g.cat)}
                className={cn(
                  "text-left rounded-lg border bg-gradient-to-br p-4 transition-all hover:-translate-y-0.5 hover:shadow-elegant focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  g.tone,
                  isActive ? "ring-2 ring-primary shadow-elegant" : "",
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="rounded-md p-2 bg-background/60">
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{g.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{g.sub}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impacted</p>
                    <p className="text-2xl font-bold leading-tight text-foreground tabular-nums">{t.count}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Incidents</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{t.issues}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>


      {/* Tiers — 4 interactive indicators grouped under one section */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tiers</p>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {cats.map((c) => {
            const meta = CAT_META[c];
            const Icon = meta.icon;
            const t = totals[c];
            const isActive = active === c;
            const status = t.count === 0 ? "Healthy" : t.count <= 2 ? "Watch" : "At risk";
            const statusColor = t.count === 0
              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
              : t.count <= 2
                ? "bg-amber-100 text-amber-700 border-amber-300"
                : "bg-destructive/10 text-destructive border-destructive/30";
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActive(isActive ? "all" : c)}
                className={cn(
                  "text-left rounded-lg border bg-gradient-to-br p-4 transition-all hover:-translate-y-0.5 hover:shadow-elegant focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  meta.tone,
                  isActive ? "ring-2 ring-primary shadow-elegant" : "",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md p-2 bg-background/60">
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] font-medium", statusColor)}>{status}</Badge>
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impacted CIs</p>
                    <p className="text-2xl font-bold leading-tight text-foreground tabular-nums">{t.count}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Incidents</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{t.issues}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 candidate tables (one per category) */}
      <div className="grid gap-6 grid-cols-1">
        {cats
          .filter((c) => active === "all" || active === c)
          .map((c) => {
            const meta = CAT_META[c];
            const Icon = meta.icon;
            const rows = grouped[c];
            return (
              <SectionCard
                key={c}
                title={`${meta.label} — Root Cause Candidates`}
                description={`${rows.length} candidate CI${rows.length === 1 ? "" : "s"} in this category`}
              >
                <div className="max-h-[360px] overflow-auto -mx-6 border-t border-border/60">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Rank</TableHead>
                        <TableHead>Configuration Item</TableHead>
                        {c === "service" && <TableHead>Golden Signal</TableHead>}
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">High/Crit</TableHead>
                        <TableHead className="text-right">Avg hrs</TableHead>
                        <TableHead className="pr-6">Latest</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={c === "service" ? 7 : 6} className="text-center text-sm text-muted-foreground py-8">
                            <div className="inline-flex items-center gap-2">
                              <Icon className="h-4 w-4 opacity-60" />
                              No {meta.label.toLowerCase()} issues in the selected window.
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {rows.map((r: any, i: number) => {
                        const riskScore = (r.total_incidents ?? 0) + (r.high_sev_count ?? 0) * 2 + (r.dynatrace_triggered ?? 0);
                        const riskLevel = riskScore >= 15 ? "critical" : riskScore >= 8 ? "high" : "medium";
                        // Pick a service golden signal per row from observed metrics
                        const signal =
                          (r.high_sev_count ?? 0) > 0 ? { label: "Error Rate", tone: "border-purple-500/40 text-purple-700 bg-purple-50" } :
                          (r.avg_resolution_hours ?? 0) >= 4 ? { label: "Latency", tone: "border-blue-500/40 text-blue-700 bg-blue-50" } :
                          (r.total_incidents ?? 0) >= 5 ? { label: "Traffic", tone: "border-emerald-500/40 text-emerald-700 bg-emerald-50" } :
                          { label: "Saturation", tone: "border-amber-500/40 text-amber-700 bg-amber-50" };
                        return (
                          <TableRow
                            key={r.cmdb_ci}
                            className="text-sm cursor-pointer hover:bg-secondary/60"
                            onClick={() => drillTo({ resetOthers: true, ci: r.cmdb_ci })}
                          >
                            <TableCell className="pl-6">
                              <div className={cn(
                                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold",
                                riskLevel === "critical" ? "bg-destructive/10 text-destructive" :
                                riskLevel === "high" ? "bg-orange-100 text-orange-700" :
                                "bg-amber-100 text-amber-700"
                              )}>
                                {i + 1}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold">{r.cmdb_ci}</TableCell>
                            {c === "service" && (
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[11px] font-medium", signal.tone)}>
                                  {signal.label}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="text-right tabular-nums font-semibold">{r.total_incidents}</TableCell>
                            <TableCell className="text-right">
                              {r.high_sev_count > 0 ? (
                                <Badge variant="outline" className="text-[11px] border-destructive/40 text-destructive bg-destructive/5 font-mono">{r.high_sev_count}</Badge>
                              ) : <span className="text-muted-foreground">0</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{r.avg_resolution_hours}</TableCell>
                            <TableCell className="pr-6 text-xs text-muted-foreground">{r.latest_incident?.split("T")[0]}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </SectionCard>
            );
          })}
      </div>
    </div>
  );
};
