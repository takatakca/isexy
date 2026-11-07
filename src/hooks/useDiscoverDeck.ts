import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchDiscoverFeed, type FeedProfile } from "@/lib/discoverFeed";
import { performSwipe, type SwipeAction, type SwipeOutcome } from "@/lib/likes";
import { track } from "@/lib/analytics";

export type { SwipeAction, SwipeOutcome };

export interface MatchInfo {
  matchId: string;
  name: string;
  photoUrl?: string;
}

interface Options {
  /** Analytics surface name, e.g. "discover" or "explore:travel". */
  source: string;
  interests?: string[];
  verifiedOnly?: boolean;
}

interface HistoryEntry {
  profile: FeedProfile;
  action: SwipeAction;
  settled: Promise<SwipeOutcome>;
}

const REFILL_AT = 5;
const PAGE = 30;

function preload(urls: (string | undefined)[]) {
  for (const url of urls) {
    if (!url) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

/**
 * Discover deck state machine shared by Discover and Explore categories.
 * Swipes are optimistic: the card leaves instantly, the server call runs in
 * the background, and a refused swipe (limits, errors) puts the card back.
 */
export function useDiscoverDeck({ source, interests, verifiedOnly = false }: Options) {
  const { profile: me } = useAuth();
  const [deck, setDeck] = useState<FeedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [likesRemaining, setLikesRemaining] = useState<number | null>(me?.likes_remaining ?? null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const history = useRef<HistoryEntry[]>([]);
  const inFlight = useRef(new Set<string>());
  const refilling = useRef(false);
  const exhausted = useRef(false);
  const deckRef = useRef<FeedProfile[]>([]);
  deckRef.current = deck;

  const meId = me?.id;
  const interestsKey = (interests ?? []).join("|");

  const load = useCallback(async (mode: "replace" | "append") => {
    if (!me) return;
    if (mode === "append" && (refilling.current || exhausted.current)) return;
    refilling.current = true;
    if (mode === "replace") {
      setLoading(true);
      exhausted.current = false;
    }
    try {
      const exclude = mode === "append"
        ? [...deckRef.current.map((p) => p.id), ...inFlight.current]
        : [...inFlight.current];
      const page = await fetchDiscoverFeed({
        viewer: me,
        limit: PAGE,
        exclude,
        verifiedOnly,
        interests: interestsKey ? interestsKey.split("|") : undefined,
      });
      if (page.length < PAGE) exhausted.current = true;
      setDeck((prev) => {
        if (mode === "replace") return page;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.filter((p) => !seen.has(p.id))];
      });
      setLoadError(false);
    } catch (e) {
      console.error("Discover feed failed:", e);
      if (mode === "replace") setLoadError(true);
    } finally {
      refilling.current = false;
      if (mode === "replace") setLoading(false);
    }
    // `me` fields used by the feed rarely change; key on identity + filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, verifiedOnly, interestsKey]);

  useEffect(() => {
    if (!meId) return;
    history.current = [];
    setCanUndo(false);
    load("replace");
  }, [meId, load]);

  useEffect(() => {
    if (me?.likes_remaining !== undefined) setLikesRemaining(me.likes_remaining ?? null);
  }, [me?.likes_remaining]);

  // Keep the stack full and the next images warm.
  useEffect(() => {
    if (!loading && deck.length <= REFILL_AT) load("append");
    preload([...(deck[0]?.photos ?? []), ...deck.slice(1, 4).map((p) => p.photos[0])]);
  }, [deck, loading, load]);

  const putBack = useCallback((profile: FeedProfile) => {
    setDeck((prev) => (prev.some((p) => p.id === profile.id) ? prev : [profile, ...prev]));
  }, []);

  const send = useCallback(async (profile: FeedProfile, action: SwipeAction): Promise<SwipeOutcome> => {
    if (!me) return { status: "error" };
    const outcome = await performSwipe(me, profile.id, action);
    if (outcome.status !== "ok") return outcome;
    if (typeof outcome.likesRemaining === "number") setLikesRemaining(outcome.likesRemaining);
    track(action, { source });
    if (outcome.matchId) {
      track("match", { source });
      navigator.vibrate?.([20, 40, 20]);
      setMatch({ matchId: outcome.matchId, name: profile.first_name, photoUrl: profile.photos[0] });
    }
    return outcome;
  }, [me, source]);

  /**
   * Swipe the top card, or `target` (e.g. a Top Pick) when given. Resolves
   * once the server has accepted or refused it; a refused card comes back.
   */
  const swipe = useCallback((action: SwipeAction, target?: FeedProfile): Promise<SwipeOutcome> => {
    const top = target ?? deckRef.current[0];
    if (!top) return Promise.resolve({ status: "error" });
    if (inFlight.current.has(top.id)) return Promise.resolve({ status: "error" });
    if (action !== "pass") navigator.vibrate?.(10);

    const wasInDeck = deckRef.current.some((p) => p.id === top.id);
    setDeck((prev) => prev.filter((p) => p.id !== top.id));
    inFlight.current.add(top.id);

    const settled = send(top, action).then((outcome) => {
      inFlight.current.delete(top.id);
      if (outcome.status !== "ok") {
        if (wasInDeck) putBack(top);
        history.current = history.current.filter((h) => h.profile.id !== top.id);
        setCanUndo(history.current.length > 0);
      }
      return outcome;
    });
    history.current = [...history.current.slice(-9), { profile: top, action, settled }];
    setCanUndo(true);
    return settled;
  }, [send, putBack]);

  /** Bring back the last swiped card (removes the swipe server-side). */
  const undo = useCallback(async () => {
    const last = history.current.pop();
    setCanUndo(history.current.length > 0);
    if (!last || !me) return false;
    const outcome = await last.settled;
    if (outcome.status === "ok") {
      await supabase.from("swipes").delete().eq("swiper_id", me.id).eq("swiped_id", last.profile.id);
    }
    putBack(last.profile);
    return true;
  }, [me, putBack]);

  return {
    deck,
    top: deck[0] as FeedProfile | undefined,
    next: deck[1] as FeedProfile | undefined,
    loading,
    loadError,
    likesRemaining,
    match,
    clearMatch: () => setMatch(null),
    swipe,
    undo,
    canUndo,
    reload: () => load("replace"),
  };
}
