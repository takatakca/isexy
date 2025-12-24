import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Check } from "lucide-react";

type ThemeMode = "system" | "light" | "dark";

export default function DarkMode() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const saved = localStorage.getItem("theme-mode") as ThemeMode;
    if (saved) {
      setSelectedMode(saved);
    }
  }, []);

  const handleSelect = (mode: ThemeMode) => {
    setSelectedMode(mode);
    localStorage.setItem("theme-mode", mode);
    
    const root = document.documentElement;
    
    if (mode === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    } else {
      root.classList.toggle("dark", mode === "dark");
    }
  };

  const options = [
    {
      id: "system" as ThemeMode,
      label: "Use System Setting",
    },
    {
      id: "light" as ThemeMode,
      label: "Light Mode",
    },
    {
      id: "dark" as ThemeMode,
      label: "Dark Mode",
    },
  ];

  return (
    <AuthLayout showBack variant="white">
      <h1 className="text-2xl font-bold text-foreground mb-6">Dark Mode</h1>

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

      <p className="text-sm text-muted-foreground mt-4 px-2">
        Using the system setting will automatically adjust CubaDate's appearance to match your device's system settings.
      </p>
    </AuthLayout>
  );
}
