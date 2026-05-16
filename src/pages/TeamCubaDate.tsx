import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { BadgeCheck } from "lucide-react";

const TeamCubaDate = () => {
  const [receiveUpdates, setReceiveUpdates] = useState(true);

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-xl font-bold text-foreground">Team ISEXY</h1>
          <BadgeCheck className="h-5 w-5 text-primary" />
        </div>

        <div className="bg-card rounded-lg">
          <div className="p-4 flex items-center justify-between">
            <div>
              <span className="text-foreground block font-medium">Team ISEXY</span>
              <span className="text-sm text-muted-foreground">
                I want to receive news, updates, and offers from ISEXY
              </span>
            </div>
            <Switch checked={receiveUpdates} onCheckedChange={setReceiveUpdates} />
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default TeamCubaDate;
