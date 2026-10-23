import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { LikesReceivedGrid } from "@/components/LikesReceivedGrid";

export default function WhoLikedYou() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1" aria-label="Go back">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Who Liked You</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        <LikesReceivedGrid />
      </div>

      <BottomNav />
    </div>
  );
}
