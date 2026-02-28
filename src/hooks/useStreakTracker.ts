import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Badge {
  id: string;
  badge_type: string;
  earned_at: string;
  streak_count: number;
}

const BADGE_THRESHOLDS = [
  { days: 3, type: "3_day" },
  { days: 7, type: "7_day" },
  { days: 14, type: "14_day" },
  { days: 30, type: "30_day" },
  { days: 100, type: "100_day" },
];

export function useStreakTracker() {
  const { profile } = useAuth();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [newBadge, setNewBadge] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const profileIdRef = useRef<string | null>(null);

  const clearNewBadge = useCallback(() => {
    setNewBadge(null);
    setShowConfetti(false);
  }, []);

  // Single initialization effect - runs once per profile
  useEffect(() => {
    const profileId = profile?.id;
    if (!profileId) {
      setLoading(false);
      return;
    }

    // Skip if already initialized for this profile
    if (initializedRef.current && profileIdRef.current === profileId) return;
    initializedRef.current = true;
    profileIdRef.current = profileId;

    const initialize = async () => {
      // 1. Calculate streak from localStorage
      const today = new Date().toDateString();
      const lastVisit = localStorage.getItem("last_visit_date");
      const storedStreak = parseInt(localStorage.getItem("current_streak") || "0", 10);
      const challengeStarted = localStorage.getItem("challenge_started");
      const modalShownToday = localStorage.getItem("modal_shown_date") === today;

      let newStreak = 1;
      if (lastVisit) {
        const lastDate = new Date(lastVisit);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) newStreak = storedStreak + 1;
        else if (diffDays === 0) newStreak = storedStreak;
        else newStreak = 1;
      }

      setCurrentStreak(newStreak);
      localStorage.setItem("current_streak", newStreak.toString());
      localStorage.setItem("last_visit_date", today);

      if (!challengeStarted && !modalShownToday && newStreak >= 3) {
        setShowModal(true);
        localStorage.setItem("modal_shown_date", today);
      }

      // 2. Fetch badges
      const { data: badges } = await supabase
        .from("streak_badges")
        .select("*")
        .eq("profile_id", profileId);
      
      const currentBadges = badges || [];
      setEarnedBadges(currentBadges);

      // 3. Update last active (fire and forget)
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", profileId)
        .then(() => {});

      // 4. Check and award new badges
      for (const threshold of BADGE_THRESHOLDS) {
        if (newStreak >= threshold.days) {
          const exists = currentBadges.some(b => b.badge_type === threshold.type);
          if (!exists) {
            const { error } = await supabase
              .from("streak_badges")
              .insert({
                profile_id: profileId,
                badge_type: threshold.type,
                streak_count: newStreak,
              });
            if (!error) {
              setNewBadge(threshold.type);
              setShowConfetti(true);
              // Refresh badges
              const { data: updated } = await supabase
                .from("streak_badges")
                .select("*")
                .eq("profile_id", profileId);
              if (updated) setEarnedBadges(updated);
              break; // Only award one badge at a time
            }
          }
        }
      }

      setLoading(false);
    };

    initialize();
  }, [profile?.id]);

  // Update last_active every 5 minutes
  useEffect(() => {
    const profileId = profile?.id;
    if (!profileId) return;

    const interval = setInterval(() => {
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", profileId)
        .then(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [profile?.id]);

  return {
    currentStreak,
    showModal,
    setShowModal,
    earnedBadges,
    newBadge,
    showConfetti,
    clearNewBadge,
    loading,
    hasBadge: (type: string) => earnedBadges.some(b => b.badge_type === type),
  };
}
