import { BottomNav } from "@/components/BottomNav";
import { Users } from "lucide-react";

interface ExploreCategory {
  id: string;
  title: string;
  emoji: string;
  color: string;
  count: string;
}

const categories: { section: string; description: string; items: ExploreCategory[] }[] = [
  {
    section: "Goal-driven dating",
    description: "Find people with similar relationship goals",
    items: [
      { id: "long-term", title: "Long-term partner", emoji: "🌹", color: "bg-purple-400", count: "3K" },
      { id: "serious", title: "Serious Daters", emoji: "🦢", color: "bg-orange-500", count: "2K" },
      { id: "tonight", title: "Free Tonight", emoji: "🌙", color: "bg-purple-400", count: "802" },
      { id: "short-term", title: "Short-term fun", emoji: "✨", color: "bg-purple-400", count: "448" },
      { id: "friends", title: "New friends", emoji: "💫", color: "bg-rose-400", count: "243" },
      { id: "non-mono", title: "Non-monogamous", emoji: "🍍", color: "bg-cyan-500", count: "357" },
    ],
  },
  {
    section: "Similar plans and lifestyles",
    description: "Find people with similar life goals",
    items: [
      { id: "wants-kids", title: "Wants Kids", emoji: "👶", color: "bg-purple-400", count: "693" },
      { id: "child-free", title: "Child-Free", emoji: "🚗", color: "bg-rose-400", count: "360" },
      { id: "verified", title: "Get Photo Verified", emoji: "📸", color: "bg-orange-500", count: "2K" },
    ],
  },
  {
    section: "Shared interests or hobbies",
    description: "Find people with similar interests",
    items: [
      { id: "travel", title: "Travel", emoji: "🌍", color: "bg-rose-400", count: "1K" },
      { id: "binge", title: "Binge Watchers", emoji: "👁️", color: "bg-purple-400", count: "1K" },
      { id: "sporty", title: "Sporty", emoji: "🏸", color: "bg-orange-500", count: "1K" },
      { id: "coffee", title: "Coffee Date", emoji: "☕", color: "bg-cyan-500", count: "204" },
      { id: "date-night", title: "Date Night", emoji: "🍿", color: "bg-orange-500", count: "1K" },
      { id: "thrill", title: "Thrill Seekers", emoji: "🏍️", color: "bg-purple-400", count: "1K" },
      { id: "creatives", title: "Creatives", emoji: "🎨", color: "bg-cyan-500", count: "1K" },
      { id: "foodies", title: "Foodies", emoji: "🥡", color: "bg-rose-400", count: "1K" },
      { id: "nature", title: "Nature Lovers", emoji: "🌳", color: "bg-cyan-500", count: "1K" },
      { id: "music", title: "Music Lovers", emoji: "🎵", color: "bg-purple-400", count: "1K" },
      { id: "self-care", title: "Self Care", emoji: "🛁", color: "bg-rose-400", count: "1K" },
      { id: "gamers", title: "Gamers", emoji: "🎮", color: "bg-purple-400", count: "411" },
      { id: "pets", title: "Animal Parents", emoji: "🐕", color: "bg-orange-500", count: "135" },
    ],
  },
];

export default function Explore() {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background px-4 pt-12 pb-4">
        <h1 className="text-3xl font-extrabold text-foreground">Explore</h1>
      </div>

      {/* Categories */}
      <div className="px-4 space-y-8">
        {categories.map((section) => (
          <div key={section.section}>
            <h2 className="text-lg font-bold text-foreground mb-1">{section.section}</h2>
            <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
            
            <div className="grid grid-cols-2 gap-3">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={`${item.color} relative rounded-2xl p-4 h-40 flex flex-col justify-end text-left transition-transform active:scale-95`}
                >
                  {/* User count badge */}
                  <div className="absolute top-3 right-3 bg-foreground/80 text-background text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {item.count}
                  </div>
                  
                  {/* Emoji */}
                  <div className="text-5xl mb-2">{item.emoji}</div>
                  
                  {/* Title */}
                  <h3 className="text-white font-bold text-lg leading-tight">{item.title}</h3>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
