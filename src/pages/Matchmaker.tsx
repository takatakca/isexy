import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

export default function Matchmaker() {
  const [showInMatchmaker, setShowInMatchmaker] = useState(true);

  const handleTerminateSessions = () => {
    toast.success("All active Matchmaker sessions have been terminated");
  };

  const handleInviteFriends = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join ISEXY Matchmaker",
        text: "Help me find my match on ISEXY!",
        url: window.location.origin,
      });
    } else {
      navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copied to clipboard!");
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <h1 className="text-2xl font-bold text-foreground mb-6">Manage Matchmaker</h1>

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">Show me in Matchmaker</span>
            <Switch
              checked={showInMatchmaker}
              onCheckedChange={setShowInMatchmaker}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground px-1">
          While turned off, you will not be shown in the Matchmaker experience.
        </p>

        <Button
          variant="outline"
          onClick={handleTerminateSessions}
          className="w-full py-6 text-destructive border-destructive/20 hover:bg-destructive/10"
        >
          Terminate all active sessions
        </Button>

        <p className="text-sm text-muted-foreground px-1">
          This will end all current sessions of Matchmaker.
        </p>

        <Button
          variant="outline"
          onClick={handleInviteFriends}
          className="w-full py-6"
        >
          <Share2 className="w-5 h-5 mr-2" />
          Invite friends to Matchmaker
        </Button>

        <p className="text-sm text-muted-foreground px-1">
          Invite a friend to recommend potential matches, without them needing to download the ISEXY app.
        </p>
      </div>
    </AuthLayout>
  );
}
