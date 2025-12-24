import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";

const SwipeSurge = () => {
  const [participateInSwipeSurge, setParticipateInSwipeSurge] = useState(true);

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4">
        <div className="bg-card rounded-lg">
          <div className="p-4 flex items-center justify-between">
            <span className="text-foreground font-medium">Participate in Swipe Surge</span>
            <Switch
              checked={participateInSwipeSurge}
              onCheckedChange={setParticipateInSwipeSurge}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-4 px-1">
          Turning this off will prevent you from being shown as swiping to other active users during a Swipe Surge
        </p>
      </div>
    </AuthLayout>
  );
};

export default SwipeSurge;
