import { useState, useEffect } from "react";
import { X, Flame, Gift, Trophy, Star } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConsistencyChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStreak: number;
}

export function ConsistencyChallengeModal({ 
  isOpen, 
  onClose, 
  currentStreak 
}: ConsistencyChallengeModalProps) {
  const [claimed, setClaimed] = useState(false);

  const rewards = [
    { day: 3, reward: "1 Free Super Like", icon: Star, claimed: currentStreak >= 3 },
    { day: 5, reward: "1 Free Boost", icon: Flame, claimed: currentStreak >= 5 },
    { day: 7, reward: "3 Free Super Likes", icon: Trophy, claimed: currentStreak >= 7 },
  ];

  const handleClaim = () => {
    setClaimed(true);
    localStorage.setItem("streak_reward_claimed", new Date().toDateString());
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background border-primary/20">
        <div className="relative">
          {/* Header with gradient */}
          <div className="gradient-primary p-6 text-center text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
              <Flame className="w-12 h-12 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold mb-1">
              {currentStreak} Day Streak! 🔥
            </h2>
            <p className="text-white/90 text-sm">
              You're on fire! Keep the momentum going.
            </p>
          </div>

          {/* Rewards section */}
          <div className="p-6 space-y-4">
            <h3 className="font-bold text-foreground text-center mb-4">
              Daily Streak Rewards
            </h3>

            <div className="space-y-3">
              {rewards.map(({ day, reward, icon: Icon, claimed: isEarned }) => (
                <div
                  key={day}
                  className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                    isEarned
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/50 border-border opacity-60"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isEarned ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{day} Days</p>
                    <p className="text-sm text-muted-foreground">{reward}</p>
                  </div>
                  {isEarned && (
                    <span className="text-xs font-semibold text-primary px-2 py-1 bg-primary/10 rounded-full">
                      Earned!
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Claim button */}
            {currentStreak >= 3 && !claimed && (
              <Button
                onClick={handleClaim}
                className="w-full py-6 text-lg font-bold gradient-primary hover:opacity-90"
              >
                <Gift className="w-5 h-5 mr-2" />
                Claim Your Reward
              </Button>
            )}

            {claimed && (
              <div className="text-center py-4">
                <p className="text-primary font-bold text-lg">🎉 Reward Claimed!</p>
              </div>
            )}

            {currentStreak < 3 && (
              <p className="text-center text-sm text-muted-foreground">
                Come back {3 - currentStreak} more day{3 - currentStreak !== 1 ? 's' : ''} to earn your first reward!
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage streak tracking
export function useStreakTracker() {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    const lastVisit = localStorage.getItem("last_visit_date");
    const storedStreak = parseInt(localStorage.getItem("current_streak") || "0", 10);
    const lastRewardClaim = localStorage.getItem("streak_reward_claimed");

    if (lastVisit) {
      const lastDate = new Date(lastVisit);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        const newStreak = storedStreak + 1;
        setCurrentStreak(newStreak);
        localStorage.setItem("current_streak", newStreak.toString());
        
        // Show modal at milestone days (3, 5, 7)
        if ([3, 5, 7].includes(newStreak) && lastRewardClaim !== today) {
          setShowModal(true);
        }
      } else if (diffDays === 0) {
        // Same day visit
        setCurrentStreak(storedStreak);
      } else {
        // Streak broken
        setCurrentStreak(1);
        localStorage.setItem("current_streak", "1");
      }
    } else {
      // First visit
      setCurrentStreak(1);
      localStorage.setItem("current_streak", "1");
    }

    localStorage.setItem("last_visit_date", today);
  }, []);

  return { currentStreak, showModal, setShowModal };
}
