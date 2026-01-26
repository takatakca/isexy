import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function TopPicks() {
  const navigate = useNavigate();
  const [showInTopPicks, setShowInTopPicks] = useState(true);

  const handleToggle = (checked: boolean) => {
    setShowInTopPicks(checked);
    toast.success(checked ? "You can now appear as a Top Pick" : "Hidden from Top Picks");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-center px-4 py-4 relative">
          <button onClick={() => navigate(-1)} className="absolute left-4 p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Top Picks</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Show me in Top Picks */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <span className="text-foreground font-medium">Show me in Top Picks</span>
            <Switch checked={showInTopPicks} onCheckedChange={handleToggle} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground px-2">
          Turning this on will allow you to be shown as a featured Top Pick to other users near you
        </p>
      </div>
    </div>
  );
}
