import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { TakatakSignIn } from "@/components/TakatakSignIn";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Staff portal: sign in with Takatak Auth, then ISEXY staff roles
 * (isexy.user_roles: admin / moderator) decide access.
 */
export default function ModeratorLogin() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [check, setCheck] = useState<"idle" | "checking" | "denied">("idle");

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    setCheck("checking");
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Error checking roles:", error);
          toast.error("Failed to verify permissions");
          setCheck("denied");
          return;
        }
        if (data?.some((r) => r.role === "admin" || r.role === "moderator")) {
          toast.success("Welcome to the Admin Panel!");
          navigate("/support", { replace: true });
        } else {
          setCheck("denied");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate]);

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground mb-2 text-center">Staff Portal</h1>
        <p className="text-muted-foreground mb-8 text-center">Sign in with your TAKATAK account to manage ISEXY.</p>

        <div className="w-full max-w-sm">
          {!user && !loading && <TakatakSignIn redirectPath="/staff-login" requireTerms={false} />}
          {(loading || check === "checking") && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          {check === "denied" && (
            <div className="text-center space-y-4">
              <p className="text-sm text-destructive">Access denied. An ISEXY moderator or admin role is required.</p>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setCheck("idle");
                }}
                className="text-primary font-semibold"
              >
                Use another account
              </button>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
