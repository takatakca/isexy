import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-semibold text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full h-14 px-4 text-lg rounded-2xl bg-card border border-input text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/20 [color-scheme:dark]",
            error && "border-destructive",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-destructive animate-shake">{error}</p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
