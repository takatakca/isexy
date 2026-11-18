import { useState, useEffect } from "react";
import { Heart, MessageCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface MatchCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  onChatNow: () => void;
  matchName: string;
  matchPhotoUrl?: string;
  userPhotoUrl?: string;
}

export function MatchCelebration({ isOpen, onClose, onChatNow, matchName, matchPhotoUrl, userPhotoUrl }: MatchCelebrationProps) {
  const { profile } = useAuth();
  const [myPhoto, setMyPhoto] = useState<string | undefined>(userPhotoUrl);

  // Show the member's own first photo next to the match's.
  useEffect(() => {
    if (!isOpen || userPhotoUrl || !profile?.id) return;
    let alive = true;
    supabase
      .from("profile_photos")
      .select("photo_url")
      .eq("profile_id", profile.id)
      .order("position")
      .limit(1)
      .then(({ data }) => { if (alive && data?.[0]) setMyPhoto(data[0].photo_url); });
    return () => { alive = false; };
  }, [isOpen, userPhotoUrl, profile?.id]);

  // Escape = keep swiping.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const ownPhoto = userPhotoUrl ?? myPhoto;

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 overflow-hidden"
      >
        {/* Brand light */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(34rem_24rem_at_50%_35%,hsl(var(--primary)/0.35),transparent_70%),radial-gradient(28rem_18rem_at_80%_90%,hsl(var(--accent)/0.18),transparent_70%)]" />
        {/* Rising sparks */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          {[...Array(14)].map((_, i) => (
            <motion.span
              key={i}
              initial={{ y: "100vh", x: `${(i * 37) % 100}vw`, opacity: 0 }}
              animate={{ y: "-10vh", opacity: [0, 1, 0] }}
              transition={{ duration: 3.2 + (i % 5) * 0.5, delay: (i % 7) * 0.3, repeat: Infinity }}
              className={`absolute block rounded-full ${i % 3 === 0 ? "h-2 w-2 bg-accent/70" : "h-1.5 w-1.5 bg-primary/70"}`}
            />
          ))}
        </div>

        {/* Content */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 16 }}
          className="text-center relative z-10 w-full max-w-sm"
        >
          <p className="eyebrow mb-6">New connection</p>
          {/* Photos */}
          <div className="relative flex items-center justify-center mb-10 h-44">
            <motion.div
              initial={{ x: 30, rotate: 0 }}
              animate={{ x: 0, rotate: -8 }}
              transition={{ delay: 0.15, type: "spring", damping: 14 }}
              className="w-32 h-40 rounded-3xl overflow-hidden ring-2 ring-foreground/80 shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.9)] -mr-5 z-10 bg-card"
            >
              {ownPhoto ? (
                <img src={ownPhoto} alt="You" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-secondary flex items-center justify-center">
                  <Heart className="w-10 h-10 text-foreground" />
                </div>
              )}
            </motion.div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.35, type: "spring" }}
              className="absolute z-20 w-14 h-14 rounded-full gradient-primary ring-4 ring-background flex items-center justify-center shadow-glow"
            >
              <Heart className="w-6 h-6 text-white fill-white" />
            </motion.div>
            <motion.div
              initial={{ x: -30, rotate: 0 }}
              animate={{ x: 0, rotate: 8 }}
              transition={{ delay: 0.15, type: "spring", damping: 14 }}
              className="w-32 h-40 rounded-3xl overflow-hidden ring-2 ring-accent shadow-[0_24px_60px_-20px_hsl(var(--accent)/0.8)] -ml-5 z-10 bg-card"
            >
              {matchPhotoUrl ? (
                <img src={matchPhotoUrl} alt={matchName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-secondary flex items-center justify-center">
                  <span className="font-display text-foreground text-3xl font-extrabold">{matchName[0]}</span>
                </div>
              )}
            </motion.div>
          </div>

          <motion.h1
            id="match-title"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="type-display text-4xl sm:text-5xl mb-3"
          >
            <span className="text-gradient">It's a Match!</span>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-muted-foreground text-lg mb-10"
          >
            You and {matchName} liked each other
          </motion.p>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="space-y-2 w-full max-w-xs mx-auto"
          >
            <button
              autoFocus
              onClick={onChatNow}
              className="cta-primary w-full h-14 text-base"
            >
              <MessageCircle className="w-5 h-5" />
              Chat Now
            </button>
            <button
              onClick={onClose}
              className="w-full min-h-12 rounded-full text-muted-foreground font-semibold flex items-center justify-center gap-2 hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              Keep Swiping
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
