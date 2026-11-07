import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Public VAPID key. Must pair with the ISEXY_VAPID_PRIVATE_KEY function secret
 * used by isexy-send-push-notification (set VITE_VAPID_PUBLIC_KEY at build time
 * to the same pair's public key).
 */
const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  "BEL2aJLdQU6HLMU5kzF8b_3Ih8v9jYJ4G-w_sWIlY9GSmFc0YH4-3cJzqGqOHGKJflbMFnNCCFgPBYF6UuPgqZc";

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  loading: boolean;
}

/** Store this browser's subscription for the signed-in member (RLS: own rows only). */
async function saveSubscription(userId: string, subscription: PushSubscription) {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error("Incomplete push subscription");
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint: json.endpoint, p256dh, auth, updated_at: new Date().toISOString() },
      { onConflict: "user_id,endpoint" },
    );
  if (error) throw error;
}

function pushSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: "default",
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        if (!cancelled) setState((prev) => ({ ...prev, isSupported: false, loading: false }));
        return;
      }
      const permission = Notification.permission;
      try {
        // getRegistration(), not serviceWorker.ready: `ready` never resolves
        // when no worker is registered, which left this hook loading forever.
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = registration ? await registration.pushManager.getSubscription() : null;
        if (cancelled) return;
        setState({ isSupported: true, isSubscribed: !!subscription, permission, loading: false });
        // Keep the server copy in sync (subscribed before it was saved, or another account on this device).
        if (subscription && userId) saveSubscription(userId, subscription).catch((e) => console.warn("Push subscription sync failed:", e));
      } catch (error) {
        console.error("Error checking push subscription:", error);
        if (!cancelled) setState((prev) => ({ ...prev, isSupported: true, permission, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!pushSupported()) {
      toast.error("Push notifications are not supported in this browser");
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));
      if (permission === "granted") return true;
      if (permission === "denied") toast.error("Notifications are blocked. You can allow them in your browser settings.");
      return false;
    } catch (error) {
      console.error("Error requesting permission:", error);
      toast.error("Failed to request notification permission");
      return false;
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!pushSupported()) return false;
    if (!userId) {
      toast.error("Sign in to turn on notifications");
      return false;
    }
    try {
      if (Notification.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      // Without this row the server has nowhere to send notifications.
      await saveSubscription(userId, subscription);

      setState((prev) => ({ ...prev, isSubscribed: true, permission: "granted" }));
      toast.success("Push notifications enabled!");
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error("Failed to enable push notifications");
      return false;
    }
  }, [userId, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      // The stored row is kept (no deletes); the push service rejects this
      // endpoint from now on and the server just skips it.
      if (subscription) await subscription.unsubscribe();
      setState((prev) => ({ ...prev, isSubscribed: false }));
      toast.success("Push notifications disabled");
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to disable push notifications");
      return false;
    }
  }, []);

  const showLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!pushSupported() || Notification.permission !== "granted") return;
    new Notification(title, {
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      ...options,
    });
  }, []);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    showLocalNotification,
  };
}

// Helper to convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray.buffer as ArrayBuffer;
}
