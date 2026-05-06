import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Heart, Lock, BadgeCheck, X, Star } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LikerProfile {
  id: string;
  first_name: string;
  age: number;
  city?: string;
  bio?: string;
  photo_url?: string;
  is_verified?: boolean;
  created_at: string;
  action: "like" | "super_like";
}

function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function WhoLikedYou() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [likers, setLikers] = useState<LikerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const tier = profile?.subscription_tier;
  const isPremiumViewer = tier === "gold" || tier === "platinum";

  useEffect(() => {
    if (profile?.id) fetchLikers();
  }, [profile?.id]);

  const fetchLikers = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // 1. Profiles I already swiped on (to exclude)
      const { data: mySwipes } = await supabase
        .from("swipes")
        .select("swiped_id")
        .eq("swiper_id", profile.id);
      const swipedSet = new Set((mySwipes || []).map((s) => s.swiped_id));

      // 2. Blocks both directions
      const { data: blocksOut } = await supabase
        .from("blocks").select("blocked_id").eq("blocker_id", profile.id);
      const { data: blocksIn } = await supabase
        .from("blocks").select("blocker_id").eq("blocked_id", profile.id);
      const blockedSet = new Set([
        ...(blocksOut || []).map((b) => b.blocked_id),
        ...(blocksIn || []).map((b) => b.blocker_id),
      ]);

      // 3. Likes I received
      const { data: swipes, error } = await supabase
        .from("swipes")
        .select("swiper_id, action, created_at")
        .eq("swiped_id", profile.id)
        .in("action", ["like", "super_like"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const candidates = (swipes || []).filter(
        (s) => !swipedSet.has(s.swiper_id) && !blockedSet.has(s.swiper_id)
      );

      if (candidates.length === 0) {
        setLikers([]);
        return;
      }

      const ids = candidates.map((s) => s.swiper_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, first_name, birth_date, city, bio, is_verified, is_active, shadow_banned")
        .in("id", ids)
        .eq("is_active", true)
        .neq("shadow_banned", true)
        .not("first_name", "is", null)
        .not("birth_date", "is", null);

      const validProfiles = (profilesData || []).filter((p) => calcAge(p.birth_date) >= 18);

      const enriched = await Promise.all(
        validProfiles.map(async (p) => {
          const { data: photos } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", p.id)
            .order("position")
            .limit(1);
          if (!photos || photos.length === 0) return null;
          const swipe = candidates.find((s) => s.swiper_id === p.id)!;
          return {
            id: p.id,
            first_name: p.first_name,
            age: calcAge(p.birth_date),
            city: p.city,
            bio: p.bio,
            photo_url: photos[0].photo_url,
            is_verified: p.is_verified,
            created_at: swipe.created_at,
            action: swipe.action as "like" | "super_like",
          } as LikerProfile;
        })
      );

      const final = enriched.filter(Boolean) as LikerProfile[];
      final.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLikers(final);
    } catch (err) {
      console.error("Error fetching likers:", err);
      toast.error("Couldn't load likes.");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (likerId: string, action: "like" | "nope" | "super_like") => {
    if (!profile?.id) return;
    if (!isPremiumViewer && action !== "nope") {
      navigate("/premium");
      return;
    }
    setActing(likerId);
    try {
      if (action === "nope") {
        const { error } = await supabase.from("swipes").insert({
          swiper_id: profile.id,
          swiped_id: likerId,
          action: "nope",
        });
        if (error && error.code !== "23505") throw error;
        setLikers((prev) => prev.filter((l) => l.id !== likerId));
        return;
      }

      const { data, error } = await supabase.rpc("perform_like", {
        p_swiper_id: profile.id,
        p_swiped_id: likerId,
        p_action: action,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        if (result?.error === "no_super_likes_remaining") {
          navigate("/get-super-likes");
          return;
        }
        if (result?.error === "no_likes_remaining") {
          toast.error("You've used all your likes!");
          navigate("/premium");
          return;
        }
        toast.error(result?.error || "Failed to record action.");
        return;
      }
      // Mutual match should be auto-created via DB trigger
      toast.success(action === "super_like" ? "Super Like sent! ⭐" : "It's a match! 💕");
      setLikers((prev) => prev.filter((l) => l.id !== likerId));
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Who Liked You</h1>
        </div>
      </div>

      {!isPremiumViewer && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Crown className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold">Unlock with Gold or Platinum</p>
              <p className="text-sm opacity-90">See who likes you & match instantly</p>
            </div>
            <button
              onClick={() => navigate("/premium")}
              className="px-4 py-2 bg-black text-white rounded-full font-semibold text-sm"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : likers.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">No one liked you yet</h2>
            <p className="text-muted-foreground">Keep swiping to get more likes!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {likers.map((liker) => (
              <div
                key={liker.id}
                className="relative rounded-xl overflow-hidden aspect-[3/4] group"
              >
                {liker.photo_url ? (
                  <img
                    src={liker.photo_url}
                    alt={liker.first_name}
                    className={`w-full h-full object-cover ${isPremiumViewer ? "" : "blur-lg scale-110"}`}
                  />
                ) : (
                  <div className={`w-full h-full bg-muted flex items-center justify-center ${isPremiumViewer ? "" : "blur-lg"}`}>
                    <span className="text-4xl font-bold text-muted-foreground">{liker.first_name[0]}</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {liker.action === "super_like" && isPremiumViewer && (
                  <div className="absolute top-2 left-2 bg-cyan-500 rounded-full p-1.5 shadow-lg">
                    <Star className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                )}

                {!isPremiumViewer && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <div className="flex items-center gap-1.5 mb-1">
                    <h3 className="font-bold text-base">{isPremiumViewer ? liker.first_name : "???"}</h3>
                    {isPremiumViewer && <span className="text-base">{liker.age}</span>}
                    {liker.is_verified && isPremiumViewer && (
                      <BadgeCheck className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                    )}
                  </div>
                  {isPremiumViewer && liker.city && (
                    <p className="text-xs text-white/80">{liker.city}</p>
                  )}

                  {isPremiumViewer && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        disabled={acting === liker.id}
                        onClick={() => handleAction(liker.id, "nope")}
                        className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-50"
                        aria-label="Pass"
                      >
                        <X className="w-4 h-4 text-rose-500" />
                      </button>
                      <button
                        disabled={acting === liker.id}
                        onClick={() => handleAction(liker.id, "super_like")}
                        className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-50"
                        aria-label="Super Like"
                      >
                        <Star className="w-4 h-4 text-cyan-500 fill-current" />
                      </button>
                      <button
                        disabled={acting === liker.id}
                        onClick={() => handleAction(liker.id, "like")}
                        className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center disabled:opacity-50 ml-auto"
                        aria-label="Like back"
                      >
                        <Heart className="w-4 h-4 text-white fill-white" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
