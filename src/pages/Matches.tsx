import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Flame, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { OnlineStatusIndicator } from "@/components/OnlineStatusIndicator";

interface Match {
  id: string;
  matched_at: string;
  last_message_at: string | null;
  unread_count: number;
  last_message_read: boolean;
  other_profile: {
    id: string;
    first_name: string;
    last_active_at: string | null;
    photos: { photo_url: string }[];
  };
}

export default function Matches() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchMatches();
    }
  }, [profile]);

  const fetchMatches = async () => {
    if (!profile) return;

    const { data, error } = await supabase
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
      .order("matched_at", { ascending: false });

    if (error) {
      console.error("Error fetching matches:", error);
      setLoading(false);
      return;
    }

    // Get photos, last_active, and unread messages for each match
    const matchesWithPhotos = await Promise.all(
      (data || []).map(async (match: any) => {
        const otherProfile = match.profile1.id === profile.id ? match.profile2 : match.profile1;
        
        const [photosResult, profileResult, unreadResult] = await Promise.all([
          supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", otherProfile.id)
            .order("position")
            .limit(1),
          supabase
            .from("profiles")
            .select("last_active_at")
            .eq("id", otherProfile.id)
            .single(),
          supabase
            .from("messages")
            .select("id, is_read")
            .eq("match_id", match.id)
            .neq("sender_id", profile.id)
            .eq("is_read", false),
        ]);

        return {
          id: match.id,
          matched_at: match.matched_at,
          last_message_at: match.last_message_at,
          unread_count: unreadResult.data?.length || 0,
          last_message_read: (unreadResult.data?.length || 0) === 0,
          other_profile: {
            ...otherProfile,
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => navigate("/discover")} className="p-2">
          <Flame className="w-6 h-6 text-muted-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Matches</h1>
        <button onClick={() => navigate("/messages")} className="p-2">
          <MessageCircle className="w-6 h-6 text-primary" />
        </button>
      </header>

      <main className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">No matches yet</h2>
            <p className="text-muted-foreground">
              Keep swiping to find your perfect match!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">
              Your Matches ({matches.length})
            </h2>

            {/* New Matches Grid */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {matches.slice(0, 6).map((match) => (
                <button
                  key={match.id}
                  onClick={() => navigate(`/chat/${match.id}`)}
                  className="relative aspect-square rounded-xl overflow-hidden"
                >
                  {match.other_profile.photos[0] ? (
                    <img
                      src={match.other_profile.photos[0].photo_url}
                      alt={match.other_profile.first_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-2xl font-bold text-muted-foreground">
                        {match.other_profile.first_name[0]}
                      </span>
                    </div>
                  )}
                  {/* Online status indicator */}
                  <div className="absolute top-2 right-2">
                    <OnlineStatusIndicator 
                      lastActiveAt={match.other_profile.last_active_at} 
                      size="sm"
                    />
                  </div>
                  {/* Unread badge */}
                  {match.unread_count > 0 && (
                    <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {match.unread_count > 9 ? "9+" : match.unread_count}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 p-2">
                    <p className="text-white text-sm font-semibold truncate">
                      {match.other_profile.first_name}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Match List */}
            <div className="space-y-2">
              {matches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => navigate(`/chat/${match.id}`)}
                  className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                    {match.other_profile.photos[0] ? (
                      <img
                        src={match.other_profile.photos[0].photo_url}
                        alt={match.other_profile.first_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-xl font-bold text-muted-foreground">
                          {match.other_profile.first_name[0]}
                        </span>
                      </div>
                    )}
                    {/* Online indicator on avatar */}
                    <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-card rounded-full">
                      <OnlineStatusIndicator 
                        lastActiveAt={match.other_profile.last_active_at} 
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground truncate">
                        {match.other_profile.first_name}
                      </h3>
                      {match.unread_count > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {match.unread_count > 9 ? "9+" : match.unread_count}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      {/* Read receipt indicator */}
                      {match.last_message_at && match.last_message_read && (
                        <CheckCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="truncate">
                        {match.last_message_at
                          ? `Last message ${format(new Date(match.last_message_at), "MMM d")}`
                          : "Say hi! 👋"}
                      </span>
                    </div>
                  </div>
                  <MessageCircle className="w-5 h-5 text-primary flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
