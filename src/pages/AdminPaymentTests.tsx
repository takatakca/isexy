import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

interface WebhookEvent {
  id: string;
  created_at: string;
  event_type: string;
  processing_status: string;
  error_message: string | null;
  stripe_session_id: string | null;
  processed_at: string | null;
}

interface FulfillmentCounts {
  credits: number;
  boosts: number;
  superLikes: number;
  gifts: number;
  donations: number;
  subscriptions: number;
  phoneMinutes: number;
  videoMinutes: number;
  chatSubs: number;
}

interface SubscriptionRow {
  profile_id: string;
  tier: string;
  status: string;
  current_period_end: string | null;
}

const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: "subscription", label: "Plus/Gold/Platinum subscription fulfilled" },
  { key: "credits", label: "Credit pack fulfilled" },
  { key: "superLikes", label: "Super-like pack fulfilled" },
  { key: "boosts", label: "Boost pack fulfilled" },
  { key: "gifts", label: "Gift completed" },
  { key: "donations", label: "Donation completed" },
  { key: "phoneMinutes", label: "Phone minutes purchased" },
  { key: "videoMinutes", label: "Video minutes purchased" },
  { key: "chatSubs", label: "Chat subscription purchased" },
  { key: "duplicate", label: "Duplicate webhook resend handled" },
];

