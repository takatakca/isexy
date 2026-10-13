import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";

const WebProfile = () => {
  const [webProfileEnabled, setWebProfileEnabled] = useState(false);
  const [showOnSearch, setShowOnSearch] = useState(false);
  
  const profileLink = "isexy.ca/u/yourprofile";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${profileLink}`);
    toast.success("Link copied to clipboard");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "Check out my ISEXY profile",
        url: `https://${profileLink}`,
      });
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
              <h3 className="font-semibold text-foreground">Enable Web Profile</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Allow others to view your profile through a web link
              </p>
            </div>
            <Switch
              checked={webProfileEnabled}
              onCheckedChange={setWebProfileEnabled}
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
                  {profileLink}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopyLink}
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

            {/* Privacy Options */}
            <div className="bg-card rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-foreground">Privacy Settings</h3>
              
              <div className="flex items-center justify-between py-2">
                <div className="flex-1 pr-4">
                  <p className="font-medium text-foreground">Show in Search Engines</p>
                  <p className="text-sm text-muted-foreground">
                    Allow your profile to appear in Google and other search results
                  </p>
                </div>
                <Switch
                  checked={showOnSearch}
                  onCheckedChange={setShowOnSearch}
                />
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
                Your exact location and contact information are never shared.
              </p>
            </div>

            {/* Preview Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(`https://${profileLink}`, "_blank")}
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
};

export default WebProfile;
