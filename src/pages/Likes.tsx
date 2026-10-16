import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { LikesReceivedGrid } from "@/components/LikesReceivedGrid";
import { Heart, Star, Loader2, BadgeCheck, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ageFrom } from "@/lib/discoverFeed";
import { fetchHiddenMemberIds } from "@/lib/blocks";

interface LikedProfile {
  id: string;
  first_name: string;
  birth_date: string;
  city?: string | null;
  is_verified?: boolean | null;
  photo_url?: string;
  action: string;
  liked_at: string;
}

const PAGE = 30;

export default function Likes() {
  const navigate = useNavigate();
  const { profile: userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"likes" | "sent">("likes");
  const [sentLikes, setSentLikes] = useState<LikedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadedSwipes = useRef(0);
  /** Blocked either way: never listed. Read once per visit. */
  const hiddenRef = useRef<Set<string> | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const meId = userProfile?.id;

  // Likes the member sent, newest first: 3 queries per page (swipes, profiles, photos).
  const fetchSent = useCallback(async (mode: "first" | "more") => {
    if (!meId) return;
    const from = mode === "first" ? 0 : loadedSwipes.current;
    if (mode === "first") setLoading(true);
    else setLoadingMore(true);
    try {
      const { data: swipes, error } = await supabase
        .from("swipes")
        .select("swiped_id, action, created_at")
        .eq("swiper_id", meId)
        .in("action", ["like", "super_like"])
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const fetched = swipes ?? [];
      loadedSwipes.current = from + fetched.length;
      setHasMore(fetched.length === PAGE);
      if (mode === "first" || !hiddenRef.current) hiddenRef.current = await fetchHiddenMemberIds(meId);
      const hidden = hiddenRef.current;
      const rows = fetched.filter((s) => !hidden.has(s.swiped_id));

      const ids = rows.map((s) => s.swiped_id);
      let page: LikedProfile[] = [];
      if (ids.length > 0) {
        const [{ data: profiles }, { data: photos }] = await Promise.all([
          supabase.from("profiles").select("id, first_name, birth_date, city, is_verified").in("id", ids),
          supabase.from("profile_photos").select("profile_id, photo_url, position").in("profile_id", ids).order("position"),
        ]);
        const photoBy = new Map<string, string>();
        for (const ph of photos ?? []) if (!photoBy.has(ph.profile_id)) photoBy.set(ph.profile_id, ph.photo_url);
        const profileBy = new Map((profiles ?? []).map((p) => [p.id, p]));
        // Keep the swipe order; members who left (inactive) are not visible and are skipped.
        page = rows.flatMap((s) => {
          const p = profileBy.get(s.swiped_id);
          return p ? [{ ...p, photo_url: photoBy.get(p.id), action: s.action, liked_at: s.created_at }] : [];
        });
      }
      setSentLikes((prev) => (mode === "first" ? page : [...prev, ...page.filter((p) => !prev.some((q) => q.id === p.id))]));
      setLoadError(false);
    } catch (err) {
      console.error("Error fetching likes:", err);
      if (mode === "first") setLoadError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [meId]);

  useEffect(() => {
    if (meId) fetchSent("first");
  }, [meId, fetchSent]);

  // Infinite scroll on the Sent tab.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || activeTab !== "sent") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loadingMore) fetchSent("more");
    }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, activeTab, loadingMore, fetchSent]);

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="sticky top-0 z-10 bg-background px-4 pt-12 pb-2">
        <h1 className="text-3xl font-extrabold text-foreground mb-4">Likes</h1>
        <div className="flex border-b border-border" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "likes"}
            onClick={() => setActiveTab("likes")}
            className={`flex-1 py-3 text-center font-semibold relative ${activeTab === "likes" ? "text-foreground" : "text-muted-foreground"}`}
          >
            Who Liked You
            {activeTab === "likes" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "sent"}
            onClick={() => setActiveTab("sent")}
            className={`flex-1 py-3 text-center font-semibold relative ${activeTab === "sent" ? "text-foreground" : "text-muted-foreground"}`}
          >
            Sent
            {activeTab === "sent" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        </div>
      </div>

      {activeTab === "likes" ? (
        <div className="px-4 py-4">
          <LikesReceivedGrid />
        </div>
      ) : (
        <div className="px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="Loading" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center py-12" role="alert">
              <p className="text-muted-foreground mb-4">We couldn't load the likes you sent.</p>
              <button onClick={() => fetchSent("first")} className="flex items-center gap-2 text-primary font-semibold">
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          ) : sentLikes.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <Heart className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No likes sent yet</p>
              <button onClick={() => navigate("/discover")} className="mt-4 text-primary font-semibold">
                Start Swiping
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {sentLikes.map((profile) => (
                  <button
                    type="button"
                    key={profile.id}
                    className="relative rounded-xl overflow-hidden aspect-[3/4] text-left bg-muted"
                    onClick={() => navigate(`/web-profile/${profile.id}`)}
                    aria-label={`Open ${profile.first_name}'s profile`}
                  >
                    {profile.photo_url ? (
                      <img src={profile.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Heart className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="font-bold text-white text-sm flex items-center gap-1">
                        <span className="truncate">{profile.first_name}, {ageFrom(profile.birth_date)}</span>
                        {profile.is_verified && <BadgeCheck className="w-4 h-4 text-cyan-300 shrink-0" aria-label="Verified" />}
                      </h3>
                      {profile.city && <p className="text-white/70 text-xs truncate">{profile.city}</p>}
                    </div>
                    {profile.action === "super_like" && (
                      <div className="absolute top-2 right-2 bg-cyan-500 rounded-full p-1" aria-label="Super Like">
                        <Star className="w-3 h-3 text-white fill-current" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {hasMore && (
                <div ref={sentinel} className="flex justify-center py-6">
                  <button
                    onClick={() => fetchSent("more")}
                    disabled={loadingMore}
                    className="px-5 py-2 rounded-full border border-border text-sm font-semibold text-foreground disabled:opacity-60"
                  >
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
