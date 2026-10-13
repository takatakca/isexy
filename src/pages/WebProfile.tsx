import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Copy, ExternalLink, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemberSettings } from "@/hooks/useMemberSettings";

/**
 * /web-profile: the member turns their shareable web profile on or off.
 * /web-profile/:userId: what anyone with the link sees, served by
 * isexy.get_web_profile, which only answers for members who turned it on.
 */
const WebProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  return userId ? <PublicWebProfile profileId={userId} /> : <ManageWebProfile />;
};

function ManageWebProfile() {
  const { profile } = useAuth();
  const { settings, loading, save } = useMemberSettings();
  const webProfileEnabled = !!settings.webProfile?.enabled;

  const profileLink = profile ? `${window.location.origin}/web-profile/${profile.id}` : "";

  const setEnabled = async (enabled: boolean) => {
    const previous = settings.webProfile;
    const savedOnServer = await save({ webProfile: { ...previous, enabled } });
    if (savedOnServer) {
      toast.success(enabled ? "Your web profile is on" : "Your web profile is off");
    } else {
      // The public link is served from the server copy: a device-only change would mislead.
      await save({ webProfile: previous });
      toast.error("Couldn't update your web profile. Please try again.");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileLink);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link. Select it and copy it instead.");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Check out my ISEXY profile", url: profileLink });
      } catch {
        /* share sheet closed */
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <AuthLayout showBack variant="gray">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Web Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your public profile visibility</p>
        </div>

        {/* Main Toggle */}
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <label htmlFor="web-profile-enabled" className="font-semibold text-foreground">Enable Web Profile</label>
              <p className="text-sm text-muted-foreground mt-1">
                Allow others to view your profile through a web link
              </p>
            </div>
            <Switch
              id="web-profile-enabled"
              checked={webProfileEnabled}
              disabled={loading}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>

        {webProfileEnabled && (
          <>
            {/* Profile Link */}
            <div className="bg-card rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-foreground">Your Profile Link</h3>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
                <span className="text-sm text-muted-foreground flex-1 truncate">
                  {profileLink.replace(/^https?:\/\//, "")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopyLink}
                  aria-label="Copy link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>

            {/* What's Visible */}
            <div className="bg-card rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-foreground">What's Visible</h3>
              <p className="text-sm text-muted-foreground">
                Your web profile shows:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Your first name and age
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Your photos
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Your bio
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Your interests
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Your exact location and contact information are never shared, and web profiles are not listed in search engines.
              </p>
            </div>

            {/* Preview Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(profileLink, "_blank", "noopener")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview Web Profile
            </Button>
          </>
        )}

        {!webProfileEnabled && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Enable your web profile to share your profile link with others
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

interface PublicProfile {
  id: string;
  first_name: string;
  age: number;
  bio: string | null;
  interests: string[] | null;
  is_verified: boolean;
  photos: string[];
}

function PublicWebProfile({ profileId }: { profileId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.rpc("get_web_profile", { p_profile_id: profileId }).then(({ data: rows, error }) => {
      if (cancelled) return;
      if (error) console.warn("Web profile not loaded:", error.message);
      setData(rows?.[0] ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profileId]);

  return (
    <AuthLayout showBack variant="gray">
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !data ? (
        <div className="text-center py-16 space-y-4">
          <h1 className="text-2xl font-bold text-foreground">This profile isn't public</h1>
          <p className="text-muted-foreground">The member may have turned off their web profile.</p>
          <Link to={user ? "/discover" : "/auth?mode=signup"} className="inline-block text-primary font-semibold">
            {user ? "Back to Discover" : "Join ISEXY"}
          </Link>
        </div>
      ) : (
        <div className="space-y-6 max-w-md mx-auto w-full">
          {data.photos[0] && (
            <div className="aspect-[3/4] w-full rounded-2xl overflow-hidden bg-muted">
              <img src={data.photos[0]} alt={data.first_name} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-2">
              {data.first_name}, {data.age}
              {data.is_verified && <BadgeCheck className="w-6 h-6 text-primary" aria-label="Verified" />}
            </h1>
            {data.bio && <p className="text-foreground mt-3 whitespace-pre-line">{data.bio}</p>}
          </div>
          {(data.interests?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.interests!.map((interest) => (
                <span key={interest} className="px-3 py-1.5 rounded-full border border-border text-sm text-foreground">
                  {interest}
                </span>
              ))}
            </div>
          )}
          {data.photos.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              {data.photos.slice(1).map((url, i) => (
                <div key={url} className="aspect-[3/4] rounded-xl overflow-hidden bg-muted">
                  <img src={url} alt={`${data.first_name} ${i + 2}`} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}
          <Link
            to={user ? "/discover" : "/auth?mode=signup"}
            className="block w-full py-4 rounded-full gradient-primary text-white font-bold text-center"
          >
            {user ? "Find people on ISEXY" : `Join ISEXY to talk with ${data.first_name}`}
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}

export default WebProfile;
