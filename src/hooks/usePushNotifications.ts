import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Store this device's push subscription for the signed-in member (no-op when signed out). */
async function saveSubscription(subscription: PushSubscription) {
  const { data: { session } } = await supabase.auth.getSession();
  const json = subscription.toJSON();
  if (!session?.user || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: session.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: "user_id,endpoint" },
  );
  if (error) console.warn("Push subscription not saved:", error.message);
}

const VAPID_PUBLIC_KEY = "BEL2aJLdQU6HLMU5kzF8b_3Ih8v9jYJ4G-w_sWIlY9GSmFc0YH4-3cJzqGqOHGKJflbMFnNCCFgPBYF6UuPgqZc";

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  loading: boolean;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: "default",
    loading: true,
  });

  useEffect(() => {
    checkSupport();
  }, []);

  const checkSupport = async () => {
    const isSupported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    
    if (!isSupported) {
      setState(prev => ({ ...prev, isSupported: false, loading: false }));
      return;
    }

    const permission = Notification.permission;
    
    // Check if already subscribed. getRegistration, not `ready`: `ready` never
    // resolves until a service worker is registered, which left this loading forever.
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription) await saveSubscription(subscription);

      setState({
        isSupported: true,
        isSubscribed: !!subscription,
        permission,
        loading: false,
      });
    } catch (error) {
      console.error("Error checking push subscription:", error);
      setState(prev => ({ ...prev, isSupported, permission, loading: false }));
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      
      if (permission === "granted") {
        return true;
      } else if (permission === "denied") {
        toast.error("Notification permission denied. Please enable in browser settings.");
        return false;
      }
      
      return false;
    } catch (error) {
      console.error("Error requesting permission:", error);
      toast.error("Failed to request notification permission");
      return false;
    }
  };

  const subscribe = async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    try {
      // Request permission first
      if (state.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      // Register service worker if not registered
      let registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // isexy-send-push-notification reads the member's devices from isexy.push_subscriptions.
      await saveSubscription(subscription);

      setState(prev => ({ ...prev, isSubscribed: true }));
      toast.success("Push notifications enabled!");
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error("Failed to enable push notifications");
      return false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;

      if (subscription) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // This device's own row only (RLS: auth.uid() = user_id).
          await supabase.from("push_subscriptions").delete()
            .eq("user_id", session.user.id).eq("endpoint", subscription.endpoint);
        }
        await subscription.unsubscribe();
        setState(prev => ({ ...prev, isSubscribed: false }));
        toast.success("Push notifications disabled");
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to disable push notifications");
      return false;
    }
  };

  const showLocalNotification = (title: string, options?: NotificationOptions) => {
    if (state.permission !== "granted") return;
    
    new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });
  };

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
