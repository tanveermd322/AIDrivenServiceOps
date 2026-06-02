// Dynatrace monitoring config generator via Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a Dynatrace monitoring configuration expert specializing in generating Monaco-compatible configurations.

Given a user request describing a monitoring need (SLO, metric, alert, dashboard, management zone, etc.), produce:
1. A Monaco-compatible JSON configuration object for the requested Dynatrace entity.
2. A Monaco YAML deployment config (the config.yaml file Monaco uses to deploy the JSON).
3. The relevant Dynatrace Query Language (DQL) or Metric Selector with the desired threshold.
4. A short human-readable summary.

Rules:
- For SLOs use Dynatrace's SLO API v2 schema (name, description, evaluationType, filter, metricExpression, target, warning, timeframe).
- Use realistic management zones, entity selectors (type(SERVICE)), and metric expressions like (builtin:service.errors.successful.count:splitBy())/(builtin:service.requestCount.total:splitBy())*(100).
- YAML must follow Monaco v2 format: configs: with id, type (settings/api), template path, and parameters.
- DQL example for availability: timeseries availability = avg(dt.service.request.success_rate), by:{dt.entity.service} | filter dt.entity.service.name == "login-service".
- Always include thresholds (target/warning) explicitly.
- Never wrap output in markdown code fences inside the tool arguments; return raw strings.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_dynatrace_config",
              description: "Emit a Dynatrace Monaco configuration bundle.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Plain-language description of what was generated." },
                  config_type: { type: "string", description: "e.g. slo, metric-event, dashboard, management-zone, alerting-profile" },
                  suggested_filename: { type: "string", description: "Base filename without extension, e.g. login-availability-slo" },
                  json_config: { type: "string", description: "Pretty-printed JSON content for the Dynatrace entity." },
                  yaml_config: { type: "string", description: "Monaco v2 YAML deployment config referencing the JSON template." },
                  dql_query: { type: "string", description: "Dynatrace Query Language or metric selector with thresholds." },
                  threshold_notes: { type: "string", description: "Explanation of target/warning thresholds." },
                },
                required: ["summary", "config_type", "suggested_filename", "json_config", "yaml_config", "dql_query", "threshold_notes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_dynatrace_config" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      const status = response.status === 429 || response.status === 402 ? response.status : 500;
      const msg = response.status === 429
        ? "Rate limit exceeded. Try again shortly."
        : response.status === 402
        ? "AI credits exhausted. Add funds in Lovable Cloud workspace settings."
        : `AI gateway error: ${t}`;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No tool call returned", raw: data }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
