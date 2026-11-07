import { useState, useEffect } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Users, Copy, Share2, Check, Coins, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { forgetReferralCode, inviteLink, pendingReferralCode } from "@/lib/referral";

interface Referral {
  id: string;
  referral_code: string;
  status: string;
  bonus_credits: number;
  created_at: string;
  completed_at?: string;
}

export default function Referrals() {
  const { profile } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [friendCode, setFriendCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [codeFailed, setCodeFailed] = useState(false);
  const [creditsEarned, setCreditsEarned] = useState(0);

  // Code from an invite link (?ref=CODE) opened on this device.
  useEffect(() => {
    const pending = pendingReferralCode();
    if (pending) setFriendCode(pending);
  }, []);

  useEffect(() => {
    if (profile?.id) {
      fetchReferralData();
    }
  }, [profile?.id]);

  const fetchReferralData = async () => {
    // The code is created server-side on first use (profiles.referral_code is
    // not writable by members).
    const [{ data: code, error: codeError }, { data: rows }, { data: bonuses }] = await Promise.all([
      supabase.rpc("get_my_referral_code"),
      supabase
        .from("referrals")
        .select("id, referral_code, status, bonus_credits, created_at, completed_at")
        .eq("referrer_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("credit_transactions")
        .select("amount")
        .eq("profile_id", profile!.id)
        .eq("type", "referral_bonus"),
    ]);

    if (codeError) {
      setCodeFailed(true);
    } else if (typeof code === "string") {
      setReferralCode(code);
      setCodeFailed(false);
    }
    if (rows) setReferrals(rows as Referral[]);
    if (bonuses) setCreditsEarned(bonuses.reduce((sum, b) => sum + (b.amount ?? 0), 0));
    setLoading(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const shareCode = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join ISEXY!",
          text: `Join me on ISEXY: use my code ${referralCode} in Invite Friends within 30 days and we both get 10 credits.`,
          url: inviteLink(referralCode),
        });
      } catch (err) {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const applyFriendCode = async () => {
    if (!friendCode.trim()) {
      toast.error("Please enter a referral code");
      return;
    }
    setApplying(true);
    const { data, error } = await supabase.rpc("apply_referral_code", {
      p_friend_code: friendCode.toUpperCase(),
    });
    setApplying(false);
    const result = data as { success?: boolean; error?: string; credits?: number } | null;
    if (error || !result?.success) {
      toast.error(result?.error || "Couldn't apply the code. Please try again.");
      return;
    }
    toast.success(`You received ${result.credits ?? 10} credits!`);
    forgetReferralCode();
    setFriendCode("");
    fetchReferralData();
  };

  const completedReferrals = referrals.filter(r => r.status === "completed");

  return (
    <AuthLayout showBack variant="white">
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Invite Friends</h1>
          <p className="text-muted-foreground mt-1">
            Give 10 credits, get 10 credits for each friend who joins!
          </p>
          <p className="text-xs text-muted-foreground mt-1">1 credit = 1 minute of video or phone calls.</p>
        </div>

        {/* Your referral code */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Your Referral Code</CardTitle>
            <CardDescription>Share this code with friends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-muted rounded-xl p-4 text-center">
                <span className="text-2xl font-bold tracking-widest text-foreground">
                  {referralCode || (loading ? "…" : codeFailed ? "Unavailable" : "")}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14"
                onClick={copyToClipboard}
                disabled={!referralCode}
                aria-label="Copy your code"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </Button>
            </div>
            {codeFailed && (
              <p role="alert" className="text-xs text-muted-foreground mb-3">
                Your code could not be loaded. Check your connection and open this page again.
              </p>
            )}
            <Button onClick={shareCode} className="w-full" size="lg" disabled={!referralCode}>
              <Share2 className="w-5 h-5 mr-2" />
              Share Your Code
            </Button>
          </CardContent>
        </Card>

        {/* Apply friend's code */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Have a Friend's Code?</CardTitle>
            <CardDescription>New members (first 30 days): enter it to get 10 free credits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter code"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                className="uppercase"
                maxLength={16}
                aria-label="Friend's referral code"
              />
              <Button onClick={applyFriendCode} disabled={applying || !friendCode.trim()}>
                {applying ? "Applying..." : "Apply"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="text-3xl font-bold text-foreground">{completedReferrals.length}</p>
              <p className="text-sm text-muted-foreground">Friends Joined</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Coins className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <p className="text-3xl font-bold text-foreground">{creditsEarned}</p>
              <p className="text-sm text-muted-foreground">Credits Earned</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent referrals */}
        {referrals.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Referrals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {referrals.slice(0, 5).map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {ref.status === "completed" ? "Friend joined" : "Pending"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ref.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={ref.status === "completed" ? "default" : "secondary"}>
                    {ref.status === "completed" ? `+${ref.bonus_credits}` : "Pending"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* How it works */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-foreground">Share your code</p>
                <p className="text-sm text-muted-foreground">
                  Send your unique code to friends
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-foreground">Friend signs up</p>
                <p className="text-sm text-muted-foreground">
                  They enter your code in Invite Friends within 30 days
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-foreground">You both get credits!</p>
                <p className="text-sm text-muted-foreground">
                  10 credits each for video calls & more
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
