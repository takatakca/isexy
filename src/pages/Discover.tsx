import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, X, Star, RotateCcw, Zap, Sliders, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { SwipeCard } from "@/components/SwipeCard";
import { DiscoverFilters } from "@/components/DiscoverFilters";
import { useSwipe } from "@/hooks/useSwipe";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DiscoverProfile {
  id: string;
  first_name: string;
  birth_date: string;
  bio?: string;
  city?: string;
  job_title?: string;
  company?: string;
  school?: string;
  is_verified?: boolean;
  latitude?: number;
  longitude?: number;
  photos: string[];
}

// Calculate age from birth date
function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function Discover() {
  const navigate = useNavigate();
  const { profile: userProfile } = useAuth();
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "up" | null>(null);
  const [lastSwiped, setLastSwiped] = useState<DiscoverProfile | null>(null);

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];

  useEffect(() => {
    if (userProfile) {
      fetchProfiles();
    }
  }, [userProfile]);

  const fetchProfiles = async () => {
    setLoading(true);

    try {
      // Get profiles that the user hasn't swiped on yet
      const excludeIds: string[] = [];
      
      if (userProfile) {
        excludeIds.push(userProfile.id);
        
        const { data: swipedIds } = await supabase
          .from("swipes")
          .select("swiped_id")
          .eq("swiper_id", userProfile.id);

        if (swipedIds) {
          excludeIds.push(...swipedIds.map((s) => s.swiped_id));
        }
      }

      // Build base query
      let query = supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          birth_date,
          bio,
          city,
          job_title,
          company,
          school,
          is_verified,
          latitude,
          longitude,
          gender,
          interested_in
        `)
        .eq("is_active", true);

      // Only exclude if we have IDs to exclude
      if (excludeIds.length > 0) {
        query = query.not("id", "in", `(${excludeIds.join(",")})`);
      }

      const { data: profilesData, error } = await query.limit(50);

      if (error) {
        console.error("Error fetching profiles:", error);
        setLoading(false);
        return;
      }

      // Filter profiles based on preferences (with flexible gender matching)
      let filteredProfiles = profilesData || [];
      
      if (userProfile?.interested_in && userProfile.interested_in.length > 0) {
        const userInterestedIn = userProfile.interested_in.map(g => g.toLowerCase());
        
        filteredProfiles = filteredProfiles.filter((p: any) => {
          const profileGender = (p.gender || "").toLowerCase();
          // Match various gender formats
          const genderMatches = 
            userInterestedIn.includes(profileGender) ||
            userInterestedIn.includes(profileGender.replace("female", "women").replace("woman", "women")) ||
            userInterestedIn.includes(profileGender.replace("male", "men").replace("man", "men")) ||
            (userInterestedIn.includes("women") && ["female", "woman"].includes(profileGender)) ||
            (userInterestedIn.includes("men") && ["male", "man"].includes(profileGender));
          
          return genderMatches;
        });
      }

      // If no matching profiles after filter, show all profiles
      if (filteredProfiles.length === 0 && (profilesData?.length || 0) > 0) {
        filteredProfiles = profilesData || [];
      }

      // Get photos for each profile (parallel fetch for performance)
      const profilesWithPhotos = await Promise.all(
        filteredProfiles.map(async (p: any) => {
          const { data: photos } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", p.id)
            .order("position");

          return {
            ...p,
            photos: photos?.map((photo) => photo.photo_url) || [],
          };
        })
      );

      // Show profiles with photos first, but also include those without
      const sortedProfiles = profilesWithPhotos.sort((a, b) => {
        // Prioritize profiles with photos
        if (a.photos.length > 0 && b.photos.length === 0) return -1;
        if (a.photos.length === 0 && b.photos.length > 0) return 1;
        
        // Then prioritize nearby profiles if user has location
        if (userProfile?.latitude && a.latitude && b.latitude) {
          const distA = calculateDistance(userProfile.latitude, userProfile.longitude || 0, a.latitude, a.longitude || 0);
          const distB = calculateDistance(userProfile.latitude, userProfile.longitude || 0, b.latitude, b.longitude || 0);
          return distA - distB;
        }
        
        return 0;
      });

      setProfiles(sortedProfiles);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Error in fetchProfiles:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = useCallback(async (action: "like" | "nope" | "super_like") => {
    if (isAnimating || !currentProfile || !userProfile) return;

    setIsAnimating(true);
    setSwipeDirection(action === "like" ? "right" : action === "nope" ? "left" : "up");
    setLastSwiped(currentProfile);

    // Record the swipe
    const { error: swipeError } = await supabase.from("swipes").insert({
      swiper_id: userProfile.id,
      swiped_id: currentProfile.id,
      action,
    });

    if (swipeError) {
      console.error("Error recording swipe:", swipeError);
    }

    // Check for match if like or super_like
    if (action === "like" || action === "super_like") {
      const { data: mutualSwipe } = await supabase
        .from("swipes")
        .select("id")
        .eq("swiper_id", currentProfile.id)
        .eq("swiped_id", userProfile.id)
        .in("action", ["like", "super_like"])
        .maybeSingle();

      if (mutualSwipe) {
        // Create a match!
        const { error: matchError } = await supabase.from("matches").insert({
          profile1_id: userProfile.id,
          profile2_id: currentProfile.id,
        });

        if (!matchError) {
          toast.success(`It's a match with ${currentProfile.first_name}! 🎉`, {
            action: {
              label: "Message",
              onClick: () => navigate("/matches"),
            },
          });
        }
      }
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setSwipeDirection(null);
      setIsAnimating(false);

      // Fetch more profiles if running low
      if (currentIndex >= profiles.length - 3) {
        fetchProfiles();
      }
    }, 300);
  }, [isAnimating, currentProfile, userProfile, currentIndex, profiles.length, navigate]);

  const handleUndo = useCallback(async () => {
    if (!lastSwiped || !userProfile) return;

    // Delete the last swipe
    await supabase
      .from("swipes")
      .delete()
      .eq("swiper_id", userProfile.id)
      .eq("swiped_id", lastSwiped.id);

    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setLastSwiped(null);
    toast.success("Undo successful!");
  }, [lastSwiped, userProfile]);

  const { dragX, dragY, rotation, handlers } = useSwipe({
    onSwipeLeft: () => handleSwipe("nope"),
    onSwipeRight: () => handleSwipe("like"),
    onSwipeUp: () => handleSwipe("super_like"),
  });

  const showLikeIndicator = dragX > 50;
  const showNopeIndicator = dragX < -50;
  const showSuperLikeIndicator = dragY < -50 && Math.abs(dragX) < 50;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center pb-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Finding people near you...</p>
        <BottomNav />
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20">
        <header className="flex items-center justify-between px-4 py-3">
          <DiscoverFilters onFiltersChange={fetchProfiles} />
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-foreground text-background rounded-full font-semibold text-sm">
              For You
            </button>
          </div>
          <div className="w-10" /> {/* Spacer to balance the header */}
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <Heart className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
            No more profiles
          </h2>
          <p className="text-muted-foreground text-center mb-6">
            Check back later or expand your preferences to see more people.
          </p>
          <button
            onClick={fetchProfiles}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold"
          >
            Refresh
          </button>
        </main>

        <BottomNav />
      </div>
    );
  }

  const formattedProfile = {
    id: currentProfile.id,
    first_name: currentProfile.first_name,
    age: calculateAge(currentProfile.birth_date),
    bio: currentProfile.bio,
    city: currentProfile.city,
    job_title: currentProfile.job_title,
    company: currentProfile.company,
    school: currentProfile.school,
    is_verified: currentProfile.is_verified,
    distance: userProfile?.latitude && currentProfile.latitude
      ? calculateDistance(
          userProfile.latitude,
          userProfile.longitude || 0,
          currentProfile.latitude,
          currentProfile.longitude || 0
        )
      : undefined,
    photos: currentProfile.photos,
  };

  const nextFormattedProfile = nextProfile ? {
    id: nextProfile.id,
    first_name: nextProfile.first_name,
    age: calculateAge(nextProfile.birth_date),
    bio: nextProfile.bio,
    photos: nextProfile.photos,
  } : null;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 z-20">
        <DiscoverFilters onFiltersChange={fetchProfiles} />
        
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-foreground text-background rounded-full font-semibold text-sm">
            For You
          </button>
          <button className="px-4 py-2 text-muted-foreground font-semibold text-sm border border-border rounded-full">
            Double Date
          </button>
        </div>
        
        <div className="w-10" /> {/* Spacer to balance header */}
      </header>

      {/* Card stack */}
      <main className="flex-1 flex items-start justify-center px-3 pt-2">
        <div className="relative w-full max-w-sm aspect-[3/4.5]" {...handlers}>
          {/* Next card (behind) */}
          {nextFormattedProfile && (
            <SwipeCard
              profile={nextFormattedProfile}
              style={{
                transform: "scale(0.95)",
                zIndex: 0,
              }}
            />
          )}

          {/* Current card */}
          <SwipeCard
            profile={formattedProfile}
            style={{
              transform: swipeDirection === "left"
                ? "translateX(-150%) rotate(-30deg)"
                : swipeDirection === "right"
                ? "translateX(150%) rotate(30deg)"
                : swipeDirection === "up"
                ? "translateY(-150%) scale(0.8)"
                : `translateX(${dragX}px) translateY(${dragY}px) rotate(${rotation}deg)`,
              transition: swipeDirection ? "transform 0.3s ease-out" : undefined,
              zIndex: 1,
            }}
            showLikeIndicator={showLikeIndicator}
            showNopeIndicator={showNopeIndicator}
            showSuperLikeIndicator={showSuperLikeIndicator}
          />
        </div>
      </main>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 px-6 py-4">
        <button
          onClick={handleUndo}
          disabled={!lastSwiped}
          className="w-12 h-12 rounded-full bg-card shadow-md flex items-center justify-center text-yellow-500 hover:scale-110 transition-transform border border-border disabled:opacity-40"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => handleSwipe("nope")}
          disabled={isAnimating}
          className="w-16 h-16 rounded-full bg-card shadow-md flex items-center justify-center hover:scale-110 transition-transform border border-border"
        >
          <X className="w-8 h-8 text-rose-500" />
        </button>
        
        <button
          onClick={() => handleSwipe("super_like")}
          disabled={isAnimating}
          className="w-12 h-12 rounded-full bg-card shadow-md flex items-center justify-center text-cyan-400 hover:scale-110 transition-transform border border-border"
        >
          <Star className="w-5 h-5 fill-current" />
        </button>
        
        <button
          onClick={() => handleSwipe("like")}
          disabled={isAnimating}
          className="w-16 h-16 rounded-full bg-card shadow-md flex items-center justify-center hover:scale-110 transition-transform border border-border"
        >
          <Heart className="w-8 h-8 text-green-500 fill-green-500" />
        </button>
        
        <button
          onClick={() => navigate("/premium")}
          className="w-12 h-12 rounded-full bg-card shadow-md flex items-center justify-center text-purple-500 hover:scale-110 transition-transform border border-border"
        >
          <Zap className="w-5 h-5 fill-current" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
