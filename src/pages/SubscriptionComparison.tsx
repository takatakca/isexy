import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, Flame, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subscriptionTiers, SubscriptionTier } from "@/lib/subscriptionTiers";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// All features across all tiers
const allFeatures = [
  { key: "unlimitedLikes", label: "Unlimited Likes", plus: true, gold: true, platinum: true },
  { key: "seeWhoLikes", label: "See Who Likes You", plus: false, gold: true, platinum: true },
  { key: "priorityLikes", label: "Priority Likes", plus: false, gold: false, platinum: true },
  { key: "unlimitedRewinds", label: "Unlimited Rewinds", plus: true, gold: true, platinum: true },
  { key: "boostPerMonth", label: "1 Free Boost per Month", plus: false, gold: true, platinum: true },
  { key: "superLikes", label: "Super Likes", plus: "0/week", gold: "5/week", platinum: "Unlimited" },
  { key: "messageBeforeMatch", label: "Message Before Matching", plus: false, gold: false, platinum: true },
  { key: "passportMode", label: "Passport™ Mode", plus: true, gold: true, platinum: true },
  { key: "topPicks", label: "Top Picks", plus: false, gold: true, platinum: true },
  { key: "controlProfile", label: "Control Your Profile", plus: true, gold: true, platinum: true },
  { key: "controlWhoSees", label: "Control Who Sees You", plus: true, gold: true, platinum: true },
  { key: "controlWhoYouSee", label: "Control Who You See", plus: true, gold: true, platinum: true },
  { key: "hideAds", label: "Hide Ads", plus: true, gold: true, platinum: true },
  { key: "firstImpressions", label: "First Impressions", plus: "0/week", gold: "0/week", platinum: "3/week" },
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
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    setLoading(tier);
    try {
      const tierData = subscriptionTiers[tier];
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: tierData.price_id },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create checkout session");
    } finally {
      setLoading(null);
    }
  };

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="w-5 h-5 text-green-500 mx-auto" />
      ) : (
        <X className="w-5 h-5 text-muted-foreground mx-auto" />
      );
    }
    return <span className="text-sm font-medium text-foreground">{value}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Compare Plans</h1>
        </div>
      </div>

      {/* Intro */}
      <div className="p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Flame className="w-8 h-8 text-primary fill-primary" />
          <span className="text-2xl font-bold text-foreground">CubaDate</span>
        </div>
        <p className="text-muted-foreground">
          Choose the plan that's right for you
        </p>
      </div>

      {/* Comparison Table */}
      <div className="px-2 pb-32 overflow-x-auto">
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
                      ${subscriptionTiers[tier].price}
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
                    ${subscriptionTiers[tier].weeklyPrice.toFixed(2)}/wk
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
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="grid grid-cols-3 gap-2">
          {(["plus", "gold", "platinum"] as SubscriptionTier[]).map((tier) => (
            <button
              key={tier}
              onClick={() => handleSubscribe(tier)}
              disabled={loading === tier}
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
        <p className="text-xs text-center text-muted-foreground mt-2">
          Cancel anytime. Terms apply.
        </p>
      </div>
    </div>
  );
}
