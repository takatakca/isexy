import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Crown, Heart, Loader2, Lock, RefreshCw, Star, X } from "lucide-react";
import { toast } from "sonner";
import { MatchCelebration } from "@/components/MatchCelebration";
import { AdSlot } from "@/components/AdSlot";
import { listAdAfterIndex } from "@/lib/ads";
import { useAuth } from "@/hooks/useAuth";
import { useChatOpener } from "@/hooks/useChatOpener";
import { ageFrom } from "@/lib/discoverFeed";
import {
  canSeeWhoLiked,
  fetchLikesReceived,
  LikesUnavailableError,
  performSwipe,
  type ReceivedLike,
  type SwipeAction,
} from "@/lib/likes";

const PAGE = 30;

/**
 * People who liked the member and are waiting for an answer. Gold / Platinum
 * see who they are and can like back (a mutual like is a match → chat) or
 * pass; other plans see how many, blurred, with an upgrade button.
 * Pages of 30, loaded as the member scrolls.
 */
export function LikesReceivedGrid() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canSee = canSeeWhoLiked(profile?.subscription_tier);
  const { openChat, contactModal } = useChatOpener();

  const [likers, setLikers] = useState<ReceivedLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<"unavailable" | "error" | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [match, setMatch] = useState<{ matchId: string; name: string; photoUrl?: string } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const load = useCallback(async (mode: "first" | "more") => {
    if (busy.current) return;
    busy.current = true;
    if (mode === "first") setLoading(true);
    else setLoadingMore(true);
    try {
      const before = mode === "more" ? likers[likers.length - 1]?.liked_at : undefined;
      const rows = await fetchLikesReceived({ limit: PAGE, before });
      setLikers((prev) => (mode === "first" ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE);
      setError(null);
    } catch (e) {
      console.error("Error fetching likes:", e);
      if (mode === "first") setError(e instanceof LikesUnavailableError ? "unavailable" : "error");
      else toast.error("Couldn't load more likes.");
    } finally {
      busy.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [likers]);

  const meId = profile?.id;
  const tier = profile?.subscription_tier;
  useEffect(() => {
    if (meId) load("first");
    // Reload when the member or their plan changes, not on every page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, tier]);

  // Infinite scroll: fetch the next page when the end of the grid shows up.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) load("more");
    }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, load]);

  const handleAction = async (liker: ReceivedLike, action: SwipeAction) => {
    if (!profile || !liker.liker_id) return;
    if (!canSee) {
      navigate("/premium");
      return;
    }
    const likerId = liker.liker_id;
    setActing(likerId);
    try {
      const outcome = await performSwipe(profile, likerId, action);
      switch (outcome.status) {
        case "ok":
          setLikers((prev) => prev.filter((l) => l.liker_id !== likerId));
          if (outcome.matchId) {
            setMatch({ matchId: outcome.matchId, name: liker.first_name ?? "", photoUrl: liker.photo_url ?? undefined });
          } else if (action !== "pass") {
            toast.success(`You liked ${liker.first_name} back`);
          }
          return;
        case "no_likes":
          toast.error("You've used all your likes!");
          navigate("/premium");
          return;
        case "no_super_likes":
          navigate("/get-super-likes");
          return;
        case "rate_limited":
          toast.error(`Daily swipe limit reached — back in ${outcome.cooldownHours}h.`);
          return;
        default:
          toast.error("Couldn't save that. Please try again.");
      }
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3" aria-busy="true" aria-label="Loading likes">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16" role="alert">
        <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          {error === "unavailable" ? "Likes are on their way" : "We couldn't load your likes"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {error === "unavailable"
            ? "This list is being switched on. Please check back soon."
            : "Check your connection and try again."}
        </p>
        <button
          onClick={() => load("first")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full gradient-primary text-white font-semibold"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  return (
    <>
      {match && (
        <MatchCelebration
          isOpen
          onClose={() => setMatch(null)}
          onChatNow={() => {
            const m = match;
            setMatch(null);
            openChat({ matchId: m.matchId, otherName: m.name, otherPhotoUrl: m.photoUrl });
          }}
          matchName={match.name}
          matchPhotoUrl={match.photoUrl}
        />
      )}
      {contactModal}

      {!canSee && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 shrink-0 rounded-full bg-white/20 flex items-center justify-center">
              <Crown className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold">
                {likers.length > 0
                  ? `${hasMore ? `${likers.length}+` : likers.length} ${likers.length === 1 && !hasMore ? "person likes" : "people like"} you`
                  : "Unlock with Gold or Platinum"}
              </p>
              <p className="text-sm opacity-90">See who likes you & match instantly</p>
            </div>
            <button
              onClick={() => navigate("/premium")}
              className="px-4 py-2 bg-black text-white rounded-full font-semibold text-sm shrink-0"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      {/* Free members: one banner after the 3rd row of the grid, or at the top of a shorter one. */}
      {listAdAfterIndex(likers.length, 2) < 0 && <AdSlot placement="isexy-list-banner" className="mb-4" />}

      {likers.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">No new likes yet</h2>
          <p className="text-muted-foreground mb-6">Complete your profile and keep swiping to get noticed.</p>
          <button onClick={() => navigate("/discover")} className="text-primary font-semibold">
            Go to Discover
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {likers.map((liker, i) => {
            const locked = liker.locked || !liker.liker_id;
            const key = liker.liker_id ?? `locked-${i}-${liker.liked_at}`;
            return (
              <Fragment key={key}>
              <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-muted">
                {locked ? (
                  <button
                    type="button"
                    onClick={() => navigate("/premium")}
                    className="absolute inset-0 w-full h-full bg-gradient-to-br from-primary/40 via-muted to-secondary/30 blur-[1px]"
                    aria-label="Upgrade to see who likes you"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/web-profile/${liker.liker_id}`)}
                    className="absolute inset-0 w-full h-full"
                    aria-label={`Open ${liker.first_name}'s profile`}
                  >
                    {liker.photo_url ? (
                      <img src={liker.photo_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground">
                        {liker.first_name?.[0]}
                      </span>
                    )}
                  </button>
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {liker.action === "super_like" && (
                  <div className="absolute top-2 left-2 bg-cyan-500 rounded-full p-1.5 shadow-lg" aria-label="Super Like">
                    <Star className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                )}

                {locked && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  {locked ? (
                    <p className="font-bold text-base">Someone likes you</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 mb-1 pointer-events-none">
                        <h3 className="font-bold text-base truncate">{liker.first_name}</h3>
                        {liker.birth_date && <span className="text-base">{ageFrom(liker.birth_date)}</span>}
                        {liker.is_verified && <BadgeCheck className="w-4 h-4 text-cyan-400 fill-cyan-400 shrink-0" aria-label="Verified" />}
                      </div>
                      {liker.city && <p className="text-xs text-white/80 truncate pointer-events-none">{liker.city}</p>}
                      {liker.message && (
                        <p className="mt-1 text-xs bg-white/15 rounded-lg px-2 py-1 line-clamp-2 pointer-events-none">“{liker.message}”</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          disabled={acting === liker.liker_id}
                          onClick={() => handleAction(liker, "pass")}
                          className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-50 active:scale-90 transition-transform"
                          aria-label={`Pass on ${liker.first_name}`}
                        >
                          <X className="w-4 h-4 text-rose-500" />
                        </button>
                        <button
                          disabled={acting === liker.liker_id}
                          onClick={() => handleAction(liker, "super_like")}
                          className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-50 active:scale-90 transition-transform"
                          aria-label={`Super Like ${liker.first_name}`}
                        >
                          <Star className="w-4 h-4 text-cyan-500 fill-current" />
                        </button>
                        <button
                          disabled={acting === liker.liker_id}
                          onClick={() => handleAction(liker, "like")}
                          className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center disabled:opacity-50 ml-auto active:scale-90 transition-transform"
                          aria-label={`Like ${liker.first_name} back`}
                        >
                          {acting === liker.liker_id ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Heart className="w-4 h-4 text-white fill-white" />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {i === listAdAfterIndex(likers.length, 2) && <AdSlot placement="isexy-list-banner" className="col-span-full" />}
              </Fragment>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div ref={sentinel} className="flex justify-center py-6">
          <button
            onClick={() => load("more")}
            disabled={loadingMore}
            className="px-5 py-2 rounded-full border border-border text-sm font-semibold text-foreground disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
