import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Gift, Star, Zap, Crown, Trophy, Coins, 
  Share2, Users, Copy, Check, ChevronRight, Flame, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Reward {
  id: string;
  name: string;
  points: number;
  icon: React.ReactNode;
  description: string;
  type: "boost" | "superlike" | "gold" | "platinum";
}

const rewards: Reward[] = [
  {
    id: "1-superlike",
    name: "1 Super Like",
    points: 100,
    icon: <Star className="w-6 h-6 text-cyan-500" />,
    description: "Stand out with a Super Like",
    type: "superlike",
  },
  {
    id: "1-boost",
    name: "1 Boost",
    points: 250,
    icon: <Zap className="w-6 h-6 text-purple-500" />,
    description: "Get 10x more views for 30 min",
    type: "boost",
  },
  {
    id: "5-superlikes",
    name: "5 Super Likes",
    points: 400,
    icon: <Star className="w-6 h-6 text-cyan-500" />,
    description: "Bundle deal - save 20%",
    type: "superlike",
  },
  {
    id: "3-boosts",
    name: "3 Boosts",
    points: 600,
    icon: <Zap className="w-6 h-6 text-purple-500" />,
    description: "Bundle deal - save 20%",
    type: "boost",
  },
  {
    id: "gold-week",
    name: "1 Week Gold",
    points: 1000,
    icon: <Crown className="w-6 h-6 text-amber-500" />,
    description: "Try Gold features for a week",
    type: "gold",
  },
  {
    id: "gold-month",
    name: "1 Month Gold",
    points: 3000,
    icon: <Crown className="w-6 h-6 text-amber-500" />,
    description: "Full month of Gold benefits",
    type: "gold",
  },
  {
    id: "platinum-week",
    name: "1 Week Platinum",
    points: 2000,
    icon: <Crown className="w-6 h-6 text-slate-600" />,
    description: "Try Platinum features for a week",
    type: "platinum",
  },
  {
    id: "platinum-month",
    name: "1 Month Platinum",
    points: 5000,
    icon: <Crown className="w-6 h-6 text-slate-600" />,
    description: "Ultimate ISEXY experience",
    type: "platinum",
  },
];

const pointsHistory = [
  { action: "Daily login", points: 5, date: "Today" },
  { action: "Profile completed", points: 50, date: "Yesterday" },
  { action: "First match", points: 25, date: "2 days ago" },
  { action: "Referral bonus", points: 200, date: "3 days ago" },
];

export default function LoyaltyRewards() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [currentPoints, setCurrentPoints] = useState(650);
  const [copied, setCopied] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"earn" | "redeem">("earn");

  const referralCode = `CUBA${profile?.first_name?.toUpperCase().slice(0, 4) || "USER"}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const nextTierPoints = 1000;
  const progressPercent = (currentPoints / nextTierPoints) * 100;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success("Referral code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeem = (reward: Reward) => {
    if (currentPoints >= reward.points) {
      setCurrentPoints(prev => prev - reward.points);
      toast.success(`Redeemed ${reward.name}!`);
    } else {
      toast.error(`You need ${reward.points - currentPoints} more points`);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: "Join ISEXY!",
      text: `Join me on ISEXY - the best way to connect with amazing people! Use my referral code: ${referralCode}`,
      url: `https://isexy.ca/signup?ref=${referralCode}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        handleCopyCode();
      }
    } catch (err) {
      handleCopyCode();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Loyalty Rewards</h1>
        </div>
      </header>

      {/* Points Banner */}
      <div className="px-4 py-6 bg-gradient-to-br from-primary/20 via-primary/10 to-background">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
            <Coins className="w-10 h-10 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">Your Points Balance</p>
          <p className="text-4xl font-bold text-foreground">{currentPoints.toLocaleString()}</p>
          
          <div className="mt-4 max-w-xs mx-auto">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Bronze</span>
              <span className="text-primary font-medium">Silver at {nextTierPoints}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {nextTierPoints - currentPoints} points to next tier
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setSelectedTab("earn")}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            selectedTab === "earn"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Earn Points
        </button>
        <button
          onClick={() => setSelectedTab("redeem")}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            selectedTab === "redeem"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Redeem Rewards
        </button>
      </div>

      {selectedTab === "earn" ? (
        <>
          {/* Referral Section */}
          <div className="px-4 py-6">
            <div className="bg-gradient-to-r from-primary to-rose-500 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Refer Friends</h3>
                  <p className="text-sm text-white/80">Earn 200 points per referral</p>
                </div>
              </div>

              <div className="bg-white/20 rounded-xl p-3 mb-4">
                <p className="text-xs text-white/70 mb-1">Your referral code</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-lg">{referralCode}</span>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleShare}
                className="w-full bg-white text-primary hover:bg-white/90"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share with Friends
              </Button>
            </div>
          </div>

          {/* Ways to Earn */}
          <div className="px-4 pb-6">
            <h3 className="font-bold text-foreground mb-3">Ways to Earn</h3>
            <div className="space-y-3">
              {[
                { icon: Flame, label: "Daily Login", points: 5, color: "text-orange-500" },
                { icon: Star, label: "Complete Your Profile", points: 50, color: "text-cyan-500" },
                { icon: Users, label: "Refer a Friend", points: 200, color: "text-primary" },
                { icon: Trophy, label: "Get a Match", points: 25, color: "text-amber-500" },
                { icon: Sparkles, label: "First Message Sent", points: 10, color: "text-purple-500" },
                { icon: Crown, label: "Verify Your Profile", points: 100, color: "text-yellow-500" },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-card rounded-xl border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <span className="font-medium text-foreground">{item.label}</span>
                  </div>
                  <span className="font-bold text-primary">+{item.points}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="px-4 pb-8">
            <h3 className="font-bold text-foreground mb-3">Recent Activity</h3>
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {pointsHistory.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-foreground">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.date}</p>
                  </div>
                  <span className="font-bold text-green-500">+{item.points}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Redeem Section */
        <div className="px-4 py-6">
          <div className="grid grid-cols-1 gap-3">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="flex items-center justify-between p-4 bg-card rounded-xl border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    {reward.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{reward.name}</p>
                    <p className="text-sm text-muted-foreground">{reward.description}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleRedeem(reward)}
                  disabled={currentPoints < reward.points}
                  className={
                    currentPoints >= reward.points
                      ? "gradient-primary text-white"
                      : ""
                  }
                >
                  {reward.points}pts
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
