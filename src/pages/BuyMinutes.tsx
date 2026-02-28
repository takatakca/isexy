import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Video, MessageCircle, Check, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MinutePackage {
  id: string;
  minutes: number;
  price: number;
  perMinute: string;
  popular?: boolean;
}

const phonePackages: MinutePackage[] = [
  { id: "phone_20", minutes: 20, price: 9.99, perMinute: "$0.50" },
  { id: "phone_150", minutes: 150, price: 45.00, perMinute: "$0.30", popular: true },
  { id: "phone_450", minutes: 450, price: 90.00, perMinute: "$0.20" },
];

const videoPackages: MinutePackage[] = [
  { id: "video_20", minutes: 20, price: 15.00, perMinute: "$0.75" },
  { id: "video_150", minutes: 150, price: 100.00, perMinute: "$0.67", popular: true },
  { id: "video_450", minutes: 450, price: 250.00, perMinute: "$0.56" },
];

export default function BuyMinutes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<string>("phone_150");
  const [isLoading, setIsLoading] = useState(false);
  const [phoneBalance, setPhoneBalance] = useState(0);
  const [videoBalance, setVideoBalance] = useState(0);
  const [activeTab, setActiveTab] = useState("phone");

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Purchase successful! Minutes added to your account.");
    }
    if (searchParams.get("canceled") === "true") {
      toast.error("Purchase was canceled.");
    }
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
    if (!profile) { navigate("/auth"); return; }
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
      {packages.map((pkg) => (
        <button
          key={pkg.id}
          onClick={() => setSelectedPackage(pkg.id)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
            selectedPackage === pkg.id
              ? "border-primary bg-primary/10"
              : "border-border bg-card hover:border-primary/50"
          }`}
        >
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{pkg.minutes} minutes</span>
              {pkg.popular && (
                <Badge className="text-xs bg-primary">
                  <Sparkles className="w-3 h-3 mr-1" />Best Value
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              ${pkg.price.toFixed(2)} · {pkg.perMinute}/min
            </p>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            selectedPackage === pkg.id ? "border-primary bg-primary" : "border-muted-foreground"
          }`}>
            {selectedPackage === pkg.id && <Check className="w-4 h-4 text-primary-foreground" />}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <AuthLayout showBack variant="white">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Buy Minutes</h1>
          <p className="text-sm text-muted-foreground">Phone & video call packages</p>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4 text-center">
              <Phone className="w-6 h-6 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{phoneBalance}</p>
              <p className="text-xs text-muted-foreground">Phone min</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/10 border-emerald-500/30">
            <CardContent className="p-4 text-center">
              <Video className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{videoBalance}</p>
              <p className="text-xs text-muted-foreground">Video min</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedPackage(v === "phone" ? "phone_150" : "video_150"); }}>
          <TabsList className="w-full">
            <TabsTrigger value="phone" className="flex-1 gap-1">
              <Phone className="w-4 h-4" /> Phone
            </TabsTrigger>
            <TabsTrigger value="video" className="flex-1 gap-1">
              <Video className="w-4 h-4" /> Video
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="mt-4">
            <div className="bg-muted/50 rounded-xl p-3 mb-4">
              <p className="text-sm text-muted-foreground">
                <strong>Masked WhatsApp relay</strong> — your real number is never exposed. Verification code required before each call.
              </p>
            </div>
            {renderPackages(phonePackages)}
          </TabsContent>

          <TabsContent value="video" className="mt-4">
            <div className="bg-muted/50 rounded-xl p-3 mb-4">
              <p className="text-sm text-muted-foreground">
                <strong>Secure in-app video</strong> — end-to-end encrypted WebRTC connection. Auto-terminates when minutes reach 0.
              </p>
            </div>
            {renderPackages(videoPackages)}
          </TabsContent>
        </Tabs>

        <Button
          onClick={handlePurchase}
          disabled={isLoading}
          className="w-full py-6 text-lg rounded-full"
        >
          {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
          {isLoading ? "Processing..." : "Purchase Package"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Minutes never expire. Billed per minute, rounded up.
        </p>
      </div>
    </AuthLayout>
  );
}
