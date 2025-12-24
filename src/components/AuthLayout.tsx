import { ReactNode } from "react";
import { ArrowLeft, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AuthLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  showClose?: boolean;
  variant?: "gradient" | "white";
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
      navigate(-1);
    }
  };

  const bgClass = variant === "gradient" ? "gradient-primary min-h-screen" : "bg-background min-h-screen";
  const iconColor = variant === "gradient" ? "text-primary-foreground" : "text-foreground";

  return (
    <div className={`${bgClass} flex flex-col`}>
      {/* Header with navigation */}
      <header className="flex items-center justify-between p-4 h-14">
        {showBack ? (
          <button
            onClick={handleBack}
            className={`${iconColor} p-2 -ml-2 hover:opacity-70 transition-opacity`}
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-10" />
        )}
        
        <div className="flex items-center gap-2">
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full font-semibold text-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
          )}
          
          {showClose && (
            <button
              onClick={() => navigate("/")}
              className={`${iconColor} p-2 -mr-2 hover:opacity-70 transition-opacity`}
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col px-6 pb-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
