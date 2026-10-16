import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Gift, Star, Zap, Crown, Trophy, Coins,
  Share2, Users, Copy, Check, Flame, Sparkles, Loader2, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { goBack } from "@/lib/navigation";
import { isMissingRpc } from "@/lib/payments";
import { inviteLink } from "@/lib/referral";
import { toast } from "sonner";

/** Rewards catalog. Ids and costs are the ones isexy.redeem_loyalty_reward() accepts. */
interface Reward {
  id: "super_like_1" | "boost_1" | "super_like_5" | "boost_3" | "gold_week" | "gold_month" | "platinum_week" | "platinum_month";
  name: string;
  points: number;
  icon: React.ReactNode;
  description: string;
}

const rewards: Reward[] = [
  { id: "super_like_1", name: "1 Super Like", points: 100, icon: <Star className="w-6 h-6 text-primary" />, description: "Stand out with a Super Like" },
  { id: "boost_1", name: "1 Boost", points: 250, icon: <Zap className="w-6 h-6 text-primary" />, description: "30 minutes at the top of Discover" },
  { id: "super_like_5", name: "5 Super Likes", points: 400, icon: <Star className="w-6 h-6 text-primary" />, description: "Bundle: save 20%" },
  { id: "boost_3", name: "3 Boosts", points: 600, icon: <Zap className="w-6 h-6 text-primary" />, description: "Bundle: save 20%" },
  { id: "gold_week", name: "1 Week Gold", points: 1000, icon: <Crown className="w-6 h-6 text-amber-500" />, description: "Gold features for 7 days" },
  { id: "gold_month", name: "1 Month Gold", points: 3000, icon: <Crown className="w-6 h-6 text-amber-500" />, description: "Gold features for 30 days" },
  { id: "platinum_week", name: "1 Week Platinum", points: 2000, icon: <Crown className="w-6 h-6 text-slate-400" />, description: "Platinum features for 7 days" },
  { id: "platinum_month", name: "1 Month Platinum", points: 5000, icon: <Crown className="w-6 h-6 text-slate-400" />, description: "Platinum features for 30 days" },
];

/** isexy.get_my_loyalty() */
interface Loyalty {
  points: number;
  lifetime_points: number;
  streak: number;
  longest_streak: number;
  history: { reason: string; points: number; detail: string | null; created_at: string }[];
  earned: string[];
}

// What the server pays for (0004_app_completion.sql part R9).
const waysToEarn = [
  { icon: Flame, label: "Open ISEXY each day", note: "once a day", points: 5, color: "text-orange-500", once: null },
  { icon: Star, label: "Complete your profile", note: "3 photos, a bio, 3 interests", points: 50, color: "text-primary", once: "profile_complete" },
  { icon: ShieldCheck, label: "Verify your profile", note: "once", points: 100, color: "text-primary", once: "verified" },
  { icon: Sparkles, label: "Send your first message", note: "once", points: 10, color: "text-primary", once: "first_message" },
  { icon: Trophy, label: "Get a match", note: "up to 4 a day", points: 25, color: "text-amber-500", once: null },
  { icon: Users, label: "A friend joins with your code", note: "up to 5 a month", points: 200, color: "text-primary", once: null },
  { icon: Flame, label: "3-day streak", note: "once", points: 25, color: "text-orange-500", once: null },
] as const;

const reasonLabel: Record<string, string> = {
  daily_visit: "Daily visit",
  profile_complete: "Profile completed",
  verified: "Profile verified",
  first_message: "First message sent",
  match: "New match",
  referral: "Friend joined with your code",
  streak_badge: "Streak badge",
};

function historyLabel(item: Loyalty["history"][number]): string {
  if (item.reason === "redeem") {
    const reward = rewards.find((r) => r.id === item.detail);
    return `Redeemed: ${reward?.name ?? "reward"}`;
  }
  return reasonLabel[item.reason] ?? item.detail ?? "Points";
}

function historyDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const redeemError: Record<string, string> = {
  not_enough_points: "You don't have enough points for this reward yet.",
  already_covered: "Your current plan already covers this reward.",
  unknown_reward: "This reward is not available.",
};

