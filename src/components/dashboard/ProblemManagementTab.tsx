import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchServiceNow } from "@/lib/servicenow";
import { SectionCard } from "./SectionCard";
import { KpiCard } from "./KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertOctagon, FileWarning, Link2, Plus, Repeat, Sparkles, Workflow, CheckCircle2, Info,
} from "lucide-react";
import { ProblemKpiDrilldownDialog, type KpiKind } from "./ProblemKpiDrilldownDialog";
import { useTimeRange } from "@/contexts/TimeRangeContext";
import { useAppFocus } from "@/contexts/AppFocusContext";

export interface ProblemTicket {
  number: string;
  short_description: string;
  priority: string;
  state: "New" | "Assess" | "Root Cause Analysis" | "Fix in Progress" | "Resolved" | "Closed";
  assignment_group: string;
  cmdb_ci: string;
  category: string;
  pattern_key: string;
  linked_incidents: string[];
  created_at: string;
  description?: string;
}

const PRIORITIES = ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"];
const GROUPS = ["Infra-Ops", "Cloud-SRE", "Database-Admin", "Network-Eng", "Security-Ops", "App-Support", "DevOps", "Platform-Eng"];

function patternKey(ci?: string, category?: string, sub?: string) {
  return `${ci ?? ""}|${category ?? ""}|${sub ?? ""}`;
}

function recommendedPriority(count: number) {
  if (count >= 7) return "1 - Critical";
  if (count >= 5) return "2 - High";
  if (count >= 3) return "3 - Medium";
  return "4 - Low";
}

