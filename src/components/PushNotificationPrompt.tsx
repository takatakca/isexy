import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Bell, MessageCircle, Users, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PushNotificationPromptProps {
  onComplete?: () => void;
}

const SEEN_KEY = "push_notification_prompt_shown";
/** Ask only inside the app (signed in, profile done), never on public or setup pages or mid-chat. */
const ASK_ON = /^\/(discover|explore|likes|matches|profile)(\/|$)/;

function seen() {
  try { return !!localStorage.getItem(SEEN_KEY); } catch { return true; }
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, "true"); } catch { /* ignore */ }
}

export function PushNotificationPrompt({ onComplete }: PushNotificationPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const { isSupported, isSubscribed, permission, subscribe, loading } = usePushNotifications();
  const eligible = !!user && !!profile && ASK_ON.test(pathname);

  useEffect(() => {
    if (!eligible || loading || !isSupported || isSubscribed || permission !== "default" || seen()) return;
    // Show after a short delay, once the page has settled.
    const timer = setTimeout(() => setIsOpen(true), 2500);
    return () => clearTimeout(timer);
  }, [eligible, isSupported, isSubscribed, permission, loading]);

  const close = () => {
    markSeen();
    setIsOpen(false);
    onComplete?.();
  };

  const handleEnable = async () => {
    setBusy(true);
    await subscribe();
    setBusy(false);
    // Asked once either way: the browser now remembers the answer.
    close();
  };

  if (!eligible || !isSupported || permission !== "default") {
    return null;
  }

  const items = [
    { icon: MessageCircle, title: "New messages", text: "Know when someone writes to you" },
    { icon: Users, title: "New matches", text: "Find out right away when you connect" },
    { icon: Phone, title: "Calls", text: "Never miss a phone or video call" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Stay connected
          </DialogTitle>
          <DialogDescription className="text-center">
            Turn on notifications to hear about new messages, matches and calls,
            even when ISEXY is closed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {items.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleEnable} disabled={busy} className="w-full gradient-primary">
            Enable notifications
          </Button>
          <Button variant="ghost" onClick={close} className="w-full">
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
