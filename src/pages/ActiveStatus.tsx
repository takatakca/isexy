import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";

const ActiveStatus = () => {
  const [showActiveStatus, setShowActiveStatus] = useState(true);
  const [showRecentlyActiveStatus, setShowRecentlyActiveStatus] = useState(true);

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4 space-y-4">
        <div className="bg-card rounded-lg">
          <div className="p-4 flex items-center justify-between">
            <span className="text-foreground font-medium">Show Active Status</span>
            <Switch
              checked={showActiveStatus}
              onCheckedChange={setShowActiveStatus}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground px-1">
          Active status is displayed on your profile if you were active in the CubaDate app within the last 2 hours
        </p>

        <div className="bg-card rounded-lg mt-6">
          <div className="p-4 flex items-center justify-between">
            <span className="text-foreground font-medium">Show Recently Active Status</span>
            <Switch
              checked={showRecentlyActiveStatus}
              onCheckedChange={setShowRecentlyActiveStatus}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground px-1">
          Recently Active status is displayed on your profile if you were active in the CubaDate app within the last 24 hours
        </p>
      </div>
    </AuthLayout>
  );
};

export default ActiveStatus;
