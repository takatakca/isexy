import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Coins, Check, Sparkles, Video, Phone, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePaymentsGate, blockedLabel } from "@/hooks/usePaymentsGate";
import { useWallet } from "@/hooks/useWallet";
import { useCheckoutReturn } from "@/hooks/useCheckoutReturn";
import { PaymentsNotice } from "@/components/PaymentsNotice";
import { cad, isMissingRpc, startCheckout } from "@/lib/payments";
import { track } from "@/lib/analytics";

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
  const gate = usePaymentsGate();
  const { wallet, refresh, setWallet } = useWallet();
  const [selectedPackage, setSelectedPackage] = useState<string>("credits_25");
  const [isLoading, setIsLoading] = useState(false);
  const [converting, setConverting] = useState<"video" | "phone" | null>(null);
  const [convertAmount, setConvertAmount] = useState(10);

  useCheckoutReturn(refresh, "Payment received. Your credits will appear in a few seconds.");

  const currentCredits = wallet?.credits ?? 0;
  const blocked = blockedLabel(gate);

  const handlePurchase = async () => {
    const pkg = creditPackages.find((p) => p.id === selectedPackage);
    if (!pkg) return;
    setIsLoading(true);
    track("checkout_started", { product: "BuyCredits" });
    const result = await startCheckout("isexy-create-credit-purchase", { packageId: pkg.id });
    if (!result.ok) {
      toast.error(result.message);
      setIsLoading(false);
    }
  };

  /** 1 credit = 1 minute of video or phone calls (isexy.convert_credits_to_minutes). */
  const convert = async (type: "video" | "phone") => {
    const amount = Math.min(Math.max(1, Math.floor(convertAmount)), currentCredits);
    if (!amount) return;
    setConverting(type);
    const { data, error } = await supabase.rpc("convert_credits_to_minutes", { p_credits: amount, p_type: type });
    setConverting(null);
    const r = data as { success?: boolean; error?: string; credits?: number; video_minutes?: number; phone_minutes?: number } | null;
    if (error || !r?.success) {
      toast.error(isMissingRpc(error) ? "Using credits for calls is not available yet." : r?.error === "not_enough_credits" ? "You don't have that many credits." : "Couldn't use your credits. Please try again.");
      return;
    }
    toast.success(`${amount} credits added as ${amount} ${type} minutes.`);
    if (wallet) setWallet({ ...wallet, credits: r.credits ?? 0, video_minutes: r.video_minutes ?? wallet.video_minutes, phone_minutes: r.phone_minutes ?? wallet.phone_minutes });
    else refresh();
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
              <p className="text-sm text-muted-foreground">1 credit = 1 minute of video or phone calls</p>
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

        {/* Use credits */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="font-bold text-foreground mb-1 flex items-center gap-2 text-sm">
            <Video className="w-4 h-4 text-primary" /> Use your credits for calls
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Turn credits into call minutes, 1 credit for 1 minute. Minutes never expire.
            {wallet && <> You have {wallet.video_minutes} video and {wallet.phone_minutes} phone minutes.</>}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="convert-amount" className="sr-only">Credits to use</label>
            <input
              id="convert-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(currentCredits, 1)}
              value={convertAmount}
              onChange={(e) => setConvertAmount(Number(e.target.value) || 0)}
              className="w-20 h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            />
            <button
              onClick={() => convert("video")}
              disabled={!currentCredits || !!converting}
              className="flex-1 h-10 rounded-full text-xs font-semibold gradient-primary text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-1"
            >
              {converting === "video" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Video className="w-4 h-4" /> Video min</>}
            </button>
            <button
              onClick={() => convert("phone")}
              disabled={!currentCredits || !!converting}
              className="flex-1 h-10 rounded-full text-xs font-semibold border border-primary text-primary disabled:opacity-40 flex items-center justify-center gap-1"
            >
              {converting === "phone" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Phone className="w-4 h-4" /> Phone min</>}
            </button>
          </div>
          {!currentCredits && <p className="text-[11px] text-muted-foreground mt-2">No credits yet: buy a pack below or invite friends (10 credits each).</p>}
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
                      {cad(pkg.price)} · {cad(pkg.price / (pkg.credits + (pkg.bonus || 0)))}/credit
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
          <ShieldCheck className="w-4 h-4 text-primary" /> Secure checkout by Stripe · prices in CAD
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        <PaymentsNotice gate={gate} />
        <button onClick={handlePurchase} disabled={isLoading || !!blocked} className="cta-primary w-full disabled:opacity-60">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : blocked ?? `Buy ${selected.credits + (selected.bonus ?? 0)} credits — ${cad(selected.price)} CAD`}
        </button>
        <p className="text-[10px] text-muted-foreground text-center">Credits are added once Stripe confirms the payment. Non-refundable.</p>
      </div>
    </AuthLayout>
  );
}
