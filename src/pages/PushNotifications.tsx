import { useState, useEffect, useRef } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Check, Bell, MessageCircle, Heart, Star, Gift, Users, type LucideIcon } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { loadNotificationSettings, saveNotificationSettings } from "@/lib/notificationSettings";

const SETTINGS_KEY = "push_notification_settings";

interface PushSettings {
  newMatches: boolean;
  messages: boolean;
  messageLikes: boolean;
  superLikes: boolean;
  offersPromotions: boolean;
  newLikes: boolean;
  likesFrequency: "1" | "10" | "100";
  topPicks: boolean;
  swipeSurge: boolean;
  boostExpiring: boolean;
}

const DEFAULTS: PushSettings = {
  newMatches: true,
  messages: true,
  messageLikes: true,
  superLikes: true,
  offersPromotions: true,
  newLikes: true,
  likesFrequency: "1",
  topPicks: true,
  swipeSurge: true,
  boostExpiring: true,
};

/** Read once, before the first save (the save effect used to overwrite saved choices with defaults). */
function loadSettings(): PushSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

const PushNotifications = () => {
  const [settings, setSettings] = useState<PushSettings>(loadSettings);
  const push = usePushNotifications();
  const set = <K extends keyof PushSettings>(key: K) => (value: PushSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const {
    newMatches, messages, messageLikes, superLikes, offersPromotions,
    newLikes, likesFrequency, topPicks, swipeSurge, boostExpiring,
  } = settings;
  const setNewMatches = set("newMatches");
  const setMessages = set("messages");
  const setMessageLikes = set("messageLikes");
  const setSuperLikes = set("superLikes");
  const setOffersPromotions = set("offersPromotions");
  const setNewLikes = set("newLikes");
  const setLikesFrequency = set("likesFrequency");
  const setTopPicks = set("topPicks");
  const setSwipeSurge = set("swipeSurge");
  const setBoostExpiring = set("boostExpiring");

  // The account's saved choices (used by the push function) win over this browser's copy.
  const { user } = useAuth();
  const { language, autoTranslate } = useLanguage();
  const userId = user?.id;
  const serverLoaded = useRef(false);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadNotificationSettings(userId).then((stored) => {
      if (cancelled) return;
      if (stored?.push) setSettings((prev) => ({ ...prev, ...(stored.push as Partial<PushSettings>) }));
      serverLoaded.current = true;
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* private mode: choices last for this visit only */
    }
    if (!userId || !serverLoaded.current) return;
    const timer = window.setTimeout(() => {
      void saveNotificationSettings(userId, "push", { ...settings }, {
        preferred_language: language.code,
        auto_translate: autoTranslate,
      });
    }, 600);
    return () => window.clearTimeout(timer);
    // Save when the choices change, not when the language does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, userId]);

  const deviceHint = !push.isSupported
    ? "This browser can't receive push notifications."
    : push.permission === "denied"
      ? "Blocked in your browser settings. Allow notifications for this site to turn them on."
      : push.isSubscribed
        ? "On for this device."
        : "Off for this device.";

  const NotificationRow = ({
    icon: Icon,
    title,
    description,
    checked,
    onChange,
  }: {
    icon: LucideIcon;
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <div className="p-4 flex items-start justify-between border-b border-border last:border-0">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-foreground font-medium block">{title}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="flex-shrink-0" />
    </div>
  );

  return (
    <AuthLayout showBack variant="white">
      <h1 className="text-2xl font-bold text-foreground mb-6">Push Notifications</h1>

      <div className="space-y-4">
        {/* This device */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-foreground font-medium block">Notifications on this device</span>
                <span className="text-sm text-muted-foreground">{deviceHint}</span>
              </div>
            </div>
            <Switch
              checked={push.isSubscribed}
              disabled={push.loading || !push.isSupported || push.permission === "denied"}
              onCheckedChange={(on) => void (on ? push.subscribe() : push.unsubscribe())}
              aria-label="Notifications on this device"
              className="flex-shrink-0"
            />
          </div>
        </div>

        {/* Match Notifications */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <h2 className="px-4 pt-4 pb-2 font-semibold text-foreground text-sm uppercase tracking-wide">
            Matches & Messages
          </h2>
          <NotificationRow
            icon={Heart}
            title="New Matches"
            description="You just got a new match"
            checked={newMatches}
            onChange={setNewMatches}
          />
          <NotificationRow
            icon={MessageCircle}
            title="Messages"
            description="Someone sent you a new message"
            checked={messages}
            onChange={setMessages}
          />
          <NotificationRow
            icon={Heart}
            title="Message Likes"
            description="Someone liked your message"
            checked={messageLikes}
            onChange={setMessageLikes}
          />
        </div>

        {/* Feature Notifications */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <h2 className="px-4 pt-4 pb-2 font-semibold text-foreground text-sm uppercase tracking-wide">
            Features
          </h2>
          <NotificationRow
            icon={Star}
            title="Super Likes"
            description="You've been Super Liked! Swipe to find out by whom."
            checked={superLikes}
            onChange={setSuperLikes}
          />
          <NotificationRow
            icon={Users}
            title="New Likes"
            description="You have new likes. See who Likes You."
            checked={newLikes}
            onChange={setNewLikes}
          />
          <NotificationRow
            icon={Star}
            title="Top Picks"
            description="Your daily Top Picks are ready to view"
            checked={topPicks}
            onChange={setTopPicks}
          />
          <NotificationRow
            icon={Bell}
            title="Swipe Surge"
            description="High activity in your area right now"
            checked={swipeSurge}
            onChange={setSwipeSurge}
          />
          <NotificationRow
            icon={Bell}
            title="Boost Expiring"
            description="Your Boost is about to end"
            checked={boostExpiring}
            onChange={setBoostExpiring}
          />
        </div>

        {/* Likes Frequency */}
        {newLikes && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <h2 className="px-4 pt-4 pb-2 font-semibold text-foreground text-sm uppercase tracking-wide">
              Likes Notification Frequency
            </h2>
            <button
              onClick={() => setLikesFrequency("1")}
              className="w-full p-4 flex items-center justify-between border-b border-border"
            >
              <span className="text-foreground">Every 1 New Like</span>
              {likesFrequency === "1" && <Check className="h-5 w-5 text-primary" />}
            </button>
            <button
              onClick={() => setLikesFrequency("10")}
              className="w-full p-4 flex items-center justify-between border-b border-border"
            >
              <span className="text-foreground">Every 10 New Likes</span>
              {likesFrequency === "10" && <Check className="h-5 w-5 text-primary" />}
            </button>
            <button
              onClick={() => setLikesFrequency("100")}
              className="w-full p-4 flex items-center justify-between"
            >
              <span className="text-foreground">Every 100 New Likes</span>
              {likesFrequency === "100" && <Check className="h-5 w-5 text-primary" />}
            </button>
          </div>
        )}

        {/* Promotions */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <h2 className="px-4 pt-4 pb-2 font-semibold text-foreground text-sm uppercase tracking-wide">
            Marketing
          </h2>
          <NotificationRow
            icon={Gift}
            title="Offers & Promotions"
            description="Receive discounts, offers, promos, and other news from ISEXY"
            checked={offersPromotions}
            onChange={setOffersPromotions}
          />
        </div>
      </div>
    </AuthLayout>
  );
};

export default PushNotifications;
