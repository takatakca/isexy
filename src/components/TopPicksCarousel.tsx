import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Lock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TopPickProfile {
  id: string;
  first_name: string;
  birth_date: string;
  city?: string;
  photos: string[];
}

interface TopPicksCarouselProps {
  className?: string;
}

export function TopPicksCarousel({ className }: TopPicksCarouselProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [picks, setPicks] = useState<TopPickProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const isGoldOrPlatinum = profile?.subscription_tier === "gold" || profile?.subscription_tier === "platinum";

  useEffect(() => {
    const fetchTopPicks = async () => {
      try {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, first_name, birth_date, city")
          .neq("id", profile?.id || "")
          .limit(10);

        if (error) throw error;

        // Get photos for each profile
        const profilesWithPhotos = await Promise.all(
          (profiles || []).map(async (p) => {
            const { data: photos } = await supabase
              .from("profile_photos")
              .select("photo_url")
              .eq("profile_id", p.id)
              .order("position", { ascending: true })
              .limit(1);

            return {
              ...p,
              photos: photos?.map((photo) => photo.photo_url) || ["/placeholder.svg"],
            };
          })
        );

        setPicks(profilesWithPhotos);
      } catch (error) {
        console.error("Error fetching top picks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopPicks();
  }, [profile?.id]);

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading || picks.length === 0) return null;

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-foreground">Top Picks</h3>
          {!isGoldOrPlatinum && (
            <Lock className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <button
          onClick={() => navigate("/premium")}
          className="text-sm text-primary font-semibold flex items-center"
        >
          {isGoldOrPlatinum ? "See All" : "Unlock"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Carousel */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {picks.slice(0, isGoldOrPlatinum ? 10 : 3).map((pick, index) => (
          <div
            key={pick.id}
            className="relative flex-shrink-0 w-32 aspect-[3/4] rounded-xl overflow-hidden cursor-pointer group"
            onClick={() => {
              if (isGoldOrPlatinum) {
                // Navigate to profile or trigger like
              } else {
                navigate("/premium");
              }
            }}
          >
            <img
              src={pick.photos[0]}
              alt={pick.first_name}
              className={`w-full h-full object-cover ${
                !isGoldOrPlatinum && index > 0 ? "blur-md" : ""
              }`}
            />
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            
            {/* Lock for non-subscribers */}
            {!isGoldOrPlatinum && index > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Lock className="w-8 h-8 text-white" />
              </div>
            )}

            {/* Info */}
            <div className="absolute bottom-2 left-2 right-2">
              <p className="text-white font-bold text-sm truncate">
                {pick.first_name}, {calculateAge(pick.birth_date)}
              </p>
              {pick.city && (
                <p className="text-white/80 text-xs truncate">{pick.city}</p>
              )}
            </div>

            {/* Crown badge */}
            <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
              <Crown className="w-3 h-3 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade prompt for non-subscribers */}
      {!isGoldOrPlatinum && (
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
