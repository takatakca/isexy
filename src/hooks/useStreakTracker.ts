import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isMissingRpc } from "@/lib/payments";

interface Badge {
  badge_type: string;
}

/** isexy.record_daily_visit(): the streak, points and badges are decided on the server. */
interface VisitResult {
  streak: number;
  new_badges: string[];
  badges: string[];
  points_earned: number;
}

// The app opens this hook twice (StreakProvider and Discover): one visit per
// profile and page load.
let visit: { profileId: string; promise: Promise<VisitResult | null> } | null = null;

/** Before isexy.record_daily_visit is deployed: the old on-device count, display only (no rewards). */
function deviceStreak(): number {
  try {
    const today = new Date().toDateString();
    const lastVisit = localStorage.getItem("last_visit_date");
    const stored = parseInt(localStorage.getItem("current_streak") || "0", 10);
    let streak = 1;
    if (lastVisit) {
      const diffDays = Math.floor((new Date(today).getTime() - new Date(lastVisit).getTime()) / 86_400_000);
      if (diffDays === 1) streak = stored + 1;
      else if (diffDays === 0) streak = stored || 1;
    }
    localStorage.setItem("current_streak", String(streak));
    localStorage.setItem("last_visit_date", today);
    return streak;
  } catch {
    return 1;
  }
}

async function recordVisit(profileId: string): Promise<VisitResult | null> {
  const { data, error } = await supabase.rpc("record_daily_visit");
  if (!error && data) {
    const r = data as Partial<VisitResult>;
    return {
      streak: r.streak ?? 0,
      new_badges: Array.isArray(r.new_badges) ? r.new_badges : [],
      badges: Array.isArray(r.badges) ? r.badges : [],
      points_earned: r.points_earned ?? 0,
    };
  }
  if (isMissingRpc(error)) {
    const { data: badges } = await supabase.from("streak_badges").select("badge_type").eq("profile_id", profileId);
    return { streak: deviceStreak(), new_badges: [], badges: (badges ?? []).map((b) => b.badge_type), points_earned: 0 };
  }
  return null;
}

function todaysVisit(profileId: string): Promise<VisitResult | null> {
  if (!visit || visit.profileId !== profileId) {
    visit = { profileId, promise: recordVisit(profileId).catch(() => null) };
  }
  return visit.promise;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function useStreakTracker() {
  const { profile } = useAuth();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [newBadge, setNewBadge] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearNewBadge = useCallback(() => {
    setNewBadge(null);
    setShowConfetti(false);
  }, []);

  useEffect(() => {
    const profileId = profile?.id;
    if (!profileId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    todaysVisit(profileId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result) return;
      setCurrentStreak(result.streak);
      setEarnedBadges(result.badges.map((badge_type) => ({ badge_type })));
      if (result.new_badges.length > 0) {
        setNewBadge(result.new_badges[result.new_badges.length - 1]);
        setShowConfetti(true);
      }
      // The challenge sheet: once a day from a 3-day streak until started (device preference).
      const today = new Date().toDateString();
      if (!safeGet("challenge_started") && safeGet("modal_shown_date") !== today && result.streak >= 3) {
        setShowModal(true);
        safeSet("modal_shown_date", today);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Presence: last active now, then every 5 minutes.
  useEffect(() => {
    const profileId = profile?.id;
    if (!profileId) return;
    const touch = () => {
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", profileId)
        .then(() => {});
    };
    touch();
    const interval = setInterval(touch, 5 * 60 * 1000);
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
    hasBadge: (type: string) => earnedBadges.some((b) => b.badge_type === type),
  };
}
