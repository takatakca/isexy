import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";

export default function QAEvents() {
  const [participateInQA, setParticipateInQA] = useState(true);

  return (
    <AuthLayout showBack variant="white">
      <h1 className="text-2xl font-bold text-foreground mb-6">Q&A Events</h1>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">Participate in Q&A Events</span>
          <Switch
            checked={participateInQA}
            onCheckedChange={setParticipateInQA}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-4 px-1">
        Turning this off will remove Q&A Event content from your profile and you'll no longer see profiles with Q&A Event content.
      </p>
    </AuthLayout>
  );
}
