import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "social" | "primary" | "secondary" | "outline" | "dark";
}

export function AuthButton({
  children,
  icon,
  variant = "social",
  className,
  ...props
}: AuthButtonProps) {
  const baseStyles = "w-full min-h-14 flex items-center justify-center gap-3 py-3.5 px-6 rounded-full font-semibold text-base transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed";
  
  const variants = {
    social: "bg-card text-foreground border border-foreground/10 hover:border-primary/50 hover:bg-secondary disabled:opacity-50",
    primary: "gradient-primary text-primary-foreground shadow-button hover:brightness-110 disabled:opacity-50",
    // Disabled-looking "Next" until the step is complete (the button itself is disabled).
    secondary: "bg-secondary text-muted-foreground border border-foreground/[0.06]",
    outline: "bg-transparent border border-input text-foreground hover:border-primary/60 hover:bg-secondary disabled:opacity-50",
    dark: "gradient-primary text-primary-foreground shadow-button hover:brightness-110 disabled:opacity-50",
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
