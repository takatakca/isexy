import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { useDeviceSetting } from "@/hooks/useDeviceSetting";
import { shareLink } from "@/lib/share";

export default function Matchmaker() {
  const [showInMatchmaker, setShowInMatchmaker] = useDeviceSetting("introductions_show_me", true);

  // Introductions sessions are not live yet, so there is nothing to end.
  const handleTerminateSessions = () => {
    toast("You have no active Introductions sessions.");
  };

  const handleInviteFriends = () => shareLink({
    title: "Join ISEXY Introductions",
    text: "Introduce me to your friends on ISEXY!",
    url: "/",
  });

  return (
    <AuthLayout showBack variant="white">
      <h1 className="text-2xl font-bold text-foreground mb-6">Manage Introductions</h1>

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">Show me in Introductions</span>
            <Switch
              checked={showInMatchmaker}
              onCheckedChange={setShowInMatchmaker}
              aria-label="Show me in Introductions"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground px-1">
          While turned off, friends cannot introduce you to other people through Introductions.
        </p>

        <Button
          variant="outline"
          onClick={handleTerminateSessions}
          className="w-full py-6 text-destructive border-destructive/20 hover:bg-destructive/10"
        >
          Terminate all active sessions
        </Button>

        <p className="text-sm text-muted-foreground px-1">
          This will end all current Introductions sessions.
        </p>

        <Button
          variant="outline"
          onClick={handleInviteFriends}
          className="w-full py-6"
        >
          <Share2 className="w-5 h-5 mr-2" />
          Invite friends to Introductions
        </Button>

        <p className="text-sm text-muted-foreground px-1">
          Introduce two of your friends to each other, or let a friend introduce you to people they think you'd get along with, without them needing to download the ISEXY app.
        </p>
      </div>
    </AuthLayout>
  );
}
