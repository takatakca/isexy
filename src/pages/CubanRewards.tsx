import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Star, Users, MessageSquare, Video, Gift, 
  Trophy, Coins, TrendingUp, ChevronRight, Crown, Zap,
  UserPlus, Heart, Phone, Flame, Sparkles, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface PointsTransaction {
  id: string;
  profile_id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

interface CubanPointsData {
  points: number;
  lifetime_points: number;
}

const tierThresholds = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
  diamond: 10000,
};

const getTier = (lifetimePoints: number) => {
  if (lifetimePoints >= tierThresholds.diamond) return { name: "Diamond", color: "text-cyan-400", next: null, progress: 100 };
  if (lifetimePoints >= tierThresholds.platinum) return { name: "Platinum", color: "text-slate-400", next: tierThresholds.diamond, progress: ((lifetimePoints - tierThresholds.platinum) / (tierThresholds.diamond - tierThresholds.platinum)) * 100 };
  if (lifetimePoints >= tierThresholds.gold) return { name: "Gold", color: "text-amber-400", next: tierThresholds.platinum, progress: ((lifetimePoints - tierThresholds.gold) / (tierThresholds.platinum - tierThresholds.gold)) * 100 };
  if (lifetimePoints >= tierThresholds.silver) return { name: "Silver", color: "text-gray-400", next: tierThresholds.gold, progress: ((lifetimePoints - tierThresholds.silver) / (tierThresholds.gold - tierThresholds.silver)) * 100 };
  return { name: "Bronze", color: "text-orange-400", next: tierThresholds.silver, progress: (lifetimePoints / tierThresholds.silver) * 100 };
};

const earningOpportunities = [
  { icon: UserPlus, label: "Invite a Friend", points: 100, description: "When they sign up", color: "text-primary" },
  { icon: MessageSquare, label: "Chat with Match", points: 5, description: "Per conversation (daily)", color: "text-blue-400" },
  { icon: Video, label: "Video Call", points: 25, description: "Per completed call", color: "text-purple-500" },
  { icon: Video, label: "Video Call (30+ min)", points: 50, description: "Bonus for longer calls", color: "text-purple-600" },
  { icon: Star, label: "Get Super Liked", points: 15, description: "Someone super liked you", color: "text-cyan-500" },
  { icon: Heart, label: "Receive a Gift", points: 10, description: "When someone donates to you", color: "text-red-400" },
  { icon: Flame, label: "Daily Login Streak", points: 10, description: "Login daily for bonus", color: "text-orange-500" },
  { icon: Trophy, label: "Profile Verification", points: 200, description: "One-time bonus", color: "text-yellow-500" },
];

export default function CubanRewards() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [pointsData, setPointsData] = useState<CubanPointsData | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"earn" | "history" | "redeem">("earn");

  useEffect(() => {
    if (profile?.id) {
      fetchPointsData();
      fetchTransactions();
    }
  }, [profile?.id]);

  const fetchPointsData = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("cuban_points")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching points:", error);
      return;
    }

    if (data) {
      setPointsData(data);
    } else {
      // Create initial points record
      const { data: newData, error: insertError } = await supabase
        .from("cuban_points")
        .insert({ profile_id: profile.id, points: 0, lifetime_points: 0 })
        .select()
        .single();
      
      if (!insertError && newData) {
        setPointsData(newData);
      }
    }
    
    setLoading(false);
  };

  const fetchTransactions = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("cuban_points_transactions")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching transactions:", error);
      return;
    }

    setTransactions(data || []);
  };

  const tier = pointsData ? getTier(pointsData.lifetime_points) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Cuban Rewards</h1>
            <p className="text-sm text-muted-foreground">Earn points, get rewards</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/cuban-cashout")}>
            <Coins className="w-4 h-4 mr-2" />
            Cash Out
          </Button>
        </div>
      </header>

      {/* Points Banner */}
      <div className="px-4 py-6">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-white/80">Available Points</p>
                <p className="text-4xl font-bold">{pointsData?.points?.toLocaleString() || 0}</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Coins className="w-8 h-8" />
              </div>
            </div>

            {tier && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crown className={`w-5 h-5 ${tier.color}`} />
                    <span className="font-semibold">{tier.name} Tier</span>
                  </div>
                  {tier.next && (
                    <span className="text-sm text-white/70">
                      {tier.next - (pointsData?.lifetime_points || 0)} pts to next tier
                    </span>
                  )}
                </div>
                <Progress value={tier.progress} className="h-2 bg-white/20" />
                <p className="text-xs text-white/70 mt-1">
                  Lifetime: {pointsData?.lifetime_points?.toLocaleString() || 0} points
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { id: "earn", label: "Earn Points" },
          { id: "history", label: "History" },
          { id: "redeem", label: "Redeem" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              selectedTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 py-6">
        {selectedTab === "earn" && (
          <div className="space-y-3">
            <h3 className="font-bold text-foreground mb-4">Ways to Earn Points</h3>
            {earningOpportunities.map((item, index) => (
              <Card key={index} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                      +{item.points}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Invite Friends CTA */}
            <Card className="bg-gradient-to-r from-primary/20 to-rose-500/20 border-primary/30 mt-6">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <h4 className="font-bold text-foreground mb-1">Invite Friends</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Earn 100 points for each friend who joins ISEXY!
                </p>
                <Button onClick={() => navigate("/referrals")} className="gradient-primary">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Now
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "history" && (
          <div>
            <h3 className="font-bold text-foreground mb-4">Points History</h3>
            {transactions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">Start earning points by chatting and making connections!</p>
              </div>
            ) : (
              <Card className="bg-card border-border divide-y divide-border overflow-hidden">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {tx.description || tx.transaction_type.replace("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <span className={`font-bold ${tx.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {selectedTab === "redeem" && (
          <div>
            <h3 className="font-bold text-foreground mb-4">Redeem Your Points</h3>
            
            <Card 
              className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer mb-4"
              onClick={() => navigate("/cuban-cashout")}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <Coins className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Cash Out to CUP</p>
                      <p className="text-sm text-muted-foreground">Transfer to TransferMóvil or EnZona</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate("/get-boosts")}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Get Boosts</p>
                      <p className="text-sm text-muted-foreground">Get more visibility on the app</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 p-4 bg-muted/50 rounded-xl">
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Higher Tiers = Better Rates</p>
                  <p className="text-sm text-muted-foreground">
                    Reach higher tiers to unlock better conversion rates when cashing out your points!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
