import { createContext, useContext, useMemo, useState, ReactNode } from "react";

export type TimeRangePreset = "1h" | "24h" | "7d" | "30d" | "90d" | "custom" | "all";

export const TIME_RANGE_PRESETS: { value: Exclude<TimeRangePreset, "custom">; label: string; ms: number | null }[] = [
  { value: "1h", label: "Last 1 hour", ms: 60 * 60 * 1000 },
  { value: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Last 7 days", ms: 7 * 86400000 },
  { value: "30d", label: "Last 30 days", ms: 30 * 86400000 },
  { value: "90d", label: "Last 90 days", ms: 90 * 86400000 },
  { value: "all", label: "All time", ms: null },
];

// Backwards-compat alias for any older imports
export const TIME_RANGE_OPTIONS = TIME_RANGE_PRESETS.map((p) => ({
  value: p.value,
  label: p.label,
  days: p.ms == null ? null : Math.round(p.ms / 86400000),
}));

type Ctx = {
  preset: TimeRangePreset;
  from: Date | null;
  to: Date | null;
  label: string;
  setPreset: (p: Exclude<TimeRangePreset, "custom">) => void;
  setCustomRange: (from: Date, to: Date) => void;
  isInRange: (iso?: string | null) => boolean;
  // legacy compatibility
  range: TimeRangePreset;
  setRange: (v: TimeRangePreset) => void;
};

const TimeRangeContext = createContext<Ctx | null>(null);

function fmt(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<TimeRangePreset>("30d");
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);

  const value = useMemo<Ctx>(() => {
    let from: Date | null = null;
    let to: Date | null = new Date();
    let label = "Last 30 days";

    if (preset === "custom") {
      from = customFrom;
      to = customTo;
      label = from && to ? `${fmt(from)} → ${fmt(to)}` : "Custom range";
    } else {
      const p = TIME_RANGE_PRESETS.find((x) => x.value === preset);
      if (p) {
        label = p.label;
        from = p.ms == null ? null : new Date(Date.now() - p.ms);
        to = p.ms == null ? null : new Date();
      }
    }

    const isInRange = (iso?: string | null) => {
      if (from == null && to == null) return true;
      if (!iso) return false;
      const t = new Date(iso).getTime();
      if (isNaN(t)) return false;
      if (from && t < from.getTime()) return false;
      if (to && t > to.getTime()) return false;
      return true;
    };

    return {
      preset,
      from,
      to,
      label,
      setPreset: (p) => setPresetState(p),
      setCustomRange: (f, t) => {
        setCustomFrom(f);
        setCustomTo(t);
        setPresetState("custom");
      },
      isInRange,
      range: preset,
      setRange: (v) => setPresetState(v),
    };
  }, [preset, customFrom, customTo]);

  return <TimeRangeContext.Provider value={value}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) throw new Error("useTimeRange must be used within TimeRangeProvider");
  return ctx;
}
