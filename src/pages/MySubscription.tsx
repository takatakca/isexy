import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Crown, Sparkles, Loader2, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subscriptionTiers as _tiers, SubscriptionTier } from "@/lib/subscriptionTiers";
import { useAuth as _useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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
      { title: "1 Free Boost / month", description: "Available with 1-month+ plans.", included: false },
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

export default function MySubscription() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeTier, setActiveTier] = useState<SubscriptionTier>("gold");
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabase.functions.invoke("check-subscription");
        if (data?.subscribed && data?.tier && ["plus","gold","platinum"].includes(data.tier)) {
          setCurrentTier(data.tier as SubscriptionTier);
          setActiveTier(data.tier as SubscriptionTier);
          if (data.subscription_end) setEndDate(data.subscription_end);
        }
      } catch {/* no-op */} finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  const sections = tierSections[activeTier];
  const tiers: SubscriptionTier[] = ["plus", "gold", "platinum"];

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Could not open subscription manager");
    } finally {
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
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted/50">
              <X className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-base font-bold text-foreground">My Subscription</h1>
            <div className="w-10" />
          </div>

          {/* Current status card */}
          <div className="px-4 pb-4">
            {loading ? (
              <div className="glass-card rounded-2xl p-5 animate-pulse h-24" />
            ) : currentTier ? (
              <div className="glass-card rounded-2xl p-5 ring-coral">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary fill-primary/30" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Active plan</span>
                  </div>
                  {endDate && <span className="text-xs text-muted-foreground">renews soon</span>}
                </div>
                <p className="text-2xl font-extrabold text-foreground">ISEXY {tierLabel[currentTier]}</p>
                {endDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Renews on {new Date(endDate).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                )}
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
          <ShieldCheck className="w-4 h-4 text-primary" /> Secure checkout powered by Stripe
        </div>
        {isFree ? (
          <button onClick={() => navigate("/premium")} className="cta-primary w-full">
            <Sparkles className="w-4 h-4" /> Upgrade to ISEXY {tierLabel[activeTier]}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleManage} disabled={portalLoading} className="cta-secondary">
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><SettingsIcon className="w-4 h-4" /> Manage</>}
            </button>
            <button onClick={() => navigate("/premium")} className="cta-primary">
              Change plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
