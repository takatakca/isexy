import { useStreakTracker } from "@/hooks/useStreakTracker";
import { ConfettiNotification } from "@/components/ConfettiNotification";

interface StreakProviderProps {
  children: React.ReactNode;
}

export function StreakProvider({ children }: StreakProviderProps) {
  const { newBadge, showConfetti, clearNewBadge } = useStreakTracker();

  return (
    <>
      {children}
      <ConfettiNotification
        show={showConfetti}
        badgeType={newBadge}
        onClose={clearNewBadge}
      />
    </>
  );
}
