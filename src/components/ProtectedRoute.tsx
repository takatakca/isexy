import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { isProfileComplete } from "@/lib/profileStatus";

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * If true (default), an authenticated user without a completed profile is
   * redirected to /profile-setup. Set to false for /profile-setup itself.
   */
  requireCompleteProfile?: boolean;
}

/**
 * Wrap private pages. While auth state is loading, render a spinner.
 * If unauthenticated, redirect to /auth (preserving the attempted location).
 * If authenticated but profile is incomplete, redirect to /profile-setup.
 */
export function ProtectedRoute({
  children,
  requireCompleteProfile = true,
}: ProtectedRouteProps) {
  const { user, profile, photoCount, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  // Profile completeness: required fields + at least one photo + 18+
  const isComplete = isProfileComplete(profile, photoCount);

  if (requireCompleteProfile && !isComplete) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
}
