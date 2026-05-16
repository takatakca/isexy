import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles, Crown, Star, Zap, Heart } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Campaign {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  cta: string;
  route: string;
}

const campaigns: Campaign[] = [
  {
    id: "gold",
    title: "ISEXY Gold™",
    subtitle: "See who likes you & match instantly",
    icon: <Crown className="w-6 h-6" />,
    gradient: "from-amber-400 to-amber-600",
    cta: "Get Gold",
    route: "/premium",
  },
  {
    id: "boost",
    title: "Get 10x More Views",
    subtitle: "Boost your profile now",
    icon: <Zap className="w-6 h-6" />,
    gradient: "from-purple-500 to-pink-500",
    cta: "Boost Now",
    route: "/get-boosts",
  },
  {
    id: "superlike",
    title: "Stand Out",
    subtitle: "3x more likely to match",
    icon: <Star className="w-6 h-6" />,
    gradient: "from-cyan-400 to-blue-500",
    cta: "Get Super Likes",
    route: "/get-super-likes",
  },
];

interface DiscoverCampaignsProps {
  className?: string;
}

export function DiscoverCampaigns({ className }: DiscoverCampaignsProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const campaign = campaigns[currentIndex];

  return (
    <div className={`px-4 ${className}`}>
      <div 
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${campaign.gradient} p-4 cursor-pointer`}
        onClick={() => navigate(campaign.route)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (currentIndex < campaigns.length - 1) {
              setCurrentIndex(prev => prev + 1);
            } else {
              setDismissed(true);
            }
          }}
          className="absolute top-2 right-2 p-1 text-white/70 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white">
            {campaign.icon}
          </div>
          <div className="flex-1 text-white">
            <p className="font-bold">{campaign.title}</p>
            <p className="text-sm text-white/90">{campaign.subtitle}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white text-foreground hover:bg-white/90 font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              navigate(campaign.route);
            }}
          >
            {campaign.cta}
          </Button>
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-1 mt-3">
          {campaigns.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                idx === currentIndex ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
