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
  gifts: number;
  donations: number;
  subscriptions: number;
}

interface SubscriptionRow {
  profile_id: string;
  tier: string;
  status: string;
  current_period_end: string | null;
}

const CHECKLIST_ITEMS = [
  { key: "subscription", label: "Plus monthly subscription tested", eventType: "checkout.session.completed", mode: "subscription" },
  { key: "credits", label: "Credit pack tested", table: "credit_transactions" },
  { key: "super_likes", label: "Super-like pack tested", table: "boost_transactions", filter: { column: "boost_type", value: "super_like" } },
  { key: "boosts", label: "Boost pack tested", table: "boost_transactions", filter: { column: "boost_type", value: "boost" } },
  { key: "gifts", label: "Gift tested", table: "gift_transactions" },
  { key: "donations", label: "Donation tested", table: "donations" },
  { key: "duplicate", label: "Duplicate webhook resend tested", check: "duplicate" },
];

export default function AdminPaymentTests() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [counts, setCounts] = useState<FulfillmentCounts>({ credits: 0, boosts: 0, gifts: 0, donations: 0, subscriptions: 0 });
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

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

    const [evRes, credRes, boostRes, giftRes, donRes, subRes, allSubsRes] = await Promise.all([
      supabase.from("stripe_webhook_events" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("credit_transactions").select("id", { count: "exact", head: true }).gte("created_at", since).eq("type", "purchase"),
      supabase.from("boost_transactions").select("id", { count: "exact", head: true }).gte("created_at", since).eq("action", "purchase"),
      supabase.from("gift_transactions").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "completed"),
      supabase.from("donations").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "completed"),
      supabase.from("subscriptions").select("profile_id, tier, status, current_period_end").neq("tier", "free").order("updated_at", { ascending: false }).limit(10),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).gte("updated_at", since),
    ]);

    const evs = (evRes.data || []) as unknown as WebhookEvent[];
    setEvents(evs);
    setCounts({
      credits: credRes.count ?? 0,
      boosts: boostRes.count ?? 0,
      gifts: giftRes.count ?? 0,
      donations: donRes.count ?? 0,
      subscriptions: allSubsRes.count ?? 0,
    });
    setSubs((subRes.data || []) as SubscriptionRow[]);

    // Build checklist from events + tables
    const cl: Record<string, boolean> = {};
    cl.subscription = evs.some(e => e.event_type?.startsWith("customer.subscription") && e.processing_status === "processed");
    cl.credits = (credRes.count ?? 0) > 0;
    cl.super_likes = evs.some(e => e.event_type === "checkout.session.completed" && e.processing_status === "processed");
    cl.boosts = (boostRes.count ?? 0) > 0;
    cl.gifts = (giftRes.count ?? 0) > 0;
    cl.donations = (donRes.count ?? 0) > 0;
    cl.duplicate = evs.some(e => e.processing_status === "skipped_duplicate");
    setChecklist(cl);
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
          <p className="text-muted-foreground">Pre-publish verification of Stripe webhooks and fulfillment</p>
        </div>

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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Credits", value: counts.credits },
                { label: "Boosts", value: counts.boosts },
                { label: "Gifts", value: counts.gifts },
                { label: "Donations", value: counts.donations },
                { label: "Subscriptions", value: counts.subscriptions },
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
          <CardHeader><CardTitle>Latest Subscriptions ({subs.length})</CardTitle></CardHeader>
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
                      <div className="text-xs font-mono text-muted-foreground truncate">{e.stripe_session_id}</div>
                    )}
                    {e.error_message && (
                      <div className="text-xs text-destructive">{e.error_message}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
