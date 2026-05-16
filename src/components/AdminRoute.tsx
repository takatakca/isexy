import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Wraps admin-only pages. Requires login + a row in user_roles with role = 'admin'.
 * Non-admins are redirected to /discover. Unauthenticated users are sent to /auth.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const [state, setState] = useState<"loading" | "admin" | "denied" | "anon">(
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
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      setState(data ? "admin" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (state === "anon") return <Navigate to="/auth" replace />;
  if (state === "denied") return <Navigate to="/discover" replace />;
  return <>{children}</>;
}
