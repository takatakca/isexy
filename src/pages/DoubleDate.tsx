import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";

export default function DoubleDate() {
  const [showMeOnFriendProfile, setShowMeOnFriendProfile] = useState(true);
  const [showFriendsOnProfile, setShowFriendsOnProfile] = useState(true);
  const [showDoubleDateProfiles, setShowDoubleDateProfiles] = useState(true);

  return (
    <AuthLayout showBack variant="white">
      <h1 className="text-2xl font-bold text-foreground mb-6">Double Date</h1>

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-foreground">Show me on my friend's profile</span>
            <Switch
              checked={showMeOnFriendProfile}
              onCheckedChange={setShowMeOnFriendProfile}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Your name and photo may appear on your Double Date friend's profile.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-foreground">Show friends on my profile</span>
            <Switch
              checked={showFriendsOnProfile}
              onCheckedChange={setShowFriendsOnProfile}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Your Double Date friend's name and photo may appear on your profile.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-foreground">Show Double Date profiles</span>
            <Switch
              checked={showDoubleDateProfiles}
              onCheckedChange={setShowDoubleDateProfiles}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            When turned off, you won't see Double Date profiles in For You mode.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
