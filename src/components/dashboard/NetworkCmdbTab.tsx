import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  Network,
  ShieldAlert,
  ShieldCheck,
  Server,
  Activity,
  GitBranch,
  AlertOctagon,
  Layers,
  Workflow,
  ArrowRight,
  X,
} from "lucide-react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ENTERPRISE_APPS,
  FLOWS,
  FIREWALL_RULES,
  ITSM_RECORDS,
} from "@/lib/network";
import { useAppFocus } from "@/contexts/AppFocusContext";
import { useTimeRange } from "@/contexts/TimeRangeContext";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

const decisionColor: Record<string, string> = {
  ALLOW: "hsl(142 55% 38%)",
  DENY: "hsl(0 72% 51%)",
  NO_TRAFFIC: "hsl(38 92% 50%)",
};

type Decision = "all" | "ALLOW" | "DENY" | "NO_TRAFFIC";
type Risk = "all" | "High" | "Medium" | "Low";
type ItsmType = "all" | "Change" | "Incident" | "Problem";

const riskBadge = (risk: string) => {
  const map: Record<string, string> = {
    High: "bg-destructive/10 text-destructive border-destructive/30",
    Medium: "bg-amber-100 text-amber-700 border-amber-300",
    Low: "bg-emerald-100 text-emerald-700 border-emerald-300",
  };
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${map[risk] ?? ""}`}>
      {risk}
    </Badge>
  );
};

const itsmBadge = (type: string) => {
  const map: Record<string, { cls: string; icon: any }> = {
    Change: { cls: "bg-blue-100 text-blue-700 border-blue-300", icon: GitBranch },
    Incident: { cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertOctagon },
    Problem: { cls: "bg-purple-100 text-purple-700 border-purple-300", icon: Workflow },
  };
  const cfg = map[type] ?? { cls: "", icon: Activity };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${cfg.cls}`}>
      <Icon className="h-3 w-3 mr-1" /> {type}
    </Badge>
  );
};

