import { X, Zap, Timer } from "lucide-react";

interface BoostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boostsRemaining: number;
  primetimeBoostsRemaining: number;
  onGetMoreBoosts: () => void;
}

export function BoostsModal({
  isOpen,
  onClose,
  boostsRemaining,
  primetimeBoostsRemaining,
  onGetMoreBoosts,
}: BoostsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="bg-background rounded-t-3xl w-full max-w-md animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Close button */}
        <div className="px-4 pb-2">
          <button onClick={onClose} className="p-2">
            <X className="w-6 h-6 text-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-8">
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">
            My Boosts
          </h2>
          <p className="text-muted-foreground text-center mb-6">
            Be a top profile in your area for 30 minutes to get more matches
          </p>

          {/* Boost types */}
          <div className="space-y-4 mb-8">
            {/* Regular Boosts */}
            <div className="flex items-center gap-4 py-3 border-b border-border">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground">Boosts</p>
                <p className="text-sm text-muted-foreground">{boostsRemaining} left</p>
              </div>
            </div>

            {/* Primetime Boosts */}
            <div className="flex items-center gap-4 py-3">
              <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                <Timer className="w-6 h-6 text-pink-500" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground">Primetime Boosts</p>
                <p className="text-sm text-muted-foreground">{primetimeBoostsRemaining} left</p>
              </div>
            </div>
          </div>

          {/* Get more button */}
          <button
            onClick={onGetMoreBoosts}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-bold text-lg hover:opacity-90 transition-opacity"
          >
            Get more Boosts
          </button>
        </div>
      </div>
    </div>
  );
}
