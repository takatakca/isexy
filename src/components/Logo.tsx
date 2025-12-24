import { Flame } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "light" | "dark" | "gradient";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

const textSizeClasses = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
};

export function Logo({ size = "md", showText = true, variant = "light", className }: LogoProps) {
  const iconColor = variant === "dark" ? "text-primary" : "text-primary-foreground";
  const textColor = variant === "dark" ? "text-foreground" : "text-primary-foreground";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${sizeClasses[size]} ${iconColor} animate-float`}>
        <Flame className="w-full h-full fill-current" />
      </div>
      {showText && (
        <span className={`${textSizeClasses[size]} ${textColor} font-extrabold tracking-tight`}>
          cubadate
        </span>
      )}
    </div>
  );
}