export const NetworkCmdbTab = () => {
  const { appId: appFilter, setAppId: setAppFilter } = useAppFocus();
  const { isInRange, from, to, preset } = useTimeRange();

  // Time-bounded ITSM records — drives ITSM panel + KPI counts
  const itsmInRange = useMemo(
    () => ITSM_RECORDS.filter((r) => isInRange(r.opened_at)),
    [isInRange],
  );

  // Window factor — scale steady-state posture metrics (flows / silent CIs /
  // risky rules) by the selected window so KPIs and per-app counts change
  // when the user changes the time range. Baseline = 30 days.
  const windowFactor = useMemo(() => {
    if (preset === "all") return 1;
    if (from && to) {
      const ms = Math.max(0, to.getTime() - from.getTime());
      return Math.max(0.02, ms / (30 * 86_400_000));
    }
    return 1;
  }, [preset, from, to]);
  const scale = (n: number) => Math.max(0, Math.round(n * windowFactor));
  const scaleSmall = (n: number) =>
    n === 0 ? 0 : Math.max(windowFactor >= 1 ? n : windowFactor > 0.2 ? 1 : 0, Math.round(n * windowFactor));

  const [decisionFilter, setDecisionFilter] = useState<Decision>("all");
  const [riskFilter, setRiskFilter] = useState<Risk>("all");
  const [itsmTypeFilter, setItsmTypeFilter] = useState<ItsmType>("all");
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);

  // Scroll helper — flash highlight on a section when a KPI/chart drills into it
  const focusSection = (id: string) => {
    setScrollTarget(id);
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    setTimeout(() => setScrollTarget(null), 1600);
  };

  const clearAll = () => {
    setAppFilter("all");
    setDecisionFilter("all");
    setRiskFilter("all");
    setItsmTypeFilter("all");
  };

  // KPI totals — flow/posture aggregates scale by the selected window, ITSM
  // counts come from the time-bounded records directly.
  const totals = useMemo(() => {
    const base = ENTERPRISE_APPS.reduce(
      (acc, a) => {
        acc.allowed += a.allowed_flows;
        acc.denied += a.denied_flows;
        acc.silent += a.silent_cis;
        acc.risky += a.open_high_risk_rules;
        acc.lbs += a.load_balancers.length;
        return acc;
      },
      { allowed: 0, denied: 0, silent: 0, risky: 0, lbs: 0 },
    );
    const inc = itsmInRange.filter((r) => r.type === "Incident").length;
    const prb = itsmInRange.filter((r) => r.type === "Problem").length;
    const chg = itsmInRange.filter((r) => r.type === "Change").length;
    return {
      allowed: scale(base.allowed),
      denied: scale(base.denied),
      silent: scaleSmall(base.silent),
      risky: scaleSmall(base.risky),
      lbs: base.lbs,
      inc,
      prb,
      chg,
    };
  }, [itsmInRange, windowFactor]);

  const filteredFlows = useMemo(
    () =>
      FLOWS.filter((f) => {
        if (appFilter !== "all" && f.source_app !== appFilter && f.dest_app !== appFilter) return false;
        if (decisionFilter !== "all" && f.decision !== decisionFilter) return false;
        return true;
      }),
    [appFilter, decisionFilter],
  );

  const filteredRules = useMemo(
    () => FIREWALL_RULES.filter((r) => riskFilter === "all" || r.risk === riskFilter),
    [riskFilter],
  );

  const filteredItsm = useMemo(
    () =>
      itsmInRange.filter((r) => {
        if (appFilter !== "all" && r.app_id !== appFilter) return false;
        if (itsmTypeFilter !== "all" && r.type !== itsmTypeFilter) return false;
        return true;
      }),
    [itsmInRange, appFilter, itsmTypeFilter],
  );

  const decisionSummary = useMemo(() => {
    const counts = { ALLOW: 0, DENY: 0, NO_TRAFFIC: 0 };
    filteredFlows.forEach((f) => (counts[f.decision]++));
    return Object.entries(counts).map(([k, v]) => ({ name: k, value: v }));
  }, [filteredFlows]);

  const scatterData = ENTERPRISE_APPS.map((a) => ({
    name: a.name,
    app_id: a.app_id,
    x: a.denied_flows,
    y: a.open_incidents + a.open_problems + a.pending_changes,
    z: Math.max(40, a.open_high_risk_rules * 80 + 60),
    tier: a.criticality,
  }));

  const focusedApp = appFilter === "all" ? null : ENTERPRISE_APPS.find((a) => a.app_id === appFilter);

  const chips: { label: string; clear: () => void }[] = [
    ...(appFilter !== "all" ? [{ label: `App: ${focusedApp?.name ?? appFilter}`, clear: () => setAppFilter("all") }] : []),
    ...(decisionFilter !== "all" ? [{ label: `Decision: ${decisionFilter.replace("_", " ")}`, clear: () => setDecisionFilter("all") }] : []),
    ...(riskFilter !== "all" ? [{ label: `Rule risk: ${riskFilter}`, clear: () => setRiskFilter("all") }] : []),
    ...(itsmTypeFilter !== "all" ? [{ label: `ITSM: ${itsmTypeFilter}`, clear: () => setItsmTypeFilter("all") }] : []),
  ];

  const sectionRing = (id: string) =>
    scrollTarget === id ? "ring-2 ring-primary ring-offset-2 ring-offset-background transition-all" : "";

  return (
    <div className="space-y-6">
      {/* Use case banner */}
      <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 p-4 flex items-start gap-3">
        <Network className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              Network Visualisation · Banking-grade east-west &amp; perimeter visibility
            </p>
            <Badge variant="outline" className="text-[10px] font-medium border-primary/40 text-primary bg-primary/5">
              Persona · Network Operations
            </Badge>
            <Badge variant="outline" className="text-[10px] font-medium border-emerald-300 text-emerald-700 bg-emerald-50">
              Business value · Improved network visibility
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Single pane for <b>NetOps</b> in regulated banking estates — payments rails, core banking, trading,
            channels and shared services. Joins <b>Illumio</b> east-west flows and <b>Tufin</b> firewall rules with
            the <b>CMDB</b> (apps, CIs, load balancers) and cross-references <b>Change</b>, <b>Incident</b> and
            <b> Problem</b> records so NetOps can spot blind spots, denied business flows, silent CIs and
            over-permissive rules that breach <b>PCI-DSS</b>, <b>SWIFT CSP</b>, <b>FCA OpRes</b>, <b>DORA</b> and
            <b> MAS TRM</b> controls. Click any KPI, chart segment or table row to drill into the underlying
            evidence.
          </p>
        </div>
      </div>

      {/* KPI row — every card is a drill */}
      <section className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        <KpiCard
          label="Apps in scope"
          value={ENTERPRISE_APPS.length}
          icon={Layers}
          onClick={() => { clearAll(); focusSection("posture"); }}
        />
        <KpiCard
          label="Allowed flows"
          value={totals.allowed.toLocaleString()}
          icon={ShieldCheck}
          active={decisionFilter === "ALLOW"}
          onClick={() => { setDecisionFilter(decisionFilter === "ALLOW" ? "all" : "ALLOW"); focusSection("flows"); }}
        />
        <KpiCard
          label="Denied flows"
          value={totals.denied.toLocaleString()}
          icon={ShieldAlert}
          accent
          active={decisionFilter === "DENY"}
          onClick={() => { setDecisionFilter(decisionFilter === "DENY" ? "all" : "DENY"); focusSection("flows"); }}
        />
        <KpiCard
          label="Silent CIs"
          value={totals.silent}
          icon={Server}
          active={decisionFilter === "NO_TRAFFIC"}
          onClick={() => { setDecisionFilter(decisionFilter === "NO_TRAFFIC" ? "all" : "NO_TRAFFIC"); focusSection("flows"); }}
        />
        <KpiCard
          label="High-risk rules"
          value={totals.risky}
          icon={AlertOctagon}
          accent
          active={riskFilter === "High"}
          onClick={() => { setRiskFilter(riskFilter === "High" ? "all" : "High"); focusSection("rules"); }}
        />
        <KpiCard
          label="Open incidents"
          value={totals.inc}
          icon={AlertOctagon}
          active={itsmTypeFilter === "Incident"}
          onClick={() => { setItsmTypeFilter(itsmTypeFilter === "Incident" ? "all" : "Incident"); focusSection("itsm"); }}
        />
        <KpiCard
          label="Open problems"
          value={totals.prb}
          icon={Workflow}
          active={itsmTypeFilter === "Problem"}
          onClick={() => { setItsmTypeFilter(itsmTypeFilter === "Problem" ? "all" : "Problem"); focusSection("itsm"); }}
        />
        <KpiCard
          label="Pending changes"
          value={totals.chg}
          icon={GitBranch}
          active={itsmTypeFilter === "Change"}
          onClick={() => { setItsmTypeFilter(itsmTypeFilter === "Change" ? "all" : "Change"); focusSection("itsm"); }}
        />
      </section>

      {/* Filters bar — Focus application moved to global header */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active filters</span>
          {chips.map((c, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1 font-normal">
              {c.label}
              <button onClick={c.clear} className="hover:bg-background rounded p-0.5" aria-label="Remove filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={clearAll}>Clear all</Button>
        </div>
      )}

      {/* Enterprise application posture table */}
      <div id="posture" className={`rounded-lg ${sectionRing("posture")}`}>
        <SectionCard
          title="Enterprise application posture"
          description="Click a row to focus that application across every panel"
        >
          <div className="max-h-[420px] overflow-auto -mx-6 border-t border-border/60">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Application</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">CIs</TableHead>
                  <TableHead>Load balancers</TableHead>
                  <TableHead className="text-right">Allow</TableHead>
                  <TableHead className="text-right">Deny</TableHead>
                  <TableHead className="text-right">Silent</TableHead>
                  <TableHead className="text-right">Risk rules</TableHead>
                  <TableHead className="text-right">INC</TableHead>
                  <TableHead className="text-right">PRB</TableHead>
                  <TableHead className="text-right">CHG</TableHead>
                  <TableHead className="pr-6 text-right">Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ENTERPRISE_APPS.map((a) => (
                  <TableRow
                    key={a.app_id}
                    className={`text-sm cursor-pointer ${appFilter === a.app_id ? "bg-muted/50" : ""}`}
                    onClick={() => setAppFilter(a.app_id === appFilter ? "all" : a.app_id)}
                  >
                    <TableCell className="pl-6">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{a.app_id} · {a.owner}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] ${
                        a.criticality === "Tier 1" ? "border-destructive/40 text-destructive bg-destructive/5" :
                        a.criticality === "Tier 2" ? "border-amber-300 text-amber-700 bg-amber-50" :
                        "border-border text-muted-foreground"
                      }`}>{a.criticality}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.ci_count}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {a.load_balancers.join(", ")}
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums text-emerald-700 hover:underline"
                      onClick={(e) => { e.stopPropagation(); setAppFilter(a.app_id); setDecisionFilter("ALLOW"); focusSection("flows"); }}
                    >{scale(a.allowed_flows).toLocaleString()}</TableCell>
                    <TableCell
                      className="text-right tabular-nums text-destructive hover:underline"
                      onClick={(e) => { e.stopPropagation(); setAppFilter(a.app_id); setDecisionFilter("DENY"); focusSection("flows"); }}
                    >{scale(a.denied_flows).toLocaleString()}</TableCell>
                    <TableCell
                      className="text-right tabular-nums hover:underline"
                      onClick={(e) => { e.stopPropagation(); setAppFilter(a.app_id); setDecisionFilter("NO_TRAFFIC"); focusSection("flows"); }}
                    >{scaleSmall(a.silent_cis)}</TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => { e.stopPropagation(); if (a.open_high_risk_rules > 0) { setRiskFilter("High"); focusSection("rules"); } }}
                    >
                      {scaleSmall(a.open_high_risk_rules) > 0 ? (
                        <Badge variant="outline" className="text-[11px] border-destructive/40 text-destructive bg-destructive/5 font-mono cursor-pointer">
                          {scaleSmall(a.open_high_risk_rules)}
                        </Badge>
                      ) : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums hover:underline"
                      onClick={(e) => { e.stopPropagation(); setAppFilter(a.app_id); setItsmTypeFilter("Incident"); focusSection("itsm"); }}
                    >{a.open_incidents}</TableCell>
                    <TableCell
                      className="text-right tabular-nums hover:underline"
                      onClick={(e) => { e.stopPropagation(); setAppFilter(a.app_id); setItsmTypeFilter("Problem"); focusSection("itsm"); }}
                    >{a.open_problems}</TableCell>
                    <TableCell
                      className="text-right tabular-nums hover:underline"
                      onClick={(e) => { e.stopPropagation(); setAppFilter(a.app_id); setItsmTypeFilter("Change"); focusSection("itsm"); }}
                    >{a.pending_changes}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${a.health_score}%`,
                              backgroundColor:
                                a.health_score >= 85 ? "hsl(142 55% 38%)" :
                                a.health_score >= 65 ? "hsl(38 92% 50%)" :
                                "hsl(0 72% 51%)",
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums font-medium">{a.health_score}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>

      {/* Risk landscape + Flow decision mix */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <SectionCard
          title="Application risk landscape"
          description="Click a bubble to focus that app · X: denied flows · Y: open ITSM · size: high-risk rules"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Denied flows" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name="Open ITSM" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <ZAxis type="number" dataKey="z" range={[60, 600]} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }}
                formatter={(v: any, n: any) => [v, n]}
                labelFormatter={() => ""}
              />
              <Scatter
                data={scatterData}
                fill="hsl(var(--chart-4))"
                className="cursor-pointer"
                onClick={(d: any) => d?.app_id && setAppFilter(d.app_id)}
              >
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={
                    d.tier === "Tier 1" ? "hsl(0 72% 51%)" :
                    d.tier === "Tier 2" ? "hsl(38 92% 50%)" :
                    "hsl(var(--chart-2))"
                  } />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Flow decisions" description={appFilter === "all" ? "Across all apps · click a slice" : `Filtered to ${appFilter}`}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={decisionSummary}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                className="cursor-pointer"
                onClick={(d: any) => {
                  const name = d?.name as Decision;
                  if (!name) return;
                  setDecisionFilter(decisionFilter === name ? "all" : name);
                  focusSection("flows");
                }}
              >
                {decisionSummary.map((d, i) => (
                  <Cell key={i} fill={decisionColor[d.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {decisionSummary.map((d) => (
              <button
                key={d.name}
                onClick={() => { setDecisionFilter(decisionFilter === (d.name as Decision) ? "all" : (d.name as Decision)); focusSection("flows"); }}
                className={`w-full flex items-center justify-between text-xs px-1.5 py-1 rounded hover:bg-secondary transition-colors text-left ${
                  decisionFilter === d.name ? "bg-secondary" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: decisionColor[d.name] }} />
                  <span className="text-foreground">{d.name.replace("_", " ")}</span>
                </div>
                <span className="text-muted-foreground tabular-nums">{d.value}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      </section>

      {/* Flow detail */}
      <div id="flows" className={`rounded-lg ${sectionRing("flows")}`}>
        <SectionCard
          title="Network flows (Illumio / Tufin)"
          description="Click a row to jump to its firewall rule"
          action={
            <div className="flex items-center gap-2">
              <Select value={decisionFilter} onValueChange={(v) => setDecisionFilter(v as Decision)}>
                <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All decisions</SelectItem>
                  <SelectItem value="ALLOW">Allow</SelectItem>
                  <SelectItem value="DENY">Deny</SelectItem>
                  <SelectItem value="NO_TRAFFIC">No traffic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
          <div className="max-h-[360px] overflow-auto -mx-6 border-t border-border/60">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Source CI</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Destination CI</TableHead>
                  <TableHead>Port / Proto</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead className="text-right">Bytes 24h</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead className="pr-6">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">No flows for this filter.</TableCell></TableRow>
                )}
                {filteredFlows.map((f, i) => (
                  <TableRow
                    key={i}
                    className="text-sm cursor-pointer hover:bg-secondary/60"
                    onClick={() => { if (f.rule_id) { focusSection("rules"); } else { setAppFilter(f.source_app); } }}
                  >
                    <TableCell className="pl-6 font-mono text-xs">
                      <div>{f.source_ci}</div>
                      <div className="text-[10px] text-muted-foreground">{f.source_app}</div>
                    </TableCell>
                    <TableCell><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{f.dest_ci}</div>
                      <div className="text-[10px] text-muted-foreground">{f.dest_app}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{f.port === 0 ? "—" : `${f.protocol}/${f.port}`}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] font-medium"
                        style={{ color: decisionColor[f.decision], borderColor: `${decisionColor[f.decision]}55`, backgroundColor: `${decisionColor[f.decision]}0d` }}>
                        {f.decision.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {f.bytes_24h ? `${(f.bytes_24h / 1e9).toFixed(2)} GB` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">{f.rule_id ?? <span className="text-muted-foreground">none</span>}</TableCell>
                    <TableCell className="pr-6 text-xs text-muted-foreground">{f.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>

      {/* Firewall rules + Rule hits chart */}
      <section id="rules" className={`grid gap-6 grid-cols-1 lg:grid-cols-2 rounded-lg ${sectionRing("rules")}`}>
        <SectionCard
          title="Tufin firewall rules"
          description="Click a row to filter by its risk level"
          action={
            <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as Risk)}>
              <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All risks</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          <div className="max-h-[340px] overflow-auto -mx-6 border-t border-border/60">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Rule</TableHead>
                  <TableHead>Source → Dest</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Hits 30d</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="pr-6">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">No rules at this risk level.</TableCell></TableRow>
                )}
                {filteredRules.map((r) => (
                  <TableRow
                    key={r.rule_id}
                    className="text-sm cursor-pointer hover:bg-secondary/60"
                    onClick={() => setRiskFilter(riskFilter === (r.risk as Risk) ? "all" : (r.risk as Risk))}
                  >
                    <TableCell className="pl-6 font-mono text-xs font-medium">{r.rule_id}</TableCell>
                    <TableCell className="text-xs">{r.source_zone} <ArrowRight className="inline h-3 w-3 text-muted-foreground" /> {r.dest_zone}</TableCell>
                    <TableCell className="font-mono text-xs">{r.service}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] ${r.action === "Deny" ? "border-destructive/40 text-destructive bg-destructive/5" : "border-emerald-300 text-emerald-700 bg-emerald-50"}`}>{r.action}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{r.hit_count_30d.toLocaleString()}</TableCell>
                    <TableCell>{riskBadge(r.risk)}</TableCell>
                    <TableCell className="pr-6 font-mono text-xs">
                      {r.linked_change ? <span className="text-primary">{r.linked_change}</span> : <span className="text-muted-foreground">unlinked</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <SectionCard title="Rule hit counts (30d)" description="Click a bar to filter by its risk level">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={filteredRules} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis dataKey="rule_id" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="hit_count_30d"
                radius={[0, 4, 4, 0]}
                className="cursor-pointer"
                onClick={(d: any) => d?.risk && setRiskFilter(riskFilter === d.risk ? "all" : d.risk)}
              >
                {filteredRules.map((r, i) => (
                  <Cell key={i} fill={r.risk === "High" ? "hsl(0 72% 51%)" : r.risk === "Medium" ? "hsl(38 92% 50%)" : "hsl(var(--chart-2))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </section>

      {/* ITSM linkage */}
      <div id="itsm" className={`rounded-lg ${sectionRing("itsm")}`}>
        <SectionCard
          title="Linked ITSM records · Change / Incident / Problem"
          description={
            appFilter === "all"
              ? "All network-correlated ITSM activity · click a row to focus its application"
              : `ITSM activity for ${focusedApp?.name}`
          }
          action={
            <div className="flex items-center gap-2">
              <Select value={itsmTypeFilter} onValueChange={(v) => setItsmTypeFilter(v as ItsmType)}>
                <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="Incident">Incident</SelectItem>
                  <SelectItem value="Problem">Problem</SelectItem>
                  <SelectItem value="Change">Change</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={clearAll} disabled={chips.length === 0}>
                Clear filters
              </Button>
            </div>
          }
        >
          <div className="max-h-[400px] overflow-auto -mx-6 border-t border-border/60">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Record</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Linked rule</TableHead>
                  <TableHead className="pr-6">Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItsm.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">No ITSM records for this filter.</TableCell></TableRow>
                )}
                {filteredItsm.map((r) => {
                  const app = ENTERPRISE_APPS.find((a) => a.app_id === r.app_id);
                  return (
                    <TableRow
                      key={r.id}
                      className="text-sm cursor-pointer hover:bg-secondary/60"
                      onClick={() => setAppFilter(r.app_id)}
                    >
                      <TableCell className="pl-6 font-mono text-xs font-semibold">{r.id}</TableCell>
                      <TableCell onClick={(e) => { e.stopPropagation(); setItsmTypeFilter(itsmTypeFilter === r.type ? "all" : r.type); }}>
                        {itsmBadge(r.type)}
                      </TableCell>
                      <TableCell className="text-xs">{app?.name ?? r.app_id}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-muted-foreground">{r.short_description}</TableCell>
                      <TableCell className="text-xs">{r.state}</TableCell>
                      <TableCell className="text-xs">{r.priority}</TableCell>
                      <TableCell
                        className="font-mono text-xs"
                        onClick={(e) => { e.stopPropagation(); if (r.linked_rule) focusSection("rules"); }}
                      >
                        {r.linked_rule ? <span className="text-primary hover:underline">{r.linked_rule}</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="pr-6 text-xs text-muted-foreground">{r.opened_at}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
