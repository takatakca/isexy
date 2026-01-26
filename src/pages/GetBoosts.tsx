import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Zap, Timer, Sparkles, Flame } from "lucide-react";

type BoostType = "boost" | "primetime" | "super";

interface Package {
  id: string;
  quantity: number;
  pricePerItem: number;
  popular?: boolean;
  bestValue?: boolean;
  savings?: number;
  duration?: string;
}

const boostPackages: Package[] = [
  { id: "1", quantity: 1, pricePerItem: 6.49 },
  { id: "10", quantity: 10, pricePerItem: 3.29, popular: true, savings: 49 },
  { id: "20", quantity: 20, pricePerItem: 2.49, bestValue: true, savings: 62 },
];

const primetimePackages: Package[] = [
  { id: "1", quantity: 1, pricePerItem: 9.99 },
  { id: "3", quantity: 3, pricePerItem: 9.33, popular: true, savings: 7 },
  { id: "5", quantity: 5, pricePerItem: 7.79, bestValue: true, savings: 22 },
];

const superBoostPackages: Package[] = [
  { id: "3h", quantity: 3, pricePerItem: 49.99, duration: "3 hours" },
  { id: "6h", quantity: 6, pricePerItem: 92.99, duration: "6 hours", popular: true, savings: 7 },
  { id: "12h", quantity: 12, pricePerItem: 169.99, duration: "12 hours", bestValue: true, savings: 15 },
];

const boostTypeConfig: Record<BoostType, {
  title: string;
  description: string;
  icon: React.ReactNode;
  headerColor: string;
  packages: Package[];
  buttonColor: string;
  goldUpsell: string;
}> = {
  boost: {
    title: "Boost",
    description: "Be a top profile in your area for 30 minutes to get more Likes.",
    icon: <Zap className="w-6 h-6 text-purple-500" />,
    headerColor: "from-purple-500 to-purple-600",
    packages: boostPackages,
    buttonColor: "bg-gradient-to-r from-purple-500 to-pink-500",
    goldUpsell: "1 free Boost a month",
  },
  primetime: {
    title: "Primetime Boost",
    description: "We boost you when the most users are active, so you're seen by more potential matches.",
    icon: <Timer className="w-6 h-6 text-purple-500" />,
    headerColor: "from-purple-400 to-purple-600",
    packages: primetimePackages,
    buttonColor: "bg-gradient-to-r from-purple-500 to-pink-500",
    goldUpsell: "1 free Boost a month",
  },
  super: {
    title: "Super Boost",
    description: "Super Boost keeps you front and center for longer, giving you more opportunities to connect.",
    icon: <Sparkles className="w-6 h-6 text-pink-400" />,
    headerColor: "from-purple-500 to-pink-500",
    packages: superBoostPackages,
    buttonColor: "bg-gradient-to-r from-purple-500 to-pink-500",
    goldUpsell: "For subscribers only.",
  },
};

export default function GetBoosts() {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState<BoostType>("boost");
  const [selectedPackage, setSelectedPackage] = useState<string>(
    activeType === "super" ? "6h" : "10"
  );

  const config = boostTypeConfig[activeType];
  const packages = config.packages;
  const selected = packages.find((p) => p.id === selectedPackage) || packages[1];
  
  const total = activeType === "super" 
    ? selected.pricePerItem 
    : selected.quantity * selected.pricePerItem;

  const handleTypeChange = (type: BoostType) => {
    setActiveType(type);
    const defaultId = type === "super" ? "6h" : "10";
    if (boostTypeConfig[type].packages.find(p => p.id === defaultId)) {
      setSelectedPackage(defaultId);
    } else {
      setSelectedPackage(boostTypeConfig[type].packages[1]?.id || boostTypeConfig[type].packages[0].id);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={() => navigate(-1)} className="p-2">
          <X className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="font-bold text-xl text-foreground">Choose your Boost</h1>
        <div className="w-10" />
      </div>

      {/* Type tabs */}
      <div className="flex items-center gap-2 px-4 pb-4">
        {(["boost", "primetime", "super"] as BoostType[]).map((type) => (
          <button
            key={type}
            onClick={() => handleTypeChange(type)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeType === type
                ? "bg-foreground text-background"
                : "text-muted-foreground border border-border"
            }`}
          >
            {type === "boost" ? "Boost" : type === "primetime" ? "Primetime Boost" : "Super Boost"}
          </button>
        ))}
      </div>

      {/* Boost info card */}
      <div className={`mx-4 p-4 rounded-2xl bg-gradient-to-r ${config.headerColor} text-white`}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            {config.icon}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-lg mb-1">{config.title}</h2>
            <p className="text-sm text-white/90">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Package selection */}
      <div className="flex-1 px-4 py-6">
        <div className="space-y-3">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg.id)}
              className={`w-full p-4 rounded-xl border-2 transition-all relative ${
                selectedPackage === pkg.id
                  ? "border-purple-500"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  {pkg.popular && (
                    <span className="text-xs font-semibold text-purple-500 mb-1 block">
                      Popular
                    </span>
                  )}
                  {pkg.bestValue && (
                    <span className="text-xs font-semibold text-purple-500 mb-1 block">
                      Best Value
                    </span>
                  )}
                  <p className="text-xl font-bold text-foreground">
                    {activeType === "super" 
                      ? pkg.duration 
                      : `${pkg.quantity} ${pkg.quantity === 1 ? config.title : config.title + "s"}`}
                  </p>
                </div>
                <div className="text-right">
                  {pkg.savings && (
                    <span className="inline-block px-2 py-0.5 bg-muted rounded-full text-xs font-semibold text-muted-foreground mb-1">
                      Save {pkg.savings}%
                    </span>
                  )}
                  <p className="text-lg font-bold text-foreground">
                    ${pkg.pricePerItem.toFixed(2)}{activeType !== "super" && "/ea"}
                  </p>
                </div>
              </div>
            </button>
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
            {config.goldUpsell}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span className="font-bold text-foreground">Get CubaDate Gold®</span>
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
      <div className="p-4 border-t border-border">
        <button className={`w-full py-4 text-white rounded-full font-bold text-lg hover:opacity-90 transition-opacity ${config.buttonColor}`}>
          Continue for ${total.toFixed(2)} total
        </button>
      </div>
    </div>
  );
}
