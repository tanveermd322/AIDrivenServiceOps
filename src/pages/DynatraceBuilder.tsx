import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Download, FileJson, FileCode, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ChatMsg = { role: "user" | "assistant"; content: string };

type GeneratedConfig = {
  summary: string;
  config_type: string;
  suggested_filename: string;
  json_config: string;
  yaml_config: string;
  dql_query: string;
  threshold_notes: string;
};

const EXAMPLES = [
  "Create an SLO for my banking app login service availability with 99.9% target and 99.5% warning threshold over the last 7 days.",
  "Create a metric event alert when payment service error rate exceeds 2% for 5 minutes in production management zone.",
  "Build a dashboard tile tracking transaction latency P95 under 300ms for the core-banking-api service.",
];

const download = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function DynatraceBuilder() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<GeneratedConfig | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dynatrace-config", {
        body: { messages: next },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConfig(data as GeneratedConfig);
      setMessages([...next, { role: "assistant", content: data.summary }]);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message ?? String(e), variant: "destructive" });
      setMessages([...next, { role: "assistant", content: `Error: ${e.message ?? e}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Dynatrace Monaco Config Builder</h1>
              <p className="text-xs text-muted-foreground">Generate SLOs, alerts &amp; dashboards from natural language</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid lg:grid-cols-[1fr_1.3fr] gap-6">
        {/* Chat */}
        <Card className="flex flex-col h-[calc(100vh-160px)]">
          <div className="px-4 py-3 border-b border-border/60">
            <h2 className="text-sm font-semibold">Describe your monitoring need</h2>
          </div>
          <ScrollArea className="flex-1 px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Try an example:</p>
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => send(ex)}
                    className="block w-full text-left text-xs p-3 rounded-md border border-border/60 hover:bg-muted/50 transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm p-3 rounded-md ${
                      m.role === "user"
                        ? "bg-primary/15 border border-primary/30 ml-6"
                        : "bg-muted/40 border border-border/60 mr-6"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{m.role}</div>
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating config…
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </ScrollArea>
          <div className="border-t border-border/60 p-3 space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="e.g. Create an SLO for banking login availability at 99.9%…"
              className="min-h-[80px] resize-none"
              disabled={loading}
            />
            <Button onClick={() => send()} disabled={loading || !input.trim()} className="w-full">
              <Send className="h-4 w-4" /> Generate
            </Button>
          </div>
        </Card>

        {/* Output */}
        <Card className="flex flex-col h-[calc(100vh-160px)]">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Generated configuration</h2>
              {config && <Badge variant="secondary">{config.config_type}</Badge>}
            </div>
            {config && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => download(`${config.suggested_filename}.json`, config.json_config, "application/json")}
                >
                  <FileJson className="h-4 w-4" /> JSON
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => download(`${config.suggested_filename}.yaml`, config.yaml_config, "text/yaml")}
                >
                  <FileCode className="h-4 w-4" /> YAML
                </Button>
              </div>
            )}
          </div>
          <ScrollArea className="flex-1">
            {!config ? (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div className="text-sm text-muted-foreground max-w-sm">
                  Your generated Monaco-ready JSON, YAML and DQL will appear here. Deploy via:
                  <code className="block mt-3 text-xs bg-muted/50 p-2 rounded">monaco deploy manifest.yaml</code>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <Section title="Summary">
                  <p className="text-sm text-muted-foreground">{config.summary}</p>
                </Section>
                <Section title="Threshold notes">
                  <p className="text-sm text-muted-foreground">{config.threshold_notes}</p>
                </Section>
                <Section title="Dynatrace Query Language (DQL)" copy={config.dql_query}>
                  <pre className="text-xs bg-muted/40 border border-border/60 rounded p-3 overflow-x-auto">
{config.dql_query}
                  </pre>
                </Section>
                <Section title={`${config.suggested_filename}.json`} copy={config.json_config}>
                  <pre className="text-xs bg-muted/40 border border-border/60 rounded p-3 overflow-x-auto max-h-80">
{config.json_config}
                  </pre>
                </Section>
                <Section title={`${config.suggested_filename}.yaml`} copy={config.yaml_config}>
                  <pre className="text-xs bg-muted/40 border border-border/60 rounded p-3 overflow-x-auto max-h-80">
{config.yaml_config}
                  </pre>
                </Section>
              </div>
            )}
          </ScrollArea>
        </Card>
      </main>
    </div>
  );
}

function Section({ title, children, copy }: { title: string; children: React.ReactNode; copy?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {copy && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => {
              navigator.clipboard.writeText(copy);
              toast({ title: "Copied to clipboard" });
            }}
          >
            <Download className="h-3 w-3" /> Copy
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}
