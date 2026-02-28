import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface PromoOffer {
  promo_id: string;
  offer_price: number;
  renewal_price: number;
  discount_percent: number;
  expires_at: string;
}

interface PromoOfferBannerProps {
  profileId: string;
  tier?: string;
}

export default function PromoOfferBanner({ profileId, tier = "gold" }: PromoOfferBannerProps) {
  const navigate = useNavigate();
  const [offer, setOffer] = useState<PromoOffer | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkEligibility = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("check_promo_eligibility", {
        p_profile_id: profileId,
        p_tier: tier,
      });
      const result = data as unknown as Record<string, unknown>;
      if (!error && result?.eligible) {
        setOffer(result as unknown as PromoOffer);
      }
    } catch (e) {
      console.error("Promo check error:", e);
    } finally {
      setLoading(false);
    }
  }, [profileId, tier]);

  useEffect(() => {
    if (profileId) checkEligibility();
  }, [profileId, checkEligibility]);

  // Countdown timer
  useEffect(() => {
    if (!offer?.expires_at) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(offer.expires_at).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        setOffer(null);
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [offer?.expires_at]);

  if (loading || !offer || dismissed) return null;

  const tierColors: Record<string, string> = {
    plus: "from-rose-500 to-pink-600",
    gold: "from-amber-400 to-yellow-600",
    platinum: "from-slate-500 to-slate-700",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-r ${tierColors[tier] || tierColors.gold} text-white relative overflow-hidden`}
      >
        {/* Sparkle effects */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white/60 rounded-full"
              style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
            Expires soon
          </span>
        </div>

        <h3 className="text-xl font-bold mb-1">
          Get {offer.discount_percent}% Off your first week
        </h3>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold">${offer.offer_price.toFixed(2)}</span>
          <span className="text-sm line-through opacity-70">
            ${offer.renewal_price.toFixed(2)}/wk
          </span>
        </div>
        <p className="text-xs opacity-80 mb-3">
          Renews at ${offer.renewal_price.toFixed(2)} after first week.
        </p>

        <div className="text-center mb-3">
          <span className="text-sm font-medium">Offer ends in </span>
          <span className="font-bold text-lg font-mono">{timeLeft}</span>
        </div>

        <button
          onClick={() => navigate("/premium")}
          className="w-full py-3 rounded-full bg-white/20 hover:bg-white/30 font-bold text-lg transition-colors flex items-center justify-center gap-2"
        >
          <Flame className="w-5 h-5 fill-current" />
          Continue
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
