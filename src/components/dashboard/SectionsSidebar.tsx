import { LucideIcon, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SectionItem {
  value: string;
  label: string;
  icon: LucideIcon;
}

interface Props {
  items: SectionItem[];
  active: string;
  onSelect: (v: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function SectionsSidebar({ items, active, onSelect, collapsed, onToggleCollapsed }: Props) {
  return (
    <aside
      className={cn(
        "shrink-0 sticky top-4 self-start rounded-lg border border-border/60 bg-card shadow-soft transition-all",
        collapsed ? "w-14" : "w-64",
      )}
    >
      <div className="flex items-center justify-between p-2 border-b border-border/60">
        {!collapsed && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pl-2">
            Sections
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 ml-auto"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sections" : "Collapse sections"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="p-2 space-y-1 max-h-[calc(100vh-8rem)] overflow-auto">
        {items.map(({ value, label, icon: Icon }) => {
          const isActive = active === value;
          return (
            <button
              key={value}
              type="button"
              title={collapsed ? label : undefined}
              onClick={() => onSelect(value)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-all border border-transparent",
                "hover:bg-secondary/70",
                isActive
                  ? "bg-gradient-brand text-primary-foreground border-primary shadow-elegant"
                  : "text-foreground",
              )}
            >
              <div
                className={cn(
                  "rounded-md p-1.5 shrink-0",
                  isActive ? "bg-primary-foreground/15" : "bg-gradient-brand text-primary-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              {!collapsed && (
                <span className="text-[12px] font-semibold leading-tight truncate">{label}</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
