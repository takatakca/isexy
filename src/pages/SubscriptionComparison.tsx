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
    gradient: "from-pink-500 to-rose-500",
    headerBg: "bg-gradient-to-r from-pink-500 to-rose-500",
    headerText: "text-white",
  },
  gold: {
    name: "Gold",
    gradient: "from-yellow-400 to-amber-500",
    headerBg: "bg-gradient-to-r from-yellow-400 to-amber-500",
    headerText: "text-white",
  },
  platinum: {
    name: "Platinum",
    gradient: "from-slate-600 to-slate-800",
    headerBg: "bg-gradient-to-r from-slate-600 to-slate-800",
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack(navigate, "/premium")} className="p-2" aria-label="Back">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Compare Plans</h1>
        </div>
      </div>

      {/* Intro */}
      <div className="p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Flame className="w-8 h-8 text-primary fill-primary" />
          <span className="text-2xl font-bold text-foreground">ISEXY</span>
        </div>
        <p className="text-muted-foreground">
          Choose the plan that's right for you
        </p>
      </div>

      {/* Comparison Table */}
      <div className="px-2 pb-48 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-0">
              <TableHead className="w-[40%]">Features</TableHead>
              {(["plus", "gold", "platinum"] as SubscriptionTier[]).map((tier) => (
                <TableHead key={tier} className="text-center p-1">
                  <div className={`${tierConfig[tier].headerBg} rounded-t-xl py-3 px-2`}>
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4 text-white fill-white" />
                      <span className="font-bold text-white text-sm">
                        {tierConfig[tier].name}
                      </span>
                    </div>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {/* Pricing Row */}
            <TableRow className="bg-muted/30">
              <TableCell className="font-semibold text-foreground">
                Monthly Price
              </TableCell>
              {(["plus", "gold", "platinum"] as SubscriptionTier[]).map((tier) => (
                <TableCell key={tier} className="text-center">
                  <div>
                    <span className="text-xl font-bold text-foreground">
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
              {(["plus", "gold", "platinum"] as SubscriptionTier[]).map((tier) => (
                <TableCell key={tier} className="text-center">
                  <span className="text-sm text-foreground">
                    {cad(subscriptionTiers[tier].plans[0].weeklyPrice)}/wk
                  </span>
                </TableCell>
              ))}
            </TableRow>

            {/* Feature Rows */}
            {allFeatures.map((feature, idx) => (
              <TableRow key={feature.key} className={idx % 2 === 0 ? "bg-muted/20" : ""}>
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

      {/* Fixed Bottom CTAs */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        {paysWithStripe ? (
          <button onClick={() => navigate("/my-subscription")} className="cta-primary w-full">Manage my plan</button>
        ) : (
          <>
            <PaymentsNotice gate={gate} />
            <div className="grid grid-cols-3 gap-2">
              {(["plus", "gold", "platinum"] as SubscriptionTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => handleSubscribe(tier)}
                  disabled={loading !== null || !!blocked}
                  className={`py-3 px-2 rounded-xl font-bold text-white text-sm bg-gradient-to-r ${tierConfig[tier].gradient} hover:opacity-90 transition-opacity disabled:opacity-50`}
                >
                  {loading === tier ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    `Get ${tierConfig[tier].name}`
                  )}
                </button>
              ))}
            </div>
          </>
        )}
        <p className="text-xs text-center text-muted-foreground">
          Monthly plans, prices in CAD. Cancel anytime in My Subscription.
        </p>
      </div>
    </div>
  );
}
