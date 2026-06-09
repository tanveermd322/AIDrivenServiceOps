import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchServiceNow } from "@/lib/servicenow";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import {
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  Search,
  Download,
  Zap,
  Target,
  TrendingUp,
  Server,
  RefreshCw,
  Shield,
  BarChart3,
  Network,
  X,
  FileWarning,
  Sparkles,
  Repeat,
  Link2,
  ClipboardList,
  Bot,
  ShieldCheck,
  ClipboardCheck,
  Siren,
  BookOpen,
  ShieldAlert,
  Database,
  HardDrive,
  Layers,
} from "lucide-react";
import { NetworkCmdbTab } from "@/components/dashboard/NetworkCmdbTab";
import { ProblemManagementTab, type ProblemTicket } from "@/components/dashboard/ProblemManagementTab";
import { ChangeManagementTab } from "@/components/dashboard/ChangeManagementTab";
import { RftChangeAdvisorTab } from "@/components/dashboard/RftChangeAdvisorTab";
import { AutomationPatternInsightsTab } from "@/components/dashboard/AutomationPatternInsightsTab";
import { CabDashboardInsightsTab } from "@/components/dashboard/CabDashboardInsightsTab";
import { PcrRecommendationTab } from "@/components/dashboard/PcrRecommendationTab";
import { MimRecommendationEngineTab } from "@/components/dashboard/MimRecommendationEngineTab";
import { KbOptimisationInsightsTab } from "@/components/dashboard/KbOptimisationInsightsTab";
import { IncidentQualityInsightsTab } from "@/components/dashboard/IncidentQualityInsightsTab";
import { RootCauseInsights } from "@/components/dashboard/RootCauseInsights";
import { MttdInsightsTab } from "@/components/dashboard/MttdInsightsTab";
import { IncidentDetailDialog } from "@/components/dashboard/IncidentDetailDialog";
import { ProblemInsightsDialog } from "@/components/dashboard/ProblemInsightsDialog";
import { useTimeRange } from "@/contexts/TimeRangeContext";
import { useAppFocus } from "@/contexts/AppFocusContext";
import { TimeRangePicker } from "@/components/dashboard/TimeRangePicker";
import { SectionsSidebar, type SectionItem } from "@/components/dashboard/SectionsSidebar";
import { renderPieValueLabel } from "@/lib/chart-utils";


const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const priorityColors: Record<string, string> = {
  "1 - Critical": "hsl(0 72% 51%)",
  "2 - High": "hsl(25 95% 53%)",
  "3 - Medium": "hsl(38 92% 50%)",
  "4 - Low": "hsl(142 55% 38%)",
};

