import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchInbox } from "@/lib/inbox";

interface NotificationCounts {
  /** Unread messages, counted like the inbox (active matches, no blocks). */
  unreadMessages: number;
  /** Likes received that the member has not answered yet. */
  newLikes: number;
}

/**
 * Bottom-nav badges. One RPC (get_my_badge_counts); until it is deployed the
 * unread count comes from the inbox and the likes badge stays empty (members
 * cannot read swipes made on them directly).
 */
export function useNotificationCounts() {
  const { profile } = useAuth();
  const profileId = profile?.id;
  const isPremium = profile?.is_premium;
  const [counts, setCounts] = useState<NotificationCounts>({ unreadMessages: 0, newLikes: 0 });
  const timer = useRef<number>();

  const fetchCounts = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase.rpc("get_my_badge_counts");
    if (!error) {
      const row = data?.[0];
      setCounts({ unreadMessages: row?.unread_messages ?? 0, newLikes: row?.new_likes ?? 0 });
      return;
    }
    try {
      const inbox = await fetchInbox({ id: profileId, is_premium: isPremium });
      setCounts({ unreadMessages: inbox.reduce((n, c) => n + c.unread_count, 0), newLikes: 0 });
    } catch {
      // Keep the last known counts.
    }
  }, [profileId, isPremium]);

  useEffect(() => {
    if (!profileId) return;
    void fetchCounts();

    const schedule = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(fetchCounts, 500);
    };
    // A unique topic per mount: the bottom nav remounts on every page, and a
    // shared topic would hand the new nav the old, still-closing channel.
    const channel = supabase
      .channel(`notification-counts-${profileId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "isexy", table: "messages" }, schedule)
      .on("postgres_changes", { event: "*", schema: "isexy", table: "matches" }, schedule)
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [profileId, fetchCounts]);

  return counts;
}
