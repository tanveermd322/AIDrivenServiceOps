import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileWarning, Link2, Repeat, Sparkles } from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import type { ProblemTicket } from "./ProblemManagementTab";

const chartColors = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--primary))",
  "hsl(var(--destructive))", "hsl(var(--accent))",
];
const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

export type KpiKind = "patterns" | "candidates" | "open" | "linked";

interface Pattern {
  key: string;
  cmdb_ci: string;
  category: string;
  subcategory?: string;
  repeat_count: number;
  dynatrace_count: number;
  incident_count: number;
  incident_numbers: string[];
  first_seen?: string;
  last_seen?: string;
  signature?: string;
  avg_duration_hours?: number | null;
}

interface Props {
  kind: KpiKind | null;
  onOpenChange: (v: boolean) => void;
  patterns: Pattern[];
  problems: ProblemTicket[];
  incidents: any[];
}

const stateColors: Record<ProblemTicket["state"], string> = {
  "New": "bg-destructive/10 text-destructive border-destructive/30",
  "Assess": "bg-orange-100 text-orange-700 border-orange-300",
  "Root Cause Analysis": "bg-amber-100 text-amber-700 border-amber-300",
  "Fix in Progress": "bg-sky-100 text-sky-700 border-sky-300",
  "Resolved": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Closed": "bg-secondary text-muted-foreground border-border",
};

