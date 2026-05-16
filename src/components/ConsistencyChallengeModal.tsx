import { X, Trophy, Flame, Zap, Star, Crown, Gift } from "lucide-react";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { StreakBadge } from "@/components/StreakBadge";
import { cn } from "@/lib/utils";

interface ConsistencyChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStreak: number;
  earnedBadges?: string[];
}

const MILESTONES = [
  { days: 3, badge: "3_day" as const, reward: "Priority visibility for 1 hour" },
  { days: 7, badge: "7_day" as const, reward: "1 Free Super Like" },
  { days: 14, badge: "14_day" as const, reward: "Profile Boost for 30 min" },
  { days: 30, badge: "30_day" as const, reward: "3 Free Super Likes + Badge" },
  { days: 100, badge: "100_day" as const, reward: "Exclusive Crown Badge + 5 Boosts" },
];

export function ConsistencyChallengeModal({ 
  isOpen, 
  onClose, 
  currentStreak,
  earnedBadges = []
}: ConsistencyChallengeModalProps) {
  const handleStartChallenge = () => {
    localStorage.setItem("challenge_started", new Date().toISOString());
    onClose();
  };

  const nextMilestone = MILESTONES.find(m => m.days > currentStreak);
  const daysToNext = nextMilestone ? nextMilestone.days - currentStreak : 0;

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="bg-card border-t border-border">
        <div className="p-6 pb-10 max-h-[85vh] overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 text-muted-foreground hover:text-foreground z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Header with flame animation */}
          <div className="text-center mb-6">
            <div className="relative inline-flex items-center justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center animate-pulse">
                <Flame className="w-10 h-10 text-white" />
              </div>
              {currentStreak > 0 && (
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {currentStreak}
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Consistency Challenge
            </h2>
            <p className="text-muted-foreground mt-1">
              {currentStreak > 0 
                ? `🔥 ${currentStreak} day streak!` 
                : "Start your streak today!"}
            </p>
          </div>

          {/* Progress bar to next milestone */}
          {nextMilestone && (
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Next reward in</span>
                <span className="text-primary font-bold">{daysToNext} days</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-primary rounded-full transition-all duration-500"
                  style={{ 
                    width: `${((currentStreak % nextMilestone.days) / nextMilestone.days) * 100}%` 
                  }}
                />
              </div>
              <div className="mt-2 flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
                <Gift className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground">{nextMilestone.reward}</span>
              </div>
            </div>
          )}

          {/* Badges collection */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              YOUR BADGES
            </h3>
            <div className="flex items-center justify-between">
              {MILESTONES.map((milestone) => (
                <StreakBadge
                  key={milestone.badge}
                  type={milestone.badge}
                  earned={earnedBadges.includes(milestone.badge) || currentStreak >= milestone.days}
                  size="md"
                  showLabel
                />
              ))}
            </div>
          </div>

          {/* Milestones list */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground">
              MILESTONES & REWARDS
            </h3>
            {MILESTONES.map((milestone, idx) => {
              const isAchieved = currentStreak >= milestone.days || earnedBadges.includes(milestone.badge);
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all",
                    isAchieved
                      ? "bg-primary/10 border-primary/30"
                      : "bg-card border-border"
                  )}
                >
                  <StreakBadge type={milestone.badge} earned={isAchieved} size="sm" />
                  <div className="flex-1">
                    <p className={cn(
                      "font-semibold",
                      isAchieved ? "text-primary" : "text-foreground"
                    )}>
                      {milestone.days} Day Streak
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {milestone.reward}
                    </p>
                  </div>
                  {isAchieved && (
                    <span className="text-xs font-bold text-primary">✓ EARNED</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pro tip */}
          <div className="bg-muted/50 rounded-xl p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Pro tip:</span> The more you use ISEXY, the better your chances of matching. Daily users are 3x more likely to find their match!
            </p>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleStartChallenge}
            className="w-full py-6 text-lg font-bold bg-gradient-to-r from-orange-500 to-primary text-white hover:opacity-90 rounded-full"
          >
            {currentStreak > 0 ? "Continue Streak" : "Start the Challenge"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Re-export the hook from the new location for backward compatibility
export { useStreakTracker } from "@/hooks/useStreakTracker";
