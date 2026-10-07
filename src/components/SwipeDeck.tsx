import { forwardRef, useCallback, useEffect, useImperativeHandle, type ReactNode } from "react";
import { Heart, X, Star, RotateCcw } from "lucide-react";
import { SwipeCard } from "@/components/SwipeCard";
import { useSwipeGesture, type SwipeDirection } from "@/hooks/useSwipeGesture";
import type { SwipeAction, SwipeOutcome, useDiscoverDeck } from "@/hooks/useDiscoverDeck";
import { toCardProfile, type FeedProfile } from "@/lib/discoverFeed";

type Deck = ReturnType<typeof useDiscoverDeck>;

const ACTION_FOR: Record<SwipeDirection, SwipeAction> = { left: "pass", right: "like", up: "super_like" };

export interface SwipeDeckHandle {
  /** Programmatically swipe the top card with the fly-out animation. */
  swipe: (direction: SwipeDirection) => void;
}

interface Props {
  deck: Deck;
  /** Called for every swipe with the server's eventual verdict. */
  onSwiped?: (action: SwipeAction, profile: FeedProfile, settled: Promise<SwipeOutcome>) => void;
  onOpenDetails?: (profile: FeedProfile) => void;
  /** Return true to take over the Super Like button (e.g. Platinum First Impression). */
  onSuperLikeRequest?: (profile: FeedProfile) => boolean;
  translatedBio?: (profileId: string) => string | undefined;
  /** Extra action button (e.g. Boost). */
  extraAction?: ReactNode;
  /** Disable gestures and keyboard while a dialog is open. */
  paused?: boolean;
}

export const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck(
  { deck, onSwiped, onOpenDetails, onSuperLikeRequest, translatedBio, extraAction, paused = false },
  handle,
) {
  const { top, next } = deck;

  const onSwipe = useCallback((direction: SwipeDirection) => {
    const profile = deck.top;
    if (!profile) return;
    const action = ACTION_FOR[direction];
    const settled = deck.swipe(action);
    onSwiped?.(action, profile, settled);
  }, [deck, onSwiped]);

  const gesture = useSwipeGesture({ onSwipe, disabled: paused || !top });

  const press = useCallback((direction: SwipeDirection) => {
    if (!top || paused) return;
    if (direction === "up" && onSuperLikeRequest?.(top)) return;
    gesture.flyOut(direction);
  }, [top, paused, onSuperLikeRequest, gesture]);

  useImperativeHandle(handle, () => ({ swipe: (d) => gesture.flyOut(d) }), [gesture]);

  // Desktop: ← pass · → like · ↑ super like · Backspace undo
  useEffect(() => {
    if (paused) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]')) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); press("left"); }
      else if (e.key === "ArrowRight") { e.preventDefault(); press("right"); }
      else if (e.key === "ArrowUp") { e.preventDefault(); press("up"); }
      else if (e.key === "Backspace" && deck.canUndo) { e.preventDefault(); deck.undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, press, deck]);

  return (
    <div className="flex flex-col items-center w-full h-full min-h-0">
      {/* The card fills the height available on this screen and keeps a 2:3 ratio,
          so the action buttons below are always visible. */}
      <div className="flex-1 min-h-0 w-full flex justify-center">
      <div className="relative h-full max-w-full max-h-[640px]" style={{ aspectRatio: "2 / 3" }}>
        {next && <SwipeCard key={`behind-${next.id}`} profile={toCardProfile(next, translatedBio?.(next.id))} isBehind />}
        {top && (
          <SwipeCard
            key={top.id}
            ref={gesture.attach}
            profile={toCardProfile(top, translatedBio?.(top.id))}
            onOpenDetails={onOpenDetails ? () => onOpenDetails(top) : undefined}
            style={{ zIndex: 1 }}
          />
        )}
      </div>
      </div>

      <div className="flex items-center justify-center gap-3 px-6 py-3 shrink-0" role="group" aria-label="Swipe actions">
        <button
          onClick={() => deck.undo()}
          disabled={!deck.canUndo}
          className="w-12 h-12 rounded-full bg-card shadow-md flex items-center justify-center text-yellow-500 active:scale-90 hover:scale-105 transition-transform border border-border disabled:opacity-40"
          aria-label="Undo last swipe"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={() => press("left")}
          disabled={!top}
          className="w-16 h-16 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 hover:scale-105 transition-transform border border-border"
          aria-label="Pass"
        >
          <X className="w-8 h-8 text-rose-500" />
        </button>
        <button
          onClick={() => press("up")}
          disabled={!top}
          className="w-12 h-12 rounded-full bg-card shadow-md flex items-center justify-center text-cyan-400 active:scale-90 hover:scale-105 transition-transform border border-border"
          aria-label="Super Like"
        >
          <Star className="w-5 h-5 fill-current" />
        </button>
        <button
          onClick={() => press("right")}
          disabled={!top}
          className="w-16 h-16 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 hover:scale-105 transition-transform border border-border"
          aria-label="Like"
        >
          <Heart className="w-8 h-8 text-green-500 fill-green-500" />
        </button>
        {extraAction}
      </div>
    </div>
  );
});
