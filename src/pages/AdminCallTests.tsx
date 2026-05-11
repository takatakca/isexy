import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";

interface CallRow {
  id: string;
  call_type: string;
  provider: string;
  status: string;
  caller_profile_id: string;
  receiver_profile_id: string | null;
  duration_seconds: number;
  minutes_charged: number;
  end_reason: string | null;
  started_at: string;
  ended_at: string | null;
}

interface MinTxnRow {
  id: string;
  profile_id: string;
  call_session_id: string;
  call_type: string;
  minutes_charged: number;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

export default function AdminCallTests() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [txns, setTxns] = useState<MinTxnRow[]>([]);

  useEffect(() => {
    void check();
  }, []);

  const check = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      navigate("/discover");
      return;
    }
    await fetchAll();
    setLoading(false);
  };

  const fetchAll = async () => {
    setRefreshing(true);
    const [c, t] = await Promise.all([
      supabase
        .from("call_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50),
      supabase
        .from("call_minute_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setCalls((c.data as CallRow[]) ?? []);
    setTxns((t.data as MinTxnRow[]) ?? []);
    setRefreshing(false);
  };

  const flagsForCall = (c: CallRow): string[] => {
    const flags: string[] = [];
    if (c.minutes_charged > 0 && !["completed", "connected"].includes(c.status)) {
      flags.push("charged_without_connect");
    }
    if (c.status === "completed" && !c.ended_at) flags.push("missing_ended_at");
    if (c.status === "failed" && c.minutes_charged > 0) flags.push("failed_with_charges");
    return flags;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Admin
          </Button>
          <h1 className="text-lg font-bold">Call tests</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={refreshing}>
          <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent call sessions ({calls.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {calls.length === 0 && (
              <div className="text-sm text-muted-foreground">No call sessions yet.</div>
            )}
            {calls.map((c) => {
              const flags = flagsForCall(c);
              return (
                <div key={c.id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{c.call_type}</Badge>
                    <Badge variant="secondary">{c.provider}</Badge>
                    <Badge>{c.status}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(c.started_at).toLocaleString()}
                    </span>
                    {flags.map((f) => (
                      <Badge key={f} variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> {f}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>caller: {c.caller_profile_id}</div>
                    <div>receiver: {c.receiver_profile_id ?? "—"}</div>
                    <div>duration: {c.duration_seconds}s</div>
                    <div>charged: {c.minutes_charged} min</div>
                    <div>end_reason: {c.end_reason ?? "—"}</div>
                    <div>ended_at: {c.ended_at ?? "—"}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent minute transactions ({txns.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {txns.length === 0 && (
              <div className="text-sm text-muted-foreground">No minute transactions yet.</div>
            )}
            {txns.map((t) => {
              const negative = t.balance_after < 0;
              return (
                <div key={t.id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t.call_type}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </span>
                    {negative && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> negative_balance
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>profile: {t.profile_id}</div>
                    <div>session: {t.call_session_id}</div>
                    <div>minutes: {t.minutes_charged}</div>
                    <div>
                      balance: {t.balance_before} → {t.balance_after}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
