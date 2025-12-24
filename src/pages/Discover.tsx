import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, X, Star, RotateCcw, Zap, Send, MapPin, Sliders } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

// Mock profile data
const mockProfiles = [
  {
    id: 1,
    name: "Florence",
    age: 28,
    location: "Nearby",
    distance: "9 km away",
    bio: "Dancing through life 💃 | Coffee lover ☕ | Looking for genuine connections",
    images: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=600&fit=crop",
    ],
  },
  {
    id: 2,
    name: "Isabella",
    age: 24,
    location: "Nearby",
    distance: "5 km away",
    bio: "Music is my passion 🎵 | Beach lover 🏖️ | Let's explore together",
    images: [
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=600&fit=crop",
    ],
  },
  {
    id: 3,
    name: "Camila",
    age: 28,
    location: "Nearby",
    distance: "12 km away",
    bio: "Chef in the making 👩‍🍳 | Adventure seeker | Looking for my partner",
    images: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=600&fit=crop",
    ],
  },
];

export default function Discover() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const currentProfile = mockProfiles[currentIndex];

  const handleSwipe = (direction: "left" | "right") => {
    if (isAnimating) return;
    
    setSwipeDirection(direction);
    setIsAnimating(true);
    
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % mockProfiles.length);
      setCurrentImageIndex(0);
      setSwipeDirection(null);
      setIsAnimating(false);
    }, 300);
  };

  const handleImageTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isRightSide = x > rect.width / 2;
    
    if (isRightSide) {
      setCurrentImageIndex((prev) => Math.min(prev + 1, currentProfile.images.length - 1));
    } else {
      setCurrentImageIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <button className="p-2">
          <Sliders className="w-6 h-6 text-muted-foreground" />
        </button>
        
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-foreground text-background rounded-full font-semibold text-sm">
            For You
          </button>
          <button className="px-4 py-2 text-muted-foreground font-semibold text-sm border border-border rounded-full">
            Double Date
          </button>
        </div>
        
        <button 
          onClick={() => navigate("/premium")}
          className="p-2"
        >
          <Zap className="w-6 h-6 text-purple-500 fill-purple-500" />
        </button>
      </header>

      {/* Card stack */}
      <main className="flex-1 flex items-start justify-center px-2 pt-2">
        <div className="relative w-full max-w-sm aspect-[3/4.5]">
          {/* Profile card */}
          <div
            onClick={handleImageTap}
            className={`absolute inset-0 rounded-xl overflow-hidden shadow-medium transition-transform duration-300 cursor-pointer ${
              swipeDirection === "left"
                ? "-translate-x-full rotate-[-20deg] opacity-0"
                : swipeDirection === "right"
                ? "translate-x-full rotate-[20deg] opacity-0"
                : ""
            }`}
          >
            {/* Image segments indicator */}
            <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
              {currentProfile.images.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    idx === currentImageIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>

            <img
              src={currentProfile.images[currentImageIndex]}
              alt={currentProfile.name}
              className="w-full h-full object-cover"
            />
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            
            {/* Location badge */}
            <div className="absolute top-16 left-4 bg-foreground/80 text-background text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {currentProfile.location}
            </div>
            
            {/* Boost button */}
            <button className="absolute bottom-28 right-4 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg">
              <Star className="w-6 h-6 text-primary-foreground fill-primary-foreground" />
            </button>
            
            {/* Profile info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    {currentProfile.name} <span className="font-normal">{currentProfile.age}</span>
                  </h2>
                  <p className="text-white/80 text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {currentProfile.distance}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Swipe indicators */}
          {swipeDirection === "left" && (
            <div className="absolute top-20 right-8 px-4 py-2 border-4 border-destructive text-destructive font-bold text-2xl rotate-12 animate-fade-in">
              NOPE
            </div>
          )}
          {swipeDirection === "right" && (
            <div className="absolute top-20 left-8 px-4 py-2 border-4 border-green-500 text-green-500 font-bold text-2xl -rotate-12 animate-fade-in">
              LIKE
            </div>
          )}
        </div>
      </main>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 px-6 py-4">
        <button className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-yellow-500 hover:scale-110 transition-transform border border-border">
          <RotateCcw className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => handleSwipe("left")}
          className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform border border-border"
        >
          <X className="w-8 h-8 text-rose-500" />
        </button>
        
        <button className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-blue-500 hover:scale-110 transition-transform border border-border">
          <Star className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => handleSwipe("right")}
          className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform border border-border"
        >
          <Heart className="w-8 h-8 text-green-500 fill-green-500" />
        </button>
        
        <button className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-blue-400 hover:scale-110 transition-transform border border-border">
          <Send className="w-5 h-5" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
