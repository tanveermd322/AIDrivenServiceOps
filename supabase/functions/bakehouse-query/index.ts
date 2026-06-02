const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/databricks";
const WAREHOUSE_ID = "6e25b9174ef4019a";

const QUERIES: Record<string, string> = {
  kpis: `
    SELECT
      (SELECT COUNT(*) FROM samples.bakehouse.sales_suppliers) AS total_suppliers,
      (SELECT COUNT(*) FROM samples.bakehouse.sales_suppliers WHERE approved = 'Y') AS approved_suppliers,
      (SELECT COUNT(DISTINCT ingredient) FROM samples.bakehouse.sales_suppliers) AS unique_ingredients,
      (SELECT COUNT(DISTINCT continent) FROM samples.bakehouse.sales_suppliers) AS continents
  `,
  ingredients: `
    SELECT ingredient, COUNT(*) AS supplier_count
    FROM samples.bakehouse.sales_suppliers
    GROUP BY ingredient
    ORDER BY supplier_count DESC
  `,
  continents: `
    SELECT continent, COUNT(*) AS supplier_count
    FROM samples.bakehouse.sales_suppliers
    GROUP BY continent
    ORDER BY supplier_count DESC
  `,
  sizes: `
    SELECT size, COUNT(*) AS supplier_count
    FROM samples.bakehouse.sales_suppliers
    GROUP BY size
    ORDER BY size
  `,
  suppliers: `
    SELECT supplierID, name, ingredient, continent, city, size, approved
    FROM samples.bakehouse.sales_suppliers
    ORDER BY name
    LIMIT 200
  `,
  ingredient_usage: `
    SELECT s.ingredient, SUM(t.quantity) AS units_used
    FROM samples.bakehouse.sales_transactions t
    JOIN samples.bakehouse.sales_suppliers s
      ON s.ingredient IS NOT NULL
    WHERE LOWER(t.product) LIKE CONCAT('%', LOWER(s.ingredient), '%')
    GROUP BY s.ingredient
    ORDER BY units_used DESC
    LIMIT 10
  `,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { key } = await req.json();
    const statement = QUERIES[key];
    if (!statement) {
      return new Response(JSON.stringify({ error: "Unknown query key" }), {
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
    console.error("bakehouse-query error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
