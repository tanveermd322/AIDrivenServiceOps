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
  BookOpen,
  Sparkles,
  AlertTriangle,
  Clock,
  Copy,
  TrendingDown,
  Lightbulb,
  Users,
  Wrench,
  CheckCircle2,
  Archive,
  Merge,
  RefreshCw,
} from "lucide-react";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

// ──────────────────────────────────────────────────────────────────────
// KB article catalogue — published ServiceNow Knowledge articles with
// usage telemetry, age, ownership, and similarity signatures used to
// detect duplicates and underutilisation.
// ──────────────────────────────────────────────────────────────────────
type KbStatus = "Published" | "Draft" | "Retired";
type KbCategory = "Network" | "Database" | "Application" | "Authentication" | "Storage" | "Cloud" | "Security";

type KbArticle = {
  id: string;
  title: string;
  category: KbCategory;
  owner: string;
  team: string;
  status: KbStatus;
  publishedAt: string; // ISO date
  lastReviewedAt: string; // ISO date
  ageDays: number;
  daysSinceReview: number;
  views30d: number;
  helpfulRatio: number; // 0..1
  linkedIncidents30d: number;
  similarityKey: string; // articles sharing this key are duplicate candidates
  body: string;
};

// helper to compute days from "today"
const today = new Date("2026-05-29");
const dt = (iso: string) => Math.floor((today.getTime() - new Date(iso).getTime()) / 86400000);

