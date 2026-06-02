const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/databricks";
const WAREHOUSE_ID = "6e25b9174ef4019a";

const QUERIES: Record<string, string> = {
  // Overview KPIs
  incident_kpis: `
    SELECT
      (SELECT COUNT(*) FROM samples.servicenow.incidents) AS total_incidents,
      (SELECT COUNT(*) FROM samples.servicenow.incidents WHERE state = 'Resolved') AS resolved,
      (SELECT COUNT(*) FROM samples.servicenow.incidents WHERE state = 'Open' OR state = 'In Progress') AS open_incidents,
      (SELECT COUNT(*) FROM samples.servicenow.incidents WHERE priority = '1 - Critical') AS critical_count,
      (SELECT COUNT(*) FROM samples.servicenow.incidents WHERE source = 'Dynatrace') AS dynatrace_alerts,
      (SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, opened_at, resolved_at)), 1) FROM samples.servicenow.incidents WHERE resolved_at IS NOT NULL) AS avg_resolution_hours
  `,

  // Recent incidents list
  incidents: `
    SELECT number, short_description, priority, severity, state, category,
           subcategory, assignment_group, assigned_to, cmdb_ci, source,
           impact, urgency, opened_at, resolved_at, closed_at
    FROM samples.servicenow.incidents
    ORDER BY opened_at DESC
    LIMIT 500
  `,

  // Incidents by priority
  by_priority: `
    SELECT priority, COUNT(*) AS count
    FROM samples.servicenow.incidents
    GROUP BY priority
    ORDER BY priority
  `,

  // Incidents by category
  by_category: `
    SELECT category, COUNT(*) AS count
    FROM samples.servicenow.incidents
    GROUP BY category
    ORDER BY count DESC
    LIMIT 10
  `,

  // Incidents by state
  by_state: `
    SELECT state, COUNT(*) AS count
    FROM samples.servicenow.incidents
    GROUP BY state
    ORDER BY count DESC
  `,

  // Incidents over time (daily)
  trend_daily: `
    SELECT DATE(opened_at) AS date, COUNT(*) AS count,
           SUM(CASE WHEN priority IN ('1 - Critical', '2 - High') THEN 1 ELSE 0 END) AS critical_high
    FROM samples.servicenow.incidents
    WHERE opened_at IS NOT NULL
    GROUP BY DATE(opened_at)
    ORDER BY date DESC
    LIMIT 30
  `,

  // Top affected CIs (Configuration Items)
  top_cis: `
    SELECT cmdb_ci, COUNT(*) AS incident_count,
           SUM(CASE WHEN priority = '1 - Critical' THEN 1 ELSE 0 END) AS critical_count,
           SUM(CASE WHEN source = 'Dynatrace' THEN 1 ELSE 0 END) AS dynatrace_count
    FROM samples.servicenow.incidents
    WHERE cmdb_ci IS NOT NULL
    GROUP BY cmdb_ci
    ORDER BY incident_count DESC
    LIMIT 15
  `,

  // Dynatrace alert patterns
  dynatrace_patterns: `
    SELECT category, subcategory, cmdb_ci, COUNT(*) AS occurrence_count,
           MIN(opened_at) AS first_seen, MAX(opened_at) AS last_seen,
           ROUND(AVG(TIMESTAMPDIFF(HOUR, opened_at, COALESCE(resolved_at, NOW()))), 1) AS avg_duration_hours
    FROM samples.servicenow.incidents
    WHERE source = 'Dynatrace'
    GROUP BY category, subcategory, cmdb_ci
    HAVING COUNT(*) > 1
    ORDER BY occurrence_count DESC
    LIMIT 20
  `,

  // Repeat incidents (same CI + category pattern)
  repeat_patterns: `
    SELECT cmdb_ci, category, short_description, COUNT(*) AS repeat_count,
           MIN(opened_at) AS first_occurrence, MAX(opened_at) AS latest_occurrence
    FROM samples.servicenow.incidents
    WHERE cmdb_ci IS NOT NULL
    GROUP BY cmdb_ci, category, short_description
    HAVING COUNT(*) >= 2
    ORDER BY repeat_count DESC
    LIMIT 20
  `,

  // Assignment group workload
  group_workload: `
    SELECT assignment_group, COUNT(*) AS total,
           SUM(CASE WHEN state IN ('Open', 'In Progress') THEN 1 ELSE 0 END) AS open_count,
           ROUND(AVG(TIMESTAMPDIFF(HOUR, opened_at, COALESCE(resolved_at, NOW()))), 1) AS avg_hours
    FROM samples.servicenow.incidents
    WHERE assignment_group IS NOT NULL
    GROUP BY assignment_group
    ORDER BY total DESC
    LIMIT 10
  `,

  // Root cause candidates: CIs with high repeat + Dynatrace correlation
  root_cause_candidates: `
    SELECT cmdb_ci,
           COUNT(*) AS total_incidents,
           SUM(CASE WHEN source = 'Dynatrace' THEN 1 ELSE 0 END) AS dynatrace_triggered,
           COUNT(DISTINCT category) AS distinct_categories,
           SUM(CASE WHEN priority IN ('1 - Critical', '2 - High') THEN 1 ELSE 0 END) AS high_sev_count,
           MIN(opened_at) AS first_incident,
           MAX(opened_at) AS latest_incident,
           ROUND(AVG(TIMESTAMPDIFF(HOUR, opened_at, COALESCE(resolved_at, NOW()))), 1) AS avg_resolution_hours
    FROM samples.servicenow.incidents
    WHERE cmdb_ci IS NOT NULL
    GROUP BY cmdb_ci
    HAVING COUNT(*) >= 2
    ORDER BY total_incidents DESC, high_sev_count DESC
    LIMIT 20
  `,

  // Incidents by source
  by_source: `
    SELECT source, COUNT(*) AS count
    FROM samples.servicenow.incidents
    GROUP BY source
    ORDER BY count DESC
  `,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { key } = await req.json();
    const statement = QUERIES[key];
    if (!statement) {
      return new Response(JSON.stringify({ error: `Unknown query key: ${key}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const DATABRICKS_API_KEY = Deno.env.get("DATABRICKS_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!DATABRICKS_API_KEY) throw new Error("DATABRICKS_API_KEY not configured");

    const res = await fetch(`${GATEWAY_URL}/2.0/sql/statements`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": DATABRICKS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: WAREHOUSE_ID,
        statement,
        wait_timeout: "30s",
      }),
    });

    const data = await res.json();
    if (!res.ok || data?.status?.state !== "SUCCEEDED") {
      throw new Error(`Databricks query failed [${res.status}]: ${JSON.stringify(data)}`);
    }

    const columns = (data.manifest?.schema?.columns ?? []).map((c: any) => c.name);
    const rows = (data.result?.data_array ?? []).map((row: any[]) => {
      const obj: Record<string, any> = {};
      columns.forEach((c: string, i: number) => {
        const v = row[i];
        const num = Number(v);
        obj[c] = v !== null && v !== "" && !isNaN(num) && /^-?\d+(\.\d+)?$/.test(String(v)) ? num : v;
      });
      return obj;
    });

    return new Response(JSON.stringify({ columns, rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("servicenow-query error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
