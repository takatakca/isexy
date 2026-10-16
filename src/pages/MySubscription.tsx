import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Crown, Sparkles, Loader2, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionTier } from "@/lib/subscriptionTiers";
import { toast } from "sonner";
import { useWallet, type Wallet } from "@/hooks/useWallet";
import { useCheckoutReturn } from "@/hooks/useCheckoutReturn";
import { startCheckout } from "@/lib/payments";
import { goBack } from "@/lib/navigation";

interface FeatureItem { title: string; description?: string; included: boolean; }
interface TierSection { category: string; features: FeatureItem[]; }

const tierSections: Record<SubscriptionTier, TierSection[]> = {
  plus: [
    { category: "Likes", features: [
      { title: "Unlimited Likes", included: true },
      { title: "See Who Likes You", included: false },
      { title: "Priority Likes", description: "Your Likes will be seen sooner.", included: false },
    ]},
    { category: "Experience", features: [
      { title: "Unlimited Rewinds", included: true },
      { title: "1 Free Boost / month", included: false },
      { title: "5 Free Super Likes / week", included: false },
      { title: "First Impressions", description: "Send a message before matching.", included: false },
    ]},
    { category: "Discovery", features: [
      { title: "Unlimited Passport™ Mode", description: "Match anywhere in the world.", included: true },
      { title: "Top Picks", description: "Daily curated selection.", included: false },
    ]},
    { category: "Control", features: [
      { title: "Control your profile", included: true },
      { title: "Control who sees you", included: true },
      { title: "Control who you see", included: true },
      { title: "Hide ads", included: true },
    ]},
  ],
  gold: [
    { category: "Likes", features: [
      { title: "Unlimited Likes", included: true },
      { title: "See Who Likes You", included: true },
      { title: "Priority Likes", included: false },
    ]},
    { category: "Experience", features: [
      { title: "Unlimited Rewinds", included: true },
      { title: "1 Free Boost / month", included: true },
      { title: "5 Free Super Likes / week", included: true },
      { title: "First Impressions", included: false },
    ]},
    { category: "Discovery", features: [
      { title: "Unlimited Passport™ Mode", included: true },
      { title: "Top Picks", included: true },
    ]},
    { category: "Control", features: [
      { title: "Control your profile", included: true },
      { title: "Control who sees you", included: true },
      { title: "Control who you see", included: true },
      { title: "Hide ads", included: true },
    ]},
  ],
  platinum: [
    { category: "Likes", features: [
      { title: "Unlimited Likes", included: true },
      { title: "See Who Likes You", included: true },
      { title: "Priority Likes", included: true },
    ]},
    { category: "Experience", features: [
      { title: "Unlimited Rewinds", included: true },
      { title: "1 Free Boost / month", included: true },
      { title: "Unlimited Super Likes", included: true },
      { title: "Message before matching", included: true },
      { title: "3 Free First Impressions / week", included: true },
    ]},
    { category: "Discovery", features: [
      { title: "Unlimited Passport™ Mode", included: true },
      { title: "Top Picks", included: true },
    ]},
    { category: "Control", features: [
      { title: "Control your profile", included: true },
      { title: "Control who sees you", included: true },
      { title: "Control who you see", included: true },
      { title: "Hide ads", included: true },
    ]},
  ],
};

const tierLabel: Record<SubscriptionTier, string> = { plus: "Plus", gold: "Gold", platinum: "Platinum" };

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

/** One line about where the plan comes from and when it ends. */
function planLine(w: Wallet): string {
  const end = w.plan_expires_at ? longDate(w.plan_expires_at) : null;
  switch (w.plan_source) {
    case "stripe":
      return end ? `Renews on ${end}. Cancel anytime.` : "Renews automatically. Cancel anytime.";
    case "coupon":
      return end ? `From a code · ends on ${end}` : "From a code · permanent";
    case "loyalty":
      return end ? `Loyalty reward · ends on ${end}` : "Loyalty reward";
    case "staff":
      return end ? `Gift from ISEXY · ends on ${end}` : "Gift from ISEXY";
    default:
      return end ? `Active until ${end}` : "Active";
  }
}