export default function AdminPaymentTests() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [counts, setCounts] = useState<FulfillmentCounts>({ credits: 0, boosts: 0, superLikes: 0, gifts: 0, donations: 0, subscriptions: 0, phoneMinutes: 0, videoMinutes: 0, chatSubs: 0 });
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [gate, setGate] = useState<{ liveEnabled: boolean; mode: string; blocked: boolean } | null>(null);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) { navigate("/discover"); return; }
    await fetchAll();
    setLoading(false);
  };

  const fetchAll = async () => {
    setRefreshing(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Webhook fulfillment is signaled by stripe_session_id NOT NULL on each row.
    // boost_transactions.action from webhook is "credit" (not "purchase").
    // boost_transactions.boost_type values: "super_like" | "boost" | "primetime_boost" | "super_boost".
    const [evRes, credRes, slRes, boostRes, giftRes, donRes, subRes, paidSubsRes, phoneRes, videoRes, chatSubRes] = await Promise.all([
      supabase.from("stripe_webhook_events" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("credit_transactions").select("id", { count: "exact", head: true })
        .gte("created_at", since).eq("type", "purchase").eq("category", "general").not("stripe_session_id", "is", null),
      supabase.from("boost_transactions").select("id", { count: "exact", head: true })
        .gte("created_at", since).eq("boost_type", "super_like").not("stripe_session_id", "is", null),
      supabase.from("boost_transactions").select("id", { count: "exact", head: true })
        .gte("created_at", since).in("boost_type", ["boost", "primetime_boost", "super_boost"]).not("stripe_session_id", "is", null),
      supabase.from("gift_transactions").select("id", { count: "exact", head: true })
        .gte("created_at", since).eq("status", "completed").not("stripe_session_id", "is", null),
      supabase.from("donations").select("id", { count: "exact", head: true })
        .gte("created_at", since).eq("status", "completed").not("stripe_session_id", "is", null),
      supabase.from("subscriptions").select("profile_id, tier, status, current_period_end")
        .neq("tier", "free").order("updated_at", { ascending: false }).limit(10),
      supabase.from("subscriptions").select("id", { count: "exact", head: true })
        .gte("updated_at", since).neq("tier", "free").eq("status", "active"),
      supabase.from("credit_transactions").select("id", { count: "exact", head: true })
        .gte("created_at", since).eq("type", "purchase").eq("category", "phone").not("stripe_session_id", "is", null),
      supabase.from("credit_transactions").select("id", { count: "exact", head: true })
        .gte("created_at", since).eq("type", "purchase").eq("category", "video").not("stripe_session_id", "is", null),
      supabase.from("chat_subscriptions").select("id", { count: "exact", head: true })
        .gte("created_at", since).not("stripe_session_id", "is", null),
    ]);

    const evs = (evRes.data || []) as unknown as WebhookEvent[];
    setEvents(evs);
    const newCounts: FulfillmentCounts = {
      credits: credRes.count ?? 0,
      superLikes: slRes.count ?? 0,
      boosts: boostRes.count ?? 0,
      gifts: giftRes.count ?? 0,
      donations: donRes.count ?? 0,
      subscriptions: paidSubsRes.count ?? 0,
      phoneMinutes: phoneRes.count ?? 0,
      videoMinutes: videoRes.count ?? 0,
      chatSubs: chatSubRes.count ?? 0,
    };
    setCounts(newCounts);
    setSubs((subRes.data || []) as SubscriptionRow[]);

    setChecklist({
      subscription: newCounts.subscriptions > 0,
      credits: newCounts.credits > 0,
      superLikes: newCounts.superLikes > 0,
      boosts: newCounts.boosts > 0,
      gifts: newCounts.gifts > 0,
      donations: newCounts.donations > 0,
      phoneMinutes: newCounts.phoneMinutes > 0,
      videoMinutes: newCounts.videoMinutes > 0,
      chatSubs: newCounts.chatSubs > 0,
      duplicate: evs.some(e => e.processing_status === "skipped_duplicate"),
    });
    const { data: gateData } = await supabase.functions.invoke("payments-gate-status");
    if (gateData) setGate(gateData as any);
    setRefreshing(false);
  };

  const failedEvents = events.filter(e => e.processing_status === "failed");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/admin")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button variant="outline" onClick={fetchAll} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Payment Test Status</h1>
          <p className="text-muted-foreground">Pre-publish verification of Stripe webhooks and fulfillment (last 24h)</p>
        </div>

        {gate && (
          <Card className={gate.blocked ? "border-amber-500 bg-amber-500/5" : "border-green-600 bg-green-600/5"}>
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertTriangle className={`w-5 h-5 ${gate.blocked ? "text-amber-600" : "text-green-600"}`} />
              <div className="text-sm">
                <div className="font-semibold">
                  {gate.blocked
                    ? "Test mode only — live payments disabled"
                    : `Live payments ENABLED (key: ${gate.mode})`}
                </div>
                <div className="text-xs text-muted-foreground">
                  PAYMENTS_LIVE_ENABLED = {String(gate.liveEnabled)} · Stripe key mode = {gate.mode}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {failedEvents.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" /> {failedEvents.length} Failed Webhook Event{failedEvents.length > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {failedEvents.map(e => (
                <div key={e.id} className="text-sm border-l-2 border-destructive pl-3">
                  <div className="font-medium">{e.event_type}</div>
                  <div className="text-muted-foreground text-xs">{new Date(e.created_at).toLocaleString()}</div>
                  {e.error_message && <div className="text-destructive text-xs mt-1">{e.error_message}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Test Checklist</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {CHECKLIST_ITEMS.map(item => (
              <div key={item.key} className="flex items-center gap-2 text-sm">
                {checklist[item.key] ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                )}
                <span className={checklist[item.key] ? "" : "text-muted-foreground"}>{item.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fulfillment Counts (Last 24h)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {[
                { label: "Subscriptions", value: counts.subscriptions },
                { label: "Credits", value: counts.credits },
                { label: "Super Likes", value: counts.superLikes },
                { label: "Boosts", value: counts.boosts },
                { label: "Gifts", value: counts.gifts },
                { label: "Donations", value: counts.donations },
              ].map(c => (
                <div key={c.label} className="text-center p-4 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Latest Paid Subscriptions ({subs.length})</CardTitle></CardHeader>
          <CardContent>
            {subs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active paid subscriptions yet.</p>
            ) : (
              <div className="space-y-2">
                {subs.map(s => (
                  <div key={s.profile_id} className="flex items-center justify-between text-sm border-b pb-2">
                    <div>
                      <div className="font-mono text-xs">{s.profile_id}</div>
                      <div className="text-xs text-muted-foreground">
                        Ends: {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{s.tier}</Badge>
                      <Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Stripe Webhook Events ({events.length})</CardTitle></CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No webhook events received yet. Run a Stripe test payment to populate.</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {events.map(e => (
                  <div key={e.id} className="text-sm border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.event_type}</span>
                      <Badge variant={
                        e.processing_status === "processed" ? "default" :
                        e.processing_status === "failed" ? "destructive" : "secondary"
                      }>{e.processing_status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                      {e.processed_at && ` → processed ${new Date(e.processed_at).toLocaleTimeString()}`}
                    </div>
                    {e.stripe_session_id && (
                      <div className="text-xs font-mono text-muted-foreground truncate">
                        session: {e.stripe_session_id}
                      </div>
                    )}
                    {e.error_message && (
                      <div className="text-xs text-destructive">{e.error_message}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Note: product_id / package_id are stored in Stripe session metadata, not in the webhook log.
              To inspect a specific purchase, copy the session ID and look it up in Stripe Dashboard or the
              corresponding fulfillment table (credit_transactions, boost_transactions, gift_transactions, donations).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
