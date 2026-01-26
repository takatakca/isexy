import { useState, useEffect } from "react";
import { Zap, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SwipeSurgeNotificationProps {
  isActive: boolean;
  multiplier?: number;
  usersActive?: number;
}

export function SwipeSurgeNotification({
  isActive,
  multiplier = 15,
  usersActive = 47,
}: SwipeSurgeNotificationProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isActive && !dismissed) {
      // Slight delay before showing
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isActive, dismissed]);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-in slide-in-from-top duration-300">
      <div 
        className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-4 shadow-lg cursor-pointer"
        onClick={() => navigate("/discover")}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          className="absolute top-2 right-2 p-1 text-white/70 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Zap className="w-7 h-7 text-white fill-white" />
          </div>
          <div className="flex-1 text-white">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-lg">Swipe Surge™</span>
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                LIVE
              </span>
            </div>
            <p className="text-sm text-white/90">
              {usersActive} people active nearby. {multiplier}x more likely to match!
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-white/30 border-2 border-white/50"
              />
            ))}
            <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center">
              <span className="text-xs font-bold text-white">+{usersActive - 4}</span>
            </div>
          </div>
          <button className="px-4 py-2 bg-white text-purple-600 rounded-full font-bold text-sm">
            Start Swiping
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to manage Swipe Surge state
export function useSwipeSurge() {
  const [isActive, setIsActive] = useState(false);
  const [surgeData, setSurgeData] = useState({
    multiplier: 15,
    usersActive: 47,
  });

  useEffect(() => {
    // Simulate random surge events (in real app, this would be from backend)
    const checkSurge = () => {
      // Random chance of surge (10% every check)
      const hasSurge = Math.random() < 0.1;
      if (hasSurge) {
        setIsActive(true);
        setSurgeData({
          multiplier: Math.floor(Math.random() * 10) + 10,
          usersActive: Math.floor(Math.random() * 50) + 30,
        });
        
        // Surge lasts for 5-15 minutes
        const duration = (Math.random() * 10 + 5) * 60 * 1000;
        setTimeout(() => setIsActive(false), duration);
      }
    };

    // Check every 2 minutes
    const interval = setInterval(checkSurge, 2 * 60 * 1000);
    
    // Initial check after 10 seconds
    const initialCheck = setTimeout(checkSurge, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialCheck);
    };
  }, []);

  return { isActive, ...surgeData };
}
