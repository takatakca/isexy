import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Heart, Sparkles, Star } from "lucide-react";
import { AuthButton } from "@/components/AuthButton";

// Mock top picks data
const mockTopPicks = [
  { id: 1, name: "Julie", age: 32, timeLeft: "24h left", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop" },
  { id: 2, name: "Melissa", age: 35, timeLeft: "24h left", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop" },
  { id: 3, name: "Aline", age: 34, timeLeft: "24h left", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop" },
  { id: 4, name: "Javiera", age: 28, timeLeft: "24h left", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop" },
];

export default function Likes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"likes" | "picks">("likes");

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background px-4 pt-12 pb-2">
        <h1 className="text-3xl font-extrabold text-foreground mb-4">Likes</h1>
        
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("likes")}
            className={`flex-1 py-3 text-center font-semibold relative ${
              activeTab === "likes" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            0 Likes
            {activeTab === "likes" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-rose-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("picks")}
            className={`flex-1 py-3 text-center font-semibold relative ${
              activeTab === "picks" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              Top Picks
              <span className="w-2 h-2 bg-rose-500 rounded-full" />
            </span>
            {activeTab === "picks" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-rose-500" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "likes" ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
          <p className="text-center text-muted-foreground mb-12">
            Upgrade to Gold to see people who have already liked you.
          </p>
          
          {/* Icon */}
          <div className="relative mb-8">
            <div className="flex items-center gap-1">
              <div className="flex flex-col gap-1">
                <div className="w-6 h-1 bg-yellow-500 rounded-full" />
                <div className="w-4 h-1 bg-yellow-500 rounded-full" />
                <div className="w-2 h-1 bg-yellow-500 rounded-full" />
              </div>
              <Heart className="w-16 h-16 text-yellow-500 fill-yellow-500" />
            </div>
          </div>
          
          <p className="text-center text-lg text-muted-foreground mb-12">
            See people who liked you with CubaDate Gold™
          </p>
          
          {/* CTA Button */}
          <AuthButton
            variant="primary"
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-foreground font-bold px-12"
            onClick={() => navigate("/premium")}
          >
            See Who Likes You
          </AuthButton>
        </div>
      ) : (
        <div className="px-4 py-4">
          <p className="text-center text-muted-foreground mb-6">
            Upgrade to CubaDate Gold™ for more Top Picks!
          </p>
          
          {/* Top Picks Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {mockTopPicks.map((pick) => (
              <div
                key={pick.id}
                className="relative rounded-xl overflow-hidden aspect-[3/4]"
              >
                {/* Blurred image */}
                <img
                  src={pick.image}
                  alt={pick.name}
                  className="w-full h-full object-cover blur-md scale-110"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                
                {/* Star button */}
                <button className="absolute bottom-4 right-4 w-10 h-10 bg-cyan-400 rounded-full flex items-center justify-center">
                  <Star className="w-5 h-5 text-white fill-white" />
                </button>
                
                {/* Info */}
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="font-bold text-lg">{pick.name}, {pick.age}</h3>
                  <p className="text-yellow-400 text-sm">{pick.timeLeft}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Unlock Button */}
          <AuthButton
            variant="primary"
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-foreground font-bold"
            onClick={() => navigate("/premium")}
          >
            Unlock all Top Picks
          </AuthButton>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
