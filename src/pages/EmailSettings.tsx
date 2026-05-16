import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const EmailSettings = () => {
  const { user } = useAuth();
  const [newMatches, setNewMatches] = useState(true);
  const [newMessages, setNewMessages] = useState(true);
  const [promotions, setPromotions] = useState(true);

  const userEmail = user?.email || "user@example.com";

  const handleUnsubscribeAll = () => {
    setNewMatches(false);
    setNewMessages(false);
    setPromotions(false);
  };

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Control the emails you want to get - all of them, just the important stuff or the bare minimum. You can always unsubscribe from the bottom of any email.
        </p>

        <div className="bg-card rounded-lg mb-2">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <span className="text-foreground">{userEmail}</span>
            <Check className="h-5 w-5 text-primary" />
          </div>
          <div className="p-4">
            <span className="text-primary text-sm">Verified Email Address</span>
          </div>
        </div>

        <button className="w-full py-3 text-muted-foreground text-sm font-medium">
          SEND VERIFICATION EMAIL
        </button>

        <div className="bg-card rounded-lg mt-4">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <span className="text-foreground">New Matches</span>
            <Switch checked={newMatches} onCheckedChange={setNewMatches} />
          </div>
          <div className="p-4 flex items-center justify-between border-b border-border">
            <span className="text-foreground">New Messages</span>
            <Switch checked={newMessages} onCheckedChange={setNewMessages} />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <span className="text-foreground block">Promotions</span>
              <span className="text-sm text-muted-foreground">
                I want to receive news, updates and offers from ISEXY
              </span>
            </div>
            <Switch checked={promotions} onCheckedChange={setPromotions} />
          </div>
        </div>

        <button
          onClick={handleUnsubscribeAll}
          className="w-full py-3 text-foreground text-sm font-medium mt-4"
        >
          UNSUBSCRIBE FROM ALL
        </button>
      </div>
    </AuthLayout>
  );
};

export default EmailSettings;
