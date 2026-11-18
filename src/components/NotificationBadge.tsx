import { ReactNode } from "react";

interface NotificationBadgeProps {
  count: number;
  children: ReactNode;
}

/** Count badge: cyan on navy so it reads at a glance on any surface. */
export function NotificationBadge({ count, children }: NotificationBadgeProps) {
  return (
    <div className="relative">
      {children}
      {count > 0 && (
        <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-accent text-accent-foreground text-[10px] font-bold leading-none rounded-full px-1 ring-2 ring-background tabular-nums animate-fade-in">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}
