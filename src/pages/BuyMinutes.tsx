import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Video, Check, Sparkles, Loader2, ShieldCheck, EyeOff, Coins } from "lucide-react";
import { toast } from "sonner";
import { usePaymentsGate, blockedLabel } from "@/hooks/usePaymentsGate";
import { useWallet } from "@/hooks/useWallet";
import { useCheckoutReturn } from "@/hooks/useCheckoutReturn";
import { PaymentsNotice } from "@/components/PaymentsNotice";
import { cad, startCheckout } from "@/lib/payments";
import { track } from "@/lib/analytics";

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
  const gate = usePaymentsGate();
  const { wallet, refresh } = useWallet();
  const [selectedPackage, setSelectedPackage] = useState<string>("phone_150");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("phone");

  useCheckoutReturn(refresh, "Checking payment confirmation. Your minutes will update after confirmation.");

  const phoneBalance = wallet?.phone_minutes ?? 0;
  const videoBalance = wallet?.video_minutes ?? 0;
  const blocked = blockedLabel(gate);

  const handlePurchase = async () => {
    setIsLoading(true);
    track("checkout_started", { product: "BuyMinutes" });
    const result = await startCheckout("isexy-create-minute-purchase", { packageId: selectedPackage });
    if (!result.ok) {
      toast.error(result.message);
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
            aria-pressed={isSel}
            className={`w-full min-h-[4.5rem] flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
              isSel
                ? "border-primary bg-primary/15 ring-brand"
                : "border-foreground/10 bg-card hover:border-primary/40"
            }`}
          >
            <div className="text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-foreground">{pkg.minutes} minutes</span>
                {pkg.popular && (
                  <Badge className="text-[10px] gradient-primary text-primary-foreground border-0">
                    <Sparkles className="w-3 h-3 mr-1" /> Best value
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{cad(pkg.price)} · {pkg.perMinute}/min</p>
            </div>
            <div className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center ${isSel ? "border-primary bg-primary" : "border-input"}`}>
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
          <p className="eyebrow mb-2">Calls · minutes never expire</p>
          <h1 className="type-title text-foreground">Buy Minutes</h1>
          <p className="text-sm text-muted-foreground mt-1">Phone & video call packages</p>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3">
          <div className="panel p-4 text-center">
            <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30"><Phone className="w-5 h-5 text-primary" /></span>
            <p className="font-display text-3xl font-extrabold text-foreground">{phoneBalance}</p>
            <p className="text-xs text-muted-foreground">Phone min</p>
          </div>
          <div className="panel p-4 text-center">
            <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/30"><Video className="w-5 h-5 text-accent" /></span>
            <p className="font-display text-3xl font-extrabold text-foreground">{videoBalance}</p>
            <p className="text-xs text-muted-foreground">Video min</p>
          </div>
        </div>

        {!!wallet?.credits && (
          <button
            onClick={() => navigate("/buy-credits")}
            className="w-full min-h-11 rounded-2xl border border-primary/30 bg-primary/10 p-3 flex items-center gap-2 text-left text-xs text-foreground hover:bg-primary/15 transition-colors"
          >
            <Coins className="w-4 h-4 text-primary shrink-0" />
            <span>You have <strong>{wallet.credits} credits</strong>: use them as call minutes (1 credit = 1 minute).</span>
          </button>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            setSelectedPackage(v === "phone" ? "phone_150" : "video_150");
          }}
        >
          <TabsList className="w-full bg-card rounded-full">
            <TabsTrigger value="phone" className="flex-1 gap-1 rounded-full">
              <Phone className="w-4 h-4" /> Phone
            </TabsTrigger>
            <TabsTrigger value="video" className="flex-1 gap-1 rounded-full">
              <Video className="w-4 h-4" /> Video
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="mt-4 space-y-3">
            <div className="rounded-2xl border border-foreground/[0.08] bg-card/60 p-3 flex items-start gap-2">
              <EyeOff className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Phone calls use phone minutes.</strong> Your real number stays private — calls go through a masked relay.
              </p>
            </div>
            {renderPackages(phonePackages)}
          </TabsContent>

          <TabsContent value="video" className="mt-4 space-y-3">
            <div className="rounded-2xl border border-foreground/[0.08] bg-card/60 p-3 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Video calls use video minutes.</strong> End-to-end encrypted WebRTC. Auto-ends when minutes hit zero.
              </p>
            </div>
            {renderPackages(videoPackages)}
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" /> Secure checkout by Stripe · prices in CAD
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-foreground/10 bg-background/90 backdrop-blur-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg space-y-2">
        <PaymentsNotice gate={gate} />
        <button onClick={handlePurchase} disabled={isLoading || !!blocked} className="cta-primary w-full h-14 text-base disabled:opacity-60">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : blocked ?? (currentPkg ? `Buy ${currentPkg.minutes} minutes — ${cad(currentPkg.price)} CAD` : "Purchase")}
        </button>
        <p className="text-[10px] text-muted-foreground text-center">Minutes never expire. Added once Stripe confirms the payment.</p>
        </div>
      </div>
    </AuthLayout>
  );
}
