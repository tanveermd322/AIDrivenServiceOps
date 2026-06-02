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
import {
  Siren,
  Sparkles,
  AlertOctagon,
  Clock,
  FileText,
  BookOpen,
  Bug,
  PlayCircle,
  Link as LinkIcon,
  Users,
  Wrench,
  Lightbulb,
  ClipboardList,
  CheckCircle2,
  Activity,
} from "lucide-react";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

// ──────────────────────────────────────────────────────────────────────
// MIM (Major Incident Management) dataset — live & recent P1/P2 majors
// the Service Operations team is bridging. Each record carries free-text
// notes, history pointers, impacted services, and linked artefacts the
// engine will use to draft a MIM report and recommendations.
// ──────────────────────────────────────────────────────────────────────
type MimSeverity = "P1 - Critical" | "P2 - High";
type MimPhase = "Detect" | "Triage" | "Mitigate" | "Resolve" | "Post-Incident";

type Artefact =
  | { kind: "kb"; id: string; title: string; url: string }
  | { kind: "jira"; id: string; title: string; url: string }
  | { kind: "confluence"; id: string; title: string; url: string }
  | { kind: "problem"; id: string; title: string; url: string }
  | { kind: "runbook"; id: string; title: string; url: string; executable: boolean };

type MimRecord = {
  id: string;
  title: string;
  severity: MimSeverity;
  phase: MimPhase;
  openedAt: string;
  durationMins: number;
  bridge: string;
  commander: string;
  application: string;
  impactedServices: string[];
  customersImpacted: number;
  symptoms: string[];
  recentNotes: { ts: string; author: string; text: string }[];
  historySignature: string; // matches similar past majors
  similarPastMajors: string[];
  artefacts: Artefact[];
};

