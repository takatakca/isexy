import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, X, Heart, Star, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SwipeCard } from "@/components/SwipeCard";
import { useSwipe } from "@/hooks/useSwipe";

interface Profile {
  id: string;
  first_name: string;
  age: number;
  city?: string;
  bio?: string;
  photos: string[];
}

const categoryTitles: Record<string, string> = {
  foodies: "Foodies",
  "nature-lovers": "Nature Lovers",
  "music-lovers": "Music Lovers",
  gamers: "Gamers",
  "fitness-enthusiasts": "Fitness Enthusiasts",
};

const categoryInterests: Record<string, string[]> = {
  foodies: ["cooking", "food", "restaurants", "baking"],
  "nature-lovers": ["hiking", "nature", "camping", "outdoors"],
  "music-lovers": ["music", "concerts", "guitar", "singing"],
  gamers: ["gaming", "video games", "esports"],
  "fitness-enthusiasts": ["fitness", "gym", "yoga", "running"],
};

export default function CategorySwipe() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleSwipe = async (action: "like" | "pass" | "super_like") => {
    if (!profile?.id || currentIndex >= profiles.length) return;
    const swipedProfile = profiles[currentIndex];
    
    await supabase.from("swipes").insert({
      swiper_id: profile.id,
      swiped_id: swipedProfile.id,
      action,
    });
    
    if (action !== "pass") toast.success(action === "super_like" ? "Super Liked! ⭐" : "Liked! ❤️");
    setCurrentIndex((prev) => prev + 1);
  };

  const { dragX, handlers } = useSwipe({
    onSwipeLeft: () => handleSwipe("pass"),
    onSwipeRight: () => handleSwipe("like"),
    onSwipeUp: () => handleSwipe("super_like"),
  });

  useEffect(() => {
    if (profile?.id && category) fetchCategoryProfiles();
  }, [profile?.id, category]);

  const fetchCategoryProfiles = async () => {
    if (!profile?.id || !category) return;
    setLoading(true);
    const interests = categoryInterests[category] || [];

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, first_name, birth_date, city, bio, interests")
      .neq("id", profile.id)
      .eq("is_active", true);

    if (!profilesData) { setLoading(false); return; }

    const matchingProfiles = profilesData.filter((p) => {
      if (!p.interests?.length) return false;
      return interests.some((i) => p.interests?.some((pi) => pi.toLowerCase().includes(i)));
    });

    const { data: swipedData } = await supabase.from("swipes").select("swiped_id").eq("swiper_id", profile.id);
    const swipedIds = new Set(swipedData?.map((s) => s.swiped_id) || []);

    const profilesWithPhotos = await Promise.all(
      matchingProfiles.filter((p) => !swipedIds.has(p.id)).map(async (p) => {
        const { data: photos } = await supabase.from("profile_photos").select("photo_url").eq("profile_id", p.id).order("position");
        return {
          id: p.id,
          first_name: p.first_name,
          age: new Date().getFullYear() - new Date(p.birth_date).getFullYear(),
          city: p.city || undefined,
          bio: p.bio || undefined,
          photos: photos?.map((ph) => ph.photo_url) || [],
        };
      })
    );

    setProfiles(profilesWithPhotos.filter((p) => p.photos.length > 0));
    setLoading(false);
  };

  const currentProfile = profiles[currentIndex];
  const title = categoryTitles[category || ""] || "Explore";

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/explore")} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {currentProfile ? (
          <div className="w-full max-w-sm">
            <div {...handlers} className="relative w-full aspect-[3/4] touch-none" style={{ transform: `translateX(${dragX}px)` }}>
              <SwipeCard
                profile={{ id: currentProfile.id, first_name: currentProfile.first_name, age: currentProfile.age, city: currentProfile.city, bio: currentProfile.bio, photos: currentProfile.photos }}
                showLikeIndicator={dragX > 50}
                showNopeIndicator={dragX < -50}
              />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <Button variant="outline" size="icon" className="w-14 h-14 rounded-full border-2 border-destructive" onClick={() => handleSwipe("pass")}><X className="w-6 h-6 text-destructive" /></Button>
              <Button size="icon" className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600" onClick={() => handleSwipe("super_like")}><Star className="w-6 h-6 text-white fill-white" /></Button>
              <Button size="icon" className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600" onClick={() => handleSwipe("like")}><Heart className="w-6 h-6 text-white fill-white" /></Button>
            </div>
          </div>
        ) : (
          <div className="text-center px-8">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4"><Info className="w-10 h-10 text-muted-foreground" /></div>
            <h2 className="text-xl font-bold text-foreground mb-2">No more {title}</h2>
            <p className="text-muted-foreground mb-6">Check back later or explore other interests!</p>
            <Button onClick={() => navigate("/explore")}>Explore More</Button>
          </div>
        )}
      </div>
    </div>
  );
}
