import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchDiscoverFeed, type FeedProfile } from "@/lib/discoverFeed";
import { track } from "@/lib/analytics";

export type SwipeAction = "like" | "pass" | "super_like";

export type SwipeOutcome =
  | { status: "ok"; matchId?: string }
  | { status: "rate_limited"; cooldownHours: number }
  | { status: "no_likes" | "no_super_likes" | "error" };

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
    try {
      if (!me.is_premium) {
        const { data: rate } = await supabase.rpc("check_swipe_rate_limit", { p_profile_id: me.id });
        const r = rate as { allowed?: boolean; error?: string; cooldown_until?: string } | null;
        if (r && r.allowed === false) {
          const hours = r.cooldown_until ? Math.max(1, Math.ceil((new Date(r.cooldown_until).getTime() - Date.now()) / 3_600_000)) : 12;
          return { status: "rate_limited", cooldownHours: hours };
        }
      }

      const { data, error } = await supabase.rpc("perform_like", {
        p_swiper_id: me.id,
        p_swiped_id: profile.id,
        p_action: action,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string; likes_remaining?: number; already_swiped?: boolean } | null;
      if (result?.success === false) {
        if (result.error === "no_likes_remaining") return { status: "no_likes" };
        if (result.error === "no_super_likes_remaining") return { status: "no_super_likes" };
        return { status: "error" };
      }
      if (typeof result?.likes_remaining === "number") setLikesRemaining(result.likes_remaining);
      track(action, { source });

      if (action !== "pass" && !result?.already_swiped) {
        const [a, b] = me.id < profile.id ? [me.id, profile.id] : [profile.id, me.id];
        const { data: m } = await supabase.from("matches").select("id").eq("profile1_id", a).eq("profile2_id", b).maybeSingle();
        if (m) {
          track("match", { source });
          navigator.vibrate?.([20, 40, 20]);
          setMatch({ matchId: m.id, name: profile.first_name, photoUrl: profile.photos[0] });
          return { status: "ok", matchId: m.id };
        }
      }
      return { status: "ok" };
    } catch (e) {
      console.error("Swipe failed:", e);
      return { status: "error" };
    }
  }, [me, source]);

  /** Swipe the top card. Resolves once the server has accepted or refused it. */
  const swipe = useCallback((action: SwipeAction): Promise<SwipeOutcome> => {
    const top = deckRef.current[0];
    if (!top) return Promise.resolve({ status: "error" });
    if (action !== "pass") navigator.vibrate?.(10);

    setDeck((prev) => prev.filter((p) => p.id !== top.id));
    inFlight.current.add(top.id);

    const settled = send(top, action).then((outcome) => {
      inFlight.current.delete(top.id);
      if (outcome.status !== "ok") {
        putBack(top);
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