const MIM_RECORDS: MimRecord[] = [
  {
    id: "INC0421887",
    title: "Checkout 5xx surge across EU region",
    severity: "P1 - Critical",
    phase: "Mitigate",
    openedAt: "Today 09:42",
    durationMins: 38,
    bridge: "bridge-mim-eu-01",
    commander: "n.iyer",
    application: "Checkout Service",
    impactedServices: ["checkout-api", "payments-gw", "cart-svc"],
    customersImpacted: 12400,
    symptoms: [
      "502 from checkout-api at edge",
      "Payments gateway p99 latency 4.8s",
      "Cart abandonment spike +320%",
    ],
    recentNotes: [
      { ts: "09:42", author: "monitoring", text: "Dynatrace fired CRITICAL on checkout-api error budget burn." },
      { ts: "09:48", author: "n.iyer", text: "MIM declared P1. Bridge open. SRE + Payments engaged." },
      { ts: "09:55", author: "sre-oncall", text: "Rolled checkout-api deploy back to v4.12 — error rate easing." },
    ],
    historySignature: "checkout-api:5xx-surge:eu",
    similarPastMajors: ["INC0411203 (8d ago)", "INC0398872 (34d ago)"],
    artefacts: [
      { kind: "kb", id: "KB001284", title: "Checkout 5xx triage playbook", url: "#kb-001284" },
      { kind: "runbook", id: "RB-CHK-07", title: "Roll back checkout-api to previous tag", url: "#rb-chk-07", executable: true },
      { kind: "jira", id: "PAY-3412", title: "Payments gateway p99 regression", url: "#jira-pay-3412" },
      { kind: "problem", id: "PRB000812", title: "Checkout error budget burn pattern", url: "#prb-000812" },
      { kind: "confluence", id: "CONF-9921", title: "Checkout incident runbook hub", url: "#conf-9921" },
    ],
  },
  {
    id: "INC0421902",
    title: "Auth service token validation failures",
    severity: "P1 - Critical",
    phase: "Triage",
    openedAt: "Today 11:08",
    durationMins: 12,
    bridge: "bridge-mim-id-04",
    commander: "s.patel",
    application: "Auth Service",
    impactedServices: ["auth-svc", "sso-edge", "session-cache"],
    customersImpacted: 5800,
    symptoms: [
      "JWT validation failing intermittently",
      "Session cache hit rate dropped to 41%",
    ],
    recentNotes: [
      { ts: "11:08", author: "monitoring", text: "Auth 401 anomaly +480% vs baseline." },
      { ts: "11:12", author: "s.patel", text: "Suspect TLS rotation overlap from CHG0097901." },
    ],
    historySignature: "auth-svc:tls-rotation:post-change",
    similarPastMajors: ["INC0418442 (21d ago)"],
    artefacts: [
      { kind: "kb", id: "KB000871", title: "Auth TLS rotation rollback", url: "#kb-000871" },
      { kind: "runbook", id: "RB-AUTH-12", title: "Force re-issue of session keys", url: "#rb-auth-12", executable: true },
      { kind: "confluence", id: "CONF-7710", title: "Auth service architecture", url: "#conf-7710" },
    ],
  },
  {
    id: "INC0421765",
    title: "Database primary failover stalled",
    severity: "P1 - Critical",
    phase: "Resolve",
    openedAt: "Yesterday 22:55",
    durationMins: 142,
    bridge: "bridge-mim-db-02",
    commander: "k.varma",
    application: "Customer DB",
    impactedServices: ["cust-db-primary", "cust-db-replica-a", "cust-db-replica-b"],
    customersImpacted: 22000,
    symptoms: [
      "Primary unreachable for writes",
      "Replica lag 4m20s",
      "Connection pool saturation on app tier",
    ],
    recentNotes: [
      { ts: "22:55", author: "monitoring", text: "DB heartbeat lost on cust-db-primary." },
      { ts: "23:18", author: "k.varma", text: "Manual failover to replica-a; clients reconnecting." },
      { ts: "01:17", author: "k.varma", text: "Service restored, monitoring stable for 30m." },
    ],
    historySignature: "cust-db:failover-stall",
    similarPastMajors: ["INC0407214 (62d ago)", "INC0395110 (118d ago)"],
    artefacts: [
      { kind: "kb", id: "KB001102", title: "DB failover decision tree", url: "#kb-001102" },
      { kind: "runbook", id: "RB-DB-05", title: "Promote replica to primary", url: "#rb-db-05", executable: true },
      { kind: "problem", id: "PRB000744", title: "Recurring failover stall on cust-db", url: "#prb-000744" },
      { kind: "jira", id: "DB-1188", title: "Investigate failover latency", url: "#jira-db-1188" },
      { kind: "confluence", id: "CONF-4421", title: "Customer DB topology", url: "#conf-4421" },
    ],
  },
  {
    id: "INC0421810",
    title: "Email delivery backlog growing",
    severity: "P2 - High",
    phase: "Mitigate",
    openedAt: "Today 07:30",
    durationMins: 95,
    bridge: "bridge-mim-msg-03",
    commander: "a.morales",
    application: "Notification Platform",
    impactedServices: ["notify-worker", "smtp-relay", "queue-kafka"],
    customersImpacted: 0,
    symptoms: [
      "Kafka lag on notify-topic 180k messages",
      "SMTP relay throttled by upstream",
    ],
    recentNotes: [
      { ts: "07:30", author: "monitoring", text: "Queue depth crossed P2 threshold." },
      { ts: "07:48", author: "a.morales", text: "Scaled notify-worker 3→8, lag draining." },
    ],
    historySignature: "notify:queue-lag:smtp-throttle",
    similarPastMajors: ["INC0414003 (16d ago)"],
    artefacts: [
      { kind: "kb", id: "KB000934", title: "Notify backlog drain procedure", url: "#kb-000934" },
      { kind: "runbook", id: "RB-NOT-02", title: "Scale notify workers", url: "#rb-not-02", executable: true },
      { kind: "jira", id: "NOT-552", title: "SMTP relay throttling protection", url: "#jira-not-552" },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────
// MIM report templates — Service Ops picks one; engine fills it in
// ──────────────────────────────────────────────────────────────────────
type Template = {
  id: string;
  name: string;
  audience: string;
  sections: string[];
};

const TEMPLATES: Template[] = [
  {
    id: "exec-brief",
    name: "Executive brief",
    audience: "Leadership / business stakeholders",
    sections: ["Summary", "Customer impact", "Current status", "Next update"],
  },
  {
    id: "tech-bridge",
    name: "Technical bridge update",
    audience: "Engineers on the bridge",
    sections: ["Symptoms", "Working theory", "Mitigations tried", "Owners & next steps"],
  },
  {
    id: "post-incident",
    name: "Post-incident report (draft)",
    audience: "Problem mgmt & retrospective",
    sections: ["Timeline", "Root cause hypothesis", "Detection & response", "Action items"],
  },
];

// ──────────────────────────────────────────────────────────────────────
// Recommendation engine — drafts MIM report from notes/history/template
// ──────────────────────────────────────────────────────────────────────
type Recommendation = {
  summary: string;
  workingTheory: string;
  confidence: number;
  recommendedActions: string[];
  recommendedArtefacts: Artefact[];
  report: string;
};

const recommendFor = (r: MimRecord, template: Template): Recommendation => {
  const noteText = r.recentNotes.map((n) => `[${n.ts}] ${n.author}: ${n.text}`).join("\n");
  const summary = `${r.severity} on ${r.application} — ${r.title}. ${r.customersImpacted.toLocaleString()} customers impacted across ${r.impactedServices.length} services. Currently in ${r.phase} phase after ${r.durationMins}m.`;

  const workingTheory =
    r.similarPastMajors.length > 0
      ? `Signature "${r.historySignature}" matches ${r.similarPastMajors.length} past major(s): ${r.similarPastMajors.join("; ")}. Apply prior mitigation pattern.`
      : `New signature "${r.historySignature}" — no historical match, proceed with first-principles triage.`;

  const confidence = Math.min(95, 60 + r.similarPastMajors.length * 12 + r.recentNotes.length * 3);

  const recommendedActions: string[] = [];
  if (r.phase === "Detect" || r.phase === "Triage") {
    recommendedActions.push("Declare commander & open bridge if not already active.");
    recommendedActions.push("Page application support owner for primary impacted service.");
  }
  if (r.phase === "Mitigate") {
    const runbook = r.artefacts.find((a) => a.kind === "runbook" && a.executable);
    if (runbook) recommendedActions.push(`Execute runbook ${runbook.id} — ${runbook.title}.`);
    recommendedActions.push("Send executive brief update every 15 minutes.");
  }
  if (r.phase === "Resolve") {
    recommendedActions.push("Validate monitoring clean for 30m before declaring resolved.");
    recommendedActions.push("Schedule post-incident review and link Problem record.");
  }
  if (r.phase === "Post-Incident") {
    recommendedActions.push("Publish post-incident report to leadership.");
    recommendedActions.push("Convert action items to Jira tickets and link to Problem.");
  }

  // Prefer artefacts most relevant to the current phase
  const recommendedArtefacts = r.artefacts.filter((a) => {
    if (r.phase === "Mitigate") return a.kind === "runbook" || a.kind === "kb";
    if (r.phase === "Triage") return a.kind === "kb" || a.kind === "confluence";
    if (r.phase === "Resolve" || r.phase === "Post-Incident") return a.kind === "problem" || a.kind === "jira";
    return true;
  });

  // Render report skeleton from chosen template
  const reportLines: string[] = [`# ${template.name} — ${r.id}`, ""];
  template.sections.forEach((s) => {
    reportLines.push(`## ${s}`);
    if (s === "Summary" || s === "Symptoms") reportLines.push(summary);
    if (s === "Customer impact") reportLines.push(`${r.customersImpacted.toLocaleString()} customers; services: ${r.impactedServices.join(", ")}.`);
    if (s === "Current status") reportLines.push(`Phase: ${r.phase}. Commander: ${r.commander}. Bridge: ${r.bridge}.`);
    if (s === "Working theory") reportLines.push(workingTheory);
    if (s === "Mitigations tried") reportLines.push(r.recentNotes.map((n) => `• ${n.text}`).join("\n"));
    if (s === "Owners & next steps") reportLines.push(recommendedActions.map((a) => `• ${a}`).join("\n"));
    if (s === "Next update") reportLines.push("Next update in 15 minutes.");
    if (s === "Timeline") reportLines.push(noteText);
    if (s === "Root cause hypothesis") reportLines.push(workingTheory);
    if (s === "Detection & response") reportLines.push(`Detected via monitoring at ${r.openedAt}. Mitigations underway in ${r.phase} phase.`);
    if (s === "Action items") reportLines.push(recommendedActions.map((a) => `• ${a}`).join("\n"));
    reportLines.push("");
  });

  return {
    summary,
    workingTheory,
    confidence,
    recommendedActions,
    recommendedArtefacts,
    report: reportLines.join("\n"),
  };
};

const severityColors: Record<MimSeverity, string> = {
  "P1 - Critical": "bg-destructive/10 text-destructive border-destructive/30",
  "P2 - High": "bg-orange-100 text-orange-700 border-orange-300",
};
const phaseColors: Record<MimPhase, string> = {
  "Detect": "bg-destructive/10 text-destructive border-destructive/30",
  "Triage": "bg-orange-100 text-orange-700 border-orange-300",
  "Mitigate": "bg-amber-100 text-amber-700 border-amber-300",
  "Resolve": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Post-Incident": "bg-secondary text-muted-foreground border-border",
};

const artefactMeta: Record<Artefact["kind"], { label: string; icon: any; tint: string }> = {
  kb: { label: "Knowledge Base", icon: BookOpen, tint: "text-sky-700 bg-sky-50 border-sky-200" },
  jira: { label: "Jira", icon: Bug, tint: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  confluence: { label: "Confluence", icon: FileText, tint: "text-blue-700 bg-blue-50 border-blue-200" },
  problem: { label: "Problem", icon: AlertOctagon, tint: "text-amber-700 bg-amber-50 border-amber-200" },
  runbook: { label: "Runbook", icon: PlayCircle, tint: "text-emerald-700 bg-emerald-50 border-emerald-200" },
};

type KpiKey = null | "active" | "p1" | "artefacts" | "matched";

export const MimRecommendationEngineTab = () => {
  const [kpiDrill, setKpiDrill] = useState<KpiKey>(null);
  const [selected, setSelected] = useState<MimRecord | null>(null);
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [executedRunbooks, setExecutedRunbooks] = useState<Record<string, string[]>>({});
  const [phaseFilter, setPhaseFilter] = useState<MimPhase | null>(null);
  const [appFilter, setAppFilter] = useState<string | null>(null);

  const { isInRange } = useTimeRange();
  const { matchesApp } = useAppFocus();

  // Convert "Today HH:MM" / "Yesterday HH:MM" → ISO timestamp for time-range filtering
  const parseOpenedAt = (s: string): string => {
    const now = new Date();
    const m = s.match(/(Today|Yesterday)\s+(\d{1,2}):(\d{2})/i);
    if (!m) return now.toISOString();
    const base = new Date(now);
    if (/Yesterday/i.test(m[1])) base.setDate(base.getDate() - 1);
    base.setHours(parseInt(m[2], 10), parseInt(m[3], 10), 0, 0);
    return base.toISOString();
  };
  const mimsInRange = useMemo(
    () => MIM_RECORDS.filter((r) => isInRange(parseOpenedAt(r.openedAt)) && matchesApp(r.application)),
    [isInRange, matchesApp],
  );

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0],
    [templateId],
  );

  const enriched = useMemo(
    () => mimsInRange.map((r) => ({ record: r, rec: recommendFor(r, template) })),
    [template, mimsInRange],
  );

  const totals = useMemo(() => {
    const active = enriched.filter((e) => e.record.phase !== "Post-Incident").length;
    const p1 = enriched.filter((e) => e.record.severity === "P1 - Critical").length;
    const artefacts = enriched.reduce((s, e) => s + e.record.artefacts.length, 0);
    const matched = enriched.filter((e) => e.record.similarPastMajors.length > 0).length;
    return { active, p1, artefacts, matched };
  }, [enriched]);

  const phaseMix = useMemo(() => {
    const out: Record<string, number> = {};
    enriched.forEach((e) => (out[e.record.phase] = (out[e.record.phase] ?? 0) + 1));
    return Object.entries(out).map(([phase, count]) => ({ phase, count }));
  }, [enriched]);

  const artefactsByKind = useMemo(() => {
    const out: Record<string, number> = {};
    enriched.forEach((e) =>
      e.record.artefacts.forEach((a) => (out[a.kind] = (out[a.kind] ?? 0) + 1)),
    );
    return Object.entries(out).map(([kind, count]) => ({
      kind,
      label: artefactMeta[kind as Artefact["kind"]].label,
      count,
    }));
  }, [enriched]);

  const phaseColorFor = (p: string) => {
    if (p === "Detect") return "hsl(0 72% 51%)";
    if (p === "Triage") return "hsl(25 95% 53%)";
    if (p === "Mitigate") return "hsl(38 92% 50%)";
    if (p === "Resolve") return "hsl(142 55% 38%)";
    return "hsl(215 35% 42%)";
  };

  const visible = enriched.filter((e) => {
    if (phaseFilter && e.record.phase !== phaseFilter) return false;
    if (appFilter && e.record.application !== appFilter) return false;
    return true;
  });

  const drillTitle: Record<Exclude<KpiKey, null>, string> = {
    active: "Active major incidents",
    p1: "P1 critical majors",
    artefacts: "Linked artefacts across MIMs",
    matched: "MIMs matching a historical signature",
  };

  const drillRecords = (key: Exclude<KpiKey, null>) =>
    enriched.filter((e) => {
      if (key === "active") return e.record.phase !== "Post-Incident";
      if (key === "p1") return e.record.severity === "P1 - Critical";
      if (key === "matched") return e.record.similarPastMajors.length > 0;
      return true;
    });

  const executeRunbook = (mimId: string, runbookId: string) => {
    setExecutedRunbooks((prev) => ({
      ...prev,
      [mimId]: Array.from(new Set([...(prev[mimId] ?? []), runbookId])),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Persona / value banner */}
      <SectionCard
        title="MIM Recommendation Engine"
        description="For Service Operations during Major Incident Management — generate MIM reports from incident notes, history and templates, with linked Knowledge, Jira, Confluence, Problem records and executable runbooks."
      >
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Target persona</p>
            <p className="text-muted-foreground mt-1">Service Operations leading the bridge during P1/P2 majors.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Business value</p>
            <p className="text-muted-foreground mt-1">Speed up MIM — faster comms, faster mitigation, fewer minutes of customer impact.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> How it works</p>
            <p className="text-muted-foreground mt-1">Engine reads notes + history signature → drafts the chosen MIM template and surfaces relevant artefacts.</p>
          </div>
        </div>
      </SectionCard>

      {/* Interactive KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active majors" value={totals.active} icon={Siren} accent onClick={() => setKpiDrill("active")} />
        <KpiCard label="P1 critical" value={totals.p1} icon={AlertOctagon} accent onClick={() => setKpiDrill("p1")} />
        <KpiCard label="History matches" value={totals.matched} icon={Activity} hint="signature reuse" onClick={() => setKpiDrill("matched")} />
        <KpiCard label="Linked artefacts" value={totals.artefacts} icon={LinkIcon} hint="KB · Jira · Conf · Problem · Runbook" onClick={() => setKpiDrill("artefacts")} />
      </section>

      {/* Charts */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <SectionCard title="MIMs by phase" description="Click a slice to filter the bridge list">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={phaseMix}
                dataKey="count"
                nameKey="phase"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                onClick={(d: any) => d?.phase && setPhaseFilter(d.phase as MimPhase)}
                className="cursor-pointer"
              >
                {phaseMix.map((d, i) => (
                  <Cell key={i} fill={phaseColorFor(d.phase)} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {phaseMix.map((d) => (
              <button
                key={d.phase}
                onClick={() => setPhaseFilter(d.phase as MimPhase)}
                className="flex w-full items-center justify-between text-xs hover:bg-secondary/60 rounded px-1 py-0.5"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: phaseColorFor(d.phase) }} />
                  {d.phase}
                </span>
                <span className="tabular-nums text-muted-foreground">{d.count}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Linked artefacts by kind"
          description="Knowledge, Jira, Confluence, Problems and executable runbooks attached to current majors"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={artefactsByKind} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} className="cursor-pointer" onClick={() => setKpiDrill("artefacts")} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </section>

      {/* Template picker */}
      <SectionCard
        title="MIM report template"
        description="Pick the template the engine will populate when you open a major"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((t) => {
            const active = t.id === templateId;
            return (
              <button
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={`text-left rounded-lg border p-3 transition ${
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border/60 bg-card hover:bg-secondary/40"
                }`}
              >
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> {t.name}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">{t.audience}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.sections.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Active filters */}
      {(phaseFilter || appFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {phaseFilter && (
            <Badge variant="outline" className="gap-1">
              Phase: {phaseFilter}
              <button onClick={() => setPhaseFilter(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </Badge>
          )}
          {appFilter && (
            <Badge variant="outline" className="gap-1">
              App: {appFilter}
              <button onClick={() => setAppFilter(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </Badge>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setPhaseFilter(null); setAppFilter(null); }}>Clear</Button>
        </div>
      )}

      {/* Bridge list */}
      <SectionCard title="Major incident bridges" description="Click a row to open the MIM recommendation workspace">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Application</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Customers</TableHead>
              <TableHead className="text-right">Artefacts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(({ record, rec }) => (
              <TableRow key={record.id} className="cursor-pointer" onClick={() => setSelected(record)}>
                <TableCell className="font-mono text-xs">{record.id}</TableCell>
                <TableCell className="max-w-[260px] truncate">{record.title}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[11px] ${severityColors[record.severity]}`}>{record.severity}</Badge>
                </TableCell>
                <TableCell>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPhaseFilter(record.phase); }}
                    className="text-left"
                  >
                    <Badge variant="outline" className={`text-[11px] ${phaseColors[record.phase]}`}>{record.phase}</Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAppFilter(record.application); }}
                    className="text-xs hover:underline"
                  >
                    {record.application}
                  </button>
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">{record.durationMins}m</TableCell>
                <TableCell className="text-right tabular-nums text-xs">{record.customersImpacted.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">{record.artefacts.length}</TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-6">
                  No majors match the current filters.
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
                <DialogDescription>Click a row to open the MIM workspace.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead className="text-right">Customers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillRecords(kpiDrill).map(({ record }) => (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer"
                        onClick={() => { setKpiDrill(null); setSelected(record); }}
                      >
                        <TableCell className="font-mono text-xs">{record.id}</TableCell>
                        <TableCell className="text-xs">{record.title}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-[11px] ${severityColors[record.severity]}`}>{record.severity}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={`text-[11px] ${phaseColors[record.phase]}`}>{record.phase}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{record.customersImpacted.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MIM workspace dialog */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selected && (() => {
            const rec = recommendFor(selected, template);
            const executed = executedRunbooks[selected.id] ?? [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Siren className="h-4 w-4 text-destructive" /> {selected.id} — {selected.title}
                  </DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`text-[11px] ${severityColors[selected.severity]}`}>{selected.severity}</Badge>
                    <Badge variant="outline" className={`text-[11px] ${phaseColors[selected.phase]}`}>{selected.phase}</Badge>
                    <span className="text-[11px] text-muted-foreground"><Clock className="inline h-3 w-3 mr-1" />{selected.durationMins}m · opened {selected.openedAt}</span>
                    <span className="text-[11px] text-muted-foreground"><Users className="inline h-3 w-3 mr-1" />Commander {selected.commander}</span>
                  </DialogDescription>
                </DialogHeader>

                {/* Recommendation summary */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Engine recommendation
                    <Badge variant="outline" className="ml-auto text-[10px]">confidence {rec.confidence}%</Badge>
                  </p>
                  <p className="text-xs text-foreground">{rec.summary}</p>
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Working theory: </span>{rec.workingTheory}</p>
                </div>

                {/* Impact + notes */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 p-3 space-y-1.5">
                    <p className="text-xs font-semibold">Impact</p>
                    <p className="text-[11px] text-muted-foreground">App: <span className="text-foreground">{selected.application}</span></p>
                    <p className="text-[11px] text-muted-foreground">Customers: <span className="text-foreground tabular-nums">{selected.customersImpacted.toLocaleString()}</span></p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selected.impactedServices.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
                      ))}
                    </div>
                    <p className="text-xs font-semibold pt-2">Symptoms</p>
                    <ul className="text-[11px] text-muted-foreground list-disc list-inside space-y-0.5">
                      {selected.symptoms.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3 space-y-1.5">
                    <p className="text-xs font-semibold">Recent notes</p>
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                      {selected.recentNotes.map((n, i) => (
                        <div key={i} className="text-[11px] border-l-2 border-border pl-2">
                          <p className="text-muted-foreground"><span className="font-mono">{n.ts}</span> · <span className="text-foreground">{n.author}</span></p>
                          <p>{n.text}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs font-semibold pt-2">History signature</p>
                    <p className="text-[11px] font-mono">{selected.historySignature}</p>
                    {selected.similarPastMajors.length > 0 && (
                      <ul className="text-[11px] text-muted-foreground list-disc list-inside">
                        {selected.similarPastMajors.map((m) => <li key={m}>{m}</li>)}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Recommended actions */}
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Recommended next actions</p>
                  <ul className="text-xs space-y-1">
                    {rec.recommendedActions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Linked artefacts */}
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5" /> Linked artefacts</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selected.artefacts.map((a) => {
                      const meta = artefactMeta[a.kind];
                      const Icon = meta.icon;
                      const isRunbook = a.kind === "runbook";
                      const ran = isRunbook && executed.includes(a.id);
                      return (
                        <div key={a.id} className={`rounded-md border p-2 flex items-start gap-2 ${meta.tint}`}>
                          <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold truncate">{a.id} · {meta.label}</p>
                            <p className="text-[11px] truncate">{a.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <a href={a.url} className="text-[10px] underline opacity-80 hover:opacity-100">Open</a>
                              {isRunbook && (a as any).executable && (
                                <Button
                                  size="sm"
                                  variant={ran ? "secondary" : "default"}
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => executeRunbook(selected.id, a.id)}
                                >
                                  <PlayCircle className="h-3 w-3" /> {ran ? "Executed" : "Execute"}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Drafted report */}
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Drafted {template.name}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => navigator.clipboard?.writeText(rec.report)}
                    >
                      Copy report
                    </Button>
                  </div>
                  <Textarea value={rec.report} readOnly className="font-mono text-[11px] min-h-[220px]" />
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
