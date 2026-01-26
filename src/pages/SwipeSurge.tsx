import { useState, useEffect } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";

const SwipeSurge = () => {
  const [participateInSwipeSurge, setParticipateInSwipeSurge] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("swipe_surge_participate");
    if (saved !== null) {
      setParticipateInSwipeSurge(saved === "true");
    }
  }, []);

  const handleToggle = (checked: boolean) => {
    setParticipateInSwipeSurge(checked);
    localStorage.setItem("swipe_surge_participate", String(checked));
  };

  return (
    <AuthLayout showBack variant="white">
      <h1 className="text-2xl font-bold text-foreground mb-6">Manage Swipe Surge™</h1>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-foreground font-medium">Participate in Swipe Surge</span>
          <Switch
            checked={participateInSwipeSurge}
            onCheckedChange={handleToggle}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-4 px-1">
        Turning this off will prevent you from being shown as swiping to other active users during a Swipe Surge
      </p>
    </AuthLayout>
  );
};

export default SwipeSurge;
