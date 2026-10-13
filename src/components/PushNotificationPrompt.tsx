import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
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

export function PushNotificationPrompt({ onComplete }: PushNotificationPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isSupported, permission, subscribe, loading } = usePushNotifications();

  useEffect(() => {
    // Check if we should show the prompt
    const hasSeenPrompt = localStorage.getItem("push_notification_prompt_shown");
    
    if (!hasSeenPrompt && isSupported && permission === "default" && !loading) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, loading]);

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      localStorage.setItem("push_notification_prompt_shown", "true");
      setIsOpen(false);
      onComplete?.();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("push_notification_prompt_shown", "true");
    setIsOpen(false);
    onComplete?.();
  };

  if (!isSupported || permission !== "default") {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Stay Connected! 💕
          </DialogTitle>
          <DialogDescription className="text-center">
            Enable notifications to know instantly when you get a new match, 
            message, or video call. Never miss a connection!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">💬</span>
            </div>
            <div>
              <p className="font-medium text-foreground">New Messages</p>
              <p className="text-sm text-muted-foreground">Get notified when someone messages you</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">❤️</span>
            </div>
            <div>
              <p className="font-medium text-foreground">New Matches</p>
              <p className="text-sm text-muted-foreground">Find out right away when you match</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">📹</span>
            </div>
            <div>
              <p className="font-medium text-foreground">Video Calls</p>
              <p className="text-sm text-muted-foreground">Never miss an incoming call</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleEnable} className="w-full gradient-primary">
            Enable Notifications
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full">
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
