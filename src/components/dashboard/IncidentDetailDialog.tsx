import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Clock, Server, Tag, Users, Zap } from "lucide-react";

interface IncidentDetailDialogProps {
  incident: any | null;
  onOpenChange: (open: boolean) => void;
  onDrillCi?: (ci: string) => void;
}

const fmt = (s?: string) => (s ? new Date(s).toLocaleString() : "—");

export const IncidentDetailDialog = ({ incident, onOpenChange, onDrillCi }: IncidentDetailDialogProps) => {
  const open = !!incident;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {incident && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{incident.number}</span>
                <Badge variant="outline" className="text-[11px]">{incident.priority}</Badge>
                <Badge variant="outline" className="text-[11px]">{incident.state}</Badge>
                {incident.source === "Dynatrace" && (
                  <Badge variant="outline" className="text-[11px] border-chart-4/40 text-chart-4 bg-chart-4/5">
                    <Zap className="h-3 w-3 mr-1" /> Dynatrace
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-base pt-2">{incident.short_description}</DialogTitle>
              <DialogDescription className="text-xs">
                Opened {fmt(incident.opened_at)} {incident.resolved_at && `· Resolved ${fmt(incident.resolved_at)}`}
              </DialogDescription>
            </DialogHeader>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field icon={Tag} label="Category">{incident.category}{incident.subcategory ? ` › ${incident.subcategory}` : ""}</Field>
              <Field icon={Users} label="Assignment group">{incident.assignment_group ?? "—"}</Field>
              <Field icon={Server} label="Configuration item">
                <button
                  className="font-mono text-xs text-primary hover:underline"
                  onClick={() => incident.cmdb_ci && onDrillCi?.(incident.cmdb_ci)}
                >
                  {incident.cmdb_ci ?? "—"}
                </button>
              </Field>
              <Field icon={Clock} label="Impact / Urgency">{incident.impact ?? "—"} / {incident.urgency ?? "—"}</Field>
              <Field icon={Users} label="Assigned to">{incident.assigned_to ?? "Unassigned"}</Field>
              <Field icon={Zap} label="Source">{incident.source}</Field>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              {incident.cmdb_ci && (
                <Button variant="outline" size="sm" onClick={() => { onDrillCi?.(incident.cmdb_ci); onOpenChange(false); }}>
                  <ExternalLink className="h-3.5 w-3.5" /> See all on this CI
                </Button>
              )}
              <Button variant="default" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ icon: Icon, label, children }: any) => (
  <div className="space-y-0.5">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
      <Icon className="h-3 w-3" /> {label}
    </p>
    <div className="text-sm text-foreground">{children}</div>
  </div>
);
