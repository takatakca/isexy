import { BadgeCheck, X } from "lucide-react";

interface PhotoVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export function PhotoVerificationModal({
  isOpen,
  onClose,
  onContinue,
}: PhotoVerificationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-3xl p-6 max-w-sm w-full text-center shadow-xl animate-in fade-in zoom-in duration-200">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 bg-blue-500 rounded-full flex items-center justify-center">
          <BadgeCheck className="w-12 h-12 text-white" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-foreground mb-3">
          Get Photo Verified
        </h2>

        {/* Description */}
        <p className="text-muted-foreground mb-8">
          Help show you really look like your photos!
        </p>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={onContinue}
            className="w-full py-4 bg-background text-background rounded-full font-bold text-lg hover:opacity-90 transition-opacity"
          >
            Continue
          </button>

          <button
            onClick={onClose}
            className="w-full py-4 bg-transparent text-foreground rounded-full font-bold text-lg border border-border hover:bg-muted transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
