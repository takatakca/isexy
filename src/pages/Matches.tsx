import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Flame, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { OnlineStatusIndicator } from "@/components/OnlineStatusIndicator";
import { ContactMethodModal } from "@/components/ContactMethodModal";

interface Match {
  id: string;
  matched_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  last_message_read: boolean;
  other_profile: {
    id: string;
    first_name: string;
    age: number | null;
    city: string | null;
    last_active_at: string | null;
    photos: { photo_url: string }[];
  };
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const d = new Date();
  let age = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
  return age;
}

export default function Matches() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactModal, setContactModal] = useState<{
    matchId: string;
    otherName: string;
    otherPhotoUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (profile) {
      fetchMatches();
    }
  }, [profile]);

  const fetchMatches = async () => {
    if (!profile) return;

    const [matchesRes, blocksRes] = await Promise.all([
      supabase
        .from("matches")
        .select(`
          id,
          matched_at,
          last_message_at,
          profile1:profiles!matches_profile1_id_fkey(id, first_name),
          profile2:profiles!matches_profile2_id_fkey(id, first_name)
        `)
        .or(`profile1_id.eq.${profile.id},profile2_id.eq.${profile.id}`)
        .eq("is_active", true)
        .order("matched_at", { ascending: false }),
      supabase
        .from("blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${profile.id},blocked_id.eq.${profile.id}`),
    ]);

    if (matchesRes.error) {
      console.error("Error fetching matches:", matchesRes.error);
      setLoading(false);
      return;
    }

    const blockedIds = new Set<string>(
      (blocksRes.data || []).map((b: any) =>
        b.blocker_id === profile.id ? b.blocked_id : b.blocker_id
      )
    );

    const data = (matchesRes.data || []).filter((m: any) => {
      const otherId = m.profile1.id === profile.id ? m.profile2.id : m.profile1.id;
      return !blockedIds.has(otherId);
    });

    // Get photos, last_active, and unread messages for each match
    const matchesWithPhotos = await Promise.all(
      (data || []).map(async (match: any) => {
        const otherProfile = match.profile1.id === profile.id ? match.profile2 : match.profile1;
        
        const [photosResult, profileResult, unreadResult, lastMsgResult] = await Promise.all([
          supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", otherProfile.id)
            .order("position")
            .limit(1),
          supabase
            .from("profiles")
            .select("last_active_at, birth_date, city")
            .eq("id", otherProfile.id)
            .single(),
          supabase
            .from("messages")
            .select("id, is_read")
            .eq("match_id", match.id)
            .neq("sender_id", profile.id)
            .eq("is_read", false),
          supabase
            .from("messages")
            .select("content, created_at")
            .eq("match_id", match.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        return {
          id: match.id,
          matched_at: match.matched_at,
          last_message_at: match.last_message_at || lastMsgResult.data?.created_at || null,
          last_message_preview: lastMsgResult.data?.content || null,
          unread_count: unreadResult.data?.length || 0,
          last_message_read: (unreadResult.data?.length || 0) === 0,
          other_profile: {
            ...otherProfile,
            age: calcAge(profileResult.data?.birth_date || null),
            city: profileResult.data?.city || null,
            last_active_at: profileResult.data?.last_active_at || null,
            photos: photosResult.data || [],
          },
        };
      })
    );

    setMatches(matchesWithPhotos);
    setLoading(false);
  };

  // Subscribe to new matches
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel("matches-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
        },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <button
          onClick={() => navigate("/discover")}
          className="p-2 -ml-2 rounded-full hover:bg-muted/60 transition-colors"
          aria-label="Back to discover"
        >
          <Flame className="w-6 h-6 text-muted-foreground" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Matches
        </h1>
        <button
          onClick={() => navigate("/messages")}
          className="p-2 -mr-2 rounded-full hover:bg-muted/60 transition-colors"
          aria-label="Open messages"
        >
          <MessageCircle className="w-6 h-6 text-primary" />
        </button>
      </header>

      <main className="px-4 pt-4 safe-bottom">
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="w-14 h-14 rounded-full bg-muted/40 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 bg-muted/40 rounded animate-pulse" />
                    <div className="h-3 w-2/3 bg-muted/30 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-24 px-6">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-secondary/20 blur-2xl" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-xl shadow-primary/30">
                <Heart className="w-12 h-12 text-primary-foreground fill-current" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">No matches yet</h2>
            <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
              Keep swiping — your next great conversation is one tap away.
            </p>
            <button
              onClick={() => navigate("/discover")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow"
            >
              <Flame className="w-4 h-4" />
              Start swiping
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  New matches
                </h2>
                <span className="text-xs text-muted-foreground">{matches.length} total</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {matches.slice(0, 6).map((match) => (
                  <button
                    key={match.id}
                    onClick={() => setContactModal({
                      matchId: match.id,
                      otherName: match.other_profile.first_name,
                      otherPhotoUrl: match.other_profile.photos[0]?.photo_url,
                    })}
                    className="group relative aspect-square rounded-2xl overflow-hidden ring-1 ring-border/60 hover:ring-primary/60 transition-all"
                  >
                    {match.other_profile.photos[0] ? (
                      <img
                        src={match.other_profile.photos[0].photo_url}
                        alt={match.other_profile.first_name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center">
                        <span className="text-2xl font-bold text-muted-foreground">
                          {match.other_profile.first_name[0]}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <OnlineStatusIndicator
                        lastActiveAt={match.other_profile.last_active_at}
                        size="sm"
                      />
                    </div>
                    {match.unread_count > 0 && (
                      <div className="absolute top-2 left-2 min-w-[20px] h-5 px-1 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                        <span className="text-[10px] font-bold text-primary-foreground">
                          {match.unread_count > 9 ? "9+" : match.unread_count}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 pt-6">
                      <p className="text-white text-sm font-semibold truncate">
                        {match.other_profile.first_name}
                        {match.other_profile.age ? `, ${match.other_profile.age}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Messages
              </h2>
              <div className="space-y-2">
                {matches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => setContactModal({
                      matchId: match.id,
                      otherName: match.other_profile.first_name,
                      otherPhotoUrl: match.other_profile.photos[0]?.photo_url,
                    })}
                    className="w-full flex items-center gap-3 p-3 bg-card/60 backdrop-blur-sm rounded-2xl border border-border/60 hover:bg-card hover:border-primary/40 transition-all active:scale-[0.99]"
                  >
                    <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-border/40">
                      {match.other_profile.photos[0] ? (
                        <img
                          src={match.other_profile.photos[0].photo_url}
                          alt={match.other_profile.first_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center">
                          <span className="text-xl font-bold text-muted-foreground">
                            {match.other_profile.first_name[0]}
                          </span>
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-card rounded-full">
                        <OnlineStatusIndicator
                          lastActiveAt={match.other_profile.last_active_at}
                          size="sm"
                        />
                      </div>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h3 className={`font-bold truncate ${match.unread_count > 0 ? "text-foreground" : "text-foreground/90"}`}>
                          {match.other_profile.first_name}
                          {match.other_profile.age ? `, ${match.other_profile.age}` : ""}
                        </h3>
                        {match.last_message_at && (
                          <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                            {format(new Date(match.last_message_at), "MMM d")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        {match.last_message_preview && match.last_message_read && (
                          <CheckCheck className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                        <span className={`truncate ${match.unread_count > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {match.last_message_preview || "Say hi! 👋"}
                        </span>
                        {match.unread_count > 0 && (
                          <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary-foreground">
                              {match.unread_count > 9 ? "9+" : match.unread_count}
                            </span>
                          </span>
                        )}
                      </div>
                      {match.other_profile.city && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {match.other_profile.city}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Contact Method Modal */}
      {contactModal && (
        <ContactMethodModal
          isOpen={true}
          onClose={() => setContactModal(null)}
          matchId={contactModal.matchId}
          otherName={contactModal.otherName}
          otherPhotoUrl={contactModal.otherPhotoUrl}
        />
      )}
    </div>
  );
}
