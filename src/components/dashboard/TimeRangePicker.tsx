import { useState } from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useTimeRange,
  TIME_RANGE_PRESETS,
  type TimeRangePreset,
} from "@/contexts/TimeRangeContext";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toTimeString(d: Date | null) {
  if (!d) return "00:00";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function combine(date: Date | undefined, time: string): Date | null {
  if (!date) return null;
  const [h, m] = time.split(":").map((x) => parseInt(x, 10) || 0);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function TimeRangePicker() {
  const { preset, from, to, label, setPreset, setCustomRange } = useTimeRange();
  const [open, setOpen] = useState(false);
  const [pendingFromDate, setPendingFromDate] = useState<Date | undefined>(from ?? undefined);
  const [pendingToDate, setPendingToDate] = useState<Date | undefined>(to ?? undefined);
  const [pendingFromTime, setPendingFromTime] = useState<string>(toTimeString(from));
  const [pendingToTime, setPendingToTime] = useState<string>(toTimeString(to));

  const applyCustom = () => {
    const f = combine(pendingFromDate, pendingFromTime);
    const t = combine(pendingToDate, pendingToTime);
    if (f && t) {
      setCustomRange(f, t);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-9 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0 text-xs font-medium gap-1.5"
        >
          <Clock className="h-3.5 w-3.5 opacity-80" />
          <span className="max-w-[220px] truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[640px] p-0 pointer-events-auto">
        <div className="flex">
          {/* Presets */}
          <div className="w-[180px] border-r border-border/60 p-2 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">Quick ranges</p>
            {TIME_RANGE_PRESETS.map((p) => (
              <Button
                key={p.value}
                variant={preset === p.value ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs h-8"
                onClick={() => {
                  setPreset(p.value as Exclude<TimeRangePreset, "custom">);
                  setOpen(false);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Custom range */}
          <div className="flex-1 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Custom range</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] flex items-center gap-1 mb-1">
                  <CalendarIcon className="h-3 w-3" /> From
                </Label>
                <Calendar
                  mode="single"
                  selected={pendingFromDate}
                  onSelect={setPendingFromDate}
                  className={cn("p-2 pointer-events-auto rounded-md border")}
                />
                <div className="mt-2 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <Input
                    type="time"
                    value={pendingFromTime}
                    onChange={(e) => setPendingFromTime(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px] flex items-center gap-1 mb-1">
                  <CalendarIcon className="h-3 w-3" /> To
                </Label>
                <Calendar
                  mode="single"
                  selected={pendingToDate}
                  onSelect={setPendingToDate}
                  className={cn("p-2 pointer-events-auto rounded-md border")}
                />
                <div className="mt-2 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <Input
                    type="time"
                    value={pendingToTime}
                    onChange={(e) => setPendingToTime(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={applyCustom}
                disabled={!pendingFromDate || !pendingToDate}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
