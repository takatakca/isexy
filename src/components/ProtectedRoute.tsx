import { ReactNode, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
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
  const { user, profile, photoCount, loading, profileError, refreshProfile, signOut } = useAuth();
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);

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

  // The profile could not be read (offline, server error): offer a retry rather
  // than treating a returning member as new and sending them to /profile-setup.
  if (profileError && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg font-semibold text-foreground">We couldn't load your profile</p>
        <p className="text-sm text-muted-foreground max-w-xs">Check your connection, then try again.</p>
        <button
          onClick={async () => {
            setRetrying(true);
            await refreshProfile();
            setRetrying(false);
          }}
          disabled={retrying}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-60"
        >
          {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Try again
        </button>
      </div>
    );
  }

  // Suspended by the safety team (staff set is_active = false): say so instead
  // of showing pages that would all come back empty.
  if (requireCompleteProfile && profile && profile.is_active === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <ShieldAlert className="w-12 h-12 text-destructive" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-foreground">Your account is suspended</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Our safety team suspended this account for breaking the community guidelines. Other members can't see your profile.
          If you think this is a mistake, contact support.
        </p>
        <Link to="/contact-us" className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold">
          Contact support
        </Link>
        <div className="flex gap-4 text-sm">
          <Link to="/community-guidelines" className="text-primary underline">Community guidelines</Link>
          <button onClick={() => void signOut()} className="text-muted-foreground underline">Sign out</button>
        </div>
      </div>
    );
  }

  // Profile completeness: required fields + at least one photo + 18+
  const isComplete = isProfileComplete(profile, photoCount);

  if (requireCompleteProfile && !isComplete) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
}
