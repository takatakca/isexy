import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Check, Bell, MessageCircle, Heart, Star, Gift, Users, Smartphone, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useMemberSettings } from "@/hooks/useMemberSettings";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type PushPrefs = {
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
};

const DEFAULTS: PushPrefs = {
  newMatches: true, messages: true, messageLikes: true, superLikes: true, offersPromotions: true,
  newLikes: true, likesFrequency: "1", topPicks: true, swipeSurge: true, boostExpiring: true,
};

/** Choices saved by older versions on this device only. */
function legacyPrefs(): Partial<PushPrefs> {
  try {
    return JSON.parse(localStorage.getItem("push_notification_settings") || "{}");
  } catch {
    return {};
  }
}

const PushNotifications = () => {
  const { settings, loading, save } = useMemberSettings();
  const device = usePushNotifications();
  const prefs: PushPrefs = { ...DEFAULTS, ...(settings.push ?? legacyPrefs()) } as PushPrefs;
  const {
    newMatches, messages, messageLikes, superLikes, offersPromotions,
    newLikes, likesFrequency, topPicks, swipeSurge, boostExpiring,
  } = prefs;

  // Each choice saves right away (private member settings, see useMemberSettings).
  const update = async (patch: Partial<PushPrefs>) => {
    const savedOnServer = await save({ push: { ...prefs, ...patch } });
    if (savedOnServer) toast.success("Notification preferences saved");
    else toast.warning("Saved on this device only. We'll keep trying to sync it.");
  };
  const setNewMatches = (v: boolean) => update({ newMatches: v });
  const setMessages = (v: boolean) => update({ messages: v });
  const setMessageLikes = (v: boolean) => update({ messageLikes: v });
  const setSuperLikes = (v: boolean) => update({ superLikes: v });
  const setOffersPromotions = (v: boolean) => update({ offersPromotions: v });
  const setNewLikes = (v: boolean) => update({ newLikes: v });
  const setLikesFrequency = (v: PushPrefs["likesFrequency"]) => update({ likesFrequency: v });
  const setTopPicks = (v: boolean) => update({ topPicks: v });
  const setSwipeSurge = (v: boolean) => update({ swipeSurge: v });
  const setBoostExpiring = (v: boolean) => update({ boostExpiring: v });

  const deviceStatus = !device.isSupported
    ? "This browser can't receive push notifications."
    : device.permission === "denied"
      ? "Notifications are blocked for ISEXY in your browser settings."
      : device.isSubscribed
        ? "This device receives ISEXY notifications."
        : "Turn on to get notifications on this device.";

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
      <Switch checked={checked} onCheckedChange={onChange} disabled={loading} aria-label={title} className="flex-shrink-0" />
    </div>
  );

  return (
    <AuthLayout showBack variant="white">
      <h1 className="text-2xl font-bold text-foreground mb-6">Push Notifications</h1>

      <div className="space-y-4">
        {/* This device */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-foreground font-medium block">Push notifications on this device</span>
                <span className="text-sm text-muted-foreground">{deviceStatus}</span>
              </div>
            </div>
            <Switch
              checked={device.isSubscribed}
              disabled={device.loading || !device.isSupported || device.permission === "denied"}
              onCheckedChange={(on) => (on ? device.subscribe() : device.unsubscribe())}
              aria-label="Push notifications on this device"
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
