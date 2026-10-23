import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { MEMBER_PROFILE_COLUMNS } from "@/lib/profileStatus";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  birth_date: string;
  gender: string;
  sexual_orientation?: string;
  interested_in: string[];
  looking_for?: string;
  bio?: string;
  school?: string;
  job_title?: string;
  company?: string;
  city?: string;
  country: string;
  distance_preference: number;
  age_min: number;
  age_max: number;
  show_gender: boolean;
  show_orientation: boolean;
  is_premium: boolean;
  subscription_tier: string;
  likes_remaining: number;
  super_likes_remaining: number;
  boosts_remaining: number;
  is_verified: boolean;
  is_active: boolean;
  latitude?: number;
  longitude?: number;
  interests?: string[];
  prompts?: Json;
  education?: string;
  communication_style?: string;
  love_language?: string;
  pets?: string[];
  drinking?: string;
  smoking?: string;
  workout?: string;
  first_purchase_promo_used?: boolean;
  promo_expires_at?: string;
  relationship_type?: string | null;
  languages?: string[] | null;
  zodiac?: string | null;
  family_plans?: string | null;
  social_media?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  photoCount: number;
  loading: boolean;
  /** The profile could not be loaded (network or server error), as opposed to "no profile yet". */
  profileError: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photoCount, setPhotoCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  // Whose profile is loaded (or loading). A different user signing in keeps
  // `loading` on until their profile arrives, so routes never see a signed-in
  // member with profile = null and send a returning member to /profile-setup.
  const profileOwner = useRef<string | null>(null);

  /** The member's profile, or null; `failed` when it could not be read (not "no profile yet"). */
  const fetchProfile = async (userId: string): Promise<{ profile: Profile | null; failed: boolean }> => {
    const { data, error } = await supabase
      .from("profiles")
      .select(MEMBER_PROFILE_COLUMNS) // not "*": shadow-ban columns are staff-only (0015 K3)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return { profile: null, failed: true };
    }
    return { profile: data as Profile | null, failed: false };
  };

  // Profile, photo count and error flag change together: a render with only
  // some of them updated would look like an incomplete profile and redirect
  // a returning member to /profile-setup.
  const loadedProfile = useRef<Profile | null>(null);
  const loadProfile = async (userId: string) => {
    let result: { profile: Profile | null; failed: boolean };
    let count = 0;
    try {
      result = await fetchProfile(userId);
      if (result.profile) count = await fetchPhotoCount(result.profile.id);
    } catch (error) {
      console.error("Error loading profile:", error);
      result = { profile: null, failed: true };
    }
    // A failed refresh keeps the profile already loaded for this member.
    if (result.failed && loadedProfile.current?.user_id === userId) return;
    loadedProfile.current = result.profile;
    setProfile(result.profile);
    setPhotoCount(count);
    setProfileError(result.failed);
  };

  const fetchPhotoCount = async (profileId: string) => {
    const { count } = await supabase
      .from("profile_photos")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId);
    return count ?? 0;
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Handle auth errors by clearing session
        if (event === 'TOKEN_REFRESHED' && !session) {
          // Token refresh failed, clear local storage
          await supabase.auth.signOut();
          setProfile(null);
          loadedProfile.current = null;
          return;
        }

        // Defer profile fetch to avoid deadlock
        if (session?.user) {
          const switchedUser = profileOwner.current !== session.user.id;
          profileOwner.current = session.user.id;
          if (switchedUser) setLoading(true);
          setTimeout(async () => {
            await loadProfile(session.user.id);
            if (switchedUser) setLoading(false);
          }, 0);
        } else {
          profileOwner.current = null;
          setProfile(null);
          loadedProfile.current = null;
          setPhotoCount(0);
          setProfileError(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      // If there's an auth error (like stale token), clear and start fresh
      if (error) {
        console.log("Session error, clearing:", error.message);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        loadedProfile.current = null;
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await loadProfile(session.user.id);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    loadedProfile.current = null;
    setPhotoCount(0);
    toast.success("Signed out successfully");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        photoCount,
        loading,
        profileError,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
