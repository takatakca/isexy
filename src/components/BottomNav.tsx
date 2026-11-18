import { Link, useLocation } from "react-router-dom";
import { Flame, Compass, Heart, MessageCircle, User } from "lucide-react";
import { NotificationBadge } from "./NotificationBadge";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { cn } from "@/lib/utils";

/**
 * App navigation, one element for every screen size:
 * phones and tablets get a glass tab bar at the bottom (labels, badges, an
 * electric-blue pill on the active tab, safe-area aware); from 1024px it
 * becomes a left rail (index.css pads #root while it is on the page).
 */
export function BottomNav() {
  const location = useLocation();
  const { unreadMessages, newLikes } = useNotificationCounts();

  const navItems = [
    { path: "/discover", icon: Flame, label: "Home", badge: 0 },
    { path: "/explore", icon: Compass, label: "Explore", badge: 0 },
    { path: "/likes", icon: Heart, label: "Likes", badge: newLikes },
    { path: "/matches", icon: MessageCircle, label: "Chat", badge: unreadMessages },
    { path: "/profile", icon: User, label: "Profile", badge: 0 },
  ];

  return (
    <nav
      aria-label="Main"
      data-app-nav
      className={cn(
        "fixed z-50 border-foreground/[0.08] bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70",
        // Phone / tablet: bottom tab bar.
        "bottom-0 left-0 right-0 border-t pb-[env(safe-area-inset-bottom)]",
        // Desktop: left rail.
        "lg:right-auto lg:top-0 lg:w-[var(--rail-width)] lg:border-r lg:border-t-0 lg:pb-0",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent lg:hidden" aria-hidden />
      {/* Rail brand mark (desktop only, decorative). */}
      <div className="hidden lg:flex flex-col items-center gap-1 pt-6 pb-8" aria-hidden>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-glow shadow-glow">
          <Flame className="h-5 w-5 text-white" strokeWidth={2.4} />
        </span>
        <span className="font-display text-[0.6875rem] font-extrabold tracking-[0.18em] text-foreground">ISEXY</span>
      </div>
      <div className="mx-auto flex h-[var(--nav-height)] max-w-md items-stretch justify-around px-1 lg:h-auto lg:max-w-none lg:flex-col lg:items-center lg:justify-start lg:gap-2 lg:px-2">
        {navItems.map(({ path, icon: Icon, label, badge }) => {
          const here = location.pathname;
          const isActive = here === path || here.startsWith(`${path}/`) ||
            (path === "/matches" && (here.startsWith("/chat/") || here.startsWith("/group-chat/"))) ||
            (path === "/likes" && here === "/who-liked-you");
          return (
            <Link
              key={path}
              to={path}
              aria-label={badge > 0 ? `${label}, ${badge} new` : label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex min-h-touch min-w-touch flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[0.6875rem] font-semibold transition-colors",
                "lg:w-full lg:flex-none lg:py-3",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "relative flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200",
                  isActive ? "bg-primary/20 shadow-[0_0_18px_-4px_hsl(var(--primary)/0.8)]" : "group-hover:bg-secondary",
                )}
              >
                <NotificationBadge count={badge}>
                  <Icon className={cn("h-[22px] w-[22px] transition-transform", isActive ? "text-primary fill-primary/25" : "group-active:scale-90")} strokeWidth={isActive ? 2.4 : 2} />
                </NotificationBadge>
              </span>
              <span className={cn("leading-none tracking-wide", isActive && "text-foreground")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
