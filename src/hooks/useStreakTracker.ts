import { useState, useEffect, useCallback } from "react";
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

  const fetchBadges = useCallback(async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("streak_badges")
      .select("*")
      .eq("profile_id", profile.id);

    if (!error && data) {
      setEarnedBadges(data);
    }
  }, [profile?.id]);

  const checkAndAwardBadges = useCallback(async (streak: number) => {
    if (!profile?.id) return;

    for (const threshold of BADGE_THRESHOLDS) {
      if (streak >= threshold.days) {
        const exists = earnedBadges.some(b => b.badge_type === threshold.type);
        if (!exists) {
          const { error } = await supabase
            .from("streak_badges")
            .insert({
              profile_id: profile.id,
              badge_type: threshold.type,
              streak_count: streak,
            });

          if (!error) {
            setNewBadge(threshold.type);
            setShowConfetti(true);
            fetchBadges();
          }
        }
      }
    }
  }, [profile?.id, earnedBadges, fetchBadges]);

  const clearNewBadge = useCallback(() => {
    setNewBadge(null);
    setShowConfetti(false);
  }, []);

  const updateLastActive = useCallback(async () => {
    if (!profile?.id) return;

    await supabase
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", profile.id);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

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

      if (diffDays === 1) {
        // Consecutive day
        newStreak = storedStreak + 1;
      } else if (diffDays === 0) {
        // Same day visit
        newStreak = storedStreak;
      } else {
        // Streak broken
        newStreak = 1;
      }
    }

    setCurrentStreak(newStreak);
    localStorage.setItem("current_streak", newStreak.toString());

    // Show modal on first visit or if challenge not started and not shown today
    if (!challengeStarted && !modalShownToday && newStreak >= 3) {
      setShowModal(true);
      localStorage.setItem("modal_shown_date", today);
    }

    localStorage.setItem("last_visit_date", today);

    // Fetch badges and update last active
    fetchBadges();
    updateLastActive();
    setLoading(false);

    // Check for new badges after streak is calculated
    checkAndAwardBadges(newStreak);
  }, [profile?.id, fetchBadges, updateLastActive, checkAndAwardBadges]);

  // Update last_active every 5 minutes while app is open
  useEffect(() => {
    if (!profile?.id) return;

    const interval = setInterval(updateLastActive, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [profile?.id, updateLastActive]);

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
