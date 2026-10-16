import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Flame, CheckCheck, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { OnlineStatusIndicator } from "@/components/OnlineStatusIndicator";
import { useChatOpener } from "@/hooks/useChatOpener";
import { fetchInbox } from "@/lib/inbox";
import { ageFrom } from "@/lib/discoverFeed";

interface Match {
  id: string;
  matched_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  /** The last message was sent by me (the tick only shows on my own messages). */
  last_message_mine: boolean | null;
  unread_count: number;
  is_unlocked: boolean;
  other_profile: {
    id: string;
    first_name: string;
    age: number | null;
    city: string | null;
    last_active_at: string | null;
    photos: { photo_url: string }[];
  };
}

export default function Matches() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const meId = profile?.id;
  const mePremium = profile?.is_premium;

  // Whole inbox in one RPC (get_my_conversations) + one query for ages/cities.
  const fetchMatches = useCallback(async () => {
    if (!meId) return;
    try {
      const inbox = await fetchInbox({ id: meId, is_premium: mePremium });
      const ids = inbox.map((c) => c.other_id);
      const { data: details } = ids.length
        ? await supabase.from("profiles").select("id, birth_date, city").in("id", ids)
        : { data: [] as { id: string; birth_date: string; city: string | null }[] };
      const detailBy = new Map((details ?? []).map((d) => [d.id, d]));

      setMatches(inbox.map((c) => {
        const d = detailBy.get(c.other_id);
        return {
          id: c.match_id,
          matched_at: c.matched_at,
          last_message_at: c.last_message_at,
          last_message_preview: c.last_message_preview,
          last_message_mine: c.last_message_mine,
          unread_count: c.unread_count,
          is_unlocked: c.is_unlocked,
          other_profile: {
            id: c.other_id,
            first_name: c.first_name,
            age: d?.birth_date ? ageFrom(d.birth_date) : null,
            city: d?.city ?? null,
            last_active_at: c.last_active_at,
            photos: c.photo_url ? [{ photo_url: c.photo_url }] : [],
          },
        };
      }));
      setLoadError(false);
    } catch (e) {
      console.error("Error fetching matches:", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [meId, mePremium]);

  useEffect(() => {
    void fetchMatches();
  }, [fetchMatches]);

  // Closing the contact sheet may have unlocked a conversation: refresh.
  const { openChat, contactModal } = useChatOpener({ onClose: () => void fetchMatches() });

  // New matches and messages refresh the list (RLS only delivers the member's own rows).
  // Topic per mount: a fixed topic can hand a remounted page the old, closing channel.
  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel(`matches-list-${meId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "isexy", table: "matches" }, () => void fetchMatches())
      .on("postgres_changes", { event: "INSERT", schema: "isexy", table: "messages" }, () => void fetchMatches())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, fetchMatches]);

  const open = (match: Match) => openChat({
    matchId: match.id,
    otherName: match.other_profile.first_name,
    otherPhotoUrl: match.other_profile.photos[0]?.photo_url,
    unlocked: match.is_unlocked,
  });

  return (
    <div className="min-h-screen bg-background pb-40">
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
          onClick={() => navigate("/matches")}
          className="p-2 -mr-2 rounded-full hover:bg-muted/60 transition-colors"
          aria-label="Open messages"
        >
          <MessageCircle className="w-6 h-6 text-primary" />
        </button>
      </header>

      <main className="px-4 pt-4 safe-bottom">
        {loading ? (
          <div className="space-y-6" aria-busy="true">
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
        ) : loadError && matches.length === 0 ? (
          <div className="text-center py-24 px-6" role="alert">
            <h2 className="text-2xl font-bold text-foreground mb-2">We couldn't load your matches</h2>
            <p className="text-muted-foreground mb-6">Check your connection and try again.</p>
            <button
              onClick={() => { setLoading(true); void fetchMatches(); }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
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
                {[...matches]
                  .sort((a, b) => new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime())
                  .slice(0, 6)
                  .map((match) => (
                  <button
                    key={match.id}
                    onClick={() => open(match)}
                    className="group relative aspect-square rounded-2xl overflow-hidden ring-1 ring-border/60 hover:ring-primary/60 transition-all"
                    aria-label={`Chat with ${match.other_profile.first_name}`}
                  >
                    {match.other_profile.photos[0] ? (
                      <img
                        src={match.other_profile.photos[0].photo_url}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
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
                    onClick={() => open(match)}
                    className="w-full flex items-center gap-3 p-3 bg-card/60 backdrop-blur-sm rounded-2xl border border-border/60 hover:bg-card hover:border-primary/40 transition-all active:scale-[0.99]"
                  >
                    <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-border/40">
                      {match.other_profile.photos[0] ? (
                        <img
                          src={match.other_profile.photos[0].photo_url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
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
                        {match.last_message_preview && match.last_message_mine && (
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
      {contactModal}
    </div>
  );
}
