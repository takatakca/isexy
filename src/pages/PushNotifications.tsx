import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";

const PushNotifications = () => {
  const [newMatches, setNewMatches] = useState(true);
  const [messages, setMessages] = useState(true);
  const [messageLikes, setMessageLikes] = useState(true);
  const [superLikes, setSuperLikes] = useState(true);
  const [offersPromotions, setOffersPromotions] = useState(true);
  const [newLikes, setNewLikes] = useState(true);
  const [likesFrequency, setLikesFrequency] = useState<"1" | "10" | "100">("1");

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4">
        <div className="bg-card rounded-lg">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div>
              <span className="text-foreground block">New Matches</span>
              <span className="text-sm text-muted-foreground">You just got a new match</span>
            </div>
            <Switch checked={newMatches} onCheckedChange={setNewMatches} />
          </div>
          
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div>
              <span className="text-foreground block">Messages</span>
              <span className="text-sm text-muted-foreground">Someone sent you a new message</span>
            </div>
            <Switch checked={messages} onCheckedChange={setMessages} />
          </div>
          
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div>
              <span className="text-foreground block">Message Likes</span>
              <span className="text-sm text-muted-foreground">Someone liked your message</span>
            </div>
            <Switch checked={messageLikes} onCheckedChange={setMessageLikes} />
          </div>
          
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div>
              <span className="text-foreground block">Super Likes</span>
              <span className="text-sm text-muted-foreground">You've been Super Liked! Swipe to find out by whom.</span>
            </div>
            <Switch checked={superLikes} onCheckedChange={setSuperLikes} />
          </div>
          
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div>
              <span className="text-foreground block">Offers & Promotions</span>
              <span className="text-sm text-muted-foreground">Receive discounts, offers, promos, and other news from CubaDate</span>
            </div>
            <Switch checked={offersPromotions} onCheckedChange={setOffersPromotions} />
          </div>
          
          <div className="p-4 flex items-center justify-between">
            <div>
              <span className="text-foreground block">New Likes</span>
              <span className="text-sm text-muted-foreground">You have new likes. See who Likes You.</span>
            </div>
            <Switch checked={newLikes} onCheckedChange={setNewLikes} />
          </div>
        </div>

        {newLikes && (
          <div className="mt-4 space-y-2">
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
              className="w-full p-4 flex items-center justify-between border-b border-border"
            >
              <span className="text-foreground">Every 100 New Likes</span>
              {likesFrequency === "100" && <Check className="h-5 w-5 text-primary" />}
            </button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default PushNotifications;
