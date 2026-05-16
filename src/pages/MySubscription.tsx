import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Flame } from "lucide-react";
import { subscriptionTiers, SubscriptionTier } from "@/lib/subscriptionTiers";

interface FeatureItem {
  title: string;
  description?: string;
  included: boolean;
}

interface TierSection {
  category: string;
  features: FeatureItem[];
}

const tierSections: Record<SubscriptionTier, TierSection[]> = {
  plus: [
    {
      category: "Upgrade Your Likes",
      features: [
        { title: "Unlimited Likes", included: true },
        { title: "See Who Likes You", included: false },
        { title: "Priority Likes", description: "Your Likes will be seen sooner with Priority Likes.", included: false },
      ],
    },
    {
      category: "Enhance Your Experience",
      features: [
        { title: "Unlimited Rewinds", included: true },
        { title: "1 Free Boost per month", description: "Free monthly Boost only available for 1 month or longer subscriptions.", included: false },
        { title: "3 Free Super Likes per week", included: false },
        { title: "3 Free First Impressions per week", description: "Stand out with a message before matching.", included: false },
      ],
    },
    {
      category: "Premium Discovery",
      features: [
        { title: "Unlimited Passport™ Mode", description: "Match and chat with people anywhere in the world.", included: true },
        { title: "Top Picks", description: "Browse through a daily curated selection of profiles.", included: false },
      ],
    },
    {
      category: "Take Control",
      features: [
        { title: "Control Your Profile", description: "Only show what you want them to know.", included: true },
        { title: "Control Who Sees You", description: "Manage who you're seen by.", included: true },
        { title: "Control Who You See", description: "Choose the type of people you want to connect with.", included: true },
        { title: "Hide Ads", included: true },
      ],
    },
  ],
  gold: [
    {
      category: "Upgrade Your Likes",
      features: [
        { title: "Unlimited Likes", included: true },
        { title: "See Who Likes You", included: true },
        { title: "Priority Likes", description: "Your Likes will be seen sooner with Priority Likes.", included: false },
      ],
    },
    {
      category: "Enhance Your Experience",
      features: [
        { title: "Unlimited Rewinds", included: true },
        { title: "1 Free Boost per month", description: "Free monthly Boost only available for 1 month or longer subscriptions.", included: true },
        { title: "5 Free Super Likes per week", included: true },
        { title: "3 Free First Impressions per week", description: "Stand out with a message before matching.", included: false },
      ],
    },
    {
      category: "Premium Discovery",
      features: [
        { title: "Unlimited Passport™ Mode", description: "Match and chat with people anywhere in the world.", included: true },
        { title: "Top Picks", description: "Browse through a daily curated selection of profiles.", included: true },
      ],
    },
    {
      category: "Take Control",
      features: [
        { title: "Control Your Profile", description: "Only show what you want them to know.", included: true },
        { title: "Control Who Sees You", description: "Manage who you're seen by.", included: true },
        { title: "Control Who You See", description: "Choose the type of people you want to connect with.", included: true },
        { title: "Hide Ads", included: true },
      ],
    },
  ],
  platinum: [
    {
      category: "Upgrade Your Likes",
      features: [
        { title: "Unlimited Likes", included: true },
        { title: "See Who Likes You", included: true },
        { title: "Priority Likes", description: "Your Likes will be seen sooner with Priority Likes.", included: true },
      ],
    },
    {
      category: "Enhance Your Experience",
      features: [
        { title: "Unlimited Rewinds", included: true },
        { title: "1 Free Boost per month", description: "Free monthly Boost only available for 1 month or longer subscriptions.", included: true },
        { title: "Unlimited Super Likes", included: true },
        { title: "Message Before Matching", description: "Send a message before you even match.", included: true },
        { title: "3 Free First Impressions per week", description: "Stand out with a message before matching.", included: true },
      ],
    },
    {
      category: "Premium Discovery",
      features: [
        { title: "Unlimited Passport™ Mode", description: "Match and chat with people anywhere in the world.", included: true },
        { title: "Top Picks", description: "Browse through a daily curated selection of profiles.", included: true },
      ],
    },
    {
      category: "Take Control",
      features: [
        { title: "Control Your Profile", description: "Only show what you want them to know.", included: true },
        { title: "Control Who Sees You", description: "Manage who you're seen by.", included: true },
        { title: "Control Who You See", description: "Choose the type of people you want to connect with.", included: true },
        { title: "Hide Ads", included: true },
      ],
    },
  ],
};

