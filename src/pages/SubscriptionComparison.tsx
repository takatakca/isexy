import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, Flame, Loader2 } from "lucide-react";
import { subscriptionTiers, SubscriptionTier } from "@/lib/subscriptionTiers";
import { toast } from "sonner";
import { usePaymentsGate, blockedLabel } from "@/hooks/usePaymentsGate";
import { useWallet } from "@/hooks/useWallet";
import { PaymentsNotice } from "@/components/PaymentsNotice";
import { cad, startCheckout } from "@/lib/payments";
import { goBack } from "@/lib/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { track } from "@/lib/analytics";

// All features across all tiers
const allFeatures = [
  { key: "unlimitedLikes", label: "Unlimited Likes", plus: true, gold: true, platinum: true },
  { key: "seeWhoLikes", label: "See Who Likes You", plus: false, gold: true, platinum: true },
  { key: "priorityLikes", label: "Priority Likes", plus: false, gold: false, platinum: true },
  { key: "unlimitedRewinds", label: "Unlimited Rewinds", plus: true, gold: true, platinum: true },
  { key: "boostPerMonth", label: "1 Free Boost per Month", plus: false, gold: true, platinum: true },
  { key: "superLikes", label: "Super Likes", plus: "0/week", gold: "5/week", platinum: "Unlimited" },
  { key: "messageBeforeMatch", label: "Message Before Matching", plus: false, gold: false, platinum: true },
  { key: "firstImpressions", label: "First Impressions", plus: "0/week", gold: "0/week", platinum: "3/week" },
  { key: "passportMode", label: "Passport™ Mode", plus: true, gold: true, platinum: true },
  { key: "topPicks", label: "Top Picks", plus: false, gold: true, platinum: true },
  { key: "controlProfile", label: "Control Your Profile", plus: true, gold: true, platinum: true },
  { key: "controlWhoSees", label: "Control Who Sees You", plus: true, gold: true, platinum: true },
  { key: "controlWhoYouSee", label: "Control Who You See", plus: true, gold: true, platinum: true },
  { key: "noAds", label: "No Ads", plus: true, gold: true, platinum: true },
];

const tierConfig: Record<SubscriptionTier, {
  name: string;
  gradient: string;
  headerBg: string;
  headerText: string;
}> = {
  plus: {
    name: "Plus",
    gradient: "from-primary-solid to-[hsl(var(--gradient-end))]",
    headerBg: "gradient-primary",
    headerText: "text-white",
  },
  gold: {
    name: "Gold",
    gradient: "from-yellow-400 to-amber-500",
    headerBg: "bg-gradient-to-r from-yellow-400 to-amber-500",
    headerText: "text-navy",
  },
  platinum: {
    name: "Platinum",
    gradient: "from-slate-600 to-slate-800",
    headerBg: "bg-gradient-to-r from-[#3B4A63] to-[#1A2540]",
    headerText: "text-white",
  },
};

