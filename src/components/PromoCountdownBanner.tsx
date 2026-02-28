import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Clock, Sparkles } from "lucide-react";
import canvasConfetti from "canvas-confetti";

interface PromoCountdownBannerProps {
  onCtaClick: () => void;
  discountPercent?: number;
  durationMinutes?: number;
}

export function PromoCountdownBanner({
  onCtaClick,
  discountPercent = 50,
  durationMinutes = 30,
}: PromoCountdownBannerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const stored = sessionStorage.getItem("promo_end_time");
    if (stored) {
      const remaining = Math.max(0, parseInt(stored) - Date.now());
      return remaining;
    }
    const endTime = Date.now() + durationMinutes * 60 * 1000;
    sessionStorage.setItem("promo_end_time", endTime.toString());
    return durationMinutes * 60 * 1000;
  });

  const [hasConfetti, setHasConfetti] = useState(false);

  useEffect(() => {
    if (!hasConfetti) {
      setHasConfetti(true);
      canvasConfetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.3 },
        colors: ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"],
      });
    }
  }, [hasConfetti]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - 1000);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const isExpired = timeLeft <= 0;

  if (isExpired) return null;

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 20 }}
      className="mx-4 mb-4 rounded-2xl overflow-hidden"
    >
      <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 p-4 relative">
        {/* Sparkle decorations */}
        <Sparkles className="absolute top-2 right-3 w-5 h-5 text-white/40 animate-pulse" />
        <Sparkles className="absolute bottom-2 left-3 w-4 h-4 text-white/30 animate-pulse" />

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-5 h-5 text-white fill-white" />
              <span className="text-white font-bold text-lg">{discountPercent}% OFF</span>
            </div>
            <p className="text-white/90 text-sm font-medium">First week special offer</p>
          </div>

          <div className="text-center">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-white/80" />
              <span className="text-white/80 text-xs">Expires in</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="bg-white/20 rounded-lg px-2 py-1">
                <span className="text-white font-mono font-bold text-lg">
                  {String(minutes).padStart(2, "0")}
                </span>
              </div>
              <span className="text-white font-bold text-lg">:</span>
              <div className="bg-white/20 rounded-lg px-2 py-1">
                <span className="text-white font-mono font-bold text-lg">
                  {String(seconds).padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onCtaClick}
          className="w-full mt-3 py-2.5 rounded-full bg-white text-rose-600 font-bold text-sm hover:bg-white/90 transition-colors"
        >
          Claim Your {discountPercent}% Discount →
        </button>
      </div>
    </motion.div>
  );
}
