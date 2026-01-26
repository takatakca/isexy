import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Star, Flame, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Package {
  id: string;
  quantity: number;
  pricePerItem: number;
  popular?: boolean;
  bestValue?: boolean;
  savings?: number;
}

const packages: Package[] = [
  { id: "3", quantity: 3, pricePerItem: 3.99 },
  { id: "15", quantity: 15, pricePerItem: 3.26, popular: true, savings: 18 },
  { id: "30", quantity: 30, pricePerItem: 2.49, bestValue: true, savings: 37 },
];

export default function GetSuperLikes() {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState<string>("15");
  const [loading, setLoading] = useState(false);

  const selected = packages.find((p) => p.id === selectedPackage)!;
  const total = selected.quantity * selected.pricePerItem;

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-one-time-payment", {
        body: {
          productName: `${selected.quantity} Super Likes`,
          quantity: 1,
          unitAmount: Math.round(total * 100), // Convert to cents
          description: `Get ${selected.quantity} Super Likes to stand out from the crowd`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Purchase error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-cyan-500/20 to-background pb-4">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted/50 rounded-full">
            <X className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-cyan-500 fill-cyan-500" />
            <span className="font-bold text-foreground">Get Super Likes</span>
          </div>
          <div className="w-10" />
        </div>

        {/* Headline */}
        <div className="px-6">
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            Stand out with Super Like. You're 3x more likely to get a match!
          </h1>
        </div>
      </div>

      {/* Package selection */}
      <div className="px-4 py-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Select a package</h2>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg.id)}
              className={`flex-shrink-0 w-36 p-4 rounded-xl border-2 transition-all relative ${
                selectedPackage === pkg.id
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-border bg-card"
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2 left-2 text-xs font-semibold text-cyan-500">
                  Popular
                </span>
              )}
              {pkg.bestValue && (
                <span className="absolute -top-2 left-2 text-xs font-semibold text-cyan-500">
                  Best Value
                </span>
              )}

              <div className="text-left">
                <p className="text-xl font-bold text-foreground">
                  {pkg.quantity} Super Likes
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  ${pkg.pricePerItem.toFixed(2)}/ea
                </p>
                {pkg.savings && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-cyan-500/20 rounded-full text-xs font-semibold text-cyan-600">
                    Save {pkg.savings}%
                  </span>
                )}
              </div>

              <div
                className={`w-full mt-4 py-3 rounded-full font-bold text-sm text-center transition-colors ${
                  selectedPackage === pkg.id
                    ? "bg-cyan-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Select
              </div>
            </button>
          ))}
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-1.5 py-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                selectedPackage === pkg.id ? "bg-cyan-500" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Divider with "or" */}
      <div className="flex items-center gap-4 px-6 py-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-muted-foreground text-sm">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Gold upsell */}
      <div className="px-4 py-4">
        <div className="border border-border rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted-foreground text-center mb-3">
            Includes 2 Free Super Likes Every Week
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span className="font-bold text-foreground">Get CubaDate Gold™</span>
            </div>
            <button
              onClick={() => navigate("/premium")}
              className="px-4 py-2 border border-border rounded-full text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Select
            </button>
          </div>
        </div>
      </div>

      {/* Bottom purchase button */}
      <div className="mt-auto p-4 border-t border-border">
        <button 
          onClick={handlePurchase}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            `Continue for $${total.toFixed(2)} CAD`
          )}
        </button>
      </div>
    </div>
  );
}
