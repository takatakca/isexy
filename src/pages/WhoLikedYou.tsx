import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Heart, Lock, BadgeCheck } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface LikerProfile {
  id: string;
  first_name: string;
  age: number;
  photo_url?: string;
  is_verified?: boolean;
  created_at: string;
}

export default function WhoLikedYou() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [likers, setLikers] = useState<LikerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isGoldSubscriber = profile?.subscription_tier === 'gold' || profile?.subscription_tier === 'platinum';

  useEffect(() => {
    if (profile?.id) {
      fetchLikers();
    }
  }, [profile?.id]);

  const fetchLikers = async () => {
    if (!profile?.id) return;
    
    try {
      // Get profiles who liked the current user
      const { data: swipes, error } = await supabase
        .from("swipes")
        .select(`
          swiper_id,
          created_at,
          profiles:swiper_id (
            id,
            first_name,
            birth_date,
            is_verified
          )
        `)
        .eq("swiped_id", profile.id)
        .in("action", ["like", "super_like"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get photos for each liker
      const likersWithPhotos = await Promise.all(
        (swipes || []).map(async (swipe: any) => {
          const likerProfile = swipe.profiles;
          if (!likerProfile) return null;

          const { data: photos } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", likerProfile.id)
            .order("position")
            .limit(1);

          const birthDate = new Date(likerProfile.birth_date);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }

          return {
            id: likerProfile.id,
            first_name: likerProfile.first_name,
            age,
            photo_url: photos?.[0]?.photo_url,
            is_verified: likerProfile.is_verified,
            created_at: swipe.created_at,
          };
        })
      );

      setLikers(likersWithPhotos.filter(Boolean) as LikerProfile[]);
    } catch (error) {
      console.error("Error fetching likers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLikeBack = async (likerId: string) => {
    if (!profile?.id || !isGoldSubscriber) {
      navigate("/premium");
      return;
    }

    try {
      // Record the like back
      await supabase.from("swipes").insert({
        swiper_id: profile.id,
        swiped_id: likerId,
        action: "like",
      });

      // Create match
      await supabase.from("matches").insert({
        profile1_id: profile.id,
        profile2_id: likerId,
      });

      // Remove from list
      setLikers(prev => prev.filter(l => l.id !== likerId));
    } catch (error) {
      console.error("Error liking back:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Who Liked You</h1>
        </div>
      </div>

      {/* Gold Upsell Banner */}
      {!isGoldSubscriber && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Crown className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold">Unlock with CubaDate Gold™</p>
              <p className="text-sm opacity-90">See who likes you & match instantly</p>
            </div>
            <button
              onClick={() => navigate("/premium")}
              className="px-4 py-2 bg-black text-white rounded-full font-semibold text-sm"
            >
              Get Gold
            </button>
          </div>
        </div>
      )}

      {/* Likers Grid */}
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
            <h2 className="text-xl font-bold text-foreground mb-2">No likes yet</h2>
            <p className="text-muted-foreground">
              Keep swiping to get more likes!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {likers.map((liker) => (
              <div
                key={liker.id}
                className="relative rounded-xl overflow-hidden aspect-[3/4] group cursor-pointer"
                onClick={() => isGoldSubscriber && handleLikeBack(liker.id)}
              >
                {/* Photo */}
                {liker.photo_url ? (
                  <img
                    src={liker.photo_url}
                    alt={liker.first_name}
                    className={`w-full h-full object-cover transition-all ${
                      isGoldSubscriber ? "" : "blur-lg scale-110"
                    }`}
                  />
                ) : (
                  <div className={`w-full h-full bg-muted flex items-center justify-center ${
                    isGoldSubscriber ? "" : "blur-lg"
                  }`}>
                    <span className="text-4xl font-bold text-muted-foreground">
                      {liker.first_name[0]}
                    </span>
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {/* Lock overlay for non-subscribers */}
                {!isGoldSubscriber && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}

                {/* Info */}
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-lg">
                      {isGoldSubscriber ? liker.first_name : "???"}
                    </h3>
                    {isGoldSubscriber && (
                      <span className="text-lg">{liker.age}</span>
                    )}
                    {liker.is_verified && isGoldSubscriber && (
                      <BadgeCheck className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                    )}
                  </div>
                </div>

                {/* Like button for subscribers */}
                {isGoldSubscriber && (
                  <button
                    className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLikeBack(liker.id);
                    }}
                  >
                    <Heart className="w-5 h-5 text-white fill-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
