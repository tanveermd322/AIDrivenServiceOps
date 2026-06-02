import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value?: number | string;
  hint?: string;
  icon: LucideIcon;
  loading?: boolean;
  accent?: boolean;
  onClick?: () => void;
  active?: boolean;
}

export const KpiCard = ({ label, value, hint, icon: Icon, loading, accent, onClick, active }: KpiCardProps) => {
  const interactive = !!onClick;
  return (
    <Card
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`relative overflow-hidden p-5 border-border/60 shadow-soft transition-all duration-300 ${
        interactive ? "cursor-pointer hover:shadow-elegant hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""
      } ${active ? "ring-2 ring-primary shadow-elegant" : ""}`}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-brand opacity-80" />
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            {label}
            {interactive && <ArrowUpRight className="h-3 w-3 opacity-60" />}
          </p>
          {loading ? (
            <Skeleton className="h-9 w-24" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {typeof value === "number" ? value.toLocaleString() : value ?? "—"}
            </p>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={`rounded-xl p-2.5 ${
            accent ? "bg-gold/15 text-gold" : "bg-gradient-brand text-primary-foreground"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
      </div>
    </Card>
  );
};
