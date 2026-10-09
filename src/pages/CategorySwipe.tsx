import { useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SwipeDeck } from "@/components/SwipeDeck";
import { MatchCelebration } from "@/components/MatchCelebration";
import { useDiscoverDeck, type SwipeAction, type SwipeOutcome } from "@/hooks/useDiscoverDeck";
import type { FeedProfile } from "@/lib/discoverFeed";

const categoryTitles: Record<string, string> = {
  "long-term": "Long-term Friendships",
  serious: "Deep Conversations",
  tonight: "Free Tonight",
  "short-term": "Just for Fun",
  friends: "New Friends",
  "non-mono": "Language Exchange",
  "wants-kids": "Family-Oriented",
  "child-free": "Child-Free",
  travel: "Travel",
  anthem: "Add an Anthem",
  foodies: "Foodies",
  nature: "Outdoor Fans",
  music: "Music Fans",
  "self-care": "Self Care",
  gamers: "Gamers",
  pets: "Animal Parents",
  binge: "Binge Watchers",
  sporty: "Sporty",
  coffee: "Coffee Chats",
  "date-night": "Night Out",
  thrill: "Thrill Seekers",
  creatives: "Creatives",
};

const categoryInterests: Record<string, string[]> = {
  "long-term": ["long-term", "friendship", "loyalty"],
  serious: ["conversation", "philosophy", "deep talks", "books"],
  tonight: ["tonight", "casual", "spontaneous"],
  "short-term": ["casual", "fun", "short-term"],
  friends: ["friends", "friendship", "platonic"],
  "non-mono": ["language exchange", "languages", "french", "english", "spanish"],
  "wants-kids": ["kids", "children", "family"],
  "child-free": ["child-free", "no kids"],
  travel: ["travel", "adventure", "explore"],
  anthem: ["music", "anthem"],
  foodies: ["cooking", "food", "restaurants", "baking"],
  nature: ["hiking", "nature", "camping", "outdoors"],
  music: ["music", "concerts", "guitar", "singing"],
  "self-care": ["self-care", "wellness", "meditation", "mindfulness"],
  gamers: ["gaming", "video games", "esports"],
  pets: ["pets", "dogs", "cats", "animals"],
  binge: ["netflix", "movies", "tv shows", "binge"],
  sporty: ["fitness", "gym", "yoga", "running", "sports"],
  coffee: ["coffee", "cafe"],
  "date-night": ["night out", "dining", "nightlife"],
  thrill: ["thrill", "extreme sports", "adventure"],
  creatives: ["art", "creative", "photography", "design", "writing"],
};

export default function CategorySwipe() {
  const { category = "" } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const title = categoryTitles[category] || "Explore";
  // Same secure, server-ranked deck as Discover, narrowed to this category.
  const deck = useDiscoverDeck({ source: `explore:${category}`, interests: categoryInterests[category] ?? [category] });

  const onSwiped = useCallback((action: SwipeAction, profile: FeedProfile, settled: Promise<SwipeOutcome>) => {
    if (action !== "pass") toast.success(action === "super_like" ? `Super Liked ${profile.first_name} ⭐` : `Liked ${profile.first_name} ❤️`, { duration: 1200 });
    settled.then((o) => {
      if (o.status === "ok") return;
      if (o.status === "no_likes" || o.status === "rate_limited") {
        toast.error("You're out of likes for now.", { action: { label: "Go Premium", onClick: () => navigate("/premium") } });
      } else if (o.status === "no_super_likes") {
        navigate("/get-super-likes");
      } else {
        toast.error(`Couldn't save that swipe — ${profile.first_name} is back on top.`);
      }
    });
  }, [navigate]);

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/explore")} className="p-2 -ml-2" aria-label="Back to Explore"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
        </div>
      </header>

      {deck.match && (
        <MatchCelebration
          isOpen
          onClose={deck.clearMatch}
          onChatNow={() => { const id = deck.match!.matchId; deck.clearMatch(); navigate(`/chat/${id}`); }}
          matchName={deck.match.name}
          matchPhotoUrl={deck.match.photoUrl}
        />
      )}

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4">
        {deck.loading ? (
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        ) : deck.top ? (
          <SwipeDeck deck={deck} onSwiped={onSwiped} paused={!!deck.match} />
        ) : (
          <div className="text-center px-8">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4"><Info className="w-10 h-10 text-muted-foreground" /></div>
            <h2 className="text-xl font-bold text-foreground mb-2">No more {title}</h2>
            <p className="text-muted-foreground mb-6">Check back later or explore other interests!</p>
            <Button onClick={() => navigate("/explore")}>Explore More</Button>
          </div>
        )}
      </div>
    </div>
  );
}
