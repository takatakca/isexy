import { useState, useEffect } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Check } from "lucide-react";

type AutoplayMode = "wifi-data" | "wifi-only" | "never";

export default function AutoplayVideos() {
  const [selectedMode, setSelectedMode] = useState<AutoplayMode>("wifi-data");

  useEffect(() => {
    const saved = localStorage.getItem("autoplay-mode") as AutoplayMode;
    if (saved) {
      setSelectedMode(saved);
    }
  }, []);

  const handleSelect = (mode: AutoplayMode) => {
    setSelectedMode(mode);
    localStorage.setItem("autoplay-mode", mode);
  };

  const options = [
    {
      id: "wifi-data" as AutoplayMode,
      label: "On Wifi and Mobile Data",
    },
    {
      id: "wifi-only" as AutoplayMode,
      label: "On Wifi Only",
    },
    {
      id: "never" as AutoplayMode,
      label: "Never Autoplay Videos",
    },
  ];

  return (
    <AuthLayout showBack variant="white">
      <p className="text-muted-foreground text-sm mb-4">
        Playing videos use more data than displaying photos, so choose when videos autoplay here.
      </p>

      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 px-1">
        Autoplay Videos
      </p>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {options.map((option, index) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className={`w-full flex items-center justify-between p-4 ${
              index !== options.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="text-foreground">{option.label}</span>
            {selectedMode === option.id && (
              <Check className="w-5 h-5 text-primary" />
            )}
          </button>
        ))}
      </div>
    </AuthLayout>
  );
}
