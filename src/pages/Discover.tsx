import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Zap, Loader2, Flame, RefreshCw } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ProfileDetail } from "@/components/ProfileDetail";
import { DiscoverFilters } from "@/components/DiscoverFilters";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DiscoverCampaigns } from "@/components/DiscoverCampaigns";
import { TopPicksCarousel } from "@/components/TopPicksCarousel";
import { SwipeSurgeNotification, useSwipeSurge } from "@/components/SwipeSurgeNotification";
import { ConsistencyChallengeModal, useStreakTracker } from "@/components/ConsistencyChallengeModal";
import { MatchCelebration } from "@/components/MatchCelebration";
import { FirstImpressionModal } from "@/components/FirstImpressionModal";
import { SwipeDeck, type SwipeDeckHandle } from "@/components/SwipeDeck";
import { useDiscoverDeck, type SwipeAction, type SwipeOutcome } from "@/hooks/useDiscoverDeck";
import { useChatOpener } from "@/hooks/useChatOpener";
import { toCardProfile, type FeedProfile } from "@/lib/discoverFeed";
import { sendFirstImpression } from "@/lib/likes";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SPANISH_HINT = /[áéíóúüñ¿¡]|\b(el|la|los|las|de|en|que|es|un|una|por|con|para|del|como|más|soy|quiero|busco|gusta|hola|amor|vida|mucho|muy|también)\b/i;

