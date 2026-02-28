import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Heart, Star, Loader2 } from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface LikedProfile {
  id: string;
  first_name: string;
  birth_date: string;
  city?: string;
  is_verified?: boolean;
  photos: string[];
  liked_at: string;
}

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function Likes() {
  const navigate = useNavigate();
  const { profile: userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"likes" | "sent">("likes");
  const [receivedLikes, setReceivedLikes] = useState<LikedProfile[]>([]);
  const [sentLikes, setSentLikes] = useState<LikedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      fetchLikes();
    }
  }, [userProfile]);

  const fetchLikes = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      // Sent likes (profiles the user liked)
      const { data: sentSwipes } = await supabase
        .from("swipes")
        .select("swiped_id, created_at")
        .eq("swiper_id", userProfile.id)
        .in("action", ["like", "super_like"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (sentSwipes && sentSwipes.length > 0) {
        const ids = sentSwipes.map(s => s.swiped_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, birth_date, city, is_verified")
          .in("id", ids);

        if (profiles) {
          const withPhotos = await Promise.all(
            profiles.map(async (p) => {
              const { data: photos } = await supabase
                .from("profile_photos")
                .select("photo_url")
                .eq("profile_id", p.id)
                .order("position")
                .limit(1);
              const swipe = sentSwipes.find(s => s.swiped_id === p.id);
              return {
                ...p,
                photos: photos?.map(ph => ph.photo_url) || [],
                liked_at: swipe?.created_at || "",
              };
            })
          );
          // Sort by liked_at desc
          withPhotos.sort((a, b) => new Date(b.liked_at).getTime() - new Date(a.liked_at).getTime());
          setSentLikes(withPhotos);
        }
      }
    } catch (err) {
      console.error("Error fetching likes:", err);
    } finally {
      setLoading(false);
    }
  };

  const isPremium = userProfile?.is_premium || userProfile?.subscription_tier === "gold" || userProfile?.subscription_tier === "platinum";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background px-4 pt-12 pb-2">
        <h1 className="text-3xl font-extrabold text-foreground mb-4">Likes</h1>
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("likes")}
            className={`flex-1 py-3 text-center font-semibold relative ${activeTab === "likes" ? "text-foreground" : "text-muted-foreground"}`}
          >
            Who Liked You
            {activeTab === "likes" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`flex-1 py-3 text-center font-semibold relative ${activeTab === "sent" ? "text-foreground" : "text-muted-foreground"}`}
          >
            {sentLikes.length} Sent
            {activeTab === "sent" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        </div>
      </div>

      {activeTab === "likes" ? (
        !isPremium ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
            <Heart className="w-16 h-16 text-primary fill-primary mb-6" />
            <p className="text-center text-lg text-muted-foreground mb-4">
              See people who liked you with CubaDate Gold™
            </p>
            <AuthButton
              variant="primary"
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-foreground font-bold px-12"
              onClick={() => navigate("/premium")}
            >
              See Who Likes You
            </AuthButton>
          </div>
        ) : (
          <div className="px-4 py-4">
            <p className="text-center text-muted-foreground mb-4">People who liked your profile</p>
            {receivedLikes.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No likes yet. Keep swiping!</p>
            )}
          </div>
        )
      ) : (
        <div className="px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
            <div className="grid grid-cols-2 gap-3">
              {sentLikes.map((profile) => (
                <div
                  key={profile.id}
                  className="relative rounded-xl overflow-hidden aspect-[3/4] cursor-pointer"
                  onClick={() => navigate(`/discover`)}
                >
                  {profile.photos[0] ? (
                    <img src={profile.photos[0]} alt={profile.first_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Heart className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <h3 className="font-bold text-white text-sm">
                      {profile.first_name}, {calculateAge(profile.birth_date)}
                    </h3>
                    {profile.city && <p className="text-white/70 text-xs">{profile.city}</p>}
                  </div>
                  {profile.is_verified && (
                    <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                      <Star className="w-3 h-3 text-primary-foreground fill-current" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
