import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Overview {
  events: Record<string, number>;
  daily: { day: string; sessions: number; users: number; page_views: number }[];
  funnel: { step: string; sessions: number }[];
  top_pages: { path: string; views: number }[];
  sources: { source: string; sessions: number }[];
  web_vitals: Record<string, number>;
  errors: number;
}

const STEP_LABELS: Record<string, string> = {
  visit: "Visited",
  sign_up: "Signed up",
  profile_completed: "Profile done",
  like: "Liked someone",
  match: "Matched",
  message_sent: "Messaged",
  checkout_started: "Started checkout",
};

// Google's Core Web Vitals thresholds (good ≤ first, poor > second).
const VITALS: Record<string, { label: string; unit: string; good: number; poor: number }> = {
  LCP: { label: "Largest Contentful Paint", unit: "ms", good: 2500, poor: 4000 },
  INP: { label: "Interaction to Next Paint", unit: "ms", good: 200, poor: 500 },
  CLS: { label: "Cumulative Layout Shift", unit: "", good: 0.1, poor: 0.25 },
  TTFB: { label: "Time to First Byte", unit: "ms", good: 800, poor: 1800 },
};

const RANGES = [7, 30, 90] as const;

export function ProductAnalyticsPanel() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.rpc("analytics_overview", { p_days: days }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error.message.includes("analytics_overview") || error.code === "PGRST202"
        ? "Product analytics will appear once the 20261007130000 migration is applied."
        : error.message);
      else { setError(null); setData(data as unknown as Overview); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [days]);

  const funnel = useMemo(() => {
    if (!data) return [];
    const top = data.funnel[0]?.sessions || 0;
    return data.funnel.map((f) => ({
      ...f,
      label: STEP_LABELS[f.step] ?? f.step,
      rate: top ? Math.round((f.sessions / top) * 1000) / 10 : 0,
    }));
  }, [data]);

  const totalSessions = data?.daily.reduce((s, d) => s + d.sessions, 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Filters: one row above the charts */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Consented first-party events</p>
        <div role="group" aria-label="Date range" className="inline-flex rounded-full bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${days === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{error}</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Sessions" value={totalSessions} />
            <StatTile label="Sign-ups" value={data.events.sign_up ?? 0} />
            <StatTile label="Matches" value={data.events.match ?? 0} />
            <StatTile label="Client errors" value={data.errors} tone={data.errors > 0 ? "warn" : undefined} />
          </div>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground">Dating funnel</h3>
            <p className="text-xs text-muted-foreground mb-3">Sessions reaching each step · % of visits</p>
            {funnel[0]?.sessions ? (
              <div className="h-[260px]" role="img" aria-label="Funnel of sessions by step">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 64, top: 0, bottom: 0 }} barCategoryGap={8}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={112} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }}
                      formatter={(v: number, _n, item) => [`${v.toLocaleString()} sessions (${item.payload.rate}%)`, item.payload.label]}
                      labelFormatter={() => ""}
                    />
                    <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      <LabelList dataKey="rate" position="right" formatter={(v: number) => `${v}%`} style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No consented visits recorded in this range yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground">Daily sessions</h3>
            <p className="text-xs text-muted-foreground mb-3">Unique sessions per day</p>
            {data.daily.length > 1 ? (
              <div className="h-[200px]" role="img" aria-label="Daily sessions over time">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sessionsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
                    <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }}
                      formatter={(v: number) => [v.toLocaleString(), "Sessions"]}
                    />
                    <Area type="monotone" dataKey="sessions" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#sessionsFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Not enough days of data yet.</p>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <RankedTable title="Top pages" rows={data.top_pages.map((p) => [p.path, p.views])} unit="views" />
            <RankedTable title="Traffic sources" rows={data.sources.map((s) => [s.source, s.sessions])} unit="sessions" />
          </div>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground">Core Web Vitals (p75)</h3>
            <p className="text-xs text-muted-foreground mb-3">Real-user measurements from consented visitors</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(VITALS).map(([key, spec]) => {
                const value = data.web_vitals[key];
                const status = value === undefined ? "none" : value <= spec.good ? "good" : value <= spec.poor ? "warn" : "poor";
                const Icon = status === "good" ? CheckCircle2 : status === "warn" ? AlertTriangle : status === "poor" ? XCircle : null;
                const statusLabel = status === "good" ? "Good" : status === "warn" ? "Needs work" : status === "poor" ? "Poor" : "No data";
                const color = status === "good" ? "text-emerald-500" : status === "warn" ? "text-amber-500" : status === "poor" ? "text-destructive" : "text-muted-foreground";
                return (
                  <div key={key} className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">{key} · {spec.label}</p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {value === undefined ? "—" : `${key === "CLS" ? value.toFixed(2) : Math.round(value).toLocaleString()}${spec.unit}`}
                    </p>
                    <p className={`text-xs font-semibold flex items-center gap-1 mt-0.5 ${color}`}>
                      {Icon && <Icon className="w-3.5 h-3.5" />}{statusLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">{value.toLocaleString()}</p>
      {tone === "warn" && (
        <p className="text-xs font-semibold text-amber-500 flex items-center gap-1 mt-0.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Review in Supabase
        </p>
      )}
    </div>
  );
}

function RankedTable({ title, rows, unit }: { title: string; rows: [string, number][]; unit: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No data yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="sr-only"><tr><th>{title}</th><th>{unit}</th></tr></thead>
          <tbody>
            {rows.map(([name, n]) => (
              <tr key={name} className="border-t border-border first:border-0">
                <td className="py-2 pr-2 text-foreground truncate max-w-[200px]">{name}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{n.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