export default function Discover() {
  const navigate = useNavigate();
  const { profile: me, refreshProfile } = useAuth();
  const { language, autoTranslate } = useLanguage();
  const { currentStreak, showModal, setShowModal } = useStreakTracker();
  const swipeSurge = useSwipeSurge();

  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const deck = useDiscoverDeck({ source: "discover", verifiedOnly: showVerifiedOnly });
  const deckHandle = useRef<SwipeDeckHandle>(null);

  const [showPaywall, setShowPaywall] = useState(false);
  const [detailFor, setDetailFor] = useState<FeedProfile | null>(null);
  const { openChat, contactModal, contactOpen } = useChatOpener();
  const [firstImpressionFor, setFirstImpressionFor] = useState<FeedProfile | null>(null);
  const [impressionsLeft, setImpressionsLeft] = useState(3);
  const [boosting, setBoosting] = useState(false);
  const pendingImpression = useRef<{ profileId: string; message: string } | null>(null);
  // Top Picks liked / passed from their detail view this session.
  const [pickedIds, setPickedIds] = useState<ReadonlySet<string>>(new Set());

  // ---- Bio translation (cards on top of the stack only, each bio once) -----
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    if (!autoTranslate) return;
    for (const p of deck.deck.slice(0, 2)) {
      const bio = p.bio;
      const key = `${p.id}:${language.code}`;
      if (!bio || attempted.current.has(key)) continue;
      attempted.current.add(key);
      const looksSpanish = SPANISH_HINT.test(bio);
      if ((looksSpanish && language.code === "es") || (!looksSpanish && language.code === "en")) continue;
      supabase.functions
        .invoke("isexy-translate-message", { body: { text: bio, targetLanguage: language.code } })
        .then(({ data }) => {
          const text = data?.translatedText;
          if (text && text !== bio) setTranslated((prev) => ({ ...prev, [p.id]: text }));
        })
        .catch(() => undefined);
    }
  }, [deck.deck, autoTranslate, language.code]);

  // ---- Server verdicts ----------------------------------------------------------
  const onSwiped = useCallback((action: SwipeAction, profile: FeedProfile, settled: Promise<SwipeOutcome>) => {
    settled.then(async (outcome) => {
      if (outcome.status === "ok") {
        const pending = pendingImpression.current;
        if (action === "super_like" && pending?.profileId === profile.id) {
          pendingImpression.current = null;
          const sent = await sendFirstImpression(profile.id, pending.message);
          if (sent.status === "ok") {
            if (sent.remaining != null) setImpressionsLeft(sent.remaining);
            toast.success("First Impression sent! 💫");
          } else if (sent.status === "no_first_impressions") {
            setImpressionsLeft(0);
            toast.error(`Super Like sent to ${profile.first_name}, but you have no First Impressions left this week.`);
          } else {
            toast.error(`Super Like sent to ${profile.first_name}, but your message couldn't be delivered.`);
          }
        }
        return;
      }
      switch (outcome.status) {
        case "rate_limited":
          toast.error(`Daily swipe limit reached — back in ${outcome.cooldownHours}h, or go Premium for unlimited.`);
          setShowPaywall(true);
          break;
        case "no_likes":
          setShowPaywall(true);
          break;
        case "no_super_likes":
          toast.error("You're out of Super Likes!");
          navigate("/get-super-likes");
          break;
        default:
          toast.error(`Couldn't save that swipe — ${profile.first_name} is back on top.`);
      }
    });
  }, [navigate]);

  const onSuperLikeRequest = useCallback((profile: FeedProfile) => {
    if (me?.subscription_tier !== "platinum") return false;
    setFirstImpressionFor(profile);
    return true;
  }, [me?.subscription_tier]);

  // Platinum: how many First Impressions are left this week (allowances).
  useEffect(() => {
    if (!firstImpressionFor || !me) return;
    supabase
      .from("allowances")
      .select("weekly_first_impressions")
      .eq("profile_id", me.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setImpressionsLeft(data.weekly_first_impressions); });
  }, [firstImpressionFor, me]);

  /**
   * Swipe a profile that may not be the top card. The top card flies out
   * with the usual animation; a Top Pick (not on top) is sent directly.
   */
  const swipeProfile = useCallback((profile: FeedProfile, direction: "left" | "right" | "up") => {
    if (deck.top?.id === profile.id) {
      deckHandle.current?.swipe(direction);
      return;
    }
    const action: SwipeAction = direction === "left" ? "pass" : direction === "right" ? "like" : "super_like";
    setPickedIds((prev) => new Set(prev).add(profile.id));
    const settled = deck.swipe(action, profile);
    if (action !== "pass") toast.success(action === "super_like" ? `Super Liked ${profile.first_name} ⭐` : `Liked ${profile.first_name}`, { duration: 1200 });
    onSwiped(action, profile, settled);
    settled.then((o) => {
      if (o.status !== "ok") setPickedIds((prev) => { const next = new Set(prev); next.delete(profile.id); return next; });
    });
  }, [deck, onSwiped]);

  /** Like / pass / super like from the profile details. */
  const actOn = (profile: FeedProfile, direction: "left" | "right" | "up") => {
    setDetailFor(null);
    if (direction === "up" && onSuperLikeRequest(profile)) return;
    swipeProfile(profile, direction);
  };
  const superLike = (profile: FeedProfile) => swipeProfile(profile, "up");

  const activateBoost = async () => {
    if (!me || boosting) return;
    setBoosting(true);
    try {
      const { data: wallet } = await supabase
        .from("boost_wallets")
        .select("boosts, monthly_boost_available")
        .eq("profile_id", me.id)
        .maybeSingle();
      const hasMonthly = !!wallet?.monthly_boost_available;
      if (!hasMonthly && !((wallet?.boosts ?? 0) > 0)) {
        navigate("/get-boosts");
        return;
      }
      const { data, error } = await supabase.rpc("use_boost", { p_profile_id: me.id, p_boost_type: hasMonthly ? "monthly" : "boost" });
      const result = data as { success?: boolean; error?: string } | null;
      if (error || !result?.success) {
        if (result?.error === "no_boosts" || result?.error === "no_monthly_boost") navigate("/get-boosts");
        else toast.error("Couldn't activate your Boost. Please try again.");
        return;
      }
      toast.success("Boost activated! 🚀 You're at the top of the stack for 30 minutes.");
      refreshProfile?.();
    } finally {
      setBoosting(false);
    }
  };

  const modalOpen = showPaywall || !!deck.match || contactOpen || !!firstImpressionFor || !!detailFor || showModal;

  const header = (
    <header className="flex items-center justify-between px-4 py-3 z-20 border-b border-border/50">
      <DiscoverFilters onFiltersChange={deck.reload} showVerifiedOnly={showVerifiedOnly} setShowVerifiedOnly={setShowVerifiedOnly} />
      <div className="flex items-center gap-2">
        <Flame className="w-5 h-5 text-primary" />
        <span className="font-bold text-foreground">ISEXY</span>
        {!me?.is_premium && deck.likesRemaining !== null && (
          <span className="text-xs text-muted-foreground ml-1 tabular-nums">({deck.likesRemaining} likes)</span>
        )}
      </div>
      <LanguageSelector variant="icon" />
    </header>
  );

  if (deck.loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20">
        {header}
        <main className="flex-1 flex flex-col items-center px-3 pt-6" aria-busy="true">
          <div className="relative w-full max-w-sm aspect-[3/4.5] rounded-3xl bg-muted/60 overflow-hidden">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-t from-muted to-muted/30" />
            <div className="absolute bottom-6 left-5 right-5 space-y-3">
              <div className="h-7 w-1/2 rounded-full bg-background/40" />
              <div className="h-4 w-3/4 rounded-full bg-background/30" />
            </div>
            <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">Finding people you'll like…</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
      {showPaywall && (
        <div role="dialog" aria-modal="true" aria-labelledby="paywall-title" className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPaywall(false)}>
          <div className="bg-card rounded-3xl p-6 max-w-sm w-full shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <Heart className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 id="paywall-title" className="text-2xl font-bold text-foreground mb-2">You're out of likes</h2>
              <p className="text-muted-foreground mb-6">Go Premium for unlimited likes, see who likes you, Passport and more.</p>
              <button onClick={() => { setShowPaywall(false); navigate("/premium"); }} className="w-full py-3 gradient-primary text-white font-bold rounded-full mb-3">
                See Premium plans
              </button>
              <button onClick={() => setShowPaywall(false)} className="text-muted-foreground text-sm">Maybe later</button>
            </div>
          </div>
        </div>
      )}

      {deck.match && (
        <MatchCelebration
          isOpen
          onClose={deck.clearMatch}
          onChatNow={() => {
            const m = deck.match!;
            deck.clearMatch();
            openChat({ matchId: m.matchId, otherName: m.name, otherPhotoUrl: m.photoUrl });
          }}
          matchName={deck.match.name}
          matchPhotoUrl={deck.match.photoUrl}
        />
      )}

      {contactModal}

      {firstImpressionFor && (
        <FirstImpressionModal
          isOpen
          onCancel={() => setFirstImpressionFor(null)}
          onClose={() => {
            setFirstImpressionFor(null);
            superLike(firstImpressionFor);
          }}
          onSend={(message) => {
            pendingImpression.current = { profileId: firstImpressionFor.id, message };
            setFirstImpressionFor(null);
            superLike(firstImpressionFor);
          }}
          targetName={firstImpressionFor.first_name}
          targetPhotoUrl={firstImpressionFor.photos[0]}
          remainingImpressions={impressionsLeft}
        />
      )}

      {detailFor && (
        <ProfileDetail
          profile={{ ...toCardProfile(detailFor, translated[detailFor.id]), interests: detailFor.interests ?? undefined }}
          onClose={() => setDetailFor(null)}
          onLike={() => actOn(detailFor, "right")}
          onPass={() => actOn(detailFor, "left")}
          onSuperLike={() => actOn(detailFor, "up")}
        />
      )}

      <SwipeSurgeNotification isActive={swipeSurge.isActive} multiplier={swipeSurge.multiplier} usersActive={swipeSurge.usersActive} />
      <ConsistencyChallengeModal isOpen={showModal} onClose={() => setShowModal(false)} currentStreak={currentStreak} />

      {header}
      {/* The card gets the room on phones: a compact Top Picks strip from
          760px tall, the promo banner only on tall (tablet / desktop) screens. */}
      <div className="hidden [@media(min-height:1000px)]:block shrink-0">
        <DiscoverCampaigns className="py-2" />
      </div>
      <div className="hidden [@media(min-height:760px)]:block shrink-0">
        <TopPicksCarousel className="py-2" compact onSelect={setDetailFor} hiddenIds={pickedIds} />
      </div>

      <main className="flex-1 min-h-0 flex flex-col items-center px-3 pt-2">
        {deck.top ? (
          <SwipeDeck
            ref={deckHandle}
            deck={deck}
            onSwiped={onSwiped}
            onOpenDetails={setDetailFor}
            onSuperLikeRequest={onSuperLikeRequest}
            translatedBio={(id) => translated[id]}
            paused={modalOpen}
            extraAction={
              <button
                onClick={activateBoost}
                disabled={boosting}
                className="w-12 h-12 rounded-full bg-card shadow-md flex items-center justify-center text-purple-500 active:scale-90 hover:scale-105 transition-transform border border-border disabled:opacity-60"
                aria-label="Boost my profile"
              >
                {boosting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
              </button>
            }
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Heart className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {deck.loadError ? "We couldn't load profiles" : "You've seen everyone for now"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {deck.loadError
                ? "Check your connection and try again."
                : showVerifiedOnly
                  ? "Turn off “Verified only” or widen your age range to meet more people."
                  : "Widen your age range or try Passport to meet people in Cuba, Canada and beyond."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={deck.reload} className="px-6 py-3 gradient-primary text-white rounded-full font-semibold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button onClick={() => navigate("/passport-mode")} className="px-6 py-3 rounded-full border border-border font-semibold text-foreground hover:bg-muted">
                Try Passport
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