const tierConfig: Record<SubscriptionTier, { 
  gradient: string;
  bgColor: string;
  buttonGradient: string;
  buttonColor: string;
  startingPrice: number;
  label: string;
  accentColor: string;
}> = {
  plus: {
    gradient: "from-pink-400 to-rose-500",
    bgColor: "bg-gradient-to-br from-pink-100 to-rose-100",
    buttonGradient: "from-rose-500 to-pink-600",
    buttonColor: "bg-gradient-to-r from-rose-500 to-pink-600",
    startingPrice: 3.33,
    label: "+",
    accentColor: "text-rose-500",
  },
  gold: {
    gradient: "from-yellow-400 to-amber-500",
    bgColor: "bg-gradient-to-br from-yellow-100 to-amber-100",
    buttonGradient: "from-yellow-500 to-amber-500",
    buttonColor: "bg-gradient-to-r from-yellow-500 to-amber-500",
    startingPrice: 5.00,
    label: "GOLD",
    accentColor: "text-amber-600",
  },
  platinum: {
    gradient: "from-slate-400 to-slate-600",
    bgColor: "bg-gradient-to-br from-slate-200 to-slate-300",
    buttonGradient: "from-slate-500 to-slate-700",
    buttonColor: "bg-gradient-to-r from-slate-500 to-slate-700",
    startingPrice: 6.67,
    label: "PLATINUM",
    accentColor: "text-slate-600",
  },
};

export default function MySubscription() {
  const navigate = useNavigate();
  const [activeTier, setActiveTier] = useState<SubscriptionTier>("platinum");
  const carouselRef = useRef<HTMLDivElement>(null);
  const tiers: SubscriptionTier[] = ["plus", "gold", "platinum"];

  const config = tierConfig[activeTier];
  const sections = tierSections[activeTier];

  // Handle scroll to update active tier
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const cardWidth = carouselRef.current.offsetWidth * 0.8;
    const index = Math.round(scrollLeft / cardWidth);
    setActiveTier(tiers[Math.min(index, tiers.length - 1)]);
  };

  // Scroll to platinum by default
  useEffect(() => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth * 0.8;
      carouselRef.current.scrollTo({ left: cardWidth * 2, behavior: "instant" });
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="p-2">
          <X className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">My Subscription</h1>
        <div className="w-10" />
      </div>

      {/* Tier carousel with peek effect */}
      <div className="relative">
        {/* Gold accent stripe on left */}
        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-amber-300 to-amber-400 z-10 rounded-r-lg my-6" />
        
        <div 
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto pb-4 pt-6 px-8 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {tiers.map((tier) => (
            <button
              key={tier}
              onClick={() => {
                setActiveTier(tier);
                const index = tiers.indexOf(tier);
                if (carouselRef.current) {
                  const cardWidth = carouselRef.current.offsetWidth * 0.8;
                  carouselRef.current.scrollTo({ left: cardWidth * index, behavior: "smooth" });
                }
              }}
              className={`flex-shrink-0 w-[80%] h-28 rounded-2xl transition-all snap-center flex items-center justify-center ${
                tierConfig[tier].bgColor
              } ${
                activeTier === tier 
                  ? "shadow-lg scale-100" 
                  : "opacity-60 scale-95"
              }`}
            >
              <div className="flex items-center gap-2">
                <Flame className={`w-6 h-6 ${tierConfig[tier].accentColor}`} />
                <span className={`font-bold text-xl text-foreground`}>
                  ISEXY
                </span>
                {tier === "plus" ? (
                  <span className="text-rose-500 text-2xl font-bold">+</span>
                ) : (
                  <span className={`${
                    tier === "gold" 
                      ? "bg-gradient-to-r from-yellow-500 to-amber-500" 
                      : "bg-gradient-to-r from-slate-500 to-slate-700"
                  } text-white text-xs px-2 py-0.5 rounded font-bold`}>
                    {tierConfig[tier].label}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-1.5 py-2">
          {tiers.map((tier) => (
            <div
              key={tier}
              className={`w-2 h-2 rounded-full transition-colors ${
                activeTier === tier ? "bg-foreground" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Feature sections */}
      <div className="flex-1 px-4 pb-32 overflow-y-auto">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-6">
            <div className="flex justify-center mb-3">
              <span className="px-4 py-1.5 bg-muted rounded-full text-xs font-semibold text-muted-foreground border border-border">
                {section.category}
              </span>
            </div>

            <div className="border border-border rounded-2xl p-4 space-y-4 bg-card">
              {section.features.map((feature, featureIdx) => (
                <div key={featureIdx} className="flex items-start gap-3">
                  <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    feature.included ? "text-primary" : "text-muted-foreground/30"
                  }`} />
                  <div>
                    <p className={`font-semibold ${feature.included ? "text-foreground" : "text-muted-foreground/50"}`}>
                      {feature.title}
                    </p>
                    {feature.description && (
                      <p className={`text-sm ${feature.included ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
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
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-6">
        <button
          onClick={() => navigate("/premium")}
          className={`w-full py-4 rounded-full font-bold text-lg text-white transition-opacity hover:opacity-90 ${config.buttonColor}`}
        >
          STARTING AT ${config.startingPrice.toFixed(2)}/wk
        </button>
      </div>
    </div>
  );
}