const _raw: Omit<KbArticle, "ageDays" | "daysSinceReview">[] = [
  { id: "KB000812", title: "Reset VPN client on Windows", category: "Network", owner: "n.iyer", team: "Network-Eng", status: "Published",
    publishedAt: "2024-02-11", lastReviewedAt: "2024-08-04", views30d: 1820, helpfulRatio: 0.86, linkedIncidents30d: 42,
    similarityKey: "vpn-reset", body: "Steps to reset the corporate VPN client on Windows endpoints." },
  { id: "KB000815", title: "Resetting Cisco AnyConnect (Windows)", category: "Network", owner: "k.varma", team: "Network-Eng", status: "Published",
    publishedAt: "2023-11-02", lastReviewedAt: "2023-12-12", views30d: 140, helpfulRatio: 0.52, linkedIncidents30d: 3,
    similarityKey: "vpn-reset", body: "How to reset Cisco AnyConnect on Windows laptops." },
  { id: "KB000901", title: "Database connection timeout — Oracle 19c", category: "Database", owner: "a.morales", team: "Database-Admin", status: "Published",
    publishedAt: "2022-06-18", lastReviewedAt: "2023-01-05", views30d: 32, helpfulRatio: 0.41, linkedIncidents30d: 1,
    similarityKey: "db-timeout-oracle", body: "Resolution steps for Oracle 19c TNS timeout errors." },
  { id: "KB000934", title: "Notify backlog drain procedure", category: "Application", owner: "s.patel", team: "App-Support", status: "Published",
    publishedAt: "2024-09-04", lastReviewedAt: "2025-12-01", views30d: 612, helpfulRatio: 0.78, linkedIncidents30d: 14,
    similarityKey: "notify-backlog", body: "Drain procedure for the notification platform queue." },
  { id: "KB001102", title: "DB failover decision tree", category: "Database", owner: "k.varma", team: "Database-Admin", status: "Published",
    publishedAt: "2025-02-22", lastReviewedAt: "2025-09-15", views30d: 980, helpfulRatio: 0.91, linkedIncidents30d: 22,
    similarityKey: "db-failover", body: "Decision tree for promoting replicas during failover." },
  { id: "KB001284", title: "Checkout 5xx triage playbook", category: "Application", owner: "n.iyer", team: "App-Support", status: "Published",
    publishedAt: "2025-08-09", lastReviewedAt: "2026-02-20", views30d: 1240, helpfulRatio: 0.88, linkedIncidents30d: 31,
    similarityKey: "checkout-5xx", body: "Triage steps for checkout-api 5xx surges." },
  { id: "KB000871", title: "Auth TLS rotation rollback", category: "Authentication", owner: "s.patel", team: "Identity", status: "Published",
    publishedAt: "2024-04-30", lastReviewedAt: "2025-05-12", views30d: 420, helpfulRatio: 0.74, linkedIncidents30d: 8,
    similarityKey: "auth-tls-rotation", body: "Rollback procedure for auth-svc TLS rotations." },
  { id: "KB000877", title: "Rolling back TLS certificates on auth-svc", category: "Authentication", owner: "j.adams", team: "Identity", status: "Published",
    publishedAt: "2023-09-19", lastReviewedAt: "2024-01-22", views30d: 70, helpfulRatio: 0.49, linkedIncidents30d: 1,
    similarityKey: "auth-tls-rotation", body: "Manual TLS cert rollback steps for auth-svc." },
  { id: "KB000620", title: "Disk full on NAS storage cluster", category: "Storage", owner: "d.lee", team: "Storage-Ops", status: "Published",
    publishedAt: "2022-01-14", lastReviewedAt: "2022-04-02", views30d: 18, helpfulRatio: 0.33, linkedIncidents30d: 0,
    similarityKey: "nas-disk-full", body: "Clearing space on the NAS storage cluster." },
  { id: "KB000621", title: "NAS storage — disk full troubleshooting", category: "Storage", owner: "r.osei", team: "Storage-Ops", status: "Published",
    publishedAt: "2023-03-09", lastReviewedAt: "2023-10-18", views30d: 24, helpfulRatio: 0.45, linkedIncidents30d: 1,
    similarityKey: "nas-disk-full", body: "Troubleshooting disk space exhaustion on NAS." },
  { id: "KB001410", title: "Kubernetes pod OOMKilled — triage", category: "Cloud", owner: "m.singh", team: "Cloud-SRE", status: "Published",
    publishedAt: "2025-11-11", lastReviewedAt: "2026-03-04", views30d: 1560, helpfulRatio: 0.83, linkedIncidents30d: 28,
    similarityKey: "k8s-oom", body: "Triage for OOMKilled pods in production clusters." },
  { id: "KB001488", title: "Suspicious login alerts — investigation", category: "Security", owner: "l.cheng", team: "Security-Ops", status: "Published",
    publishedAt: "2024-12-03", lastReviewedAt: "2025-08-10", views30d: 305, helpfulRatio: 0.69, linkedIncidents30d: 6,
    similarityKey: "sec-suspicious-login", body: "Investigating suspicious login signals." },
  { id: "KB000540", title: "Legacy AD password reset (Win7)", category: "Authentication", owner: "j.adams", team: "Identity", status: "Published",
    publishedAt: "2020-05-08", lastReviewedAt: "2021-02-14", views30d: 5, helpfulRatio: 0.22, linkedIncidents30d: 0,
    similarityKey: "legacy-ad-reset-win7", body: "AD password reset steps for Windows 7 endpoints." },
  { id: "KB001520", title: "Cache redis eviction storm", category: "Application", owner: "a.morales", team: "App-Support", status: "Published",
    publishedAt: "2026-01-22", lastReviewedAt: "2026-04-02", views30d: 690, helpfulRatio: 0.79, linkedIncidents30d: 11,
    similarityKey: "redis-eviction", body: "Handling redis eviction storms in cache fleet." },
];

const KB_ARTICLES: KbArticle[] = _raw.map((a) => ({
  ...a,
  ageDays: dt(a.publishedAt),
  daysSinceReview: dt(a.lastReviewedAt),
}));

// ──────────────────────────────────────────────────────────────────────
// Optimisation engine — flags each article and drafts a recommendation
// ──────────────────────────────────────────────────────────────────────
type Flag = "Underutilised" | "Duplicate" | "Ageing" | "Low quality";
type Action = "Consolidate" | "Refresh" | "Retire" | "Keep";

type Recommendation = {
  flags: Flag[];
  action: Action;
  confidence: number;
  rationale: string[];
  consolidateWith?: string[];
  suggestedTitle?: string;
  suggestedBody: string;
};