const stateColors: Record<string, string> = {
  "Open": "hsl(0 72% 51%)",
  "In Progress": "hsl(38 92% 50%)",
  "Resolved": "hsl(142 55% 38%)",
  "Closed": "hsl(215 35% 42%)",
  "Pending": "hsl(25 95% 53%)",
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

const Index = () => {
  const kpis = useQuery({ queryKey: ["sn", "incident_kpis"], queryFn: () => fetchServiceNow("incident_kpis") });
  const incidents = useQuery({ queryKey: ["sn", "incidents"], queryFn: () => fetchServiceNow("incidents") });
  const byPriority = useQuery({ queryKey: ["sn", "by_priority"], queryFn: () => fetchServiceNow("by_priority") });
  const byCategory = useQuery({ queryKey: ["sn", "by_category"], queryFn: () => fetchServiceNow("by_category") });
  const byState = useQuery({ queryKey: ["sn", "by_state"], queryFn: () => fetchServiceNow("by_state") });
  const trendDaily = useQuery({ queryKey: ["sn", "trend_daily"], queryFn: () => fetchServiceNow("trend_daily") });
  const topCis = useQuery({ queryKey: ["sn", "top_cis"], queryFn: () => fetchServiceNow("top_cis") });
  const dynatracePatterns = useQuery({ queryKey: ["sn", "dynatrace_patterns"], queryFn: () => fetchServiceNow("dynatrace_patterns") });
  const repeatPatterns = useQuery({ queryKey: ["sn", "repeat_patterns"], queryFn: () => fetchServiceNow("repeat_patterns") });
  const groupWorkload = useQuery({ queryKey: ["sn", "group_workload"], queryFn: () => fetchServiceNow("group_workload") });
  const rootCause = useQuery({ queryKey: ["sn", "root_cause_candidates"], queryFn: () => fetchServiceNow("root_cause_candidates") });
  const bySource = useQuery({ queryKey: ["sn", "by_source"], queryFn: () => fetchServiceNow("by_source") });

  const { isInRange, label: timeRangeLabel } = useTimeRange();
  const { appId: focusAppId, setAppId: setFocusAppId, options: appOptions, appName: focusAppName, matchesApp } = useAppFocus();

  // Apply selected time range AND focused application to the raw incidents feed — everything downstream derives from this.
  const incidentsInRange = useMemo(() => {
    return (incidents.data ?? []).filter((s: any) => {
      if (!isInRange(s.opened_at)) return false;
      const blob = [s.short_description, s.cmdb_ci, s.category, s.subcategory, s.assignment_group].filter(Boolean).join(" ");
      return matchesApp(blob);
    });
  }, [incidents.data, isInRange, matchesApp]);

  // Recompute KPIs from the time-filtered incidents so the whole app reflects the selected period.
  const k = useMemo(() => {
    const list = incidentsInRange;
    const total = list.length;
    const open = list.filter((s: any) => s.state === "Open" || s.state === "In Progress" || s.state === "Pending").length;
    const resolved = list.filter((s: any) => s.state === "Resolved" || s.state === "Closed").length;
    const critical = list.filter((s: any) => s.priority === "1 - Critical").length;
    const dynatrace = list.filter((s: any) => s.source === "Dynatrace").length;
    const durations = list
      .filter((s: any) => s.opened_at && s.resolved_at)
      .map((s: any) => (new Date(s.resolved_at).getTime() - new Date(s.opened_at).getTime()) / 3_600_000)
      .filter((n: number) => isFinite(n) && n >= 0);
    const avg = durations.length ? +(durations.reduce((a: number, b: number) => a + b, 0) / durations.length).toFixed(1) : 0;
    return {
      total_incidents: total,
      open_incidents: open,
      resolved,
      critical_count: critical,
      dynatrace_alerts: dynatrace,
      avg_resolution_hours: avg,
    };
  }, [incidentsInRange]);


  // Tabs + filters
  const [activeTab, setActiveTab] = useState("network");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [ciFilter, setCiFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [problems, setProblems] = useState<ProblemTicket[]>(() => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    return [
      {
        number: "PRB0010001",
        short_description: "Recurring payment gateway timeouts on checkout-api",
        description: "Repeating timeout pattern observed against payments-gw during peak EU hours. RCA underway.",
        priority: "2 - High",
        state: "Root Cause Analysis",
        assignment_group: "Cloud-SRE",
        cmdb_ci: "checkout-api",
        category: "Application",
        pattern_key: "checkout-api|Application|timeout",
        linked_incidents: [],
        created_at: daysAgo(6),
      },
      {
        number: "PRB0010002",
        short_description: "Customer DB failover latency exceeds SLO",
        description: "Failover validation slow on cust-db cluster; investigating replication lag profile.",
        priority: "1 - Critical",
        state: "Assess",
        assignment_group: "Database-Admin",
        cmdb_ci: "cust-db-primary",
        category: "Database",
        pattern_key: "cust-db-primary|Database|failover",
        linked_incidents: [],
        created_at: daysAgo(3),
      },
      {
        number: "PRB0010003",
        short_description: "Edge firewall packet drops during traffic spikes",
        description: "Sporadic drops correlated with WAF rule evaluation under load.",
        priority: "3 - Medium",
        state: "Fix in Progress",
        assignment_group: "Network-Eng",
        cmdb_ci: "edge-fw-01",
        category: "Network",
        pattern_key: "edge-fw-01|Network|packet-drop",
        linked_incidents: [],
        created_at: daysAgo(10),
      },
      {
        number: "PRB0010004",
        short_description: "Auth service intermittent 401s post TLS rotation",
        description: "Token validation flakiness after scheduled key rotation. Hardening rollout plan in progress.",
        priority: "2 - High",
        state: "New",
        assignment_group: "App-Support",
        cmdb_ci: "auth-svc",
        category: "Application",
        pattern_key: "auth-svc|Application|tls-rotation",
        linked_incidents: [],
        created_at: daysAgo(1),
      },
      {
        number: "PRB0010005",
        short_description: "Notification queue backlog under SMTP throttle",
        description: "Recurring queue backlog when upstream SMTP throttles. Capacity / fallback design pending.",
        priority: "3 - Medium",
        state: "Assess",
        assignment_group: "Platform-Eng",
        cmdb_ci: "notify-worker",
        category: "Application",
        pattern_key: "notify-worker|Application|queue-lag",
        linked_incidents: [],
        created_at: daysAgo(4),
      },
    ];
  });
  const [problemInsights, setProblemInsights] = useState<null | "candidates" | "open">(null);

  const SECTIONS: SectionItem[] = [
    { value: "overview", label: "Overview", icon: BarChart3, category: "Overview" },
    { value: "patterns", label: "Patterns", icon: TrendingUp, category: "Patterns" },
    { value: "network", label: "Network Visualisation", icon: Network, category: "Network Management" },
    { value: "quality", label: "Incident Quality Insights", icon: ShieldAlert, category: "Incident Management" },
    { value: "incidents", label: "Incidents", icon: Activity, category: "Incident Management" },
    { value: "mttd", label: "MTTD Insights (P1/P2)", icon: Clock, category: "Incident Management" },
    { value: "automation", label: "Automation Pattern Insights", icon: Bot, category: "Incident Management" },
    { value: "mim", label: "MIM Recommendation Engine", icon: Siren, category: "Incident Management" },
    { value: "rootcause", label: "Root Cause Insights", icon: Target, category: "Incident Management" },
    { value: "problem", label: "Auto Problem Creation", icon: FileWarning, category: "Problem Management" },
    { value: "change", label: "Change Quality Insights", icon: ClipboardList, category: "Change Management" },
    { value: "rft", label: "RFT Change Advisor", icon: Shield, category: "Change Management" },
    { value: "cab", label: "CAB Dashboard Insights", icon: ShieldCheck, category: "Change Management" },
    { value: "pcr", label: "PCR Recommendation", icon: ClipboardCheck, category: "Change Management" },
    { value: "kb", label: "KB Optimisation Insights", icon: BookOpen, category: "Knowledge Management" },
  ];


  // Problem Management metrics (lifted from tab for top-level KPIs)
  const problemMetrics = useMemo(() => {
    const rep = (repeatPatterns.data ?? []) as any[];
    const dyn = (dynatracePatterns.data ?? []) as any[];
    const map = new Map<string, any>();
    rep.forEach((r) => {
      const key = `${r.cmdb_ci ?? ""}|${r.category ?? ""}`;
      map.set(key, { key, cmdb_ci: r.cmdb_ci, category: r.category, repeat_count: r.repeat_count ?? 0, dynatrace_count: 0 });
    });
    dyn.forEach((d) => {
      const key = `${d.cmdb_ci ?? ""}|${d.category ?? ""}`;
      const ex = map.get(key);
      if (ex) ex.dynatrace_count = d.occurrence_count ?? 0;
      else map.set(key, { key, cmdb_ci: d.cmdb_ci, category: d.category, repeat_count: 0, dynatrace_count: d.occurrence_count ?? 0 });
    });
    const patterns = Array.from(map.values());
    const candidates = patterns.filter((p) => p.repeat_count >= 3 || p.dynatrace_count >= 3);
    const openProblems = problems.filter((p) => p.state !== "Resolved" && p.state !== "Closed").length;
    const linkedIncidents = problems.reduce((s, p) => s + p.linked_incidents.length, 0);
    return {
      totalPatterns: patterns.length,
      candidates: candidates.length,
      openProblems,
      linkedIncidents,
    };
  }, [repeatPatterns.data, dynatracePatterns.data, problems]);

  const trendData = useMemo(
    () => [...(trendDaily.data ?? [])].reverse().filter((d: any) => isInRange(d.date)),
    [trendDaily.data, isInRange]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidentsInRange.filter((s: any) => {
      if (q && !s.short_description?.toLowerCase().includes(q) && !s.number?.toLowerCase().includes(q) && !s.cmdb_ci?.toLowerCase().includes(q) && !s.category?.toLowerCase().includes(q) && !s.assignment_group?.toLowerCase().includes(q)) return false;
      if (priorityFilter !== "all" && s.priority !== priorityFilter) return false;
      if (stateFilter !== "all" && s.state !== stateFilter) return false;
      if (sourceFilter !== "all" && s.source !== sourceFilter) return false;
      if (ciFilter !== "all" && s.cmdb_ci !== ciFilter) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      return true;
    });
  }, [incidentsInRange, search, priorityFilter, stateFilter, sourceFilter, ciFilter, categoryFilter]);


  const clearAllFilters = () => {
    setSearch(""); setPriorityFilter("all"); setStateFilter("all"); setSourceFilter("all"); setCiFilter("all"); setCategoryFilter("all");
  };

  // Drill helpers — jump to Incidents tab with the right filters applied
  const drillTo = (opts: { priority?: string; state?: string; source?: string; ci?: string; category?: string; search?: string; resetOthers?: boolean }) => {
    if (opts.resetOthers) clearAllFilters();
    if (opts.priority !== undefined) setPriorityFilter(opts.priority);
    if (opts.state !== undefined) setStateFilter(opts.state);
    if (opts.source !== undefined) setSourceFilter(opts.source);
    if (opts.ci !== undefined) setCiFilter(opts.ci);
    if (opts.category !== undefined) setCategoryFilter(opts.category);
    if (opts.search !== undefined) setSearch(opts.search);
    setActiveTab("incidents");
  };

  const activeFilterChips: { label: string; clear: () => void }[] = [
    ...(priorityFilter !== "all" ? [{ label: `Priority: ${priorityFilter}`, clear: () => setPriorityFilter("all") }] : []),
    ...(stateFilter !== "all" ? [{ label: `State: ${stateFilter}`, clear: () => setStateFilter("all") }] : []),
    ...(sourceFilter !== "all" ? [{ label: `Source: ${sourceFilter}`, clear: () => setSourceFilter("all") }] : []),
    ...(ciFilter !== "all" ? [{ label: `CI: ${ciFilter}`, clear: () => setCiFilter("all") }] : []),
    ...(categoryFilter !== "all" ? [{ label: `Category: ${categoryFilter}`, clear: () => setCategoryFilter("all") }] : []),
    ...(search ? [{ label: `Search: "${search}"`, clear: () => setSearch("") }] : []),
  ];

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ["number", "short_description", "priority", "state", "category", "assignment_group", "cmdb_ci", "source", "opened_at", "resolved_at"];
    const csv = [headers.join(","), ...filtered.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "incidents.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      "1 - Critical": "bg-destructive/10 text-destructive border-destructive/30",
      "2 - High": "bg-orange-100 text-orange-700 border-orange-300",
      "3 - Medium": "bg-amber-100 text-amber-700 border-amber-300",
      "4 - Low": "bg-emerald-100 text-emerald-700 border-emerald-300",
    };
    return <Badge variant="outline" className={`font-medium text-[11px] ${colors[priority] ?? ""}`}>{priority}</Badge>;
  };

  const getStateBadge = (state: string) => {
    const colors: Record<string, string> = {
      "Open": "bg-destructive/10 text-destructive border-destructive/30",
      "In Progress": "bg-amber-100 text-amber-700 border-amber-300",
      "Resolved": "bg-emerald-100 text-emerald-700 border-emerald-300",
      "Closed": "bg-secondary text-muted-foreground border-border",
      "Pending": "bg-orange-100 text-orange-700 border-orange-300",
    };
    return <Badge variant="outline" className={`font-medium text-[11px] ${colors[state] ?? ""}`}>{state}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-gradient-brand text-primary-foreground shadow-soft">
        <div className="w-full px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center ring-1 ring-primary-foreground/20">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AI Driven Service Management (AISM)</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Select value={focusAppId} onValueChange={setFocusAppId}>
              <SelectTrigger className="h-9 w-[240px] bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0 text-xs font-medium">
                <Network className="h-3.5 w-3.5 mr-1.5 opacity-80" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All enterprise applications</SelectItem>
                {appOptions.map((a) => (
                  <SelectItem key={a.app_id} value={a.app_id}>
                    {a.app_id} · {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TimeRangePicker />
            <Badge variant="secondary" className="font-normal bg-primary-foreground/10 text-primary-foreground border-0">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Live · Databricks
            </Badge>
            <Button size="sm" variant="secondary" className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>

        </div>
      </header>

      <main className="w-full px-4 sm:px-6 py-6">
        <div className="flex gap-6 items-start">
          <SectionsSidebar
            items={SECTIONS}
            active={activeTab}
            onSelect={setActiveTab}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          />

          <div className="flex-1 min-w-0 space-y-6">
            <div className="rounded-lg border border-border/60 bg-card px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Time window:</span>
              <span className="font-semibold text-foreground">{timeRangeLabel}</span>
              {focusAppId !== "all" && (
                <>
                  <span className="mx-2 text-border">|</span>
                  <Network className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">Application:</span>
                  <span className="font-semibold text-foreground">{focusAppName}</span>
                  <button
                    className="ml-auto text-primary hover:underline"
                    onClick={() => setFocusAppId("all")}
                  >
                    Clear app
                  </button>
                </>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">All sections respect this window</span>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">



          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key insights (only here, at the top) */}
            <SectionCard title="Key Insights" description="Click any metric to drill into details">
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
                {[
                  { label: "Total incidents", value: k?.total_incidents, icon: Activity, onClick: () => drillTo({ resetOthers: true }), active: false, accent: false },
                  { label: "Open", value: k?.open_incidents, icon: AlertTriangle, onClick: () => drillTo({ resetOthers: true, state: "Open" }), active: stateFilter === "Open", accent: true },
                  { label: "Resolved", value: k?.resolved, icon: CheckCircle2, onClick: () => drillTo({ resetOthers: true, state: "Resolved" }), active: stateFilter === "Resolved", accent: false },
                  { label: "Critical", value: k?.critical_count, icon: Zap, onClick: () => drillTo({ resetOthers: true, priority: "1 - Critical" }), active: priorityFilter === "1 - Critical", accent: true },
                  { label: "Dynatrace alerts", value: k?.dynatrace_alerts, icon: Target, onClick: () => drillTo({ resetOthers: true, source: "Dynatrace" }), active: sourceFilter === "Dynatrace", accent: false },
                  { label: "Avg resolution (hrs)", value: k?.avg_resolution_hours, icon: Clock, onClick: () => drillTo({ resetOthers: true, state: "Resolved" }), active: false, accent: false },
                  { label: "Problem candidates", value: problemMetrics.candidates, icon: Sparkles, onClick: () => setProblemInsights("candidates"), active: false, accent: true },
                  { label: "Open problems", value: problemMetrics.openProblems, icon: FileWarning, onClick: () => setProblemInsights("open"), active: false, accent: false },
                ].map(({ label, value, icon: Icon, onClick, active, accent }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className={`group flex items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-2 text-left transition-all hover:shadow-elegant hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className={`rounded-md p-1.5 ${accent ? "bg-gold/15 text-gold" : "bg-gradient-brand text-primary-foreground"}`}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
                      <p className="text-base font-bold leading-tight text-foreground">
                        {kpis.isLoading ? "…" : typeof value === "number" ? value.toLocaleString() : value ?? "—"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* Trend */}
            <SectionCard title="Incident trend (last 30 days)" description="Daily incident volume with critical/high severity overlay">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaAll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="areaCrit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" name="All incidents" stroke="hsl(var(--chart-4))" fill="url(#areaAll)" strokeWidth={2} />
                  <Area type="monotone" dataKey="critical_high" name="Critical/High" stroke="hsl(0 72% 51%)" fill="url(#areaCrit)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </SectionCard>

            <section className="grid gap-6 grid-cols-1 lg:grid-cols-3">
              {/* By Priority */}
              <SectionCard title="By priority" description="Incident distribution by priority level">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byPriority.data ?? []} dataKey="count" nameKey="priority" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}
                      label={renderPieValueLabel} labelLine={false}
                      onClick={(d: any) => d?.priority && drillTo({ resetOthers: true, priority: d.priority })}
                      className="cursor-pointer">
                      {(byPriority.data ?? []).map((d: any, i) => (
                        <Cell key={i} fill={priorityColors[d.priority] ?? chartColors[i % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {(byPriority.data ?? []).map((d: any, i) => (
                    <button
                      key={d.priority}
                      onClick={() => drillTo({ resetOthers: true, priority: d.priority })}
                      className="w-full flex items-center justify-between text-xs px-1.5 py-1 rounded hover:bg-secondary transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priorityColors[d.priority] ?? chartColors[i % chartColors.length] }} />
                        <span className="text-foreground">{d.priority}</span>
                      </div>
                      <span className="text-muted-foreground tabular-nums">{d.count}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* By State */}
              <SectionCard title="By state" description="Current incident status breakdown">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byState.data ?? []} dataKey="count" nameKey="state" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}
                      label={renderPieValueLabel} labelLine={false}
                      onClick={(d: any) => d?.state && drillTo({ resetOthers: true, state: d.state })}
                      className="cursor-pointer">
                      {(byState.data ?? []).map((d: any, i) => (
                        <Cell key={i} fill={stateColors[d.state] ?? chartColors[i % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {(byState.data ?? []).map((d: any, i) => (
                    <button
                      key={d.state}
                      onClick={() => drillTo({ resetOthers: true, state: d.state })}
                      className="w-full flex items-center justify-between text-xs px-1.5 py-1 rounded hover:bg-secondary transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stateColors[d.state] ?? chartColors[i % chartColors.length] }} />
                        <span className="text-foreground">{d.state}</span>
                      </div>
                      <span className="text-muted-foreground tabular-nums">{d.count}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* By Source */}
              <SectionCard title="By source" description="Alert origin — Dynatrace vs manual vs others">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bySource.data ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="source" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} className="cursor-pointer"
                      onClick={(d: any) => d?.source && drillTo({ resetOthers: true, source: d.source })} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </section>

            {/* Top categories + group workload */}
            <section className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              <SectionCard title="Top categories" description="Most frequent incident categories">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byCategory.data ?? []} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="category" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 6, 6, 0]} className="cursor-pointer"
                      onClick={(d: any) => d?.category && drillTo({ resetOthers: true, category: d.category })} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="Assignment group workload" description="Team capacity and avg resolution time">
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Group</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                        <TableHead className="text-right">Avg hrs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(groupWorkload.data ?? []).map((g: any) => (
                        <TableRow key={g.assignment_group} className="text-sm cursor-pointer hover:bg-secondary/60" onClick={() => drillTo({ resetOthers: true, search: g.assignment_group })}>
                          <TableCell className="font-medium">{g.assignment_group}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.total}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.open_count}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.avg_hours}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </SectionCard>
            </section>
          </TabsContent>

          {/* ===== INCIDENTS TAB ===== */}
          <TabsContent value="incidents" className="space-y-4">
            <SectionCard
              title="Incident log"
              description={`${filtered.length} of ${(incidents.data ?? []).length} incidents`}
              action={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>}
            >
              <div className="flex flex-col gap-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by number, description, or CI…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="1 - Critical">1 - Critical</SelectItem>
                      <SelectItem value="2 - High">2 - High</SelectItem>
                      <SelectItem value="3 - Medium">3 - Medium</SelectItem>
                      <SelectItem value="4 - Low">4 - Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="State" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All states</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      <SelectItem value="Dynatrace">Dynatrace</SelectItem>
                      <SelectItem value="Manual">Manual</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activeFilterChips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Active filters</span>
                    {activeFilterChips.map((c, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 pr-1 font-normal">
                        {c.label}
                        <button onClick={c.clear} className="hover:bg-background rounded p-0.5" aria-label="Remove filter">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={clearAllFilters}>Clear all</Button>
                  </div>
                )}
              </div>

              <div className="max-h-[500px] overflow-auto -mx-6 border-t border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Number</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>CI</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="pr-6">Opened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">No incidents match your filters.</TableCell>
                      </TableRow>
                    )}
                    {filtered.slice(0, 200).map((s: any) => (
                      <TableRow key={s.number} className="text-sm cursor-pointer hover:bg-secondary/60" onClick={() => setSelectedIncident(s)}>
                        <TableCell className="pl-6 font-mono text-xs font-medium text-primary">{s.number}</TableCell>
                        <TableCell className="max-w-[240px] truncate">{s.short_description}</TableCell>
                        <TableCell>{getPriorityBadge(s.priority)}</TableCell>
                        <TableCell>{getStateBadge(s.state)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{s.category}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); drillTo({ resetOthers: true, ci: s.cmdb_ci }); }}>
                          <span className="hover:text-primary hover:underline">{s.cmdb_ci}</span>
                        </TableCell>
                        <TableCell>
                          {s.source === "Dynatrace" ? (
                            <Badge variant="outline" className="text-[11px] border-chart-4/40 text-chart-4 bg-chart-4/5"><Zap className="h-3 w-3 mr-1" />Dynatrace</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{s.source}</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-xs text-muted-foreground tabular-nums">{s.opened_at?.split("T")[0]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          </TabsContent>

          {/* ===== PATTERNS TAB ===== */}
          <TabsContent value="patterns" className="space-y-6">
            {(() => {
              // Consolidated patterns: merge repeat + Dynatrace patterns by CI + category
              const rep = (repeatPatterns.data ?? []) as any[];
              const dyn = (dynatracePatterns.data ?? []) as any[];
              const map = new Map<string, { cmdb_ci: string; category: string; subcategory: string; occurrences: number; first: string; latest: string; description: string }>();
              rep.forEach((r) => {
                const key = `${r.cmdb_ci}|${r.category}`;
                map.set(key, {
                  cmdb_ci: r.cmdb_ci,
                  category: r.category,
                  subcategory: r.subcategory ?? "—",
                  occurrences: r.repeat_count ?? 0,
                  first: r.first_occurrence,
                  latest: r.latest_occurrence,
                  description: r.short_description ?? "",
                });
              });
              dyn.forEach((d) => {
                const key = `${d.cmdb_ci}|${d.category}`;
                const ex = map.get(key);
                if (ex) {
                  ex.occurrences += d.occurrence_count ?? 0;
                  ex.subcategory = ex.subcategory && ex.subcategory !== "—" ? ex.subcategory : d.subcategory;
                  if (!ex.first || (d.first_seen && d.first_seen < ex.first)) ex.first = d.first_seen;
                  if (!ex.latest || (d.last_seen && d.last_seen > ex.latest)) ex.latest = d.last_seen;
                } else {
                  map.set(key, {
                    cmdb_ci: d.cmdb_ci,
                    category: d.category,
                    subcategory: d.subcategory ?? "—",
                    occurrences: d.occurrence_count ?? 0,
                    first: d.first_seen,
                    latest: d.last_seen,
                    description: d.short_description ?? "",
                  });
                }
              });
              const consolidated = Array.from(map.values()).sort((a, b) => b.occurrences - a.occurrences);

              // Lineage stats — known existing automation patterns (golden paths) = 7
              const EXISTING_AUTOMATIONS = 7;
              const candidates = consolidated.filter((p) => p.occurrences >= 3).length;
              const toCreate = Math.max(0, candidates - EXISTING_AUTOMATIONS);
              const matched = Math.min(candidates, EXISTING_AUTOMATIONS);

              return (
                <>
                  {/* Pictorial lineage */}
                  <SectionCard title="Incident pattern → Automation lineage" description="From observed incident patterns to reusable automation use cases">
                    <div className="flex flex-col lg:flex-row items-stretch gap-3">
                      {[
                        { label: "Incident patterns", value: consolidated.length, hint: "consolidated CI + category", color: "bg-gradient-brand text-primary-foreground", icon: TrendingUp },
                        { label: "Recurring candidates", value: candidates, hint: "≥3 occurrences", color: "bg-amber-100 text-amber-700 border border-amber-300", icon: RefreshCw },
                        { label: "Matched to existing automation", value: matched, hint: `${EXISTING_AUTOMATIONS} golden paths available`, color: "bg-emerald-100 text-emerald-700 border border-emerald-300", icon: Bot },
                        { label: "New automations to create", value: toCreate, hint: "new use cases", color: "bg-destructive/10 text-destructive border border-destructive/30", icon: Sparkles },
                      ].map((tile, i, arr) => (
                        <div key={tile.label} className="flex items-center gap-3 flex-1">
                          <div className={`flex-1 rounded-lg p-4 ${tile.color}`}>
                            <div className="flex items-center gap-2">
                              <tile.icon className="h-4 w-4" />
                              <p className="text-[11px] uppercase tracking-wider font-semibold">{tile.label}</p>
                            </div>
                            <p className="text-3xl font-bold mt-2 tabular-nums">{tile.value}</p>
                            <p className="text-[11px] opacity-80 mt-1">{tile.hint}</p>
                          </div>
                          {i < arr.length - 1 && (
                            <div className="hidden lg:flex items-center text-muted-foreground">
                              <svg width="28" height="20" viewBox="0 0 28 20" fill="none"><path d="M0 10 L22 10 M16 4 L24 10 L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  {/* Consolidated patterns */}
                  <SectionCard title="Consolidated incident patterns" description="All recurring CI + category combinations — single source of truth across modules">
                    <div className="max-h-[400px] overflow-auto -mx-6 border-t border-border/60">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-6">Configuration Item</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Subcategory</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Occurrences</TableHead>
                            <TableHead>First</TableHead>
                            <TableHead className="pr-6">Latest</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consolidated.map((d, i) => (
                            <TableRow key={i} className="text-sm cursor-pointer hover:bg-secondary/60" onClick={() => drillTo({ resetOthers: true, ci: d.cmdb_ci, category: d.category })}>
                              <TableCell className="pl-6 font-mono text-xs font-medium">{d.cmdb_ci}</TableCell>
                              <TableCell className="text-muted-foreground">{d.category}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{d.subcategory}</TableCell>
                              <TableCell className="max-w-[240px] truncate text-muted-foreground">{d.description}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={d.occurrences >= 4 ? "destructive" : "secondary"} className="font-mono">
                                  <RefreshCw className="h-3 w-3 mr-1" />{d.occurrences}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{d.first?.split("T")[0]}</TableCell>
                              <TableCell className="pr-6 text-xs text-muted-foreground">{d.latest?.split("T")[0]}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </SectionCard>

                  {/* Top CIs */}
                  <SectionCard title="Most affected infrastructure" description="Configuration items with highest incident concentration">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topCis.data ?? []} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis dataKey="cmdb_ci" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} width={140} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="incident_count" name="Total" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} className="cursor-pointer"
                          onClick={(d: any) => d?.cmdb_ci && drillTo({ resetOthers: true, ci: d.cmdb_ci })} />
                        <Bar dataKey="critical_count" name="Critical" fill="hsl(0 72% 51%)" radius={[0, 4, 4, 0]} className="cursor-pointer"
                          onClick={(d: any) => d?.cmdb_ci && drillTo({ resetOthers: true, ci: d.cmdb_ci, priority: "1 - Critical" })} />
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                </>
              );
            })()}
          </TabsContent>


          {/* ===== ROOT CAUSE INSIGHTS TAB ===== */}
          <TabsContent value="rootcause" className="space-y-6">
            <RootCauseInsights
              rootCause={(rootCause.data ?? []) as any[]}
              drillTo={drillTo}
            />
          </TabsContent>


          {/* ===== NETWORK × CMDB TAB ===== */}
          <TabsContent value="network" className="space-y-6">
            <NetworkCmdbTab />
          </TabsContent>

          {/* ===== PROBLEM MANAGEMENT TAB ===== */}
          <TabsContent value="problem" className="space-y-6">
            <ProblemManagementTab problems={problems} setProblems={setProblems} />
          </TabsContent>

          {/* ===== CHANGE MANAGEMENT TAB ===== */}
          <TabsContent value="change" className="space-y-6">
            <ChangeManagementTab />
          </TabsContent>

          {/* ===== RFT CHANGE ADVISOR TAB ===== */}
          <TabsContent value="rft" className="space-y-6">
            <RftChangeAdvisorTab />
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            <AutomationPatternInsightsTab />
          </TabsContent>

          <TabsContent value="cab" className="space-y-6">
            <CabDashboardInsightsTab />
          </TabsContent>

          <TabsContent value="pcr" className="space-y-6">
            <PcrRecommendationTab />
          </TabsContent>

          <TabsContent value="mim" className="space-y-6">
            <MimRecommendationEngineTab />
          </TabsContent>

          <TabsContent value="kb" className="space-y-6">
            <KbOptimisationInsightsTab />
          </TabsContent>

          <TabsContent value="mttd" className="space-y-6">
            <MttdInsightsTab />
          </TabsContent>

          <TabsContent value="quality" className="space-y-6">
            <IncidentQualityInsightsTab />
          </TabsContent>
            </Tabs>
          </div>
        </div>

        <footer className="pt-2 pb-8 flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="h-3.5 w-3.5" />
          Data source: <code className="bg-secondary px-1.5 py-0.5 rounded">samples.servicenow</code> via Databricks
        </footer>
      </main>

      <IncidentDetailDialog
        incident={selectedIncident}
        onOpenChange={(o) => { if (!o) setSelectedIncident(null); }}
        onDrillCi={(ci) => { setSelectedIncident(null); drillTo({ resetOthers: true, ci }); }}
      />

      <ProblemInsightsDialog
        open={problemInsights !== null}
        onOpenChange={(o) => { if (!o) setProblemInsights(null); }}
        mode={problemInsights ?? "candidates"}
        problems={problems}
        setProblems={setProblems}
        onGoToProblemTab={() => setActiveTab("problem")}
      />
    </div>
  );
};

export default Index;
