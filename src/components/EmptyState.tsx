import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Glowing icon orb, title, short text and actions: the empty / error state used across member pages. */
export function EmptyState({ icon: Icon, title, children, actions, className, role }: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  role?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center py-14 px-4", className)} role={role}>
      <div className="relative mb-6 h-24 w-24" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
        <div className="absolute inset-0 rounded-full border border-primary/25" />
        <div className="absolute inset-4 flex items-center justify-center rounded-full bg-card ring-1 ring-primary/40">
          <Icon className="h-7 w-7 text-primary" />
        </div>
      </div>
      <h2 className="type-heading text-foreground mb-2">{title}</h2>
      {children && <div className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">{children}</div>}
      {actions && <div className="flex flex-col sm:flex-row items-center gap-2">{actions}</div>}
    </div>
  );
}
