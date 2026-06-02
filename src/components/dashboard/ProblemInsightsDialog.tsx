import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchServiceNow } from "@/lib/servicenow";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { Sparkles, FileWarning, ArrowRight, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ProblemTicket } from "./ProblemManagementTab";

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

const stateColors: Record<ProblemTicket["state"], string> = {
  "New": "bg-destructive/10 text-destructive border-destructive/30",
  "Assess": "bg-orange-100 text-orange-700 border-orange-300",
  "Root Cause Analysis": "bg-amber-100 text-amber-700 border-amber-300",
  "Fix in Progress": "bg-sky-100 text-sky-700 border-sky-300",
  "Resolved": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Closed": "bg-secondary text-muted-foreground border-border",
};

function patternKey(ci?: string, category?: string, sub?: string) {
  return `${ci ?? ""}|${category ?? ""}|${sub ?? ""}`;
}

function daysOpen(createdAt: string) {
  const created = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "candidates" | "open";
  problems: ProblemTicket[];
  setProblems: React.Dispatch<React.SetStateAction<ProblemTicket[]>>;
  onGoToProblemTab: () => void;
}

function recommendedPriority(count: number) {
  if (count >= 7) return "1 - Critical";
  if (count >= 5) return "2 - High";
  if (count >= 3) return "3 - Medium";
  return "4 - Low";
}

