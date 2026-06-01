import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Video, Check, Sparkles, Loader2, ShieldCheck, Lock, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePaymentsGate } from "@/hooks/usePaymentsGate";

interface MinutePackage {
  id: string;
  minutes: number;
  price: number;
  perMinute: string;
  popular?: boolean;
}

const phonePackages: MinutePackage[] = [
  { id: "phone_20", minutes: 20, price: 9.99, perMinute: "$0.50" },
  { id: "phone_150", minutes: 150, price: 45.0, perMinute: "$0.30", popular: true },
  { id: "phone_450", minutes: 450, price: 90.0, perMinute: "$0.20" },
];

const videoPackages: MinutePackage[] = [
  { id: "video_20", minutes: 20, price: 15.0, perMinute: "$0.75" },
  { id: "video_150", minutes: 150, price: 100.0, perMinute: "$0.67", popular: true },
  { id: "video_450", minutes: 450, price: 250.0, perMinute: "$0.56" },
];

export default function BuyMinutes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const gate = usePaymentsGate();
  const [selectedPackage, setSelectedPackage] = useState<string>("phone_150");
  const [isLoading, setIsLoading] = useState(false);
  const [phoneBalance, setPhoneBalance] = useState(0);
  const [videoBalance, setVideoBalance] = useState(0);
  const [activeTab, setActiveTab] = useState("phone");

  useEffect(() => {
    if (searchParams.get("success") === "true") toast.success("Purchase successful! Minutes added.");
    if (searchParams.get("canceled") === "true") toast.error("Purchase was canceled.");
  }, [searchParams]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from("user_credits")
        .select("phone_minutes, video_minutes")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (data) {
        setPhoneBalance(data.phone_minutes || 0);
        setVideoBalance(data.video_minutes || 0);
      }
    };
    fetchBalance();
  }, [profile?.id]);

  const handlePurchase = async () => {
    if (!profile) {
      navigate("/auth");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-minute-purchase", {
        body: { packageId: selectedPackage },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate purchase");
    } finally {
      setIsLoading(false);
    }
  };

  const renderPackages = (packages: MinutePackage[]) => (
    <div className="space-y-3">
      {packages.map((pkg) => {
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
            <div className="text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground">{pkg.minutes} minutes</span>
                {pkg.popular && (
                  <Badge className="text-[10px] gradient-primary text-primary-foreground border-0">
                    <Sparkles className="w-3 h-3 mr-1" /> Best value
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">${pkg.price.toFixed(2)} · {pkg.perMinute}/min</p>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSel ? "border-primary bg-primary" : "border-muted-foreground"}`}>
              {isSel && <Check className="w-4 h-4 text-primary-foreground" />}
            </div>
          </button>
        );
      })}
    </div>
  );

  const currentPkg = [...phonePackages, ...videoPackages].find((p) => p.id === selectedPackage);

  return (
    <AuthLayout showBack variant="white">
      <div className="space-y-6 pb-40">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Buy Minutes</h1>
          <p className="text-sm text-muted-foreground">Phone & video call packages</p>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-2xl p-4 text-center">
            <Phone className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-foreground">{phoneBalance}</p>
            <p className="text-xs text-muted-foreground">Phone min</p>
          </div>
          <div className="glass-card rounded-2xl p-4 text-center">
            <Video className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-foreground">{videoBalance}</p>
            <p className="text-xs text-muted-foreground">Video min</p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            setSelectedPackage(v === "phone" ? "phone_150" : "video_150");
          }}
        >
          <TabsList className="w-full bg-card">
            <TabsTrigger value="phone" className="flex-1 gap-1 data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground">
              <Phone className="w-4 h-4" /> Phone
            </TabsTrigger>
            <TabsTrigger value="video" className="flex-1 gap-1 data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground">
              <Video className="w-4 h-4" /> Video
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="mt-4 space-y-3">
            <div className="glass-card rounded-2xl p-3 flex items-start gap-2">
              <EyeOff className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Phone calls use phone minutes.</strong> Your real number stays private — calls go through a masked relay.
              </p>
            </div>
            {renderPackages(phonePackages)}
          </TabsContent>

          <TabsContent value="video" className="mt-4 space-y-3">
            <div className="glass-card rounded-2xl p-3 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Video calls use video minutes.</strong> End-to-end encrypted WebRTC. Auto-ends when minutes hit zero.
              </p>
            </div>
            {renderPackages(videoPackages)}
          </TabsContent>
        </Tabs>

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
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : currentPkg ? `Buy ${currentPkg.minutes} minutes — $${currentPkg.price.toFixed(2)}` : "Purchase"}
        </button>
        <p className="text-[10px] text-muted-foreground text-center">Minutes never expire. Applied after successful payment.</p>
      </div>
    </AuthLayout>
  );
}