const recommendFor = (a: KbArticle, all: KbArticle[]): Recommendation => {
  const flags: Flag[] = [];
  const rationale: string[] = [];

  const duplicates = all.filter((o) => o.id !== a.id && o.similarityKey === a.similarityKey);
  if (duplicates.length > 0) {
    flags.push("Duplicate");
    rationale.push(`Shares topic signature "${a.similarityKey}" with ${duplicates.length} other article(s).`);
  }
  if (a.views30d < 50) {
    flags.push("Underutilised");
    rationale.push(`Only ${a.views30d} views in last 30 days.`);
  }
  if (a.daysSinceReview > 365) {
    flags.push("Ageing");
    rationale.push(`Not reviewed in ${a.daysSinceReview} days.`);
  }
  if (a.helpfulRatio < 0.5) {
    flags.push("Low quality");
    rationale.push(`Helpful rating ${(a.helpfulRatio * 100).toFixed(0)}% is below threshold.`);
  }

  // Decide action
  let action: Action = "Keep";
  let confidence = 70;

  if (flags.includes("Duplicate")) {
    // The article with the highest views in the cluster is the survivor.
    const cluster = [a, ...duplicates];
    const survivor = cluster.reduce((s, c) => (c.views30d > s.views30d ? c : s));
    if (survivor.id !== a.id) {
      action = "Consolidate";
      confidence = 92;
      rationale.push(`Lower traffic than ${survivor.id} (${survivor.views30d} vs ${a.views30d}) — merge into survivor.`);
    } else {
      action = "Refresh";
      confidence = 80;
      rationale.push(`Survivor of duplicate cluster — refresh and absorb sibling content.`);
    }
  } else if (flags.includes("Underutilised") && flags.includes("Ageing") && a.linkedIncidents30d === 0) {
    action = "Retire";
    confidence = 88;
    rationale.push("No incident links in 30 days + low traffic + stale → retire.");
  } else if (flags.includes("Ageing") || flags.includes("Low quality")) {
    action = "Refresh";
    confidence = 78;
  } else if (flags.length === 0) {
    action = "Keep";
    confidence = 95;
    rationale.push("Healthy article — recent, well-used, high helpful ratio.");
  }

  // Draft body
  const bodyLines = [
    `Topic: ${a.title}`,
    `Category: ${a.category}`,
    `Owner: ${a.owner} (${a.team})`,
    "",
    `Engine action: ${action}.`,
    ...rationale.map((r) => `• ${r}`),
  ];
  if (action === "Consolidate") {
    const cluster = [a, ...duplicates];
    const survivor = cluster.reduce((s, c) => (c.views30d > s.views30d ? c : s));
    bodyLines.push("", `Merge plan:`);
    bodyLines.push(`• Survivor: ${survivor.id} — ${survivor.title}`);
    bodyLines.push(`• Redirect: ${cluster.filter((c) => c.id !== survivor.id).map((c) => c.id).join(", ")}`);
    bodyLines.push(`• Preserve canonical steps from survivor and append unique content from siblings.`);
  } else if (action === "Refresh") {
    bodyLines.push("", `Refresh checklist:`);
    bodyLines.push(`• Validate steps against current platform version.`);
    bodyLines.push(`• Add a 30-day review reminder to ${a.owner}.`);
    bodyLines.push(`• Re-tag the article for current categories.`);
  } else if (action === "Retire") {
    bodyLines.push("", `Retirement plan:`);
    bodyLines.push(`• Move to Retired status; preserve URL with redirect.`);
    bodyLines.push(`• Notify ${a.owner} and remove from recommended lists.`);
  }

  return {
    flags,
    action,
    confidence,
    rationale,
    consolidateWith: duplicates.map((d) => d.id),
    suggestedTitle: action === "Consolidate" || action === "Refresh" ? a.title : undefined,
    suggestedBody: bodyLines.join("\n"),
  };
};

const flagColors: Record<Flag, string> = {
  "Underutilised": "bg-amber-100 text-amber-700 border-amber-300",
  "Duplicate": "bg-orange-100 text-orange-700 border-orange-300",
  "Ageing": "bg-destructive/10 text-destructive border-destructive/30",
  "Low quality": "bg-destructive/10 text-destructive border-destructive/30",
};
const actionColors: Record<Action, string> = {
  "Consolidate": "bg-orange-100 text-orange-700 border-orange-300",
  "Refresh": "bg-amber-100 text-amber-700 border-amber-300",
  "Retire": "bg-secondary text-muted-foreground border-border",
  "Keep": "bg-emerald-100 text-emerald-700 border-emerald-300",
};

