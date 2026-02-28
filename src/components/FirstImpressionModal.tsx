import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface FirstImpressionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  targetName: string;
  targetPhotoUrl?: string;
  remainingImpressions: number;
}

export function FirstImpressionModal({
  isOpen,
  onClose,
  onSend,
  targetName,
  targetPhotoUrl,
  remainingImpressions,
}: FirstImpressionModalProps) {
  const [message, setMessage] = useState("");
  const maxLength = 140;

  const handleSend = useCallback(() => {
    if (message.trim().length === 0) return;
    onSend(message.trim());
    setMessage("");
  }, [message, onSend]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 300 }}
          animate={{ y: 0 }}
          exit={{ y: 300 }}
          transition={{ type: "spring", damping: 25 }}
          className="w-full max-w-md bg-card rounded-t-3xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-cyan-500 fill-cyan-500" />
              <h2 className="text-lg font-bold text-foreground">First Impression</h2>
            </div>
            <button onClick={onClose} className="p-1">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Target preview */}
          <div className="flex items-center gap-3 mb-4">
            {targetPhotoUrl ? (
              <img src={targetPhotoUrl} alt={targetName} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                {targetName[0]}
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">Send {targetName} a message</p>
              <p className="text-xs text-muted-foreground">
                Stand out with a message before matching • {remainingImpressions} left this week
              </p>
            </div>
          </div>

          {/* Message input */}
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
            placeholder={`Say something to ${targetName}...`}
            className="mb-2 resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-muted-foreground">{message.length}/{maxLength}</span>
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={message.trim().length === 0}
            className="w-full py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
            Send Super Like + Message
          </button>

          <button onClick={onClose} className="w-full text-center text-sm text-muted-foreground mt-3">
            Send without message
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
