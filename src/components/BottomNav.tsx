import { Link, useLocation } from "react-router-dom";
import { Flame, MessageCircle, User, Star, Shield } from "lucide-react";

export function BottomNav() {
  const location = useLocation();
  
  const navItems = [
    { path: "/discover", icon: Flame, label: "Discover" },
    { path: "/matches", icon: Star, label: "Likes" },
    { path: "/chat", icon: MessageCircle, label: "Chat" },
    { path: "/safety", icon: Shield, label: "Safety" },
    { path: "/settings", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive && path === "/discover" ? "fill-current" : ""}`} />
              <span className="text-xs mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