function daysOpen(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

const meta: Record<KpiKind, { title: string; desc: string; Icon: any }> = {
  patterns:   { title: "Detected patterns — full breakdown", desc: "Every recurring signature detected across ServiceNow + Dynatrace. Click any row to inspect matching incidents.", Icon: Repeat },
  candidates: { title: "Problem candidates — promote to Problem", desc: "Patterns crossing the recurrence threshold without an active Problem ticket. Click to drill down.", Icon: Sparkles },
  open:       { title: "Open Problem tickets", desc: "Problems currently in the ITIL lifecycle. Click any row to view the full ServiceNow record and linked incidents.", Icon: FileWarning },
  linked:     { title: "Linked incidents — problem associations", desc: "All incident → Problem associations currently tracked. Click any row to inspect the incident.", Icon: Link2 },
};

export const ProblemKpiDrilldownDialog = ({ kind, onOpenChange, patterns, problems, incidents }: Props) => {
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<ProblemTicket | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  const linkedRows = useMemo(() => {
    const rows: { incident: any; problem: ProblemTicket }[] = [];
    problems.forEach((p) => {
      p.linked_incidents.forEach((num) => {
        const inc = incidents.find((i) => i.number === num);
        if (inc) rows.push({ incident: inc, problem: p });
      });
    });
    return rows;
  }, [problems, incidents]);

  const candidatePatterns = patterns.filter((p) => p.repeat_count >= 3 || p.dynatrace_count >= 3);
  const openProblems = problems.filter((p) => p.state !== "Resolved" && p.state !== "Closed");

  // Multi-line chart: daily incident count per top pattern (last 30 days) — anomaly spotter
  const patternLinesData = useMemo(() => {
    const top = [...patterns]
      .sort((a, b) => b.incident_count - a.incident_count)
      .slice(0, 7);
    const labels = top.map((p) => `${p.cmdb_ci} · ${p.category}`.slice(0, 24));
    const series: Record<string, Record<string, number>> = {};
    const dateSet = new Set<string>();
    top.forEach((p, idx) => {
      const label = labels[idx];
      series[label] = {};
      incidents
        .filter((i) => p.incident_numbers.includes(i.number))
        .forEach((i) => {
          const d = (i.opened_at ?? "").split("T")[0];
          if (!d) return;
          dateSet.add(d);
          series[label][d] = (series[label][d] ?? 0) + 1;
        });
    });
    const dates = Array.from(dateSet).sort().slice(-30);
    const rows = dates.map((date) => {
      const row: Record<string, any> = { date: date.slice(5) };
      labels.forEach((l) => { row[l] = series[l][date] ?? 0; });
      return row;
    });
    return { rows, labels };
  }, [patterns, incidents]);

  const closeAll = () => {
    setSelectedPattern(null);
    setSelectedProblem(null);
    setSelectedIncident(null);
    onOpenChange(false);
  };

  if (!kind) return null;
  const { title, desc, Icon } = meta[kind];

  return (
    <>
      <Dialog open={!!kind} onOpenChange={(v) => !v && closeAll()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" /> {title}
            </DialogTitle>
            <DialogDescription>{desc}</DialogDescription>
          </DialogHeader>

          {(kind === "patterns" || kind === "candidates") && (
            <>
              {kind === "patterns" && (
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Daily incident volume per top detected pattern (last 30 days) — spikes indicate anomalies
                  </p>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={patternLinesData.rows} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {patternLinesData.labels.map((label, i) => (
                        <Line key={label} type="monotone" dataKey={label}
                          stroke={chartColors[i % chartColors.length]}
                          strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">CI</TableHead>
                    <TableHead>Category / Signature</TableHead>
                    <TableHead className="text-right">Repeats</TableHead>
                    <TableHead className="text-right">Dynatrace</TableHead>
                    <TableHead className="text-right">Incidents</TableHead>
                    <TableHead>First → Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(kind === "patterns" ? patterns : candidatePatterns).map((p) => (
                    <TableRow key={p.key} className="border-border/60 cursor-pointer hover:bg-muted/40" onClick={() => setSelectedPattern(p)}>
                      <TableCell className="pl-4 font-mono text-xs">{p.cmdb_ci}</TableCell>
                      <TableCell>
                        <div className="text-sm">{p.category}</div>
                        <div className="text-[11px] text-muted-foreground">{p.subcategory || p.signature}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.repeat_count || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.dynatrace_count || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.incident_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.first_seen?.split("T")[0]} → {p.last_seen?.split("T")[0]}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}

          {kind === "open" && (
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Number</TableHead>
                    <TableHead>Short description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Days open</TableHead>
                    <TableHead className="text-right pr-4">Linked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openProblems.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No open Problem tickets.</TableCell></TableRow>
                  ) : openProblems.map((p) => (
                    <TableRow key={p.number} className="border-border/60 cursor-pointer hover:bg-muted/40" onClick={() => setSelectedProblem(p)}>
                      <TableCell className="pl-4 font-mono text-xs text-primary">{p.number}</TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{p.short_description}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[11px]">{p.priority}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={`text-[11px] ${stateColors[p.state]}`}>{p.state}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.assignment_group}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-medium">{daysOpen(p.created_at)}</TableCell>
                      <TableCell className="text-right tabular-nums pr-4">{p.linked_incidents.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {kind === "linked" && (
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Incident</TableHead>
                    <TableHead>Short description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Linked to</TableHead>
                    <TableHead className="pr-4">Opened</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No incidents currently linked to a Problem ticket.</TableCell></TableRow>
                  ) : linkedRows.map(({ incident, problem }) => (
                    <TableRow key={`${problem.number}-${incident.number}`} className="border-border/60 cursor-pointer hover:bg-muted/40" onClick={() => setSelectedIncident({ ...incident, _problem: problem })}>
                      <TableCell className="pl-4 font-mono text-xs">{incident.number}</TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{incident.short_description}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[11px]">{incident.priority}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-[11px]">{incident.state}</Badge></TableCell>
                      <TableCell className="font-mono text-xs text-primary">{problem.number}</TableCell>
                      <TableCell className="text-xs text-muted-foreground pr-4">{incident.opened_at?.split("T")[0]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pattern detail sub-dialog */}
      <Dialog open={!!selectedPattern} onOpenChange={(v) => !v && setSelectedPattern(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedPattern && (() => {
            const matching = incidents.filter((i) => selectedPattern.incident_numbers.includes(i.number));
            const linkedProblem = problems.find((p) => p.pattern_key === selectedPattern.key);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Repeat className="h-5 w-5 text-primary" />
                    <span className="font-mono">{selectedPattern.cmdb_ci}</span>
                    <Badge variant="outline" className="text-[11px]">{selectedPattern.category}</Badge>
                    {selectedPattern.subcategory && <Badge variant="outline" className="text-[11px]">{selectedPattern.subcategory}</Badge>}
                  </DialogTitle>
                  <DialogDescription>{selectedPattern.signature || `Recurring pattern on ${selectedPattern.cmdb_ci}`}</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Repeat occurrences</p>
                    <p className="text-lg font-semibold mt-1 tabular-nums">{selectedPattern.repeat_count}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Dynatrace alerts</p>
                    <p className="text-lg font-semibold mt-1 tabular-nums">{selectedPattern.dynatrace_count}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Matching incidents</p>
                    <p className="text-lg font-semibold mt-1 tabular-nums">{selectedPattern.incident_count}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Linked Problem</p>
                    <p className="text-sm font-mono mt-1">{linkedProblem ? linkedProblem.number : "—"}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3 col-span-2">
                    <p className="text-muted-foreground">First seen</p>
                    <p className="text-sm mt-1">{selectedPattern.first_seen ? new Date(selectedPattern.first_seen).toLocaleString() : "—"}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3 col-span-2">
                    <p className="text-muted-foreground">Last seen</p>
                    <p className="text-sm mt-1">{selectedPattern.last_seen ? new Date(selectedPattern.last_seen).toLocaleString() : "—"}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                  <div className="px-4 py-2 border-b border-border/60">
                    <p className="text-xs font-medium">Matching incidents ({matching.length})</p>
                  </div>
                  {matching.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-4">No incidents available.</p>
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
                        {matching.map((i: any) => (
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
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Problem detail sub-dialog */}
      <Dialog open={!!selectedProblem} onOpenChange={(v) => !v && setSelectedProblem(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedProblem && (() => {
            const linkedIncidents = incidents.filter((i) => selectedProblem.linked_incidents.includes(i.number));
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
                    <p className="text-muted-foreground">Days open</p>
                    <p className="text-sm mt-1 font-medium">{daysOpen(selectedProblem.created_at)} days</p>
                  </div>
                </div>

                {selectedProblem.description && (
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <pre className="text-xs whitespace-pre-wrap font-sans">{selectedProblem.description}</pre>
                  </div>
                )}

                <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                  <div className="px-4 py-2 border-b border-border/60">
                    <p className="text-xs font-medium">Linked incidents ({linkedIncidents.length})</p>
                  </div>
                  {linkedIncidents.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-4">No linked incidents.</p>
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
                            <TableCell className="text-xs max-w-[260px] truncate">{i.short_description}</TableCell>
                            <TableCell className="text-xs">{i.priority}</TableCell>
                            <TableCell className="text-xs">{i.state}</TableCell>
                            <TableCell className="text-xs text-muted-foreground pr-4">{i.opened_at?.split("T")[0]}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            );
          })()}
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
                <Field label="Configuration Item" value={selectedIncident.cmdb_ci} mono />
                <Field label="Category" value={`${selectedIncident.category}${selectedIncident.subcategory ? " · " + selectedIncident.subcategory : ""}`} />
                <Field label="Assignment Group" value={selectedIncident.assignment_group} />
                <Field label="Assigned to" value={selectedIncident.assigned_to} />
                <Field label="Source" value={selectedIncident.source} />
                <Field label="Severity" value={selectedIncident.severity} />
                <Field label="Impact" value={selectedIncident.impact} />
                <Field label="Urgency" value={selectedIncident.urgency} />
                <Field label="Opened" value={selectedIncident.opened_at ? new Date(selectedIncident.opened_at).toLocaleString() : "—"} />
                <Field label="Resolved" value={selectedIncident.resolved_at ? new Date(selectedIncident.resolved_at).toLocaleString() : "—"} />
                {selectedIncident._problem && (
                  <div className="col-span-2 rounded-md border border-border/60 bg-card p-3">
                    <p className="text-muted-foreground">Linked Problem</p>
                    <p className="font-mono text-sm mt-1 text-primary">{selectedIncident._problem.number}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedIncident._problem.short_description}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIncident(null)}>Close <ArrowRight className="h-3.5 w-3.5" /></Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const Field = ({ label, value, mono }: { label: string; value?: string; mono?: boolean }) => (
  <div className="rounded-md border border-border/60 bg-card p-3">
    <p className="text-muted-foreground">{label}</p>
    <p className={`text-sm mt-1 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
  </div>
);
