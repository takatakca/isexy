import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "social" | "primary" | "secondary" | "outline";
}

export function AuthButton({
  children,
  icon,
  variant = "social",
  className,
  ...props
}: AuthButtonProps) {
  const baseStyles = "w-full flex items-center justify-center gap-3 py-4 px-6 rounded-full font-semibold text-base transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    social: "bg-card text-foreground shadow-button hover:shadow-medium border border-border",
    primary: "gradient-primary text-primary-foreground shadow-button hover:shadow-glow hover:opacity-95",
    secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
    outline: "bg-transparent border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
