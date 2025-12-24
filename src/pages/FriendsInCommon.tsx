import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";

const FriendsInCommon = () => {
  const [enableFriendsInCommon, setEnableFriendsInCommon] = useState(false);

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4">
        <div className="bg-card rounded-lg">
          <div className="p-4 flex items-center justify-between">
            <div>
              <span className="text-foreground font-medium block">Enable Friends in Common</span>
              <span className="text-sm text-muted-foreground">Contacts not uploaded</span>
            </div>
            <Switch
              checked={enableFriendsInCommon}
              onCheckedChange={setEnableFriendsInCommon}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-4 px-1">
          You and your contacts may be counted as mutuals for other CubaDate members who enable Friends in Common.{" "}
          <span className="text-primary cursor-pointer">Learn More</span>
        </p>
      </div>
    </AuthLayout>
  );
};

export default FriendsInCommon;
