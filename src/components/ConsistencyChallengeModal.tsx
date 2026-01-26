import { useState, useEffect } from "react";
import { X, Smartphone } from "lucide-react";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
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
  const handleStartChallenge = () => {
    localStorage.setItem("challenge_started", new Date().toISOString());
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="bg-card border-t border-border">
        <div className="p-6 pb-10">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Header */}
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            Consistency Challenge
          </h2>

          {/* Phone illustration */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-40 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center shadow-lg">
                <div className="w-20 h-36 bg-white rounded-xl p-1">
                  <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg grid grid-cols-4 gap-1 p-2">
                    {[...Array(12)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-3 h-3 rounded-sm ${
                          i === 0 ? 'bg-primary' : 
                          [1,2,5,7,10].includes(i) ? 'bg-pink-300' :
                          [3,4,6,8].includes(i) ? 'bg-blue-300' : 
                          'bg-green-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Hand illustration */}
              <div className="absolute -bottom-4 -right-4 w-16 h-20 bg-gradient-to-br from-red-400 to-red-500 rounded-full transform rotate-12 opacity-80" />
              {/* Notification dots */}
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
              <div className="absolute top-4 -right-4 w-3 h-3 bg-red-400 rounded-full animate-pulse delay-75" />
              <div className="absolute top-10 -right-2 w-2 h-2 bg-red-300 rounded-full animate-pulse delay-150" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-foreground text-center mb-2">
            Improve your chances of matching
          </h3>
          
          {/* Challenge description */}
          <p className="text-muted-foreground text-center mb-4">
            Challenge: Show up 7 days in a row to earn a reward!
          </p>

          {/* Pro tip */}
          <p className="text-sm text-muted-foreground text-center mb-8">
            <span className="font-semibold text-foreground">Pro tip:</span> The more you use CubaDate, the better your chances of matching are.
          </p>

          {/* CTA Button */}
          <Button
            onClick={handleStartChallenge}
            className="w-full py-6 text-lg font-bold bg-white text-foreground border border-border hover:bg-muted rounded-full"
          >
            Start the Challenge
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
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
    const challengeStarted = localStorage.getItem("challenge_started");
    const modalShownToday = localStorage.getItem("modal_shown_date") === today;

    if (lastVisit) {
      const lastDate = new Date(lastVisit);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        const newStreak = storedStreak + 1;
        setCurrentStreak(newStreak);
        localStorage.setItem("current_streak", newStreak.toString());
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

    // Show modal on first visit or if challenge not started and not shown today
    if (!challengeStarted && !modalShownToday) {
      setShowModal(true);
      localStorage.setItem("modal_shown_date", today);
    }

    localStorage.setItem("last_visit_date", today);
  }, []);

  return { currentStreak, showModal, setShowModal };
}