type KpiKey = null | "underutilised" | "duplicate" | "ageing" | "lowQuality";

export const KbOptimisationInsightsTab = () => {
  const [kpiDrill, setKpiDrill] = useState<KpiKey>(null);
  const [selected, setSelected] = useState<KbArticle | null>(null);
  const [actionFilter, setActionFilter] = useState<Action | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<KbCategory | null>(null);
  const [accepted, setAccepted] = useState<Record<string, Action>>({});

  const { isInRange } = useTimeRange();
  const { matchesApp } = useAppFocus();
  // Time-bounded KB corpus — articles published or reviewed in the selected window
  const kbInRange = useMemo(
    () =>
      KB_ARTICLES.filter((a) => {
        const inTime = isInRange(a.publishedAt) || isInRange(a.lastReviewedAt);
        if (!inTime) return false;
        const txt = `${a.title ?? ""} ${(a as any).category ?? ""} ${(a as any).application ?? ""}`;
        return matchesApp(txt);
      }),
    [isInRange, matchesApp],
  );

  const enriched = useMemo(
    () => kbInRange.map((a) => ({ article: a, rec: recommendFor(a, kbInRange) })),
    [kbInRange],
  );

  const totals = useMemo(() => {
    const underutilised = enriched.filter((e) => e.rec.flags.includes("Underutilised")).length;
    const duplicate = enriched.filter((e) => e.rec.flags.includes("Duplicate")).length;
    const ageing = enriched.filter((e) => e.rec.flags.includes("Ageing")).length;
    const lowQuality = enriched.filter((e) => e.rec.flags.includes("Low quality")).length;
    return { underutilised, duplicate, ageing, lowQuality };
  }, [enriched]);

  const actionMix = useMemo(() => {
    const out: Record<string, number> = {};
    enriched.forEach((e) => (out[e.rec.action] = (out[e.rec.action] ?? 0) + 1));
    return Object.entries(out).map(([action, count]) => ({ action, count }));
  }, [enriched]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { category: string; articles: number; flagged: number }>();
    enriched.forEach((e) => {
      const ex = map.get(e.article.category);
      const flagged = e.rec.flags.length > 0 ? 1 : 0;
      if (ex) { ex.articles += 1; ex.flagged += flagged; }
      else map.set(e.article.category, { category: e.article.category, articles: 1, flagged });
    });
    return Array.from(map.values()).sort((a, b) => b.flagged - a.flagged);
  }, [enriched]);

  const actionColorFor = (a: string) => {
    if (a === "Keep") return "hsl(142 55% 38%)";
    if (a === "Refresh") return "hsl(38 92% 50%)";
    if (a === "Consolidate") return "hsl(25 95% 53%)";
    return "hsl(215 35% 42%)"; // Retire
  };

  const visible = enriched.filter((e) => {
    if (actionFilter && e.rec.action !== actionFilter) return false;
    if (categoryFilter && e.article.category !== categoryFilter) return false;
    return true;
  });

  const drillTitle: Record<Exclude<KpiKey, null>, string> = {
    underutilised: "Underutilised KB articles (<50 views / 30d)",
    duplicate: "Duplicate KB candidates (shared topic signature)",
    ageing: "Ageing KB articles (not reviewed in >365 days)",
    lowQuality: "Low quality KB articles (helpful rating <50%)",
  };

  const drillRecords = (key: Exclude<KpiKey, null>) =>
    enriched.filter((e) => {
      if (key === "underutilised") return e.rec.flags.includes("Underutilised");
      if (key === "duplicate") return e.rec.flags.includes("Duplicate");
      if (key === "ageing") return e.rec.flags.includes("Ageing");
      return e.rec.flags.includes("Low quality");
    });

  const acceptRecommendation = (id: string, action: Action) => {
    setAccepted((p) => ({ ...p, [id]: action }));
  };

  return (
    <div className="space-y-6">
      {/* Persona / value banner */}
      <SectionCard
        title="KB Optimisation Insights"
        description="For Service Operations — identify underutilised, duplicate and ageing Knowledge Base articles in ServiceNow and apply consolidation or optimisation recommendations."
      >
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Target persona</p>
            <p className="text-muted-foreground mt-1">Service Operations and Knowledge Management leads curating ServiceNow KB.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Business value</p>
            <p className="text-muted-foreground mt-1">Improve KB quality — fewer duplicates, fresher content, higher self-service resolution.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="font-semibold text-foreground flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> How it works</p>
            <p className="text-muted-foreground mt-1">Engine scores usage, age, helpfulness and topic similarity → recommends Consolidate, Refresh, Retire or Keep.</p>
          </div>
        </div>
      </SectionCard>

      {/* Interactive KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Underutilised" value={totals.underutilised} icon={TrendingDown} accent hint="<50 views / 30d" onClick={() => setKpiDrill("underutilised")} />
        <KpiCard label="Duplicate candidates" value={totals.duplicate} icon={Copy} accent hint="shared topic" onClick={() => setKpiDrill("duplicate")} />
        <KpiCard label="Ageing" value={totals.ageing} icon={Clock} hint=">365d since review" onClick={() => setKpiDrill("ageing")} />
        <KpiCard label="Low quality" value={totals.lowQuality} icon={AlertTriangle} hint="helpful <50%" onClick={() => setKpiDrill("lowQuality")} />
      </section>

      {/* Charts */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <SectionCard title="Recommended action mix" description="Click a slice to filter the catalogue">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={actionMix}
                dataKey="count"
                nameKey="action"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                onClick={(d: any) => d?.action && setActionFilter(d.action as Action)}
                className="cursor-pointer"
              >
                {actionMix.map((d, i) => (
                  <Cell key={i} fill={actionColorFor(d.action)} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {actionMix.map((d) => (
              <button
                key={d.action}
                onClick={() => setActionFilter(d.action as Action)}
                className="flex w-full items-center justify-between text-xs hover:bg-secondary/60 rounded px-1 py-0.5"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: actionColorFor(d.action) }} />
                  {d.action}
                </span>
                <span className="tabular-nums text-muted-foreground">{d.count}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Flagged articles by category"
          description="Click a bar to filter the catalogue by category"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCategory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="flagged"
                fill="hsl(var(--chart-2))"
                radius={[6, 6, 0, 0]}
                className="cursor-pointer"
                onClick={(d: any) => d?.category && setCategoryFilter(d.category as KbCategory)}
              />
              <Bar dataKey="articles" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} opacity={0.35} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </section>

      {/* Active filters */}
      {(actionFilter || categoryFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {actionFilter && (
            <Badge variant="outline" className="gap-1">
              Action: {actionFilter}
              <button onClick={() => setActionFilter(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </Badge>
          )}
          {categoryFilter && (
            <Badge variant="outline" className="gap-1">
              Category: {categoryFilter}
              <button onClick={() => setCategoryFilter(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </Badge>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setActionFilter(null); setCategoryFilter(null); }}>Clear</Button>
        </div>
      )}

      {/* Catalogue */}
      <SectionCard title="KB catalogue" description="Click a row to open the optimisation workspace">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="text-right">Views 30d</TableHead>
              <TableHead className="text-right">Helpful</TableHead>
              <TableHead className="text-right">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(({ article, rec }) => {
              const accepted_ = accepted[article.id];
              return (
                <TableRow key={article.id} className="cursor-pointer" onClick={() => setSelected(article)}>
                  <TableCell className="font-mono text-xs">{article.id}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{article.title}</TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCategoryFilter(article.category); }}
                      className="text-xs hover:underline"
                    >
                      {article.category}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {rec.flags.length === 0 ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">Healthy</Badge>
                      ) : (
                        rec.flags.map((f) => (
                          <Badge key={f} variant="outline" className={`text-[10px] ${flagColors[f]}`}>{f}</Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActionFilter(rec.action); }}
                      className="text-left"
                    >
                      <Badge variant="outline" className={`text-[11px] ${actionColors[rec.action]}`}>
                        {accepted_ ? `${accepted_} ✓` : rec.action}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{article.views30d.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{Math.round(article.helpfulRatio * 100)}%</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{article.ageDays}d</TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-6">
                  No articles match the current filters.
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
                <DialogDescription>Click a row to open the optimisation workspace.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Helpful</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillRecords(kpiDrill).map(({ article, rec }) => (
                      <TableRow
                        key={article.id}
                        className="cursor-pointer"
                        onClick={() => { setKpiDrill(null); setSelected(article); }}
                      >
                        <TableCell className="font-mono text-xs">{article.id}</TableCell>
                        <TableCell className="text-xs">{article.title}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-[11px] ${actionColors[rec.action]}`}>{rec.action}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{article.views30d.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{Math.round(article.helpfulRatio * 100)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Article workspace dialog */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selected && (() => {
            const rec = recommendFor(selected, KB_ARTICLES);
            const duplicates = KB_ARTICLES.filter((a) => a.id !== selected.id && a.similarityKey === selected.similarityKey);
            const ActionIcon = rec.action === "Consolidate" ? Merge : rec.action === "Refresh" ? RefreshCw : rec.action === "Retire" ? Archive : CheckCircle2;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" /> {selected.id} — {selected.title}
                  </DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">{selected.category}</Badge>
                    <span className="text-[11px] text-muted-foreground"><Users className="inline h-3 w-3 mr-1" />{selected.owner} ({selected.team})</span>
                    <span className="text-[11px] text-muted-foreground"><Clock className="inline h-3 w-3 mr-1" />Age {selected.ageDays}d · Reviewed {selected.daysSinceReview}d ago</span>
                  </DialogDescription>
                </DialogHeader>

                {/* Recommendation summary */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Engine recommendation
                    <Badge variant="outline" className={`ml-2 text-[11px] ${actionColors[rec.action]}`}>
                      <ActionIcon className="h-3 w-3 mr-1" />{rec.action}
                    </Badge>
                    <Badge variant="outline" className="ml-auto text-[10px]">confidence {rec.confidence}%</Badge>
                  </p>
                  <ul className="text-xs space-y-1">
                    {rec.rationale.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">›</span>
                        <span className="text-muted-foreground">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Telemetry */}
                <div className="grid gap-3 sm:grid-cols-4 text-xs">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">Views 30d</p>
                    <p className="text-lg font-bold tabular-nums">{selected.views30d.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">Helpful ratio</p>
                    <p className="text-lg font-bold tabular-nums">{Math.round(selected.helpfulRatio * 100)}%</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">Linked incidents 30d</p>
                    <p className="text-lg font-bold tabular-nums">{selected.linkedIncidents30d}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-muted-foreground">Days since review</p>
                    <p className="text-lg font-bold tabular-nums">{selected.daysSinceReview}</p>
                  </div>
                </div>

                {/* Duplicate cluster */}
                {duplicates.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <Copy className="h-3.5 w-3.5" /> Duplicate cluster — signature "{selected.similarityKey}"
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="text-right">Views</TableHead>
                          <TableHead className="text-right">Helpful</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {duplicates.map((d) => (
                          <TableRow key={d.id} className="cursor-pointer" onClick={() => setSelected(d)}>
                            <TableCell className="font-mono text-xs">{d.id}</TableCell>
                            <TableCell className="text-xs">{d.title}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{d.views30d.toLocaleString()}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{Math.round(d.helpfulRatio * 100)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Suggested optimised KB */}
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5" /> Optimisation plan
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => navigator.clipboard?.writeText(rec.suggestedBody)}
                      >
                        Copy plan
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => acceptRecommendation(selected.id, rec.action)}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Apply {rec.action}
                      </Button>
                    </div>
                  </div>
                  <Textarea value={rec.suggestedBody} readOnly className="font-mono text-[11px] min-h-[200px]" />
                </div>

                {/* Original body */}
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold mb-1">Current KB body</p>
                  <p className="text-xs text-muted-foreground">{selected.body}</p>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
