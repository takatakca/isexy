import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Users } from "lucide-react";
import Forum from "@/components/Forum";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ExploreCategory {
  id: string;
  title: string;
  color: string;
  count: string;
  image?: string;
  featured?: boolean;
}

const categories: { section: string; description: string; items: ExploreCategory[] }[] = [
  {
    section: "Goal-driven dating",
    description: "Find people with similar relationship goals",
    items: [
      { id: "long-term", title: "Long-term partner", color: "from-orange-600/90 to-rose-500/90", count: "3K", featured: true },
      { id: "serious", title: "Serious Daters", color: "from-red-600/90 to-orange-500/90", count: "2K" },
      { id: "tonight", title: "Free Tonight", color: "from-purple-600/90 to-violet-500/90", count: "776" },
      { id: "short-term", title: "Short-term fun", color: "from-pink-600/90 to-rose-500/90", count: "448" },
      { id: "friends", title: "New friends", color: "from-rose-500/90 to-pink-500/90", count: "243" },
      { id: "non-mono", title: "Non-monogamous", color: "from-cyan-600/90 to-teal-500/90", count: "357" },
    ],
  },
  {
    section: "Similar plans and lifestyles",
    description: "Find people with similar life goals",
    items: [
      { id: "wants-kids", title: "Wants Kids", color: "from-green-600/90 to-emerald-500/90", count: "685" },
      { id: "child-free", title: "Child-Free", color: "from-cyan-600/90 to-teal-500/90", count: "339" },
    ],
  },
  {
    section: "Shared interests or hobbies",
    description: "Find people with similar interests",
    items: [
      { id: "travel", title: "Travel", color: "from-rose-600/90 to-pink-500/90", count: "1K" },
      { id: "anthem", title: "Add an Anthem", color: "from-cyan-600/90 to-blue-500/90", count: "1K" },
      { id: "foodies", title: "Foodies", color: "from-red-800/90 to-rose-600/90", count: "1K" },
      { id: "nature", title: "Nature Lovers", color: "from-green-600/90 to-emerald-500/90", count: "1K" },
      { id: "music", title: "Music Lovers", color: "from-purple-700/90 to-violet-500/90", count: "1K" },
      { id: "self-care", title: "Self Care", color: "from-green-600/90 to-teal-500/90", count: "1K" },
      { id: "gamers", title: "Gamers", color: "from-green-700/90 to-emerald-600/90", count: "436" },
      { id: "pets", title: "Animal Parents", color: "from-red-700/90 to-orange-600/90", count: "147" },
      { id: "binge", title: "Binge Watchers", color: "from-green-600/90 to-teal-500/90", count: "1K" },
      { id: "sporty", title: "Sporty", color: "from-red-600/90 to-orange-500/90", count: "1K" },
      { id: "coffee", title: "Coffee Date", color: "from-yellow-600/90 to-amber-500/90", count: "192" },
      { id: "date-night", title: "Date Night", color: "from-pink-700/90 to-rose-600/90", count: "1K" },
      { id: "thrill", title: "Thrill Seekers", color: "from-orange-600/90 to-amber-500/90", count: "1K" },
      { id: "creatives", title: "Creatives", color: "from-purple-600/90 to-violet-500/90", count: "1K" },
    ],
  },
];

// Placeholder images for categories (using gradients as fallback)
const categoryImages: Record<string, string> = {
  "long-term": "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&h=500&fit=crop",
  "serious": "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400&h=500&fit=crop",
  "tonight": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=500&fit=crop",
  "wants-kids": "https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=400&h=500&fit=crop",
  "child-free": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=500&fit=crop",
  "travel": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=500&fit=crop",
  "anthem": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=500&fit=crop",
  "foodies": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=500&fit=crop",
  "nature": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=500&fit=crop",
  "music": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=500&fit=crop",
  "self-care": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=500&fit=crop",
  "gamers": "https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=400&h=500&fit=crop",
  "pets": "https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=400&h=500&fit=crop",
  "binge": "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=400&h=500&fit=crop",
  "sporty": "https://images.unsplash.com/photo-1461896836934- voices?w=400&h=500&fit=crop",
  "coffee": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=500&fit=crop",
  "date-night": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=500&fit=crop",
};

export default function Explore() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("discover");

  const handleCategoryClick = (category: ExploreCategory) => {
    navigate(`/explore/${category.id}`);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background px-4 pt-12 pb-4">
        <h1 className="text-3xl font-extrabold text-foreground">Explore</h1>
      </div>

      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="forum">Forum</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-8">
            {categories.map((section) => (
              <div key={section.section}>
                <h2 className="text-lg font-bold text-foreground mb-1">{section.section}</h2>
                <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
                
                <div className="grid grid-cols-2 gap-3">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleCategoryClick(item)}
                      className={`relative rounded-2xl overflow-hidden ${item.featured ? 'col-span-2 h-48' : 'h-44'} flex flex-col justify-end text-left transition-transform active:scale-[0.98]`}
                    >
                      {categoryImages[item.id] && (
                        <img
                          src={categoryImages[item.id]}
                          alt={item.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.color} mix-blend-multiply`} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute top-3 right-3 bg-background/90 text-background text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                        <Users className="w-3 h-3" />
                        {item.count}
                      </div>
                      <div className="relative z-10 p-4">
                        <h3 className="text-white font-bold text-xl leading-tight drop-shadow-lg">
                          {item.title}
                        </h3>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="forum">
            <Forum />
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
