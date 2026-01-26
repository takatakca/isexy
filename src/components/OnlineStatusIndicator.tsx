import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface OnlineStatusIndicatorProps {
  lastActiveAt: string | null;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function OnlineStatusIndicator({ 
  lastActiveAt, 
  showLabel = false,
  size = "md"
}: OnlineStatusIndicatorProps) {
  if (!lastActiveAt) return null;

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);

  const isOnline = diffMinutes < 5; // Online if active within 5 minutes
  const isRecent = diffMinutes < 60; // Recently online if within 1 hour

  const sizeClasses = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
  };

  const dotColor = isOnline 
    ? "bg-green-500" 
    : isRecent 
      ? "bg-yellow-500" 
      : "bg-muted-foreground/50";

  const statusText = isOnline 
    ? "Online now" 
    : `Active ${formatDistanceToNow(lastActive, { addSuffix: true })}`;

  return (
    <div className="flex items-center gap-1.5">
      <span 
        className={cn(
          "rounded-full flex-shrink-0",
          sizeClasses[size],
          dotColor,
          isOnline && "animate-pulse"
        )}
      />
      {showLabel && (
        <span className={cn(
          "text-xs",
          isOnline ? "text-green-500" : "text-muted-foreground"
        )}>
          {statusText}
        </span>
      )}
    </div>
  );
}

export function getOnlineStatus(lastActiveAt: string | null): "online" | "recent" | "offline" {
  if (!lastActiveAt) return "offline";

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);

  if (diffMinutes < 5) return "online";
  if (diffMinutes < 60) return "recent";
  return "offline";
}
