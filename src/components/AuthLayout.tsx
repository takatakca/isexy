import { ReactNode } from "react";
import { ArrowLeft, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { goBack } from "@/lib/navigation";

interface AuthLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  showClose?: boolean;
  variant?: "gradient" | "white" | "gray";
  onBack?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export function AuthLayout({
  children,
  showBack = false,
  showClose = false,
  variant = "white",
  onBack,
  onSave,
  isSaving = false,
}: AuthLayoutProps) {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // Opened directly (link, reload, installed app): stay in ISEXY.
      goBack(navigate, "/");
    }
  };

  const bgClass = variant === "gradient" 
    ? "gradient-primary min-h-screen" 
    : variant === "gray" 
    ? "bg-muted min-h-screen" 
    : "bg-background min-h-screen";
  // Soft brand light at the top of every auth / setup screen.
  const glow = variant === "gradient" ? null : (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(36rem_14rem_at_50%_-30%,hsl(var(--primary)/0.22),transparent_70%)]" aria-hidden />
  );
  const iconColor = variant === "gradient" ? "text-primary-foreground" : "text-foreground";

  return (
    <div className={`${bgClass} relative flex flex-col`}>
      {glow}
      {/* Header with navigation */}
      <header className="relative flex items-center justify-between px-3 pb-1 min-h-14" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        {showBack ? (
          <button
            onClick={handleBack}
            className={`${iconColor} flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary/70 transition-colors`}
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-11" />
        )}
        
        <div className="flex items-center gap-2">
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="min-h-10 px-5 bg-primary text-primary-foreground rounded-full font-semibold text-sm shadow-button disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
          )}
          
          {showClose && (
            <button
              onClick={() => navigate("/")}
              className={`${iconColor} flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary/70 transition-colors`}
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative flex-1 flex flex-col w-full max-w-lg mx-auto px-6 pb-[max(2rem,env(safe-area-inset-bottom))] animate-fade-in">
        {children}
      </main>
    </div>
  );
}
