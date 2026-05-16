import { useState, useEffect } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Check, Bell, MessageCircle, Heart, Star, Gift, Users } from "lucide-react";

const PushNotifications = () => {
  const [newMatches, setNewMatches] = useState(true);
  const [messages, setMessages] = useState(true);
  const [messageLikes, setMessageLikes] = useState(true);
  const [superLikes, setSuperLikes] = useState(true);
  const [offersPromotions, setOffersPromotions] = useState(true);
  const [newLikes, setNewLikes] = useState(true);
  const [likesFrequency, setLikesFrequency] = useState<"1" | "10" | "100">("1");
  const [topPicks, setTopPicks] = useState(true);
  const [swipeSurge, setSwipeSurge] = useState(true);
  const [boostExpiring, setBoostExpiring] = useState(true);

  // Save to localStorage
  useEffect(() => {
    const settings = {
      newMatches,
      messages,
      messageLikes,
      superLikes,
      offersPromotions,
      newLikes,
      likesFrequency,
      topPicks,
      swipeSurge,
      boostExpiring,
    };
    localStorage.setItem("push_notification_settings", JSON.stringify(settings));
  }, [newMatches, messages, messageLikes, superLikes, offersPromotions, newLikes, likesFrequency, topPicks, swipeSurge, boostExpiring]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("push_notification_settings");
    if (saved) {
      const settings = JSON.parse(saved);
      setNewMatches(settings.newMatches ?? true);
      setMessages(settings.messages ?? true);
      setMessageLikes(settings.messageLikes ?? true);
      setSuperLikes(settings.superLikes ?? true);
      setOffersPromotions(settings.offersPromotions ?? true);
      setNewLikes(settings.newLikes ?? true);
      setLikesFrequency(settings.likesFrequency ?? "1");
      setTopPicks(settings.topPicks ?? true);
      setSwipeSurge(settings.swipeSurge ?? true);
      setBoostExpiring(settings.boostExpiring ?? true);
    }
  }, []);

  const NotificationRow = ({
    icon: Icon,
    title,
    description,
    checked,
    onChange,
  }: {
    icon: any;
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