function daysOpen(createdAt: string) {
  const created = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

const stateColors: Record<ProblemTicket["state"], string> = {
  "New": "bg-destructive/10 text-destructive border-destructive/30",
  "Assess": "bg-orange-100 text-orange-700 border-orange-300",
  "Root Cause Analysis": "bg-amber-100 text-amber-700 border-amber-300",
  "Fix in Progress": "bg-sky-100 text-sky-700 border-sky-300",
  "Resolved": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Closed": "bg-secondary text-muted-foreground border-border",
};

interface Props {
  problems: ProblemTicket[];
  setProblems: React.Dispatch<React.SetStateAction<ProblemTicket[]>>;
}

export const ProblemManagementTab = ({ problems, setProblems }: Props) => {
  const repeatPatterns = useQuery({ queryKey: ["sn", "repeat_patterns"], queryFn: () => fetchServiceNow("repeat_patterns") });
  const dynatracePatterns = useQuery({ queryKey: ["sn", "dynatrace_patterns"], queryFn: () => fetchServiceNow("dynatrace_patterns") });
  const incidentsRaw = useQuery({ queryKey: ["sn", "incidents"], queryFn: () => fetchServiceNow("incidents") });

  const { isInRange } = useTimeRange();
  const { matchesApp } = useAppFocus();
  const matchAny = (...vals: (string | undefined | null)[]) => matchesApp(vals.filter(Boolean).join(" "));
  // Time-bounded + app-scoped views — every downstream pattern/incident metric uses these
  const incidents = useMemo(
    () => ({
      data: ((incidentsRaw.data ?? []) as any[]).filter(
        (i) => isInRange(i.opened_at) && matchAny(i.short_description, i.cmdb_ci, i.category, i.assignment_group),
      ),
    }),
    [incidentsRaw.data, isInRange, matchesApp],
  );
  const repeatPatternsFiltered = useMemo(
    () =>
      ((repeatPatterns.data ?? []) as any[]).filter(
        (p) => isInRange(p.latest_occurrence) && matchAny(p.short_description, p.cmdb_ci, p.category),
      ),
    [repeatPatterns.data, isInRange, matchesApp],
  );
  const dynatracePatternsFiltered = useMemo(
    () =>
      ((dynatracePatterns.data ?? []) as any[]).filter(
        (p) => isInRange(p.last_seen) && matchAny(p.short_description, p.cmdb_ci, p.category),
      ),
    [dynatracePatterns.data, isInRange, matchesApp],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [activePattern, setActivePattern] = useState<any | null>(null);
  const [form, setForm] = useState({
    short_description: "",
    description: "",
    priority: "3 - Medium",
    assignment_group: "Infra-Ops",
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkIncident, setLinkIncident] = useState<any | null>(null);
  const [linkPattern, setLinkPattern] = useState<any | null>(null);
  const [linkTarget, setLinkTarget] = useState<string>("");
  const [kpiDrilldown, setKpiDrilldown] = useState<KpiKind | null>(null);
  const [selectedPatternKey, setSelectedPatternKey] = useState<string | null>(null);
  const [expandedProblem, setExpandedProblem] = useState<string | null>(null);

  const openProblems = useMemo(
    () => problems.filter((p) => p.state !== "Resolved" && p.state !== "Closed"),
    [problems],
  );

  const openLinkFromPattern = (p: any) => {
    setLinkPattern(p);
    setLinkIncident(null);
    const suggested = openProblems.find((pr) => pr.cmdb_ci === p.cmdb_ci && pr.category === p.category);
    setLinkTarget(suggested?.number ?? openProblems[0]?.number ?? "");
    setLinkOpen(true);
  };

  // Build unified pattern rows by combining repeat_patterns + dynatrace_patterns
  const patterns = useMemo(() => {
    const rep = repeatPatternsFiltered;
    const dyn = dynatracePatternsFiltered;
    const map = new Map<string, any>();
    rep.forEach((r) => {
      const sub = r.short_description?.split("—")[1]?.trim() ?? "";
      const key = patternKey(r.cmdb_ci, r.category, sub);
      map.set(key, {
        key,
        cmdb_ci: r.cmdb_ci,
        category: r.category,
        subcategory: sub,
        repeat_count: r.repeat_count ?? 0,
        first_seen: r.first_occurrence,
        last_seen: r.latest_occurrence,
        dynatrace_count: 0,
        avg_duration_hours: null as number | null,
        signature: r.short_description,
      });
    });
    dyn.forEach((d) => {
      const key = patternKey(d.cmdb_ci, d.category, d.subcategory);
      const existing = map.get(key);
      if (existing) {
        existing.dynatrace_count = d.occurrence_count ?? 0;
        existing.avg_duration_hours = d.avg_duration_hours ?? null;
        existing.first_seen = existing.first_seen ?? d.first_seen;
        existing.last_seen = existing.last_seen ?? d.last_seen;
      } else {
        map.set(key, {
          key,
          cmdb_ci: d.cmdb_ci,
          category: d.category,
          subcategory: d.subcategory,
          repeat_count: 0,
          first_seen: d.first_seen,
          last_seen: d.last_seen,
          dynatrace_count: d.occurrence_count ?? 0,
          avg_duration_hours: d.avg_duration_hours ?? null,
          signature: `${d.category} issue on ${d.cmdb_ci} — ${d.subcategory}`,
        });
      }
    });
    return Array.from(map.values())
      .map((p) => {
        const matchingIncidents = ((incidents.data ?? []) as any[]).filter(
          (i) => i.cmdb_ci === p.cmdb_ci && i.category === p.category && (!p.subcategory || i.subcategory === p.subcategory)
        );
        return {
          ...p,
          incident_count: matchingIncidents.length,
          incident_numbers: matchingIncidents.map((i) => i.number),
        };
      })
      .sort((a, b) => (b.repeat_count + b.dynatrace_count) - (a.repeat_count + a.dynatrace_count));
  }, [repeatPatternsFiltered, dynatracePatternsFiltered, incidents.data]);

  const promotablePatterns = patterns.filter((p) => p.repeat_count >= 3 || p.dynatrace_count >= 3);
  const problemsForPattern = (key: string) => problems.filter((p) => p.pattern_key === key);

  const kpis = {
    total_patterns: patterns.length,
    candidate_problems: promotablePatterns.filter((p) => problemsForPattern(p.key).length === 0).length,
    open_problems: problems.filter((p) => p.state !== "Resolved" && p.state !== "Closed").length,
    linked_incidents: problems.reduce((s, p) => s + p.linked_incidents.length, 0),
  };

  // ── Recurring incidents unlinked to a problem ──
  const unlinkedRecurring = useMemo(() => {
    const linked = new Set(problems.flatMap((p) => p.linked_incidents));
    const recurringSignatures = new Set(
      patterns.filter((p) => p.incident_count >= 2).map((p) => patternKey(p.cmdb_ci, p.category, p.subcategory))
    );
    return ((incidents.data ?? []) as any[])
      .filter((i) => !linked.has(i.number))
      .filter((i) => recurringSignatures.has(patternKey(i.cmdb_ci, i.category, i.subcategory)))
      .slice(0, 25);
  }, [incidents.data, patterns, problems]);

  const openCreateFromPattern = (p: any) => {
    setActivePattern(p);
    setForm({
      short_description: `Recurring ${p.category}/${p.subcategory || "issue"} on ${p.cmdb_ci}`,
      description: `Auto-generated from recurring incident pattern.\n\nCI: ${p.cmdb_ci}\nCategory: ${p.category}\nSubcategory: ${p.subcategory || "—"}\nRepeat occurrences: ${p.repeat_count}\nDynatrace alerts: ${p.dynatrace_count}\nFirst seen: ${p.first_seen}\nLast seen: ${p.last_seen}\nMatching incidents: ${p.incident_count}\n\nRecommended action: Initiate Problem Management workflow — perform Root Cause Analysis, identify known error, and plan permanent fix via Change Management.`,
      priority: recommendedPriority(Math.max(p.repeat_count, p.dynatrace_count)),
      assignment_group: GROUPS[Math.floor(Math.random() * GROUPS.length)],
    });
    setCreateOpen(true);
  };

  const submitProblem = () => {
    if (!activePattern) return;
    const number = `PRB${String(10000 + problems.length + 1).padStart(7, "0")}`;
    const linked: string[] = activePattern.incident_numbers ?? [];
    const ticket: ProblemTicket = {
      number,
      short_description: form.short_description,
      description: form.description,
      priority: form.priority,
      state: "New",
      assignment_group: form.assignment_group,
      cmdb_ci: activePattern.cmdb_ci,
      category: activePattern.category,
      pattern_key: activePattern.key,
      linked_incidents: linked,
      created_at: new Date().toISOString(),
    };
    setProblems((p) => [ticket, ...p]);
    setCreateOpen(false);
    toast({
      title: `Problem ${number} created`,
      description: `Submitted to ServiceNow Problem Management · ${linked.length} incident(s) auto-linked.`,
    });
  };

  const openLinkDialog = (incident: any) => {
    setLinkIncident(incident);
    setLinkPattern(null);
    // Suggest matching open problem
    const match = openProblems.find(
      (p) => p.cmdb_ci === incident.cmdb_ci && p.category === incident.category
    );
    setLinkTarget(match?.number ?? openProblems[0]?.number ?? "");
    setLinkOpen(true);
  };

  const submitLink = () => {
    if (!linkTarget) return;
    if (linkPattern) {
      const nums: string[] = linkPattern.incident_numbers ?? [];
      setProblems((all) => all.map((p) => {
        if (p.number !== linkTarget) return p;
        const merged = Array.from(new Set([...p.linked_incidents, ...nums]));
        return { ...p, linked_incidents: merged };
      }));
      toast({
        title: "Incidents linked",
        description: `${nums.length} incident(s) from this pattern linked to ${linkTarget}.`,
      });
    } else if (linkIncident) {
      setProblems((all) => all.map((p) =>
        p.number === linkTarget && !p.linked_incidents.includes(linkIncident.number)
          ? { ...p, linked_incidents: [...p.linked_incidents, linkIncident.number] }
          : p
      ));
      toast({
        title: "Incident linked",
        description: `${linkIncident.number} linked to ${linkTarget}.`,
      });
    }
    setLinkOpen(false);
    setLinkIncident(null);
    setLinkPattern(null);
  };

  const advanceState = (number: string) => {
    const order: ProblemTicket["state"][] = ["New", "Assess", "Root Cause Analysis", "Fix in Progress", "Resolved", "Closed"];
    setProblems((all) => all.map((p) => {
      if (p.number !== number) return p;
      const idx = order.indexOf(p.state);
      return { ...p, state: order[Math.min(idx + 1, order.length - 1)] };
    }));
  };

  return (
    <div className="space-y-6">
      {/* Use case banner */}
      <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 p-4 flex items-start gap-3">
        <Workflow className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              Auto Problem Creation · Pattern-driven problem records for banking application estates
            </p>
            <Badge variant="outline" className="text-[10px] font-medium border-primary/40 text-primary bg-primary/5">
              Persona · Application Support
            </Badge>
            <Badge variant="outline" className="text-[10px] font-medium border-emerald-300 text-emerald-700 bg-emerald-50">
              Business value · Reduce MTTR &amp; eliminate duplicate effort
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Built for <b>Application Support</b> squads running regulated banking workloads — payments rails,
            core banking ledger, online &amp; mobile channels, cards, trading and AML/sanctions. Correlates
            repeating <b>ServiceNow</b> incidents and <b>Dynatrace</b> alert patterns against the impacted
            <b> CMDB CIs</b> to auto-propose <b>Problem</b> records, link every matching incident and surface
            the likely root cause — so L2/L3 stop re-triaging the same ticket, <b>MTTR drops</b>, and
            duplicate war-rooms are avoided. Aligned to <b>ITIL Problem Management</b> and audit expectations
            under <b>FCA OpRes</b>, <b>DORA</b> and <b>MAS TRM</b>. Click any KPI, pattern row or candidate
            to drill into the underlying incidents and promote to a Problem.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Detected patterns" value={kpis.total_patterns} icon={Repeat} onClick={() => setKpiDrilldown("patterns")} />
        <KpiCard label="Problem candidates" value={kpis.candidate_problems} icon={Sparkles} accent onClick={() => setKpiDrilldown("candidates")} />
        <KpiCard label="Open problems" value={kpis.open_problems} icon={FileWarning} onClick={() => setKpiDrilldown("open")} />
        <KpiCard label="Linked incidents" value={kpis.linked_incidents} icon={Link2} onClick={() => setKpiDrilldown("linked")} />
      </section>

      <ProblemKpiDrilldownDialog
        kind={kpiDrilldown}
        onOpenChange={(v) => !v && setKpiDrilldown(null)}
        patterns={patterns}
        problems={problems}
        incidents={(incidents.data ?? []) as any[]}
      />

      {/* Recurring patterns */}
      <SectionCard
        title="Recurring incident patterns"
        description="Patterns auto-detected across ServiceNow + Dynatrace. Promote a pattern to a Problem ticket and auto-link matching incidents."
      >
        <div className="overflow-x-auto -mx-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">CI</TableHead>
                <TableHead>Category / Signature</TableHead>
                <TableHead className="text-right">Matching incidents</TableHead>
                <TableHead>First → Last seen</TableHead>
                <TableHead>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-help">
                        Status <Info className="h-3 w-3 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs leading-relaxed">
                      <p className="font-semibold mb-1">Status definitions</p>
                      <p><b>Candidate</b> — recurring pattern (≥3 repeats or ≥3 Dynatrace alerts) with no Problem record yet; should be promoted.</p>
                      <p className="mt-1"><b>Monitoring</b> — pattern observed but below the candidate threshold; tracked passively.</p>
                      <p className="mt-1"><b>PRBxxxx · &lt;state&gt;</b> — a Problem ticket already exists for this pattern; shows its current ITIL lifecycle state.</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.map((p) => {
                const existing = problemsForPattern(p.key);
                const isCandidate = p.repeat_count >= 3 || p.dynatrace_count >= 3;
                const isSelected = selectedPatternKey === p.key;
                return (
                  <TableRow
                    key={p.key}
                    className={`border-border/60 cursor-pointer ${isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-secondary/60"}`}
                    onClick={() => setSelectedPatternKey(isSelected ? null : p.key)}
                  >
                    <TableCell className="pl-6 font-mono text-xs">{p.cmdb_ci}</TableCell>
                    <TableCell>
                      <div className="text-sm text-foreground">{p.category}</div>
                      <div className="text-[11px] text-muted-foreground">{p.subcategory || p.signature}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.incident_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.first_seen?.split("T")[0]} → {p.last_seen?.split("T")[0]}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {existing.length > 0 ? (
                              <Badge variant="outline" className={`text-[11px] ${stateColors[existing[0].state]}`}>
                                {existing[0].number} · {existing[0].state}
                              </Badge>
                            ) : isCandidate ? (
                              <Badge variant="outline" className="text-[11px] border-amber-300 bg-amber-100 text-amber-700">
                                <AlertOctagon className="h-3 w-3 mr-1" /> Candidate
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Monitoring</span>
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs leading-relaxed">
                          {existing.length > 0 ? (
                            <>
                              <p className="font-semibold mb-1">Problem ticket exists</p>
                              <p>An ITIL Problem record (<b>{existing[0].number}</b>) is already tracking this pattern, currently in <b>{existing[0].state}</b> state.</p>
                            </>
                          ) : isCandidate ? (
                            <>
                              <p className="font-semibold mb-1">Candidate</p>
                              <p>Recurring pattern crossed the promotion threshold (≥3 repeats or ≥3 Dynatrace alerts). Recommended to promote to a Problem record.</p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold mb-1">Monitoring</p>
                              <p>Pattern observed but below the candidate threshold. Tracked passively — no Problem ticket needed yet.</p>
                            </>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      {existing.length > 0 ? (
                        <Button size="sm" variant="ghost" onClick={() => advanceState(existing[0].number)}>
                          <Workflow className="h-3.5 w-3.5" /> Advance
                        </Button>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant={isCandidate ? "default" : "outline"} onClick={() => openCreateFromPattern(p)}>
                            <Plus className="h-3.5 w-3.5" /> Create Problem
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={openProblems.length === 0 || p.incident_count === 0}
                            onClick={() => openLinkFromPattern(p)}
                          >
                            <Link2 className="h-3.5 w-3.5" /> Link existing
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {/* Relevant incidents for selected pattern */}
      {selectedPatternKey && (() => {
        const p = patterns.find((x) => x.key === selectedPatternKey);
        if (!p) return null;
        const matchingIncidents = ((incidents.data ?? []) as any[]).filter(
          (i) => i.cmdb_ci === p.cmdb_ci && i.category === p.category && (!p.subcategory || i.subcategory === p.subcategory)
        );
        return (
          <SectionCard
            title={`Relevant incidents · ${p.cmdb_ci} · ${p.category}${p.subcategory ? " / " + p.subcategory : ""}`}
            description={`${matchingIncidents.length} incident(s) match this recurring pattern. These will be auto-linked when a Problem ticket is created.`}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelectedPatternKey(null)}>Clear</Button>
                <Button size="sm" onClick={() => openCreateFromPattern(p)}>
                  <Plus className="h-3.5 w-3.5" /> Create Problem
                </Button>
              </div>
            }
          >
            {matchingIncidents.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">No incidents found in the selected window.</div>
            ) : (
              <div className="max-h-[360px] overflow-auto -mx-6 border-t border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Number</TableHead>
                      <TableHead>Short description</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead className="pr-6">Opened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchingIncidents.map((i: any) => (
                      <TableRow key={i.number} className="text-sm">
                        <TableCell className="pl-6 font-mono text-xs text-primary">{i.number}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{i.short_description}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[11px]">{i.priority}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-[11px]">{i.state}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{i.assignment_group}</TableCell>
                        <TableCell className="pr-6 text-xs text-muted-foreground tabular-nums">{i.opened_at?.split("T")[0]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        );
      })()}


      {/* Open problems */}
      <SectionCard
        title="Problem tickets"
        description="Problem records created from recurring patterns. Advance through the ITIL Problem Management lifecycle."
      >
        {problems.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <FileWarning className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No Problem tickets yet. Promote a candidate pattern above to create one.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Number</TableHead>
                  <TableHead>Short description</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Days Open</TableHead>
                  <TableHead className="text-right">Linked incidents</TableHead>
                  <TableHead className="text-right pr-6">Lifecycle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problems.map((p) => {
                  const isExpanded = expandedProblem === p.number;
                  const linkedDetails = ((incidents.data ?? []) as any[]).filter((i) => p.linked_incidents.includes(i.number));
                  return (
                    <Fragment key={p.number}>
                      <TableRow
                        key={p.number}
                        className="border-border/60 cursor-pointer hover:bg-secondary/60"
                        onClick={() => setExpandedProblem(isExpanded ? null : p.number)}
                      >
                        <TableCell className="pl-6 font-mono text-xs">{p.number}</TableCell>
                        <TableCell className="max-w-[360px] truncate text-sm">{p.short_description}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[11px]">{p.priority}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={`text-[11px] ${stateColors[p.state]}`}>{p.state}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.assignment_group}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs font-medium">{daysOpen(p.created_at)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Badge variant="outline" className="font-mono text-[11px]">{p.linked_incidents.length}</Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          {p.state === "Closed" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Done
                            </span>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => advanceState(p.number)}>
                              <Workflow className="h-3.5 w-3.5" /> Advance
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={p.number + "-detail"} className="bg-secondary/30 hover:bg-secondary/30">
                          <TableCell colSpan={8} className="px-6 py-4">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                              <Link2 className="h-3.5 w-3.5" />
                              Linked incidents ({p.linked_incidents.length}) — incidents this Problem ticket was created for
                            </div>
                            {p.linked_incidents.length === 0 ? (
                              <div className="text-xs text-muted-foreground py-2">No incidents linked.</div>
                            ) : (
                              <div className="rounded-md border border-border/60 bg-card overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="pl-4">Number</TableHead>
                                      <TableHead>Short description</TableHead>
                                      <TableHead>Priority</TableHead>
                                      <TableHead>State</TableHead>
                                      <TableHead className="pr-4">Opened</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {linkedDetails.length === 0 ? (
                                      p.linked_incidents.map((num) => (
                                        <TableRow key={num}><TableCell className="pl-4 font-mono text-xs text-primary">{num}</TableCell><TableCell colSpan={4} className="text-xs text-muted-foreground">Details out of current window</TableCell></TableRow>
                                      ))
                                    ) : linkedDetails.map((i: any) => (
                                      <TableRow key={i.number} className="text-sm">
                                        <TableCell className="pl-4 font-mono text-xs text-primary">{i.number}</TableCell>
                                        <TableCell className="max-w-[360px] truncate">{i.short_description}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-[11px]">{i.priority}</Badge></TableCell>
                                        <TableCell><Badge variant="outline" className="text-[11px]">{i.state}</Badge></TableCell>
                                        <TableCell className="pr-4 text-xs text-muted-foreground tabular-nums">{i.opened_at?.split("T")[0]}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Recurring incidents needing linking */}
      <SectionCard
        title="Recurring incidents — link to a Problem"
        description="Incidents matching a known recurring pattern. Link them to an existing Problem ticket for faster root-cause closure."
      >
        {unlinkedRecurring.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            All recurring incidents are linked to a Problem ticket.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Number</TableHead>
                  <TableHead>Short description</TableHead>
                  <TableHead>CI</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlinkedRecurring.map((i: any) => {
                  const suggested = problems.find((p) => p.cmdb_ci === i.cmdb_ci && p.category === i.category);
                  const candidatePattern = patterns.find(
                    (p) => p.cmdb_ci === i.cmdb_ci && p.category === i.category && (!p.subcategory || p.subcategory === i.subcategory)
                  );
                  return (
                    <TableRow key={i.number} className="border-border/60">
                      <TableCell className="pl-6 font-mono text-xs">{i.number}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-sm">{i.short_description}</TableCell>
                      <TableCell className="font-mono text-xs">{i.cmdb_ci}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.category}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[11px]">{i.priority}</Badge></TableCell>
                      <TableCell className="text-right pr-6 space-x-2">
                        {suggested ? (
                          <Button size="sm" variant="outline" onClick={() => openLinkDialog(i)}>
                            <Link2 className="h-3.5 w-3.5" /> Link to {suggested.number}
                          </Button>
                        ) : candidatePattern ? (
                          <Button size="sm" variant="outline" onClick={() => openCreateFromPattern(candidatePattern)}>
                            <Plus className="h-3.5 w-3.5" /> Create Problem
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Create Problem dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Create Problem ticket
            </DialogTitle>
            <DialogDescription>
              Auto-populated from detected pattern. Will be submitted to the ServiceNow Problem Management module and matching incidents will be linked automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Short description</Label>
              <Input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Assignment group</Label>
                <Select value={form.assignment_group} onValueChange={(v) => setForm({ ...form, assignment_group: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea rows={8} className="font-mono text-xs" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {activePattern && (() => {
              const nums: string[] = activePattern.incident_numbers ?? [];
              const details = ((incidents.data ?? []) as any[]).filter((i) => nums.includes(i.number));
              return (
                <div className="rounded-md border border-border/60 bg-secondary/40 p-3 text-xs space-y-2">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    Auto-link preview · {nums.length} incident(s) will be linked
                  </div>
                  {nums.length > 0 && (
                    <div className="max-h-40 overflow-auto rounded border border-border/60 bg-card">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-3 h-8">Number</TableHead>
                            <TableHead className="h-8">Description</TableHead>
                            <TableHead className="h-8 pr-3">Priority</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(details.length > 0 ? details : nums.map((n) => ({ number: n, short_description: "—", priority: "—" }))).map((i: any) => (
                            <TableRow key={i.number} className="text-[11px]">
                              <TableCell className="pl-3 font-mono text-primary py-1">{i.number}</TableCell>
                              <TableCell className="max-w-[280px] truncate py-1">{i.short_description}</TableCell>
                              <TableCell className="pr-3 py-1">{i.priority}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitProblem}>
              <Plus className="h-3.5 w-3.5" /> Submit to ServiceNow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link incident / pattern dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              {linkPattern ? "Link pattern incidents to Problem" : "Link incident to Problem"}
            </DialogTitle>
            <DialogDescription>
              {linkPattern
                ? `Link ${linkPattern.incident_count} matching incident(s) for ${linkPattern.cmdb_ci} · ${linkPattern.category}${linkPattern.subcategory ? " / " + linkPattern.subcategory : ""} to an existing open Problem record.`
                : `Link ${linkIncident?.number} (${linkIncident?.cmdb_ci}) to an existing open Problem record.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">Open Problem ticket</Label>
            {openProblems.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-3">
                No open Problem tickets available. Create one first.
              </div>
            ) : (
              <Select value={linkTarget} onValueChange={setLinkTarget}>
                <SelectTrigger><SelectValue placeholder="Select a Problem" /></SelectTrigger>
                <SelectContent>
                  {openProblems.map((p) => (
                    <SelectItem key={p.number} value={p.number}>
                      {p.number} · {p.state} — {p.short_description.slice(0, 50)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {linkPattern && linkPattern.incident_numbers?.length > 0 && (
              <div className="rounded-md border border-border/60 bg-secondary/40 p-2 max-h-32 overflow-auto text-[11px] font-mono text-muted-foreground">
                {linkPattern.incident_numbers.join(", ")}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={submitLink} disabled={!linkTarget}>
              <Link2 className="h-3.5 w-3.5" /> Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
