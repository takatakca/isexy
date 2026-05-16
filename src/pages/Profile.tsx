import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Shield, Settings, Pencil, Star, Zap, Flame, Check, Lock, Image, FileText, BadgeCheck, Plus, ChevronRight, Briefcase, GraduationCap, MapPin, Quote, Heart, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { Progress } from "@/components/ui/progress";

const iconMap: Record<string, any> = {
  Image, FileText, BadgeCheck, Briefcase, GraduationCap, MapPin, Quote, Heart, Sparkles,
};

const iconBgMap: Record<string, string> = {
  Image: "bg-pink-100",
  FileText: "bg-purple-100",
  Sparkles: "bg-blue-100",
  BadgeCheck: "bg-rose-100",
  Briefcase: "bg-amber-100",
  GraduationCap: "bg-green-100",
  MapPin: "bg-teal-100",
  Quote: "bg-indigo-100",
  Heart: "bg-pink-100",
};

const iconColorMap: Record<string, string> = {
  Image: "text-pink-500",
  FileText: "text-purple-500",
  Sparkles: "text-blue-500",
  BadgeCheck: "text-rose-500",
  Briefcase: "text-amber-500",
  GraduationCap: "text-green-500",
  MapPin: "text-teal-500",
  Quote: "text-indigo-500",
  Heart: "text-pink-500",
};

export default function Profile() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const { score, items, loading: completionLoading } = useProfileCompletion(profile?.id, profile);

  useEffect(() => {
    if (profile?.id) {
      supabase
        .from("profile_photos")
        .select("photo_url")
        .eq("profile_id", profile.id)
        .order("position")
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) setProfilePhoto(data[0].photo_url);
        });
    }
  }, [profile?.id]);

  const incompleteItems = items.filter(i => !i.completed);
  const completedItems = items.filter(i => i.completed);

  const quickActions = [
    { id: "superlikes", icon: Star, iconColor: "text-cyan-500", title: `${profile?.super_likes_remaining ?? 0} Super Likes`, action: "GET MORE" },
    { id: "boosts", icon: Zap, iconColor: "text-purple-500", title: `${profile?.boosts_remaining ?? 0} Boosts`, action: "GET MORE" },
    { id: "subscription", icon: Flame, iconColor: "text-primary", title: profile?.subscription_tier && profile.subscription_tier !== 'free' ? profile.subscription_tier.charAt(0).toUpperCase() + profile.subscription_tier.slice(1) : "Subscribe", action: null },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Header */}
      <div className="bg-background px-4 pt-12 pb-6">
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-3xl">
                {profile?.first_name?.[0] || "?"}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-foreground">{profile?.first_name || "User"}</h1>
              {profile?.is_verified && <BadgeCheck className="w-5 h-5 text-cyan-500" />}
            </div>
            <button
              onClick={() => navigate("/edit-profile")}
              className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-full font-semibold text-sm"
            >
              <Pencil className="w-4 h-4" />
              Edit profile
            </button>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSelector variant="icon" />
            <button className="p-2"><Shield className="w-6 h-6 text-muted-foreground" /></button>
            <button onClick={() => navigate("/settings")} className="p-2"><Settings className="w-6 h-6 text-muted-foreground" /></button>
          </div>
        </div>
      </div>

      {/* Completion Score */}
      <div className="bg-background px-4 pb-6 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Profile Score</span>
          <span className="text-sm font-bold text-primary">{score}%</span>
        </div>
        <Progress value={score} className="h-3" />
        <p className="text-xs text-muted-foreground mt-2">
          {score >= 80 ? "🔥 Your profile is looking great!" : "Complete your profile to be seen by more people!"}
        </p>
      </div>

      {/* Incomplete Action Cards */}
      {incompleteItems.length > 0 && (
        <div className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Boost your visibility</h2>
          {incompleteItems.map((card) => {
            const Icon = iconMap[card.icon] || Image;
            return (
              <button
                key={card.id}
                onClick={() => navigate(card.actionPath)}
                className="w-full flex items-center gap-4 p-4 bg-background rounded-2xl shadow-sm"
              >
                <div className={`relative ${iconBgMap[card.icon] || "bg-muted"} p-3 rounded-xl`}>
                  <Icon className={`w-6 h-6 ${iconColorMap[card.icon] || "text-muted-foreground"}`} />
                  <span className="absolute -bottom-1 -right-1 text-xs font-bold text-primary">{card.boost}</span>
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-foreground">{card.label}</h3>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
                <div className="w-8 h-8 border-2 border-muted-foreground/20 rounded-full flex items-center justify-center">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Completed items collapsed */}
      {completedItems.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1">{completedItems.length} completed</p>
          <div className="flex flex-wrap gap-2">
            {completedItems.map((card) => {
              const Icon = iconMap[card.icon] || Image;
              return (
                <div key={card.id} className="flex items-center gap-1 px-3 py-1.5 bg-background rounded-full border border-border">
                  <Icon className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-foreground">{card.label}</span>
                  <Check className="w-3 h-3 text-green-500" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 pt-4 grid grid-cols-3 gap-3 mb-4">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => navigate("/premium")}
            className="relative bg-background rounded-2xl p-4 flex flex-col items-center shadow-sm"
          >
            <Plus className="absolute top-2 right-2 w-4 h-4 text-muted-foreground" />
            <action.icon className={`w-8 h-8 ${action.iconColor} mb-2`} />
            <span className="text-xs font-semibold text-foreground text-center">{action.title}</span>
            {action.action && <span className="text-xs text-primary font-semibold mt-1">{action.action}</span>}
          </button>
        ))}
      </div>

      {/* Gold Upsell */}
      <div className="px-4">
        <div className="bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-yellow-600" />
              <span className="font-bold text-yellow-800">ISEXY</span>
              <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs font-bold rounded">GOLD</span>
            </div>
            <button onClick={() => navigate("/premium")} className="px-4 py-2 bg-yellow-500 text-foreground font-bold rounded-full text-sm">Upgrade</button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">What's Included</span>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">Free</span>
                <span className="font-bold text-foreground">Gold</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">See Who Likes You</span>
              <div className="flex items-center gap-4">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <Check className="w-5 h-5 text-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
