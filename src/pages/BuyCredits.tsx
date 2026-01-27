import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Check, Sparkles, Video, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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
  const { profile } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<string>("credits_25");
  const [isLoading, setIsLoading] = useState(false);
  const [currentCredits, setCurrentCredits] = useState(0);

  useState(() => {
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
  });

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
        body: { packageId: pkg.id, credits: pkg.credits + (pkg.bonus || 0), price: pkg.price },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate purchase");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Coins className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Buy Credits</h1>
              <p className="text-sm text-muted-foreground">$1 per minute of video chat</p>
            </div>
          </div>
        </div>

        {/* Current Balance */}
        <Card className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Your Balance</p>
                <p className="text-3xl font-bold text-foreground">{currentCredits} credits</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Coins className="w-7 h-7 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How it Works */}
        <div className="bg-muted/50 rounded-xl p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            How Video Credits Work
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              1 credit = 1 minute of video chat
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              Credits never expire
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              Get bonus credits with larger packages
            </li>
          </ul>
        </div>

        {/* Credit Packages */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Choose a Package</h3>
          
          {creditPackages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg.id)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                selectedPackage === pkg.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  selectedPackage === pkg.id ? "bg-primary" : "bg-muted"
                }`}>
                  <Coins className={`w-6 h-6 ${selectedPackage === pkg.id ? "text-white" : "text-muted-foreground"}`} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{pkg.credits} Credits</span>
                    {pkg.bonus && (
                      <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-500">
                        +{pkg.bonus} bonus
                      </Badge>
                    )}
                    {pkg.popular && (
                      <Badge className="text-xs bg-primary">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Popular
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ${pkg.price} · ${(pkg.price / (pkg.credits + (pkg.bonus || 0))).toFixed(2)}/credit
                  </p>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedPackage === pkg.id ? "border-primary bg-primary" : "border-muted-foreground"
              }`}>
                {selectedPackage === pkg.id && <Check className="w-4 h-4 text-white" />}
              </div>
            </button>
          ))}
        </div>

        {/* Purchase Button */}
        <Button
          onClick={handlePurchase}
          disabled={isLoading}
          className="w-full py-6 text-lg rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
        >
          <Zap className="w-5 h-5 mr-2" />
          {isLoading ? "Processing..." : `Buy ${creditPackages.find((p) => p.id === selectedPackage)?.credits} Credits`}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By purchasing, you agree to our Terms of Service. Credits are non-refundable.
        </p>
      </div>
    </AuthLayout>
  );
}
