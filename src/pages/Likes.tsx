import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Heart, Sparkles } from "lucide-react";
import { AuthButton } from "@/components/AuthButton";

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
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        {activeTab === "likes" ? (
          <>
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
          </>
        ) : (
          <>
            <div className="relative mb-8">
              <Sparkles className="w-16 h-16 text-primary" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">Top Picks</h2>
            <p className="text-center text-muted-foreground mb-12">
              Get curated matches picked just for you with CubaDate Gold™
            </p>
            
            <AuthButton
              variant="primary"
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-foreground font-bold px-12"
              onClick={() => navigate("/premium")}
            >
              Unlock Top Picks
            </AuthButton>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
