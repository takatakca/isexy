import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, X, Star, RotateCcw, Zap, Loader2, Flame } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { SwipeCard } from "@/components/SwipeCard";
import { ProfileDetail } from "@/components/ProfileDetail";
import { DiscoverFilters } from "@/components/DiscoverFilters";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DiscoverCampaigns } from "@/components/DiscoverCampaigns";
import { TopPicksCarousel } from "@/components/TopPicksCarousel";
import { SwipeSurgeNotification, useSwipeSurge } from "@/components/SwipeSurgeNotification";
import { ConsistencyChallengeModal, useStreakTracker } from "@/components/ConsistencyChallengeModal";
import { MatchCelebration } from "@/components/MatchCelebration";
import { ContactMethodModal } from "@/components/ContactMethodModal";
import { useSwipe } from "@/hooks/useSwipe";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
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
  interests?: string[];
  photos: string[];
}

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function Discover() {
  const navigate = useNavigate();
  const { profile: userProfile, refreshProfile } = useAuth();
  const { language, autoTranslate } = useLanguage();
  const { currentStreak, showModal, setShowModal } = useStreakTracker();
  const swipeSurge = useSwipeSurge();

  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "up" | null>(null);
  const [lastSwiped, setLastSwiped] = useState<DiscoverProfile | null>(null);
  const [translatedBios, setTranslatedBios] = useState<Record<string, string>>({});
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [showTopPicks, setShowTopPicks] = useState(true);
  const [likesRemaining, setLikesRemaining] = useState<number>(100);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [matchCelebration, setMatchCelebration] = useState<{
    matchId: string;
    matchName: string;
    matchPhotoUrl?: string;
  } | null>(null);
  const [contactModal, setContactModal] = useState<{
    matchId: string;
    otherName: string;
    otherPhotoUrl?: string;
  } | null>(null);

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];

  const detectsAsSpanish = (text: string): boolean => {
    const spanishPatterns = /[áéíóúüñ¿¡]|(\b(el|la|los|las|de|en|que|es|un|una|por|con|para|del|al|como|más|su|se|le|lo|me|te|mi|tu|nos|hola|amor|busco|soy|quiero|gusta|vida|tiempo|mucho|siempre|nunca|también|muy|bien|cuando|donde|porque|aunque|entre|sobre)\b)/i;
    return spanishPatterns.test(text);
  };

  const translateBio = useCallback(async (profileId: string, bio: string) => {
    if (!bio || !autoTranslate) return;
    const bioAppearsSpanish = detectsAsSpanish(bio);
    const userWantsEnglish = language.code === 'en';
    const userWantsSpanish = language.code === 'es';
    if ((bioAppearsSpanish && userWantsSpanish) || (!bioAppearsSpanish && userWantsEnglish)) return;
    try {
      const response = await supabase.functions.invoke("translate-message", {
        body: { text: bio, targetLanguage: language.code }
      });
      if (response.data?.translatedText && response.data.translatedText !== bio) {
        setTranslatedBios(prev => ({ ...prev, [profileId]: response.data.translatedText }));
      }
    } catch (error) {
      console.error("Translation error:", error);
    }
  }, [language.code, autoTranslate]);

  useEffect(() => {
    if (currentProfile?.bio && !translatedBios[currentProfile.id]) {
      translateBio(currentProfile.id, currentProfile.bio);
    }
    if (nextProfile?.bio && !translatedBios[nextProfile.id]) {
      translateBio(nextProfile.id, nextProfile.bio);
    }
  }, [currentProfile, nextProfile, translateBio, translatedBios]);

  useEffect(() => {
    if (userProfile) {
      setLikesRemaining(userProfile.likes_remaining ?? 100);
      fetchProfiles();
    }
  }, [userProfile]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const excludeIds: string[] = [];
      if (userProfile) {
        excludeIds.push(userProfile.id);
        const { data: swipedIds } = await supabase
          .from("swipes")
          .select("swiped_id")
          .eq("swiper_id", userProfile.id);
        if (swipedIds) excludeIds.push(...swipedIds.map((s) => s.swiped_id));
      }

      let query = supabase
        .from("profiles")
        .select("id, first_name, birth_date, bio, city, job_title, company, school, is_verified, latitude, longitude, gender, interested_in, interests, subscription_tier, last_boost_at")
        .eq("is_active", true);

      if (excludeIds.length > 0) {
        query = query.not("id", "in", `(${excludeIds.join(",")})`);
      }

      const { data: profilesData, error } = await query.limit(50);
      if (error) { console.error("Error fetching profiles:", error); setLoading(false); return; }

      let filteredProfiles = profilesData || [];
      if (userProfile?.interested_in && userProfile.interested_in.length > 0) {
        const userInterestedIn = userProfile.interested_in.map(g => g.toLowerCase());
        const filtered = filteredProfiles.filter((p: any) => {
          const pg = (p.gender || "").toLowerCase();
          return userInterestedIn.includes(pg) ||
            (userInterestedIn.includes("women") && ["female", "woman"].includes(pg)) ||
            (userInterestedIn.includes("men") && ["male", "man"].includes(pg));
        });
        if (filtered.length > 0) filteredProfiles = filtered;
      }

      const profilesWithPhotos = await Promise.all(
        filteredProfiles.map(async (p: any) => {
          const { data: photos } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", p.id)
            .order("position");
          return { ...p, photos: photos?.map((photo) => photo.photo_url) || [] };
        })
      );

      // Score-based ranking: tier multiplier + boost + profile completeness
      const scoredProfiles = profilesWithPhotos.map((p: any) => {
        let score = 0;
        if (p.photos.length > 0) score += p.photos.length * 7;
        if (p.bio && p.bio.length >= 10) score += 20;
        if (p.interests && p.interests.length >= 3) score += 12;
        if (p.is_verified) score += 8;
        if (p.job_title) score += 8;
        if (p.school) score += 6;
        if (p.city) score += 6;

        // Tier multiplier
        const tierMult: Record<string, number> = { platinum: 2.0, gold: 1.5, plus: 1.2 };
        score = Math.round(score * (tierMult[p.subscription_tier] || 1.0));

        // Boost multiplier
        if (p.last_boost_at && new Date(p.last_boost_at).getTime() > Date.now() - 30 * 60 * 1000) {
          score = score * 3;
        }

        // Distance penalty
        let dist = Infinity;
        if (userProfile?.latitude && p.latitude) {
          dist = calculateDistance(userProfile.latitude, userProfile.longitude || 0, p.latitude, p.longitude || 0);
        }
        return { ...p, _score: score, _dist: dist };
      });

      const sorted = scoredProfiles.sort((a: any, b: any) => {
        // Photos first
        if (a.photos.length > 0 && b.photos.length === 0) return -1;
        if (a.photos.length === 0 && b.photos.length > 0) return 1;
        // Then by score descending
        if (b._score !== a._score) return b._score - a._score;
        // Then by distance ascending
        return a._dist - b._dist;
      });

      setProfiles(sorted);
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
    setShowProfileDetail(false);

    // Use server-side atomic function for likes/super_likes
    if (action === "like" || action === "super_like") {
      const { data, error } = await supabase.rpc("perform_like", {
        p_swiper_id: userProfile.id,
        p_swiped_id: currentProfile.id,
        p_action: action,
      });

      if (error) {
        console.error("Error recording swipe:", error);
        toast.error("Failed to record action. Please try again.");
        setIsAnimating(false);
        setSwipeDirection(null);
        return;
      }

      const result = data as any;
      if (!result?.success) {
        if (result?.error === "no_likes_remaining" || result?.error === "no_super_likes_remaining") {
          setShowPaywall(true);
          toast.error("You've used all your likes! Upgrade to Premium for unlimited likes.");
          setIsAnimating(false);
          setSwipeDirection(null);
          return;
        }
        // Already swiped - just advance
      }

      // Update local likes count
      if (result?.likes_remaining !== undefined) setLikesRemaining(result.likes_remaining);

      // Match is created automatically by DB trigger (check_and_create_match)
      // Check if a match was just created to show notification
      if (!result?.already_swiped) {
        // Match is created on every like now (one-sided messaging)
        const { data: matchData } = await supabase
          .from("matches")
          .select("id")
          .or(`and(profile1_id.eq.${userProfile.id < currentProfile.id ? userProfile.id : currentProfile.id},profile2_id.eq.${userProfile.id < currentProfile.id ? currentProfile.id : userProfile.id})`)
          .maybeSingle();

        if (matchData) {
          // Check if mutual like (both liked each other)
          const { data: mutualSwipe } = await supabase
            .from("swipes")
            .select("id")
            .eq("swiper_id", currentProfile.id)
            .eq("swiped_id", userProfile.id)
            .in("action", ["like", "super_like"])
            .maybeSingle();

          if (mutualSwipe) {
            // Mutual like → show celebration
            setMatchCelebration({
              matchId: matchData.id,
              matchName: currentProfile.first_name,
              matchPhotoUrl: currentProfile.photos?.[0],
            });
          } else {
            // One-sided like → show contact modal directly
            setContactModal({
              matchId: matchData.id,
              otherName: currentProfile.first_name,
              otherPhotoUrl: currentProfile.photos?.[0],
            });
          }
        }
      }
    } else {
      // Pass - just insert directly
      const { error } = await supabase.from("swipes").insert({
        swiper_id: userProfile.id,
        swiped_id: currentProfile.id,
        action: "nope",
      });
      if (error && error.code !== "23505") {
        console.error("Error recording pass:", error);
        toast.error("Failed to record action.");
        setIsAnimating(false);
        setSwipeDirection(null);
        return;
      }
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setSwipeDirection(null);
      setIsAnimating(false);
      if (currentIndex >= profiles.length - 3) fetchProfiles();
    }, 300);
  }, [isAnimating, currentProfile, userProfile, currentIndex, profiles.length, navigate]);

  const handleUndo = useCallback(async () => {
    if (!lastSwiped || !userProfile) return;
    await supabase.from("swipes").delete()
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

  const filteredProfiles = showVerifiedOnly ? profiles.filter(p => p.is_verified) : profiles;
  const displayProfile = filteredProfiles[currentIndex];
  const displayNextProfile = filteredProfiles[currentIndex + 1];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center pb-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Finding people near you...</p>
        <BottomNav />
      </div>
    );
  }

  if (!displayProfile) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20">
        <header className="flex items-center justify-between px-4 py-3">
          <DiscoverFilters onFiltersChange={fetchProfiles} showVerifiedOnly={showVerifiedOnly} setShowVerifiedOnly={setShowVerifiedOnly} />
          <div className="flex items-center gap-2"><Flame className="w-5 h-5 text-primary" /><span className="font-bold text-foreground">CubaDate</span></div>
          <LanguageSelector variant="icon" />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <Heart className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center">No more profiles</h2>
          <p className="text-muted-foreground text-center mb-6">Check back later or expand your preferences.</p>
          <button onClick={fetchProfiles} className="px-6 py-3 gradient-primary text-white rounded-full font-semibold">Refresh</button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const formattedProfile = {
    id: displayProfile.id,
    first_name: displayProfile.first_name,
    age: calculateAge(displayProfile.birth_date),
    bio: displayProfile.bio,
    translatedBio: translatedBios[displayProfile.id],
    city: displayProfile.city,
    job_title: displayProfile.job_title,
    company: displayProfile.company,
    school: displayProfile.school,
    is_verified: displayProfile.is_verified,
    distance: userProfile?.latitude && displayProfile.latitude
      ? calculateDistance(userProfile.latitude, userProfile.longitude || 0, displayProfile.latitude, displayProfile.longitude || 0)
      : undefined,
    photos: displayProfile.photos,
    interests: displayProfile.interests,
  };

  const nextFormattedProfile = displayNextProfile ? {
    id: displayNextProfile.id,
    first_name: displayNextProfile.first_name,
    age: calculateAge(displayNextProfile.birth_date),
    bio: displayNextProfile.bio,
    translatedBio: translatedBios[displayNextProfile.id],
    photos: displayNextProfile.photos,
  } : null;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPaywall(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <Heart className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Out of Likes!</h2>
              <p className="text-muted-foreground mb-2">You have {likesRemaining} likes remaining.</p>
              <p className="text-muted-foreground mb-6">Upgrade to Premium for unlimited likes, see who likes you, and more!</p>
              <button
                onClick={() => { setShowPaywall(false); navigate("/premium"); }}
                className="w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-foreground font-bold rounded-full mb-3"
              >
                Get Premium
              </button>
              <button onClick={() => setShowPaywall(false)} className="text-muted-foreground text-sm">
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Celebration */}
      {matchCelebration && (
        <MatchCelebration
          isOpen={true}
          onClose={() => setMatchCelebration(null)}
          onChatNow={() => {
            const mc = matchCelebration;
            setMatchCelebration(null);
            setContactModal({
              matchId: mc.matchId,
              otherName: mc.matchName,
              otherPhotoUrl: mc.matchPhotoUrl,
            });
          }}
          matchName={matchCelebration.matchName}
          matchPhotoUrl={matchCelebration.matchPhotoUrl}
        />
      )}

      {/* Contact Method Modal */}
      {contactModal && (
        <ContactMethodModal
          isOpen={true}
          onClose={() => setContactModal(null)}
          matchId={contactModal.matchId}
          otherName={contactModal.otherName}
          otherPhotoUrl={contactModal.otherPhotoUrl}
        />
      )}

      {/* Profile Detail View */}
      {showProfileDetail && displayProfile && (
        <ProfileDetail
          profile={formattedProfile}
          onClose={() => setShowProfileDetail(false)}
          onLike={() => handleSwipe("like")}
          onPass={() => handleSwipe("nope")}
          onSuperLike={() => handleSwipe("super_like")}
        />
      )}

      <SwipeSurgeNotification isActive={swipeSurge.isActive} multiplier={swipeSurge.multiplier} usersActive={swipeSurge.usersActive} />
      <ConsistencyChallengeModal isOpen={showModal} onClose={() => setShowModal(false)} currentStreak={currentStreak} />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 z-20 border-b border-border/50">
        <DiscoverFilters onFiltersChange={fetchProfiles} showVerifiedOnly={showVerifiedOnly} setShowVerifiedOnly={setShowVerifiedOnly} />
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground">CubaDate</span>
          {!userProfile?.is_premium && (
            <span className="text-xs text-muted-foreground ml-1">({likesRemaining} likes)</span>
          )}
        </div>
        <LanguageSelector variant="icon" />
      </header>

      <DiscoverCampaigns className="py-2" />
      {showTopPicks && <TopPicksCarousel className="py-2" />}

      {/* Card stack */}
      <main className="flex-1 flex items-start justify-center px-3 pt-2">
        <div className="relative w-full max-w-sm aspect-[3/4.5]" {...handlers}>
          {nextFormattedProfile && (
            <SwipeCard profile={nextFormattedProfile} style={{ transform: "scale(0.95)", zIndex: 0 }} />
          )}

          <div
            onClick={() => !isAnimating && setShowProfileDetail(true)}
            className="cursor-pointer"
            style={{ position: "absolute", inset: 0, zIndex: 1 }}
          >
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
              }}
              showLikeIndicator={showLikeIndicator}
              showNopeIndicator={showNopeIndicator}
              showSuperLikeIndicator={showSuperLikeIndicator}
            />
          </div>
        </div>
      </main>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 px-6 py-4">
        <button onClick={handleUndo} disabled={!lastSwiped}
          className="w-12 h-12 rounded-full bg-card shadow-md flex items-center justify-center text-yellow-500 hover:scale-110 transition-transform border border-border disabled:opacity-40">
          <RotateCcw className="w-5 h-5" />
        </button>
        <button onClick={() => handleSwipe("nope")} disabled={isAnimating}
          className="w-16 h-16 rounded-full bg-card shadow-md flex items-center justify-center hover:scale-110 transition-transform border border-border">
          <X className="w-8 h-8 text-rose-500" />
        </button>
        <button onClick={() => handleSwipe("super_like")} disabled={isAnimating}
          className="w-12 h-12 rounded-full bg-card shadow-md flex items-center justify-center text-cyan-400 hover:scale-110 transition-transform border border-border">
          <Star className="w-5 h-5 fill-current" />
        </button>
        <button onClick={() => handleSwipe("like")} disabled={isAnimating}
          className="w-16 h-16 rounded-full bg-card shadow-md flex items-center justify-center hover:scale-110 transition-transform border border-border">
          <Heart className="w-8 h-8 text-green-500 fill-green-500" />
        </button>
        <button onClick={() => navigate("/premium")}
          className="w-12 h-12 rounded-full bg-card shadow-md flex items-center justify-center text-purple-500 hover:scale-110 transition-transform border border-border">
          <Zap className="w-5 h-5 fill-current" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