export default function SubscriptionComparison() {
  const navigate = useNavigate();
  const gate = usePaymentsGate();
  const { wallet } = useWallet();
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const blocked = blockedLabel(gate);
  // Members paying through Stripe change plan in the billing page (no second subscription).
  const paysWithStripe = wallet?.plan_source === "stripe";

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (paysWithStripe) {
      navigate("/my-subscription");
      return;
    }
    setLoading(tier);
    track("checkout_started", { product: "SubscriptionComparison" });
    const result = await startCheckout("isexy-create-checkout", { tier, duration: "month" });
    if (!result.ok) {
      toast.error(result.message);
      setLoading(null);
    }
  };

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="w-5 h-5 text-primary mx-auto" aria-label="Included" />
      ) : (
        <X className="w-5 h-5 text-muted-foreground mx-auto" aria-label="Not included" />
      );
    }
    return <span className="text-sm font-medium text-foreground">{value}</span>;
  };

  const tiers = ["plus", "gold", "platinum"] as SubscriptionTier[];
  // Each card lists what its plan includes (the full table follows).
  const highlights = (tier: SubscriptionTier) =>
    allFeatures
      .filter((f) => f[tier] !== false && !(typeof f[tier] === "string" && /^0\//.test(f[tier] as string)))
      .slice(0, 6)
      .map((f) => (typeof f[tier] === "string" ? `${f.label}: ${f[tier]}` : f.label));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="app-header">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-2 min-h-14">
          <button onClick={() => goBack(navigate, "/premium")} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary" aria-label="Back">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">Compare Plans</h1>
        </div>
      </header>

      {/* Intro */}
      <div className="px-4 pt-6 pb-2 text-center">
        <p className="eyebrow mb-3">ISEXY plans · CAD</p>
        <p className="type-title text-foreground">Choose the plan that's right for you</p>
      </div>

      <div className={`mx-auto max-w-5xl px-4 ${paysWithStripe ? "pb-36" : "pb-16"}`}>
        {!paysWithStripe && <div className="mt-4"><PaymentsNotice gate={gate} /></div>}

        {/* Pricing cards: one checkout button each */}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => {
            const cfg = tierConfig[tier];
            const featured = tier === "gold";
            return (
              <section
                key={tier}
                aria-label={`ISEXY ${cfg.name}`}
                className={`relative flex flex-col overflow-hidden rounded-[1.5rem] border bg-card ${featured ? "border-primary/60 shadow-[0_24px_60px_-28px_hsl(var(--primary)/0.9)]" : "border-foreground/10"}`}
              >
                <div className={`${cfg.headerBg} flex items-center justify-between px-5 py-3`}>
                  <span className={`flex items-center gap-1.5 font-display font-extrabold ${cfg.headerText}`}>
                    <Flame className="w-4 h-4 fill-current" /> {cfg.name}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-extrabold text-foreground">{cad(subscriptionTiers[tier].plans[1].totalPrice)}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">or {cad(subscriptionTiers[tier].plans[0].weeklyPrice)}/wk weekly</p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {highlights(tier).map((h) => (
                      <li key={h} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20"><Check className="h-3 w-3 text-primary" strokeWidth={3} /></span>
                        {h}
                      </li>
                    ))}
                  </ul>
                  {!paysWithStripe && (
                    <button
                      onClick={() => handleSubscribe(tier)}
                      disabled={loading !== null || !!blocked}
                      className={`mt-6 w-full min-h-12 rounded-full font-semibold text-sm transition-all disabled:opacity-50 ${featured ? "gradient-primary text-primary-foreground shadow-button hover:brightness-110" : "border border-primary/50 text-foreground hover:bg-primary/15"}`}
                    >
                      {loading === tier ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        `Get ${cfg.name}`
                      )}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-center text-muted-foreground">
          Monthly plans, prices in CAD. Cancel anytime in My Subscription.
        </p>

        {/* Full comparison */}
        <h2 className="eyebrow-muted mt-10 mb-3">Every feature</h2>
        <div className="overflow-x-auto rounded-[1.25rem] border border-foreground/10 bg-card/60">
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="w-[40%] text-muted-foreground">Features</TableHead>
              {tiers.map((tier) => (
                <TableHead key={tier} className="text-center p-1">
                  <div className={`${tierConfig[tier].headerBg} rounded-xl py-2 px-2`}>
                    <span className={`font-display font-bold text-sm ${tierConfig[tier].headerText}`}>
                      {tierConfig[tier].name}
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* Pricing Row */}
            <TableRow className="bg-primary/5">
              <TableCell className="font-semibold text-foreground">
                Monthly Price
              </TableCell>
              {tiers.map((tier) => (
                <TableCell key={tier} className="text-center">
                  <div>
                    <span className="font-display text-lg font-extrabold text-foreground">
                      {cad(subscriptionTiers[tier].plans[1].totalPrice)}
                    </span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                </TableCell>
              ))}
            </TableRow>

            {/* Weekly Price Row */}
            <TableRow>
              <TableCell className="text-muted-foreground">
                Weekly Price
              </TableCell>
              {tiers.map((tier) => (
                <TableCell key={tier} className="text-center">
                  <span className="text-sm text-foreground">
                    {cad(subscriptionTiers[tier].plans[0].weeklyPrice)}/wk
                  </span>
                </TableCell>
              ))}
            </TableRow>

            {/* Feature Rows */}
            {allFeatures.map((feature, idx) => (
              <TableRow key={feature.key} className={idx % 2 === 0 ? "bg-foreground/[0.02]" : ""}>
                <TableCell className="text-foreground text-sm">
                  {feature.label}
                </TableCell>
                <TableCell className="text-center">
                  {renderFeatureValue(feature.plus)}
                </TableCell>
                <TableCell className="text-center">
                  {renderFeatureValue(feature.gold)}
                </TableCell>
                <TableCell className="text-center">
                  {renderFeatureValue(feature.platinum)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Stripe members change plan in the billing page */}
      {paysWithStripe && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-foreground/10 bg-background/90 backdrop-blur-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md">
            <button onClick={() => navigate("/my-subscription")} className="cta-primary w-full">Manage my plan</button>
          </div>
        </div>
      )}
    </div>
  );
}
