import { useMemo, useState } from "react";
import { SectionCard } from "./SectionCard";
import { KpiCard } from "./KpiCard";
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
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Clock, Timer, AlertTriangle, Activity, ChevronRight, Lightbulb } from "lucide-react";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

// MTTD stage = wall-clock time from incident-start (event first detectable in
// monitoring) until it is acknowledged by an on-call engineer. We break that
// window into four observable sub-stages that operations teams can act on:
//   1. Signal Emission – time for telemetry/log/metric to surface
//   2. Alert Correlation – time for the monitoring stack to fire an alert
//   3. Notification Routing – time for paging/ticketing to reach a human
//   4. Human Acknowledgement – time on-call takes to ack the page
type Stage = {
  key: string;
  label: string;
  minutes: number;
  wasted: boolean;
  rootCause: string;
  recommendation: string;
};

type MttdExample = {
  incident: string;
  title: string;
  priority: "1 - Critical" | "2 - High";
  ci: string;
  category: string;
  detectedAt: string;
  totalMinutes: number;
  slaMinutes: number;
  stages: Stage[];
  takeaway: string;
};

const EXAMPLES: MttdExample[] = [
  {
    incident: "INC100023",
    title: "Checkout API 5xx surge — payments-gw saturated",
    priority: "1 - Critical",
    ci: "checkout-api",
    category: "Application",
    detectedAt: "2026-05-31 14:22 UTC",
    totalMinutes: 27,
    slaMinutes: 10,
    stages: [
      {
        key: "signal",
        label: "Signal Emission",
        minutes: 3,
        wasted: false,
        rootCause: "Metric scrape interval (1m) within target.",
        recommendation: "Maintain 1m scrape; OK.",
      },
      {
        key: "correlate",
        label: "Alert Correlation",
        minutes: 14,
        wasted: true,
        rootCause:
          "Alert required 3 consecutive 5xx breaches before firing — rule was tuned to suppress noise after a Q1 false-positive storm.",
        recommendation:
          "Lower the breach window to 2/3 datapoints for P1-tier services and add a fast-path rule keyed on payments-gw error budget burn.",
      },
      {
        key: "route",
        label: "Notification Routing",
        minutes: 7,
        wasted: true,
        rootCause:
          "PagerDuty service routed to 'Payments-Tier3' (business hours) instead of 'Payments-OnCall' (24x7). Service owner rotation drifted.",
        recommendation:
          "Re-bind the monitor to Payments-OnCall and add a weekly drift-check job that fails CI if a P1 CI is paged to a non-24x7 schedule.",
      },
      {
        key: "ack",
        label: "Human Acknowledgement",
        minutes: 3,
        wasted: false,
        rootCause: "On-call acknowledged within target SLO.",
        recommendation: "OK — keep current escalation policy.",
      },
    ],
    takeaway:
      "21 of 27 MTTD minutes were spent in tooling, not in human response. Tightening the correlation window and fixing routing alone would cut MTTD to ~6 minutes.",
  },
  {
    incident: "INC100045",
    title: "Customer DB primary failover — replication lag spike",
    priority: "1 - Critical",
    ci: "cust-db-primary",
    category: "Database",
    detectedAt: "2026-05-28 02:11 UTC",
    totalMinutes: 19,
    slaMinutes: 10,
    stages: [
      {
        key: "signal",
        label: "Signal Emission",
        minutes: 6,
        wasted: true,
        rootCause:
          "Replication-lag exporter scrapes every 5 minutes; spike was already 4 minutes old before first datapoint.",
        recommendation:
          "Reduce exporter interval to 30s on tier-1 DB clusters and emit a synthetic heartbeat to detect exporter staleness.",
      },
      {
        key: "correlate",
        label: "Alert Correlation",
        minutes: 4,
        wasted: false,
        rootCause: "Threshold rule fired on first breach as designed.",
        recommendation: "OK.",
      },
      {
        key: "route",
        label: "Notification Routing",
        minutes: 2,
        wasted: false,
        rootCause: "Routed correctly to Database-Admin on-call.",
        recommendation: "OK.",
      },
      {
        key: "ack",
        label: "Human Acknowledgement",
        minutes: 7,
        wasted: true,
        rootCause:
          "Primary on-call was paged but secondary missed the auto-escalation due to a stale phone number in the rotation.",
        recommendation:
          "Sync rotation contact details from HRIS nightly; add a quarterly synthetic page test for every on-call schedule.",
      },
    ],
    takeaway:
      "Half the MTTD here is observability blindspots (slow exporter) and half is escalation hygiene. Both are solvable without touching the application itself.",
  },
  {
    incident: "INC100071",
    title: "Edge firewall packet drops — WAF rule evaluation under load",
    priority: "2 - High",
    ci: "edge-fw-01",
    category: "Network",
    detectedAt: "2026-05-25 18:47 UTC",
    totalMinutes: 41,
    slaMinutes: 20,
    stages: [
      {
        key: "signal",
        label: "Signal Emission",
        minutes: 12,
        wasted: true,
        rootCause:
          "Packet-drop counter is only published via SNMP polling every 10 minutes; first signal arrived after damage was visible to users.",
        recommendation:
          "Stream NetFlow/sFlow to the SIEM in near-real-time, and alert on rate-of-change rather than absolute drop counts.",
      },
      {
        key: "correlate",
        label: "Alert Correlation",
        minutes: 18,
        wasted: true,
        rootCause:
          "No correlation rule existed between WAF CPU saturation and downstream drops — operators saw two unrelated tickets and triaged in series.",
        recommendation:
          "Add a topology-aware correlation rule (WAF-CPU >85% + edge drops >0.5%) that opens a single parent incident.",
      },
      {
        key: "route",
        label: "Notification Routing",
        minutes: 6,
        wasted: false,
        rootCause: "Routed to Network-Eng correctly.",
        recommendation: "OK.",
      },
      {
        key: "ack",
        label: "Human Acknowledgement",
        minutes: 5,
        wasted: false,
        rootCause: "Within SLO for P2.",
        recommendation: "OK.",
      },
    ],
    takeaway:
      "Both observability latency (SNMP polling) and the absence of cross-signal correlation are systemic. Fixing them improves MTTD across every Network P1/P2, not just this CI.",
  },
];

