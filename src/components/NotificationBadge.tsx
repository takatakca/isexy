import { ReactNode } from "react";

interface NotificationBadgeProps {
  count: number;
  children: ReactNode;
}

export function NotificationBadge({ count, children }: NotificationBadgeProps) {
  return (
    <div className="relative">
      {children}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold rounded-full px-1">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}
