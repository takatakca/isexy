import { useState, useEffect } from "react";
import { Heart, MessageCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MatchCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  onChatNow: () => void;
  matchName: string;
  matchPhotoUrl?: string;
  userPhotoUrl?: string;
}

export function MatchCelebration({ isOpen, onClose, onChatNow, matchName, matchPhotoUrl, userPhotoUrl }: MatchCelebrationProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-gradient-to-b from-primary/90 to-primary/70 backdrop-blur-sm flex flex-col items-center justify-center p-6"
      >
        {/* Hearts background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: "100vh", x: `${Math.random() * 100}vw`, opacity: 0 }}
              animate={{ y: "-10vh", opacity: [0, 1, 0] }}
              transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 2, repeat: Infinity }}
              className="absolute"
            >
              <Heart className="w-6 h-6 text-white/30 fill-white/20" />
            </motion.div>
          ))}
        </div>

        {/* Content */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="text-center relative z-10"
        >
          {/* Photos */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl -mr-4 z-10">
              {userPhotoUrl ? (
                <img src={userPhotoUrl} alt="You" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                  <Heart className="w-10 h-10 text-white" />
                </div>
              )}
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center z-20 shadow-lg"
            >
              <Heart className="w-6 h-6 text-primary fill-primary" />
            </motion.div>
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl -ml-4 z-10">
              {matchPhotoUrl ? (
                <img src={matchPhotoUrl} alt={matchName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{matchName[0]}</span>
                </div>
              )}
            </div>
          </div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-extrabold text-white mb-2"
          >
            It's a Match!
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/80 text-lg mb-10"
          >
            You and {matchName} liked each other
          </motion.p>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="space-y-3 w-full max-w-xs mx-auto"
          >
            <button
              onClick={onChatNow}
              className="w-full py-4 bg-white text-primary font-bold rounded-full text-lg flex items-center justify-center gap-2 shadow-lg hover:bg-white/90 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Chat Now
            </button>
            <button
              onClick={onClose}
              className="w-full py-4 text-white/80 font-semibold flex items-center justify-center gap-2 hover:text-white transition-colors"
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
