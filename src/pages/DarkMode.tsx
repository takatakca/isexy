import { useEffect } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Check } from "lucide-react";

/**
 * ISEXY ships one theme: dark (deep navy). There is no light palette yet, so
 * this page says so instead of offering choices that would only break colours.
 */
export default function DarkMode() {
  useEffect(() => {
    // Older versions saved "light"/"system" here and toggled the `dark` class; undo that.
    try {
      localStorage.removeItem("theme-mode");
    } catch {
      /* storage blocked: nothing to clean up */
    }
  }, []);

  return (
    <AuthLayout showBack variant="white">
      <h1 className="text-2xl font-bold text-foreground mb-6">Dark Mode</h1>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="w-full flex items-center justify-between p-4 border-b border-border">
          <span className="text-foreground">Dark Mode</span>
          <Check className="w-5 h-5 text-primary" aria-label="Selected" />
        </div>
        <div className="w-full flex items-center justify-between p-4 text-muted-foreground">
          <span>Light Mode</span>
          <span className="text-xs font-semibold uppercase tracking-wide">Coming soon</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-4 px-2">
        ISEXY uses a dark theme on every device, designed to be easy on the eyes day and night.
      </p>
    </AuthLayout>
  );
}
