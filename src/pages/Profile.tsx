import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Shield, Settings, Pencil, Star, Zap, Flame, Check, Lock, Image, FileText, BadgeCheck, Plus, ChevronRight } from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ProfileCompletion {
  photos: number;
  bio: boolean;
  verified: boolean;
}

export default function Profile() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [completion, setCompletion] = useState<ProfileCompletion>({
    photos: 0,
    bio: false,
    verified: false,
  });
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchProfileData();
    }
  }, [profile?.id]);

  const fetchProfileData = async () => {
    if (!profile?.id) return;

    // Get photo count
    const { data: photos } = await supabase
      .from("profile_photos")
      .select("photo_url")
      .eq("profile_id", profile.id)
      .order("position");

    if (photos && photos.length > 0) {
      setProfilePhoto(photos[0].photo_url);
    }

    setCompletion({
      photos: photos?.length || 0,
      bio: !!profile.bio,
      verified: !!profile.is_verified,
    });
  };

  const calculateProgress = () => {
    let progress = 0;
    if (completion.photos >= 4) progress += 40;
    else progress += (completion.photos / 4) * 40;
    if (completion.bio) progress += 30;
    if (completion.verified) progress += 30;
    return Math.round(progress);
  };

  const progress = calculateProgress();

  const actionCards = [
    {
      id: "photos",
      icon: Image,
      iconBg: "bg-pink-100",
      iconColor: "text-pink-500",
      boost: "+28%",
      title: "Add at least 4 photos",
      description: "Get up to 2x more Likes with 6 pics.",
      completed: completion.photos >= 4,
      progress: completion.photos / 6,
    },
    {
      id: "bio",
      icon: FileText,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-500",
      boost: "+20%",
      title: 'Add "About Me"',
      description: "Get up to 25% more matches with an intro.",
      completed: completion.bio,
    },
    {
      id: "verified",
      icon: BadgeCheck,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-500",
      boost: "+8%",
      title: "Get verified",
      description: "Verify your profile to build trust with others.",
      completed: completion.verified,
    },
  ];

  const quickActions = [
    { id: "superlikes", icon: Star, iconColor: "text-cyan-500", title: "0 Super Likes", action: "GET MORE" },
    { id: "boosts", icon: Zap, iconColor: "text-purple-500", title: "My Boosts", action: "GET MORE" },
    { id: "subscription", icon: Flame, iconColor: "text-primary", title: "Subscriptions", action: null },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Header */}
      <div className="bg-background px-4 pt-12 pb-6">
        <div className="flex items-start gap-4">
          {/* Profile Photo */}
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-3xl">
                {profile?.first_name?.[0] || "?"}
              </div>
            )}
          </div>

          {/* Name and Actions */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-foreground">{profile?.first_name || "User"}</h1>
              {profile?.is_verified && (
                <BadgeCheck className="w-5 h-5 text-cyan-500" />
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/profile-setup")}
                className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-full font-semibold text-sm"
              >
                <Pencil className="w-4 h-4" />
                Edit profile
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="flex items-center gap-2">
            <button className="p-2">
              <Shield className="w-6 h-6 text-muted-foreground" />
            </button>
            <button onClick={() => navigate("/settings")} className="p-2">
              <Settings className="w-6 h-6 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-background px-4 pb-6 border-b border-border">
        <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-2">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 to-rose-400 rounded-full"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 bg-foreground text-background text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ left: `${Math.max(5, progress)}%`, transform: "translateX(-50%) translateY(-50%)" }}
          >
            {progress}%
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete your profile to be seen by more people!
        </p>
      </div>

      {/* Action Cards */}
      <div className="p-4 space-y-3">
        {actionCards.map((card) => (
          <button
            key={card.id}
            onClick={() => navigate("/profile-setup")}
            className="w-full flex items-center gap-4 p-4 bg-background rounded-2xl shadow-sm"
          >
            <div className={`relative ${card.iconBg} p-3 rounded-xl`}>
              <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              <span className="absolute -bottom-1 -right-1 text-xs font-bold text-rose-500">
                {card.boost}
              </span>
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-foreground">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </div>
            {card.completed ? (
              <Check className="w-5 h-5 text-green-500" />
            ) : (
              <div className="w-8 h-8 border-2 border-muted-foreground/20 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="px-4 grid grid-cols-3 gap-3 mb-4">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => navigate("/premium")}
            className="relative bg-background rounded-2xl p-4 flex flex-col items-center shadow-sm"
          >
            <Plus className="absolute top-2 right-2 w-4 h-4 text-muted-foreground" />
            <action.icon className={`w-8 h-8 ${action.iconColor} mb-2`} />
            <span className="text-xs font-semibold text-foreground text-center">{action.title}</span>
            {action.action && (
              <span className="text-xs text-rose-500 font-semibold mt-1">{action.action}</span>
            )}
          </button>
        ))}
      </div>

      {/* Gold Upsell */}
      <div className="px-4">
        <div className="bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-yellow-600" />
              <span className="font-bold text-yellow-800">CubaDate</span>
              <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs font-bold rounded">GOLD</span>
            </div>
            <button
              onClick={() => navigate("/premium")}
              className="px-4 py-2 bg-yellow-500 text-foreground font-bold rounded-full text-sm"
            >
              Upgrade
            </button>
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