export default function MySubscription() {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refresh } = useWallet();
  const [activeTier, setActiveTier] = useState<SubscriptionTier>("gold");
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncing, setSyncing] = useState(true);

  useCheckoutReturn(refresh, "Payment received. Your plan starts in a few seconds.");

  // Catch up with Stripe (a missed webhook), then show the plan from the database.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("isexy-check-subscription");
        if (!cancelled && (data as { restored?: number } | null)?.restored) await refresh();
      } catch {
        /* the database plan is still shown */
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTier = wallet && wallet.tier !== "free" ? (wallet.tier as SubscriptionTier) : null;
  useEffect(() => {
    if (currentTier) setActiveTier(currentTier);
  }, [currentTier]);
  const loading = walletLoading && !wallet;
  const manageable = wallet?.plan_source === "stripe";

  const sections = tierSections[activeTier];
  const tiers: SubscriptionTier[] = ["plus", "gold", "platinum"];

  const handleManage = async () => {
    setPortalLoading(true);
    const result = await startCheckout("isexy-customer-portal");
    if (!result.ok) {
      toast.error(result.message);
      setPortalLoading(false);
    }
  };

  const isFree = !currentTier;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => goBack(navigate, "/settings")} className="p-2 rounded-full hover:bg-muted/50" aria-label="Close">
              <X className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-base font-bold text-foreground">My Subscription</h1>
            <div className="w-10" />
          </div>

          {/* Current status card */}
          <div className="px-4 pb-4">
            {loading ? (
              <div className="glass-card rounded-2xl p-5 animate-pulse h-24" />
            ) : currentTier && wallet ? (
              <div className="glass-card rounded-2xl p-5 ring-coral">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary fill-primary/30" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Active plan</span>
                  </div>
                  {syncing && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Checking with Stripe" />}
                </div>
                <p className="text-2xl font-extrabold text-foreground">ISEXY {tierLabel[currentTier]}</p>
                <p className="text-xs text-muted-foreground mt-1">{planLine(wallet)}</p>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Free plan</span>
                </div>
                <p className="text-lg font-bold text-foreground">Upgrade to unlock premium features</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tier selector */}
      <div className="px-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tiers.map((tier) => {
            const isActive = activeTier === tier;
            const isCurrent = currentTier === tier;
            return (
              <button
                key={tier}
                onClick={() => setActiveTier(tier)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  isActive
                    ? "gradient-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                ISEXY {tierLabel[tier]}{isCurrent ? " ·" : ""}
                {isCurrent && <Check className="w-3 h-3 inline ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature sections */}
      <div className="flex-1 px-4 py-4 pb-44 overflow-y-auto space-y-4">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="glass-card rounded-2xl p-4">
            <div className="flex justify-center mb-3">
              <span className="px-3 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider">
                {section.category}
              </span>
            </div>
            <div className="space-y-3">
              {section.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    feature.included ? "bg-primary/15" : "bg-muted"
                  }`}>
                    <Check className={`w-3.5 h-3.5 ${feature.included ? "text-primary" : "text-muted-foreground/40"}`} />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${feature.included ? "text-foreground" : "text-muted-foreground/60"}`}>
                      {feature.title}
                    </p>
                    {feature.description && (
                      <p className={`text-xs ${feature.included ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                        {feature.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" /> Payments by Stripe · prices in CAD
        </div>
        {isFree ? (
          <button onClick={() => navigate("/premium")} className="cta-primary w-full">
            <Sparkles className="w-4 h-4" /> Upgrade to ISEXY {tierLabel[activeTier]}
          </button>
        ) : manageable ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleManage} disabled={portalLoading} className="cta-secondary">
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><SettingsIcon className="w-4 h-4" /> Manage</>}
            </button>
            <button onClick={handleManage} disabled={portalLoading} className="cta-primary">
              Change plan
            </button>
          </div>
        ) : (
          <button onClick={() => navigate("/premium")} className="cta-primary w-full">
            See paid plans
          </button>
        )}
      </div>
    </div>
  );
}
