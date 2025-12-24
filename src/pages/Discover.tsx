import { useState } from "react";
import { Heart, X, Star, RotateCcw, Zap, User, MessageCircle, Flame } from "lucide-react";

// Mock profile data
const mockProfiles = [
  {
    id: 1,
    name: "Maria",
    age: 26,
    location: "Havana, Cuba",
    distance: "2,500 km away",
    bio: "Dancing through life 💃 | Coffee lover ☕ | Looking for genuine connections",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop",
  },
  {
    id: 2,
    name: "Isabella",
    age: 24,
    location: "Santiago, Cuba",
    distance: "2,800 km away",
    bio: "Music is my passion 🎵 | Beach lover 🏖️ | Let's explore together",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop",
  },
  {
    id: 3,
    name: "Camila",
    age: 28,
    location: "Varadero, Cuba",
    distance: "2,400 km away",
    bio: "Chef in the making 👩‍🍳 | Adventure seeker | Looking for my Canadian partner",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop",
  },
];

export default function Discover() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const currentProfile = mockProfiles[currentIndex];

  const handleSwipe = (direction: "left" | "right") => {
    if (isAnimating) return;
    
    setSwipeDirection(direction);
    setIsAnimating(true);
    
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % mockProfiles.length);
      setSwipeDirection(null);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button className="p-2">
          <User className="w-6 h-6 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-1 text-primary">
          <Flame className="w-8 h-8 fill-current" />
        </div>
        <button className="p-2">
          <MessageCircle className="w-6 h-6 text-muted-foreground" />
        </button>
      </header>

      {/* Card stack */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm aspect-[3/4]">
          {/* Profile card */}
          <div
            className={`absolute inset-0 rounded-2xl overflow-hidden shadow-medium transition-transform duration-300 ${
              swipeDirection === "left"
                ? "-translate-x-full rotate-[-20deg] opacity-0"
                : swipeDirection === "right"
                ? "translate-x-full rotate-[20deg] opacity-0"
                : ""
            }`}
          >
            <img
              src={currentProfile.image}
              alt={currentProfile.name}
              className="w-full h-full object-cover"
            />
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            {/* Profile info */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h2 className="text-3xl font-bold mb-1">
                {currentProfile.name}, {currentProfile.age}
              </h2>
              <p className="text-white/80 mb-1">{currentProfile.location}</p>
              <p className="text-white/60 text-sm mb-3">{currentProfile.distance}</p>
              <p className="text-white/90 text-sm leading-relaxed">{currentProfile.bio}</p>
            </div>
          </div>

          {/* Swipe indicators */}
          {swipeDirection === "left" && (
            <div className="absolute top-8 right-8 px-4 py-2 border-4 border-destructive text-destructive font-bold text-2xl rotate-12 animate-fade-in">
              NOPE
            </div>
          )}
          {swipeDirection === "right" && (
            <div className="absolute top-8 left-8 px-4 py-2 border-4 border-green-500 text-green-500 font-bold text-2xl -rotate-12 animate-fade-in">
              LIKE
            </div>
          )}
        </div>
      </main>

      {/* Action buttons */}
      <footer className="flex items-center justify-center gap-4 p-6">
        <button className="w-12 h-12 rounded-full border-2 border-yellow-400 flex items-center justify-center text-yellow-400 hover:bg-yellow-400/10 transition-colors">
          <RotateCcw className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => handleSwipe("left")}
          className="w-16 h-16 rounded-full border-2 border-destructive flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="w-8 h-8" />
        </button>
        
        <button className="w-12 h-12 rounded-full border-2 border-blue-400 flex items-center justify-center text-blue-400 hover:bg-blue-400/10 transition-colors">
          <Star className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => handleSwipe("right")}
          className="w-16 h-16 rounded-full border-2 border-green-500 flex items-center justify-center text-green-500 hover:bg-green-500/10 transition-colors"
        >
          <Heart className="w-8 h-8" />
        </button>
        
        <button className="w-12 h-12 rounded-full border-2 border-purple-400 flex items-center justify-center text-purple-400 hover:bg-purple-400/10 transition-colors">
          <Zap className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}
