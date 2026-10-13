import { useState, useEffect } from "react";
import { toast } from "sonner";

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
    
    // Check if already subscribed
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
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

      // In production, send subscription to server
      console.log("Push subscription:", JSON.stringify(subscription));
      
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
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
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
