import { Link, useLocation } from "react-router-dom";
import { Flame, Compass, Heart, MessageCircle, User } from "lucide-react";
import { NotificationBadge } from "./NotificationBadge";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";

export function BottomNav() {
  const location = useLocation();
  const { unreadMessages, newMatches } = useNotificationCounts();
  
  const navItems = [
    { path: "/discover", icon: Flame, label: "Home", badge: 0 },
    { path: "/explore", icon: Compass, label: "Explore", badge: 0 },
    { path: "/likes", icon: Heart, label: "Likes", badge: newMatches },
    { path: "/matches", icon: MessageCircle, label: "Chat", badge: unreadMessages },
    { path: "/profile", icon: User, label: "Profile", badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-inset-bottom z-50">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label, badge }) => {
          const isActive = location.pathname === path || 
            (path === "/matches" && location.pathname.startsWith("/chat"));
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <NotificationBadge count={badge}>
                <Icon className={`w-6 h-6 ${isActive ? "fill-current" : ""}`} />
              </NotificationBadge>
              <span className="text-xs mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
