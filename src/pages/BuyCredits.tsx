import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Coins, Check, Sparkles, Video, Loader2, ShieldCheck, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePaymentsGate } from "@/hooks/usePaymentsGate";

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  bonus?: number;
  popular?: boolean;
}

const creditPackages: CreditPackage[] = [
  { id: "credits_10", credits: 10, price: 9.99 },
  { id: "credits_25", credits: 25, price: 19.99, bonus: 5, popular: true },
  { id: "credits_50", credits: 50, price: 34.99, bonus: 15 },
  { id: "credits_100", credits: 100, price: 59.99, bonus: 40 },
];

export default function BuyCredits() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const gate = usePaymentsGate();
  const [selectedPackage, setSelectedPackage] = useState<string>("credits_25");
  const [isLoading, setIsLoading] = useState(false);
  const [currentCredits, setCurrentCredits] = useState(0);

  useEffect(() => {
    if (searchParams.get("success") === "true") toast.success("Purchase successful! Credits will appear shortly.");
    if (searchParams.get("canceled") === "true") toast.error("Purchase was canceled.");
  }, [searchParams]);

  useEffect(() => {
    const fetchCredits = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (data) setCurrentCredits(data.credits);
    };
    fetchCredits();
  }, [profile?.id]);

  const handlePurchase = async () => {
    if (!profile) {
      navigate("/auth");
      return;
    }
    setIsLoading(true);
    try {
      const pkg = creditPackages.find((p) => p.id === selectedPackage);
      if (!pkg) return;
      const { data, error } = await supabase.functions.invoke("create-credit-purchase", {
        body: { packageId: pkg.id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate purchase");
    } finally {
      setIsLoading(false);
    }
  };

  const selected = creditPackages.find((p) => p.id === selectedPackage)!;

  return (
    <AuthLayout showBack variant="white">
      <div className="space-y-6 pb-40">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
              <Coins className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">Buy Credits</h1>
              <p className="text-sm text-muted-foreground">1 credit = 1 minute of video chat</p>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your balance</p>
            <p className="text-3xl font-extrabold text-foreground">{currentCredits}<span className="text-base font-bold text-muted-foreground ml-1">credits</span></p>
          </div>
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
            <Coins className="w-7 h-7 text-primary" />
          </div>
        </div>

        {/* How it works */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2 text-sm">
            <Video className="w-4 h-4 text-primary" /> How video credits work
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />1 credit = 1 minute of video chat</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />Credits never expire</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />Bonus credits with larger packages</li>
          </ul>
        </div>

        {/* Packages */}
        <div className="space-y-3">
          <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">Choose a package</h3>
          {creditPackages.map((pkg) => {
            const isSel = selectedPackage === pkg.id;
            return (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  isSel
                    ? "border-primary bg-primary/10 ring-coral"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center ${isSel ? "gradient-primary" : "bg-muted"}`}>
                    <Coins className={`w-5 h-5 ${isSel ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{pkg.credits} Credits</span>
                      {pkg.bonus && <Badge className="text-[10px] bg-primary/15 text-primary border-0">+{pkg.bonus} bonus</Badge>}
                      {pkg.popular && <Badge className="text-[10px] gradient-primary text-primary-foreground border-0"><Sparkles className="w-3 h-3 mr-1" />Popular</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ${pkg.price.toFixed(2)} · ${(pkg.price / (pkg.credits + (pkg.bonus || 0))).toFixed(2)}/credit
                    </p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSel ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {isSel && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" /> Secure checkout powered by Stripe
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        {gate?.blocked && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5 justify-center">
            <Lock className="w-3.5 h-3.5" /> Live payments disabled during testing
          </div>
        )}
        <button onClick={handlePurchase} disabled={isLoading} className="cta-primary w-full">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Buy ${selected.credits} Credits — $${selected.price.toFixed(2)}`}
        </button>
        <p className="text-[10px] text-muted-foreground text-center">Credits applied after successful payment. Non-refundable.</p>
      </div>
    </AuthLayout>
  );
}
