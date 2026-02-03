import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Sparkles, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export default function RedeemCode() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{
    code_type: string;
    subscription_tier: string;
    expires_at: string | null;
    description: string;
  } | null>(null);

  const handleRedeem = async () => {
    if (!code.trim() || !profile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("redeem_coupon", {
        p_code: code.toUpperCase(),
        p_profile_id: profile.id,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        code_type?: string;
        subscription_tier?: string;
        expires_at?: string;
        description?: string;
      };

      if (!result.success) {
        toast.error(result.error || "Failed to redeem code");
        return;
      }

      // Success!
      setSuccess({
        code_type: result.code_type || "vip",
        subscription_tier: result.subscription_tier || "platinum",
        expires_at: result.expires_at || null,
        description: result.description || "VIP Access activated!",
      });

      // Refresh profile to get updated premium status
      await refreshProfile();

      // Celebration!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast.success("🎉 Code redeemed successfully!");
    } catch (error: any) {
      console.error("Redeem error:", error);
      toast.error(error.message || "Failed to redeem code");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Welcome to {success.subscription_tier.charAt(0).toUpperCase() + success.subscription_tier.slice(1)}!</CardTitle>
            <CardDescription>{success.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1">Your Benefits</p>
              <ul className="text-sm space-y-1">
                <li>✨ Unlimited Likes</li>
                <li>💫 Unlimited Super Likes</li>
                <li>🚀 Free Boosts</li>
                <li>🌍 Passport Mode</li>
                <li>👀 See Who Likes You</li>
              </ul>
              {success.expires_at && (
                <p className="text-xs text-muted-foreground mt-3">
                  Valid until: {new Date(success.expires_at).toLocaleDateString()}
                </p>
              )}
              {!success.expires_at && (
                <p className="text-xs text-green-500 font-medium mt-3">
                  ✓ Permanent Access
                </p>
              )}
            </div>
            <Button onClick={() => navigate("/discover")} className="w-full">
              Start Exploring
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex items-center justify-center p-4 pt-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Redeem VIP Code</CardTitle>
            <CardDescription>
              Enter your VIP or promotional code to unlock premium features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Input
                placeholder="Enter your code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-center text-lg font-mono tracking-widest"
                maxLength={20}
              />
            </div>

            <Button
              onClick={handleRedeem}
              disabled={!code.trim() || loading}
              className="w-full bg-gradient-to-r from-primary to-accent"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {loading ? "Redeeming..." : "Redeem Code"}
            </Button>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Don't have a code?{" "}
                <button
                  onClick={() => navigate("/premium")}
                  className="text-primary hover:underline"
                >
                  View subscription plans
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