function fmtMinutes(m: number) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

export const MttdInsightsTab = () => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = EXAMPLES[selectedIdx];

  const overall = useMemo(() => {
    const p1 = EXAMPLES.filter((e) => e.priority === "1 - Critical");
    const p2 = EXAMPLES.filter((e) => e.priority === "2 - High");
    const avg = (arr: MttdExample[]) =>
      arr.length ? +(arr.reduce((s, e) => s + e.totalMinutes, 0) / arr.length).toFixed(1) : 0;
    const totalWasted = EXAMPLES.reduce(
      (s, e) => s + e.stages.filter((st) => st.wasted).reduce((a, b) => a + b.minutes, 0),
      0,
    );
    const totalSpent = EXAMPLES.reduce((s, e) => s + e.totalMinutes, 0);
    const breachRate = Math.round(
      (EXAMPLES.filter((e) => e.totalMinutes > e.slaMinutes).length / EXAMPLES.length) * 100,
    );
    return {
      p1Avg: avg(p1),
      p2Avg: avg(p2),
      wastedPct: Math.round((totalWasted / totalSpent) * 100),
      breachRate,
    };
  }, []);

  // Stage-level aggregate across all sampled incidents — shows where time
  // tends to leak across the portfolio, not just on a single ticket.
  const stageAggregate = useMemo(() => {
    const acc = new Map<string, { stage: string; avg: number; wasted: number; total: number }>();
    EXAMPLES.forEach((e) => {
      e.stages.forEach((s) => {
        const ex = acc.get(s.label) ?? { stage: s.label, avg: 0, wasted: 0, total: 0 };
        ex.total += s.minutes;
        if (s.wasted) ex.wasted += s.minutes;
        acc.set(s.label, ex);
      });
    });
    return Array.from(acc.values()).map((r) => ({
      stage: r.stage,
      "Avg minutes": +(r.total / EXAMPLES.length).toFixed(1),
      "Wasted minutes": +(r.wasted / EXAMPLES.length).toFixed(1),
    }));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="P1 MTTD (avg)"
          value={`${overall.p1Avg}m`}
          icon={AlertTriangle}
          accent
        />
        <KpiCard label="P2 MTTD (avg)" value={`${overall.p2Avg}m`} icon={Timer} />
        <KpiCard label="MTTD-SLA breach rate" value={`${overall.breachRate}%`} icon={Clock} />
        <KpiCard label="Detection time wasted" value={`${overall.wastedPct}%`} icon={Activity} />
      </div>

      <SectionCard
        title="Where detection time is being lost"
        description="Average minutes per MTTD stage across the sampled P1/P2 incidents. The red portion is time we classify as recoverable through tooling or process changes."
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageAggregate} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="stage" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} label={{ value: "minutes", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Avg minutes" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Wasted minutes" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="MTTD case studies"
        description="Pick an incident to see exactly where the minutes went and what to change so it does not repeat."
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {EXAMPLES.map((e, i) => (
            <Button
              key={e.incident}
              variant={i === selectedIdx ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedIdx(i)}
              className="text-xs"
            >
              {e.incident} · {e.priority.split(" - ")[0]}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="rounded-lg border border-border/60 p-4">
            <div className="text-[11px] uppercase text-muted-foreground font-semibold">Incident</div>
            <div className="text-sm font-semibold mt-1">{selected.incident}</div>
            <div className="text-xs text-muted-foreground mt-1">{selected.title}</div>
            <div className="flex gap-2 mt-3">
              <Badge variant="outline" className="text-[11px]">{selected.priority}</Badge>
              <Badge variant="outline" className="text-[11px]">{selected.category}</Badge>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <div className="text-[11px] uppercase text-muted-foreground font-semibold">MTTD</div>
            <div className="text-2xl font-bold mt-1">{fmtMinutes(selected.totalMinutes)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              SLO target: {fmtMinutes(selected.slaMinutes)} —{" "}
              <span className={selected.totalMinutes > selected.slaMinutes ? "text-destructive font-semibold" : "text-success font-semibold"}>
                {selected.totalMinutes > selected.slaMinutes
                  ? `breached by ${selected.totalMinutes - selected.slaMinutes}m`
                  : "within SLO"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">Detected: {selected.detectedAt}</div>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <div className="text-[11px] uppercase text-muted-foreground font-semibold">CI under stress</div>
            <div className="text-sm font-semibold mt-1">{selected.ci}</div>
            <div className="text-xs text-muted-foreground mt-2">
              Wasted minutes:{" "}
              <span className="font-semibold text-destructive">
                {selected.stages.filter((s) => s.wasted).reduce((a, b) => a + b.minutes, 0)}m
              </span>{" "}
              of {selected.totalMinutes}m
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-5">
          <div className="text-[11px] uppercase text-muted-foreground font-semibold mb-2">
            Stage-by-stage timeline
          </div>
          <div className="flex w-full overflow-hidden rounded-md border border-border/60">
            {selected.stages.map((s) => {
              const pct = (s.minutes / selected.totalMinutes) * 100;
              return (
                <div
                  key={s.key}
                  className="flex items-center justify-center text-[11px] font-medium px-2 py-2 text-primary-foreground"
                  style={{
                    width: `${pct}%`,
                    background: s.wasted
                      ? "hsl(var(--destructive))"
                      : "hsl(var(--chart-1))",
                  }}
                  title={`${s.label}: ${s.minutes}m`}
                >
                  {pct > 10 ? `${s.label} · ${s.minutes}m` : `${s.minutes}m`}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: "hsl(var(--chart-1))" }} />
              On-target time
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: "hsl(var(--destructive))" }} />
              Recoverable / wasted time
            </span>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Stage</TableHead>
              <TableHead className="w-[80px]">Minutes</TableHead>
              <TableHead className="w-[110px]">Verdict</TableHead>
              <TableHead>Why the time was spent here</TableHead>
              <TableHead>How to prevent next time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selected.stages.map((s) => (
              <TableRow key={s.key}>
                <TableCell className="font-medium text-sm">{s.label}</TableCell>
                <TableCell className="text-sm">{s.minutes}m</TableCell>
                <TableCell>
                  {s.wasted ? (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[11px]">
                      Recoverable
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[11px]">
                      On target
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.rootCause}</TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-start gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <span>{s.recommendation}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs flex gap-2">
          <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-primary">Takeaway: </span>
            <span className="text-foreground">{selected.takeaway}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Cross-incident recommendations"
        description="Themes that repeatedly drove up MTTD across the sampled P1/P2 incidents."
      >
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2">
            <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">Tighten alert correlation windows on tier-1 services</span> — multi-datapoint
              suppression rules are the single biggest source of recoverable MTTD.
            </span>
          </li>
          <li className="flex gap-2">
            <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">Audit notification routing weekly</span> — drifted PagerDuty bindings sent two
              of three incidents to the wrong rotation.
            </span>
          </li>
          <li className="flex gap-2">
            <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">Stream telemetry instead of polling</span> — SNMP / 5-minute scrapes added 6-12
              minutes of blind time before alerts could even fire.
            </span>
          </li>
          <li className="flex gap-2">
            <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">Synthetic on-call drills</span> — quarterly test pages would have caught the
              stale rotation contact that delayed the DB failover ack.
            </span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
};
