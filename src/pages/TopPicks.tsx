import { useState, useEffect } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";

export default function TopPicks() {
  const [showInTopPicks, setShowInTopPicks] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("show-in-top-picks");
    if (saved !== null) {
      setShowInTopPicks(saved === "true");
    }
  }, []);

  const handleToggle = (checked: boolean) => {
    setShowInTopPicks(checked);
    localStorage.setItem("show-in-top-picks", String(checked));
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <span className="text-foreground font-medium">Show me in Top Picks</span>
          <Switch checked={showInTopPicks} onCheckedChange={handleToggle} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-4 px-2">
        Turning this on will allow you to be shown as a featured Top Pick to other users near you
      </p>
    </AuthLayout>
  );
}
