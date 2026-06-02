import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from "react";
import { ENTERPRISE_APPS } from "@/lib/network";

// Keyword map per enterprise application — used for fuzzy matching of tab
// records that reference apps by free-text name (e.g. "Payments API",
// "Billing Engine") rather than by APP-xxx id.
const APP_KEYWORDS: Record<string, string[]> = {
  "APP-001": ["payment", "swift", "sepa", "faster payments", "pay-gw", "pay "],
  "APP-002": ["mobile", "retail", "online banking", "portal", "customer portal"],
  "APP-003": ["core banking", "ledger", "billing", "order", "oms", "crm"],
  "APP-004": ["identity", "auth", "sso", "idp", "tls"],
  "APP-005": ["warehouse", "dwh", "data", "etl", "risk", "regulatory", "reporting", "analytics"],
  "APP-006": ["trading", "fix", "order management", "markets"],
  "APP-007": ["marketing", "public", "rates site", "search"],
  "APP-008": ["aml", "sanctions", "fraud", "screening"],
};

type Ctx = {
  appId: string; // "all" or app_id
  setAppId: (id: string) => void;
  appName: string; // human-friendly
  options: { app_id: string; name: string }[];
  /** Returns true if a free-text application name should be included
   *  given the current focus. When focus is "all", returns true. */
  matchesApp: (candidate?: string | null) => boolean;
  /** Returns true for records carrying an APP-xxx id. */
  matchesAppById: (candidate?: string | null) => boolean;
};

const AppFocusContext = createContext<Ctx | null>(null);

export function AppFocusProvider({ children }: { children: ReactNode }) {
  const [appId, setAppId] = useState<string>("all");

  const matchesApp = useCallback(
    (candidate?: string | null) => {
      if (appId === "all") return true;
      if (!candidate) return false;
      const c = candidate.toLowerCase();
      const focused = ENTERPRISE_APPS.find((a) => a.app_id === appId);
      const kws = [
        ...(APP_KEYWORDS[appId] ?? []),
        ...(focused ? focused.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3) : []),
      ];
      return kws.some((k) => c.includes(k));
    },
    [appId],
  );

  const matchesAppById = useCallback(
    (candidate?: string | null) => {
      if (appId === "all") return true;
      if (!candidate) return false;
      return candidate === appId;
    },
    [appId],
  );

  const value = useMemo<Ctx>(() => {
    const match = ENTERPRISE_APPS.find((a) => a.app_id === appId);
    return {
      appId,
      setAppId,
      appName: appId === "all" ? "All applications" : match ? `${match.app_id} · ${match.name}` : appId,
      options: ENTERPRISE_APPS.map((a) => ({ app_id: a.app_id, name: a.name })),
      matchesApp,
      matchesAppById,
    };
  }, [appId, matchesApp, matchesAppById]);

  return <AppFocusContext.Provider value={value}>{children}</AppFocusContext.Provider>;
}

export function useAppFocus() {
  const ctx = useContext(AppFocusContext);
  if (!ctx) throw new Error("useAppFocus must be used within AppFocusProvider");
  return ctx;
}
