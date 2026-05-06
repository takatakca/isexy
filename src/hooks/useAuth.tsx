import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
  prompts?: any;
  education?: string;
  communication_style?: string;
  love_language?: string;
  pets?: string[];
  drinking?: string;
  smoking?: string;
  workout?: string;
  shadow_banned?: boolean;
  first_purchase_promo_used?: boolean;
  promo_expires_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  photoCount: number;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
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

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
    return data as Profile | null;
  };

  const fetchPhotoCount = async (profileId: string) => {
    const { count } = await supabase
      .from("profile_photos")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId);
    return count ?? 0;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
      if (profileData) {
        setPhotoCount(await fetchPhotoCount(profileData.id));
      } else {
        setPhotoCount(0);
      }
    }
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
          return;
        }

        // Defer profile fetch to avoid deadlock
        if (session?.user) {
          setTimeout(async () => {
            const p = await fetchProfile(session.user.id);
            setProfile(p);
            setPhotoCount(p ? await fetchPhotoCount(p.id) : 0);
          }, 0);
        } else {
          setProfile(null);
          setPhotoCount(0);
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
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        setProfile(profileData);
        setPhotoCount(profileData ? await fetchPhotoCount(profileData.id) : 0);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    toast.success("Account created successfully!");
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    toast.success("Welcome back!");
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
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
        signUp,
        signIn,
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
