import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { LikesReceivedGrid } from "@/components/LikesReceivedGrid";

export default function WhoLikedYou() {
  return (
    <div className="min-h-screen bg-background pb-40">
      <AppHeader back backLabel="Go back" eyebrow="Likes" title="Who Liked You" />

      <div className="px-4 py-6 mx-auto max-w-3xl">
        <LikesReceivedGrid />
      </div>

      <BottomNav />
    </div>
  );
}
