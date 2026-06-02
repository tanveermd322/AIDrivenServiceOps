import { supabase } from "@/integrations/supabase/client";

export type QueryKey =
  | "kpis"
  | "ingredients"
  | "continents"
  | "sizes"
  | "suppliers"
  | "ingredient_usage";

export async function fetchBakehouse<T = Record<string, any>>(key: QueryKey) {
  const { data, error } = await supabase.functions.invoke("bakehouse-query", {
    body: { key },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.rows ?? []) as T[];
}
