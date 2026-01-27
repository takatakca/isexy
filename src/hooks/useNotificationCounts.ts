import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface NotificationCounts {
  unreadMessages: number;
  newMatches: number;
}

export function useNotificationCounts() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadMessages: 0,
    newMatches: 0,
  });

  useEffect(() => {
    if (!profile?.id) return;

    fetchCounts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('notification-counts')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'messages'
        },
        () => fetchCounts()
      )
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'matches'
        },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchCounts = async () => {
    if (!profile?.id) return;

    // Get unread messages count
    const { data: matches } = await supabase
      .from("matches")
      .select("id")
      .or(`profile1_id.eq.${profile.id},profile2_id.eq.${profile.id}`);

    if (matches) {
      const matchIds = matches.map(m => m.id);
      
      if (matchIds.length > 0) {
        const { count: unreadCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("match_id", matchIds)
          .neq("sender_id", profile.id)
          .eq("is_read", false);

        setCounts(prev => ({
          ...prev,
          unreadMessages: unreadCount || 0
        }));
      }
    }

    // Get new matches count (matches from last 24 hours that haven't been seen)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { count: matchCount } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`profile1_id.eq.${profile.id},profile2_id.eq.${profile.id}`)
      .gte("matched_at", oneDayAgo.toISOString());

    setCounts(prev => ({
      ...prev,
      newMatches: matchCount || 0
    }));
  };

  return counts;
}
