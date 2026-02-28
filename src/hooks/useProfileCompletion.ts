import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CompletionItem {
  id: string;
  label: string;
  boost: string;
  description: string;
  weight: number;
  completed: boolean;
  progress?: number; // 0-1 for partial items
  actionPath: string;
  icon: string; // icon name
}

interface ProfileCompletionResult {
  score: number; // 0-100
  items: CompletionItem[];
  loading: boolean;
}

export function useProfileCompletion(profileId?: string, profile?: any): ProfileCompletionResult {
  const [photoCount, setPhotoCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    supabase
      .from("profile_photos")
      .select("id")
      .eq("profile_id", profileId)
      .then(({ data }) => {
        setPhotoCount(data?.length ?? 0);
        setLoading(false);
      });
  }, [profileId]);

  const hasPrompts = (() => {
    if (!profile?.prompts) return false;
    try {
      const p = typeof profile.prompts === "string" ? JSON.parse(profile.prompts) : profile.prompts;
      return Array.isArray(p) && p.length > 0;
    } catch {
      return false;
    }
  })();

  const items: CompletionItem[] = [
    {
      id: "photos",
      label: "Add at least 4 photos",
      boost: "+28%",
      description: "Get up to 2x more Likes with 6 pics.",
      weight: 28,
      completed: photoCount >= 4,
      progress: Math.min(photoCount / 4, 1),
      actionPath: "/edit-profile",
      icon: "Image",
    },
    {
      id: "bio",
      label: 'Add "About Me"',
      boost: "+20%",
      description: "Get up to 25% more matches with an intro.",
      weight: 20,
      completed: !!profile?.bio && profile.bio.length >= 10,
      actionPath: "/edit-bio",
      icon: "FileText",
    },
    {
      id: "interests",
      label: "Add interests",
      boost: "+12%",
      description: "Help us find your best matches.",
      weight: 12,
      completed: Array.isArray(profile?.interests) && profile.interests.length >= 3,
      actionPath: "/interests",
      icon: "Sparkles",
    },
    {
      id: "verified",
      label: "Get verified",
      boost: "+8%",
      description: "Verify your profile to build trust with others.",
      weight: 8,
      completed: !!profile?.is_verified,
      actionPath: "/photo-verification",
      icon: "BadgeCheck",
    },
    {
      id: "job",
      label: "Add your job",
      boost: "+8%",
      description: "People are curious about what you do.",
      weight: 8,
      completed: !!profile?.job_title,
      actionPath: "/edit-profile",
      icon: "Briefcase",
    },
    {
      id: "school",
      label: "Add your school",
      boost: "+6%",
      description: "Find others from your alma mater.",
      weight: 6,
      completed: !!profile?.school,
      actionPath: "/edit-profile",
      icon: "GraduationCap",
    },
    {
      id: "city",
      label: "Add your city",
      boost: "+6%",
      description: "Get matched with locals near you.",
      weight: 6,
      completed: !!profile?.city,
      actionPath: "/edit-profile",
      icon: "MapPin",
    },
    {
      id: "prompts",
      label: "Add conversation prompts",
      boost: "+6%",
      description: "Help break the ice with creative answers.",
      weight: 6,
      completed: hasPrompts,
      actionPath: "/edit-profile",
      icon: "Quote",
    },
    {
      id: "lifestyle",
      label: "Add lifestyle details",
      boost: "+6%",
      description: "Share your drinking, workout & pet preferences.",
      weight: 6,
      completed: !!(profile?.drinking || profile?.workout || (profile?.pets && profile.pets.length > 0)),
      actionPath: "/edit-profile",
      icon: "Heart",
    },
  ];

  const score = items.reduce((acc, item) => {
    if (item.completed) return acc + item.weight;
    if (item.progress !== undefined) return acc + Math.floor(item.weight * item.progress);
    return acc;
  }, 0);

  return { score, items, loading };
}
