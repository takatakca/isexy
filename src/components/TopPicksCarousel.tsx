import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Lock, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ageFrom, fetchDiscoverFeed, type FeedProfile } from "@/lib/discoverFeed";
import { canSeeWhoLiked } from "@/lib/likes";

interface TopPicksCarouselProps {
  className?: string;
  /** Gold / Platinum: open this pick (profile details with like / pass). */
  onSelect?: (profile: FeedProfile) => void;
  /** Picks already liked or passed in this session. */
  hiddenIds?: ReadonlySet<string>;
  /** Small thumbnails and no upgrade button (Discover on phones). */
  compact?: boolean;
}

/**
 * Today's Top Picks: the best-ranked people from the member's own Discover
 * feed, verified members first. Same server rules as the deck (preferences,
 * age range, blocks), so people already liked or passed never show up here.
 */
export function TopPicksCarousel({ className, onSelect, hiddenIds, compact = false }: TopPicksCarouselProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [picks, setPicks] = useState<FeedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Top Picks is a Gold / Platinum feature, like "See who likes you".
  const isGoldOrPlatinum = canSeeWhoLiked(profile?.subscription_tier);
  const meId = profile?.id;

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    (async () => {
      try {
        let found = await fetchDiscoverFeed({ viewer: profile, limit: 10, verifiedOnly: true });
        if (found.length < 3) {
          const more = await fetchDiscoverFeed({ viewer: profile, limit: 10, exclude: found.map((p) => p.id) });
          found = [...found, ...more].slice(0, 10);
        }
        if (alive) setPicks(found);
      } catch (error) {
        console.error("Error fetching top picks:", error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // The feed only depends on who is looking; refetch when that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  const visible = picks.filter((p) => !hiddenIds?.has(p.id));
  if (loading || visible.length === 0) return null;

  return (
    <div className={className}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 ${compact ? "mb-2" : "mb-3"}`}>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-foreground">Top Picks</h3>
          {!isGoldOrPlatinum && (
            <Lock className="w-4 h-4 text-muted-foreground" aria-label="Gold feature" />
          )}
        </div>
        {!isGoldOrPlatinum && (
          <button
            onClick={() => navigate("/premium")}
            className="text-sm text-primary font-semibold flex items-center"
          >
            Unlock
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Carousel */}
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain snap-x px-4 pb-2 scrollbar-hide">
        {visible.slice(0, isGoldOrPlatinum ? 10 : 3).map((pick, index) => {
          const locked = !isGoldOrPlatinum && index > 0;
          return (
            <button
              type="button"
              key={pick.id}
              className={`relative flex-shrink-0 snap-start ${compact ? "w-20" : "w-32"} aspect-[3/4] rounded-xl overflow-hidden text-left group`}
              aria-label={locked ? "Unlock Top Picks with Gold" : `${pick.first_name}, ${ageFrom(pick.birth_date)}: open profile`}
              onClick={() => {
                if (isGoldOrPlatinum && onSelect) onSelect(pick);
                else navigate("/premium");
              }}
            >
              <img
                src={pick.photos[0]}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                className={`w-full h-full object-cover ${locked ? "blur-md scale-110" : ""}`}
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              {/* Lock for non-subscribers */}
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Lock className={compact ? "w-5 h-5 text-white" : "w-8 h-8 text-white"} />
                </div>
              )}

              {/* Info */}
              {!locked && (
                <div className={`absolute ${compact ? "bottom-1.5 left-1.5 right-1.5" : "bottom-2 left-2 right-2"}`}>
                  <p className={`text-white font-bold truncate ${compact ? "text-xs" : "text-sm"}`}>
                    {pick.first_name}, {ageFrom(pick.birth_date)}
                  </p>
                  {pick.city && !compact && (
                    <p className="text-white/80 text-xs truncate">{pick.city}</p>
                  )}
                </div>
              )}

              {/* Crown badge */}
              {!compact && (
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                  <Crown className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Upgrade prompt for non-subscribers */}
      {!isGoldOrPlatinum && !compact && (
        <button
          onClick={() => navigate("/premium")}
          className="mx-4 mt-3 w-[calc(100%-2rem)] py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-full font-bold text-sm"
        >
          Unlock Top Picks with Gold
        </button>
      )}
    </div>
  );
}