export const ProblemInsightsDialog = ({ open, onOpenChange, mode, problems, setProblems, onGoToProblemTab }: Props) => {
  const [selectedProblem, setSelectedProblem] = useState<ProblemTicket | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<any | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  const createProblemFromPattern = (p: any) => {
    const existing = problems.find((pr) => pr.pattern_key === p.key);
    if (existing) {
      toast({ title: `Already tracked as ${existing.number}`, description: `State: ${existing.state}` });
      return;
    }
    const number = `PRB${String(10000 + problems.length + 1).padStart(7, "0")}`;
    const linked: string[] = ((incidents.data ?? []) as any[])
      .filter((i) => i.cmdb_ci === p.cmdb_ci && i.category === p.category)
      .map((i) => i.number);
    const ticket: ProblemTicket = {
      number,
      short_description: `Recurring ${p.category}/${p.subcategory || "issue"} on ${p.cmdb_ci}`,
      description: `Auto-generated from recurring incident pattern.\n\nCI: ${p.cmdb_ci}\nCategory: ${p.category}\nSubcategory: ${p.subcategory || "—"}\nRepeat occurrences: ${p.repeat_count}\nDynatrace alerts: ${p.dynatrace_count}\nMatching incidents: ${p.incident_count}`,
      priority: recommendedPriority(Math.max(p.repeat_count, p.dynatrace_count)),
      state: "New",
      assignment_group: "Infra-Ops",
      cmdb_ci: p.cmdb_ci,
      category: p.category,
      pattern_key: p.key,
      linked_incidents: linked,
      created_at: new Date().toISOString(),
    };
    setProblems((all) => [ticket, ...all]);
    toast({
      title: `Problem ${number} created`,
      description: `Submitted to ServiceNow Problem Management · ${linked.length} incident(s) auto-linked.`,
    });
  };

  const repeatPatterns = useQuery({ queryKey: ["sn", "repeat_patterns"], queryFn: () => fetchServiceNow("repeat_patterns") });
  const dynatracePatterns = useQuery({ queryKey: ["sn", "dynatrace_patterns"], queryFn: () => fetchServiceNow("dynatrace_patterns") });
  const incidents = useQuery({ queryKey: ["sn", "incidents"], queryFn: () => fetchServiceNow("incidents") });

  const patterns = useMemo(() => {
    const rep = (repeatPatterns.data ?? []) as any[];
    const dyn = (dynatracePatterns.data ?? []) as any[];
    const map = new Map<string, any>();
    rep.forEach((r) => {
      const sub = r.short_description?.split("—")[1]?.trim() ?? "";
      const key = patternKey(r.cmdb_ci, r.category, sub);
      map.set(key, {
        key, cmdb_ci: r.cmdb_ci, category: r.category, subcategory: sub,
        repeat_count: r.repeat_count ?? 0, dynatrace_count: 0,
        first_seen: r.first_occurrence, last_seen: r.latest_occurrence,
      });
    });
    dyn.forEach((d) => {
      const key = patternKey(d.cmdb_ci, d.category, d.subcategory);
      const ex = map.get(key);
      if (ex) ex.dynatrace_count = d.occurrence_count ?? 0;
      else map.set(key, {
        key, cmdb_ci: d.cmdb_ci, category: d.category, subcategory: d.subcategory,
        repeat_count: 0, dynatrace_count: d.occurrence_count ?? 0,
        first_seen: d.first_seen, last_seen: d.last_seen,
      });
    });
    return Array.from(map.values()).map((p) => {
      const matching = ((incidents.data ?? []) as any[]).filter(
        (i) => i.cmdb_ci === p.cmdb_ci && i.category === p.category
      );
      return { ...p, incident_count: matching.length, incidents: matching };
    });
  }, [repeatPatterns.data, dynatracePatterns.data, incidents.data]);

  const candidatePatterns = patterns
    .filter((p) => p.repeat_count >= 3 || p.dynatrace_count >= 3)
    .sort((a, b) => (b.repeat_count + b.dynatrace_count) - (a.repeat_count + a.dynatrace_count));

  const openProblems = problems.filter((p) => p.state !== "Resolved" && p.state !== "Closed");

  // Chart 1: Per-pattern daily incident line chart (top 7 patterns)
  const patternLinesChart = useMemo(() => {
    const topPatterns = candidatePatterns.slice(0, 7);
    const dateSet = new Set<string>();
    const patternSeries: Record<string, Record<string, number>> = {};

    topPatterns.forEach((p) => {
      const label = `${p.cmdb_ci}`.slice(0, 14);
      patternSeries[label] = {};
      p.incidents.forEach((i: any) => {
        const d = (i.opened_at ?? "").split("T")[0];
        if (!d) return;
        dateSet.add(d);
        patternSeries[label][d] = (patternSeries[label][d] ?? 0) + 1;
      });
    });

    const dates = Array.from(dateSet).sort().slice(-30);
    return dates.map((date) => {
      const row: Record<string, any> = { date: date.slice(5) };
      topPatterns.forEach((p, idx) => {
        const label = `${p.cmdb_ci}`.slice(0, 14);
        row[label] = patternSeries[label][date] ?? 0;
      });
      return row;
    });
  }, [candidatePatterns]);

  const patternLabels = useMemo(() => {
    return candidatePatterns.slice(0, 7).map((p) => `${p.cmdb_ci}`.slice(0, 14));
  }, [candidatePatterns]);

  // Chart 2: Overall incident volume matching recurring patterns
  const trendChart = useMemo(() => {
    const keys = new Set(candidatePatterns.map((p) => `${p.cmdb_ci}|${p.category}`));
    const m = new Map<string, number>();
    ((incidents.data ?? []) as any[]).forEach((i) => {
      const k = `${i.cmdb_ci}|${i.category}`;
      if (!keys.has(k)) return;
      const d = (i.opened_at ?? "").split("T")[0];
      if (!d) return;
      m.set(d, (m.get(d) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([date, count]) => ({ date: date.slice(5), count }));
  }, [incidents.data, candidatePatterns]);

  // Chart 3: Open problems — daily creation trend
  const problemCreationChart = useMemo(() => {
    const m = new Map<string, number>();
    problems.forEach((p) => {
      if (p.state === "Resolved" || p.state === "Closed") return;
      const d = (p.created_at ?? "").split("T")[0];
      if (!d) return;
      m.set(d, (m.get(d) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([date, count]) => ({ date: date.slice(5), count }));
  }, [problems]);

  const title = mode === "candidates" ? "Problem candidates — recurring patterns" : "Open problems — active investigations";
  const Icon = mode === "candidates" ? Sparkles : FileWarning;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>
            {mode === "candidates"
              ? "Recurring incident patterns detected across ServiceNow and Dynatrace. Promote any to a Problem record from the Problem Management tab."
              : "Problem tickets currently in the ITIL lifecycle (New → Closed). Use the Problem Management tab to advance each ticket."}
          </DialogDescription>
        </DialogHeader>

        {/* Charts — all line graphs */}
        <div className="grid gap-4 grid-cols-1">
          {/* Per-pattern daily incident line chart */}
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Daily incident count by top recurring pattern (last 30 days)</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={patternLinesChart} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {patternLabels.map((label, i) => (
                  <Line
                    key={label}
                    type="monotone"
                    dataKey={label}
                    stroke={chartColors[i % chartColors.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Total trend */}
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Total incident volume matching recurring patterns (last 30 days)</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendChart} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Open problems creation trend (only when mode is open) */}
          {mode === "open" && (
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Open problems created over time (last 30 days)</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={problemCreationChart} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detail table */}
        <div className="rounded-lg border border-border/60 bg-card mt-2 overflow-hidden">
          {mode === "candidates" ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">CI</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Repeats</TableHead>
                  <TableHead className="text-right">Dynatrace</TableHead>
                  <TableHead className="text-right">Incidents</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidatePatterns.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No candidate patterns detected.</TableCell></TableRow>
                ) : candidatePatterns.map((p) => {
                  const existing = problems.find((pr) => pr.pattern_key === p.key);
                  return (
                    <TableRow key={p.key} className="border-border/60 cursor-pointer hover:bg-muted/40" onClick={() => setSelectedPattern(p)}>
                      <TableCell className="pl-4 font-mono text-xs">{p.cmdb_ci}</TableCell>
                      <TableCell className="text-sm">{p.category} <span className="text-muted-foreground text-[11px]">{p.subcategory}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{p.repeat_count || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.dynatrace_count || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.incident_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.last_seen?.split("T")[0]}</TableCell>
                      <TableCell className="text-right pr-4">
                        {existing ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {existing.number}
                          </span>
                        ) : (
                          <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); createProblemFromPattern(p); }}>
                            <Plus className="h-3.5 w-3.5" /> Create Problem
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Number</TableHead>
                  <TableHead>Short description</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Days Open</TableHead>
                  <TableHead className="text-right">Linked</TableHead>
                  <TableHead className="text-right pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openProblems.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No open Problem tickets. Promote a candidate from the Problem Management tab.</TableCell></TableRow>
                ) : openProblems.map((p) => (
                  <TableRow
                    key={p.number}
                    className="border-border/60 cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedProblem(p)}
                  >
                    <TableCell className="pl-4 font-mono text-xs text-primary">{p.number}</TableCell>
                    <TableCell className="text-sm max-w-[320px] truncate">{p.short_description}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[11px]">{p.priority}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={`text-[11px] ${stateColors[p.state]}`}>{p.state}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="text-xs font-medium">{daysOpen(p.created_at)}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.linked_incidents.length}</TableCell>
                    <TableCell className="text-right pr-4">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedProblem(p); }}>
                        View <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={() => { onOpenChange(false); onGoToProblemTab(); }}>
            Open Problem Management <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>

      {/* Problem detail sub-dialog */}
      <Dialog open={!!selectedProblem} onOpenChange={(v) => !v && setSelectedProblem(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedProblem && (() => {
            const linkedIncidents = ((incidents.data ?? []) as any[]).filter((i) =>
              selectedProblem.linked_incidents.includes(i.number)
            );
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileWarning className="h-5 w-5 text-primary" />
                    <span className="font-mono">{selectedProblem.number}</span>
                    <Badge variant="outline" className={`text-[11px] ${stateColors[selectedProblem.state]}`}>{selectedProblem.state}</Badge>
                    <Badge variant="outline" className="text-[11px]">{selectedProblem.priority}</Badge>
                  </DialogTitle>
                  <DialogDescription>{selectedProblem.short_description}</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Configuration Item</p>
                    <p className="font-mono text-sm mt-1">{selectedProblem.cmdb_ci}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Category</p>
                    <p className="text-sm mt-1">{selectedProblem.category}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Assignment Group</p>
                    <p className="text-sm mt-1">{selectedProblem.assignment_group}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Created</p>
                    <p className="text-sm mt-1">{new Date(selectedProblem.created_at).toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Days Open</p>
                    <p className="text-sm mt-1 font-medium">{daysOpen(selectedProblem.created_at)} days</p>
                  </div>
                </div>

                <div className="rounded-md border border-border/60 bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <pre className="text-xs whitespace-pre-wrap font-sans">{selectedProblem.description}</pre>
                </div>

                <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                  <div className="px-4 py-2 border-b border-border/60 flex items-center justify-between">
                    <p className="text-xs font-medium">Linked incidents ({selectedProblem.linked_incidents.length})</p>
                  </div>
                  {linkedIncidents.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-4">No linked incidents resolved from ServiceNow.</p>
                  ) : (
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
                        {linkedIncidents.map((i: any) => (
                          <TableRow key={i.number} className="border-border/60 cursor-pointer hover:bg-muted/40" onClick={() => setSelectedIncident(i)}>
                            <TableCell className="pl-4 font-mono text-xs text-primary">{i.number}</TableCell>
                            <TableCell className="text-xs max-w-[280px] truncate">{i.short_description}</TableCell>
                            <TableCell className="text-xs">{i.priority}</TableCell>
                            <TableCell className="text-xs">{i.state}</TableCell>
                            <TableCell className="text-xs text-muted-foreground pr-4">{i.opened_at?.split("T")[0]}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedProblem(null)}>Close</Button>
                  <Button size="sm" onClick={() => { setSelectedProblem(null); onOpenChange(false); onGoToProblemTab(); }}>
                    Manage in Problem Management <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Pattern detail sub-dialog (candidate row click) */}
      <Dialog open={!!selectedPattern} onOpenChange={(v) => !v && setSelectedPattern(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedPattern && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-mono">{selectedPattern.cmdb_ci}</span>
                  <Badge variant="outline" className="text-[11px]">{selectedPattern.category}</Badge>
                  {selectedPattern.subcategory && <Badge variant="outline" className="text-[11px]">{selectedPattern.subcategory}</Badge>}
                </DialogTitle>
                <DialogDescription>Recurring pattern detected from ServiceNow + Dynatrace correlation.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-md border border-border/60 bg-card p-3"><p className="text-muted-foreground">Repeats</p><p className="text-lg font-semibold mt-1 tabular-nums">{selectedPattern.repeat_count}</p></div>
                <div className="rounded-md border border-border/60 bg-card p-3"><p className="text-muted-foreground">Dynatrace</p><p className="text-lg font-semibold mt-1 tabular-nums">{selectedPattern.dynatrace_count}</p></div>
                <div className="rounded-md border border-border/60 bg-card p-3"><p className="text-muted-foreground">Incidents</p><p className="text-lg font-semibold mt-1 tabular-nums">{selectedPattern.incident_count}</p></div>
                <div className="rounded-md border border-border/60 bg-card p-3"><p className="text-muted-foreground">Last seen</p><p className="text-sm mt-1">{selectedPattern.last_seen?.split("T")[0]}</p></div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="px-4 py-2 border-b border-border/60"><p className="text-xs font-medium">Matching incidents ({selectedPattern.incidents?.length ?? 0})</p></div>
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
                    {(selectedPattern.incidents ?? []).map((i: any) => (
                      <TableRow key={i.number} className="border-border/60 cursor-pointer hover:bg-muted/40" onClick={() => setSelectedIncident(i)}>
                        <TableCell className="pl-4 font-mono text-xs text-primary">{i.number}</TableCell>
                        <TableCell className="text-xs max-w-[260px] truncate">{i.short_description}</TableCell>
                        <TableCell className="text-xs">{i.priority}</TableCell>
                        <TableCell className="text-xs">{i.state}</TableCell>
                        <TableCell className="text-xs text-muted-foreground pr-4">{i.opened_at?.split("T")[0]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedPattern(null)}>Close</Button>
                {!problems.find((pr) => pr.pattern_key === selectedPattern.key) && (
                  <Button size="sm" onClick={() => { createProblemFromPattern(selectedPattern); setSelectedPattern(null); }}>
                    <Plus className="h-3.5 w-3.5" /> Create Problem
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Incident detail sub-dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={(v) => !v && setSelectedIncident(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedIncident && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-primary">{selectedIncident.number}</span>
                  <Badge variant="outline" className="text-[11px]">{selectedIncident.priority}</Badge>
                  <Badge variant="outline" className="text-[11px]">{selectedIncident.state}</Badge>
                </DialogTitle>
                <DialogDescription>{selectedIncident.short_description}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ["Configuration Item", selectedIncident.cmdb_ci, true],
                  ["Category", `${selectedIncident.category}${selectedIncident.subcategory ? " · " + selectedIncident.subcategory : ""}`],
                  ["Assignment Group", selectedIncident.assignment_group],
                  ["Assigned to", selectedIncident.assigned_to],
                  ["Source", selectedIncident.source],
                  ["Severity", selectedIncident.severity],
                  ["Impact", selectedIncident.impact],
                  ["Urgency", selectedIncident.urgency],
                  ["Opened", selectedIncident.opened_at ? new Date(selectedIncident.opened_at).toLocaleString() : "—"],
                  ["Resolved", selectedIncident.resolved_at ? new Date(selectedIncident.resolved_at).toLocaleString() : "—"],
                ].map(([label, value, mono]: any) => (
                  <div key={label} className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">{label}</p>
                    <p className={`text-sm mt-1 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIncident(null)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};