export default function LoyaltyRewards() {
  const navigate = useNavigate();
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeeming, setRedeeming] = useState<Reward["id"] | null>(null);
  const [selectedTab, setSelectedTab] = useState<"earn" | "redeem">("earn");

  const load = useCallback(async () => {
    const [{ data, error }, code] = await Promise.all([
      supabase.rpc("get_my_loyalty"),
      supabase.rpc("get_my_referral_code"),
    ]);
    if (!code.error && typeof code.data === "string") setReferralCode(code.data);
    if (error || !data) {
      setStatus(isMissingRpc(error) ? "unavailable" : "error");
      return;
    }
    setLoyalty(data as unknown as Loyalty);
    setStatus("ready");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const points = loyalty?.points ?? 0;
  // Progress towards the next reward the member cannot afford yet.
  const nextReward = rewards.slice().sort((a, b) => a.points - b.points).find((r) => r.points > points);
  const progressPercent = nextReward ? Math.min(100, (points / nextReward.points) * 100) : 100;

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Your code is " + referralCode);
    }
  };

  const handleRedeem = async (reward: Reward) => {
    setRedeeming(reward.id);
    const { data, error } = await supabase.rpc("redeem_loyalty_reward", { p_reward: reward.id });
    setRedeeming(null);
    const result = data as { success?: boolean; error?: string; points?: number; expires_at?: string | null } | null;
    if (error || !result?.success) {
      toast.error((result?.error && redeemError[result.error]) || "Couldn't redeem this reward. Please try again.");
      return;
    }
    const until = result.expires_at
      ? ` until ${new Date(result.expires_at).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
      : "";
    toast.success(`${reward.name} added to your account${until}.`);
    load();
  };

  const handleShare = async () => {
    if (!referralCode) return;
    const shareData = {
      title: "Join ISEXY!",
      text: `Join me on ISEXY, a Canadian social network to meet new people. Use my code ${referralCode} in Invite Friends within 30 days and we both get 10 credits.`,
      url: inviteLink(referralCode),
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await handleCopyCode();
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => goBack(navigate, "/profile")} className="p-2 -ml-2" aria-label="Back">
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
          {status === "loading" ? (
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" aria-label="Loading your points" />
          ) : status === "ready" ? (
            <>
              <p className="text-4xl font-bold text-foreground" data-testid="loyalty-points">{points.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <Flame className="w-3.5 h-3.5 inline -mt-0.5 text-orange-500" /> {loyalty?.streak ?? 0}-day streak
                {loyalty && loyalty.longest_streak > loyalty.streak ? ` · best ${loyalty.longest_streak}` : ""}
              </p>
              {nextReward && (
                <div className="mt-4 max-w-xs mx-auto">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Next reward</span>
                    <span className="text-primary font-medium">{nextReward.name}</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{nextReward.points - points} points to go</p>
                </div>
              )}
            </>
          ) : (
            <p role="status" className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
              {status === "unavailable"
                ? "Loyalty points are not switched on yet. Everything you do now will count once they are."
                : "Your points could not be loaded. Check your connection and try again."}
            </p>
          )}
          {status === "error" && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setStatus("loading"); load(); }}>
              Try again
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border" role="tablist">
        <button
          role="tab"
          aria-selected={selectedTab === "earn"}
          onClick={() => setSelectedTab("earn")}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            selectedTab === "earn" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          Earn Points
        </button>
        <button
          role="tab"
          aria-selected={selectedTab === "redeem"}
          onClick={() => setSelectedTab("redeem")}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            selectedTab === "redeem" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          Redeem Rewards
        </button>
      </div>

      {selectedTab === "earn" ? (
        <>
          {/* Referral Section */}
          <div className="px-4 py-6">
            <div className="gradient-primary rounded-2xl p-5 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Invite Friends</h3>
                  <p className="text-sm text-white/80">200 points for each friend who joins with your code</p>
                </div>
              </div>

              <div className="bg-white/20 rounded-xl p-3 mb-4">
                <p className="text-xs text-white/70 mb-1">Your referral code</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-lg">{referralCode ?? "…"}</span>
                  <button
                    onClick={handleCopyCode}
                    disabled={!referralCode}
                    aria-label="Copy your code"
                    className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button onClick={handleShare} disabled={!referralCode} className="w-full bg-white text-primary hover:bg-white/90">
                <Share2 className="w-4 h-4 mr-2" />
                Share with Friends
              </Button>
            </div>
          </div>

          {/* Ways to Earn */}
          <div className="px-4 pb-6">
            <h3 className="font-bold text-foreground mb-3">Ways to Earn</h3>
            <div className="space-y-3">
              {waysToEarn.map((item) => {
                const done = !!item.once && !!loyalty?.earned.includes(item.once);
                return (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{item.label}</span>
                        <p className="text-xs text-muted-foreground">{item.note}</p>
                      </div>
                    </div>
                    {done ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-primary"><Check className="w-4 h-4" /> Done</span>
                    ) : (
                      <span className="font-bold text-primary">+{item.points}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Streaks also give free Super Likes and Boosts at 7, 14, 30 and 100 days.
            </p>
          </div>

          {/* Recent Activity */}
          <div className="px-4 pb-8">
            <h3 className="font-bold text-foreground mb-3">Recent Activity</h3>
            {loyalty && loyalty.history.length > 0 ? (
              <div className="bg-card rounded-xl border border-border divide-y divide-border">
                {loyalty.history.map((item, index) => (
                  <div key={`${item.created_at}-${index}`} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-foreground">{historyLabel(item)}</p>
                      <p className="text-xs text-muted-foreground">{historyDate(item.created_at)}</p>
                    </div>
                    <span className={`font-bold ${item.points >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {item.points >= 0 ? `+${item.points}` : item.points}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {status === "ready" ? "No points yet. Come back tomorrow to start your streak." : "Nothing to show yet."}
              </p>
            )}
          </div>
        </>
      ) : (
        /* Redeem Section */
        <div className="px-4 py-6 pb-10">
          <div className="grid grid-cols-1 gap-3">
            {rewards.map((reward) => {
              const affordable = status === "ready" && points >= reward.points;
              return (
                <div key={reward.id} className="flex items-center justify-between gap-3 p-4 bg-card rounded-xl border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-muted flex items-center justify-center">{reward.icon}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{reward.name}</p>
                      <p className="text-sm text-muted-foreground">{reward.description}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleRedeem(reward)}
                    disabled={!affordable || redeeming !== null}
                    className={affordable ? "gradient-primary text-white shrink-0" : "shrink-0"}
                    aria-label={`Redeem ${reward.name} for ${reward.points} points`}
                  >
                    {redeeming === reward.id ? <Loader2 className="w-4 h-4 animate-spin" /> : `${reward.points} pts`}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Plan rewards add days on top of a reward plan already running and never replace a paid plan.
          </p>
        </div>
      )}
    </div>
  );
}
