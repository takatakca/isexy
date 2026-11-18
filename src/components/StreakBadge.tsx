import { cn } from "@/lib/utils";
import { Flame, Star, Trophy, Crown, Zap } from "lucide-react";

interface StreakBadgeProps {
  type: "3_day" | "7_day" | "14_day" | "30_day" | "100_day";
  earned?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const badgeConfig = {
  "3_day": {
    icon: Flame,
    label: "3 Days",
    color: "from-primary-solid to-primary",
    bgColor: "bg-primary/15",
    textColor: "text-primary",
  },
  "7_day": {
    icon: Zap,
    label: "7 Days",
    color: "from-primary to-accent",
    bgColor: "bg-primary/15",
    textColor: "text-primary",
  },
  "14_day": {
    icon: Star,
    label: "14 Days",
    color: "from-[hsl(var(--gradient-end))] to-accent",
    bgColor: "bg-accent/15",
    textColor: "text-accent",
  },
  "30_day": {
    icon: Trophy,
    label: "30 Days",
    color: "from-primary to-accent",
    bgColor: "bg-accent/15",
    textColor: "text-accent",
  },
  "100_day": {
    icon: Crown,
    label: "100 Days",
    color: "from-accent to-foreground",
    bgColor: "bg-foreground/10",
    textColor: "text-foreground",
  },
};

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function StreakBadge({ type, earned = true, size = "md", showLabel = false }: StreakBadgeProps) {
  const config = badgeConfig[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "rounded-full flex items-center justify-center",
          sizeClasses[size],
          earned
            ? `bg-gradient-to-br ${config.color} shadow-lg`
            : "bg-muted border-2 border-dashed border-muted-foreground/30"
        )}
      >
        <Icon
          className={cn(
            iconSizes[size],
            earned ? "text-white" : "text-muted-foreground/50"
          )}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            "text-xs font-medium",
            earned ? config.textColor : "text-muted-foreground"
          )}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}
