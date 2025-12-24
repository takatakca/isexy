import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Star, Flame } from "lucide-react";

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
  { id: "30", quantity: 30, pricePerItem: 2.49, bestValue: true, savings: 38 },
];

export default function GetSuperLikes() {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState<string>("15");

  const selected = packages.find((p) => p.id === selectedPackage)!;
  const total = selected.quantity * selected.pricePerItem;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-blue-100 to-background pb-4">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate(-1)} className="p-2">
            <X className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-blue-500 fill-blue-500" />
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
                  ? "border-blue-500 bg-blue-50"
                  : "border-border bg-card"
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2 left-2 text-xs font-semibold text-blue-500">
                  Popular
                </span>
              )}
              {pkg.bestValue && (
                <span className="absolute -top-2 left-2 text-xs font-semibold text-blue-500">
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
                  <span className="inline-block mt-2 px-2 py-0.5 bg-muted rounded-full text-xs font-semibold text-muted-foreground">
                    Save {pkg.savings}%
                  </span>
                )}
              </div>

              <button
                className={`w-full mt-4 py-3 rounded-full font-bold text-sm transition-colors ${
                  selectedPackage === pkg.id
                    ? "bg-blue-500 text-white"
                    : "bg-blue-500 text-white"
                }`}
              >
                Select
              </button>
            </button>
          ))}
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-1.5 py-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                selectedPackage === pkg.id ? "bg-foreground" : "bg-muted"
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
        <button className="w-full py-4 bg-blue-500 text-white rounded-full font-bold text-lg hover:bg-blue-600 transition-colors">
          Continue for ${total.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
