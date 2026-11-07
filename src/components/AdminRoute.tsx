import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AdminRouteProps {
  children: ReactNode;
  /** Also admit support moderators (agent dashboard). */
  allowModerator?: boolean;
}

/**
 * Wraps staff pages. Requires login + a row in user_roles with role 'admin'
 * (or 'moderator' when allowModerator). A moderator on an admin-only page is
 * sent to the staff home (/admin); members go to /discover, guests to /auth.
 * The server checks the role again on every read (RLS) and action (RPCs).
 */
export function AdminRoute({ children, allowModerator = false }: AdminRouteProps) {
  const [state, setState] = useState<"loading" | "admin" | "moderator-only" | "denied" | "anon">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setState("anon");
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "moderator"]);
      if (cancelled) return;
      const roles = new Set((data ?? []).map((r) => r.role as string));
      if (roles.has("admin") || (allowModerator && roles.has("moderator"))) setState("admin");
      else if (roles.has("moderator")) setState("moderator-only");
      else setState("denied");
    })();
    return () => {
      cancelled = true;
    };
  }, [allowModerator]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (state === "anon") return <Navigate to="/auth" replace />;
  if (state === "moderator-only") return <Navigate to="/admin" replace />;
  if (state === "denied") return <Navigate to="/discover" replace />;
  return <>{children}</>;
}
