import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Award, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiNotificationProps {
  show: boolean;
  badgeType: string | null;
  onClose: () => void;
}

const badgeInfo: Record<string, { label: string; reward: string; emoji: string }> = {
  "3_day": { label: "3 Day Streak", reward: "🎁 Unlocked: 1 Free Super Like", emoji: "🔥" },
  "7_day": { label: "7 Day Streak", reward: "🎁 Unlocked: Profile Boost", emoji: "⚡" },
  "14_day": { label: "14 Day Streak", reward: "🎁 Unlocked: 3 Free Super Likes", emoji: "💎" },
  "30_day": { label: "30 Day Streak", reward: "🎁 Unlocked: 1 Week Premium Trial", emoji: "👑" },
  "100_day": { label: "100 Day Streak", reward: "🎁 Unlocked: 1 Month Premium Free!", emoji: "🏆" },
};

export function ConfettiNotification({ show, badgeType, onClose }: ConfettiNotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show && badgeType) {
      setVisible(true);
      
      // Fire confetti
      const duration = 3 * 1000;
      const end = Date.now() + duration;

      const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#9B59B6"];

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();

      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        setVisible(false);
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [show, badgeType, onClose]);

  const info = badgeType ? badgeInfo[badgeType] : null;

  if (!info) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed top-4 left-4 right-4 z-[100] pointer-events-auto"
        >
          <div className="bg-gradient-to-r from-primary via-pink-500 to-orange-500 rounded-2xl p-1 shadow-2xl">
            <div className="bg-card rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{info.emoji}</span>
                    <h3 className="font-bold text-foreground text-lg">Badge Earned!</h3>
                  </div>
                  <p className="font-semibold text-foreground">{info.label}</p>
                  <p className="text-sm text-primary font-medium mt-1">{info.reward}</p>
                </div>
                <button
                  onClick={() => {
                    setVisible(false);
                    onClose();
                  }}
                  className="p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
