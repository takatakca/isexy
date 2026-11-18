import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title?: ReactNode;
  /** Small wide-spaced caps label above the title. */
  eyebrow?: ReactNode;
  /** Show a back button; a string navigates there, true goes back in history. */
  back?: boolean | string;
  backLabel?: string;
  onBack?: () => void;
  /** Right-hand actions (icon buttons, menus). */
  actions?: ReactNode;
  /** Left slot when there is no back button (filters, logo). */
  leading?: ReactNode;
  /** Content under the title row (tabs, search). */
  children?: ReactNode;
  className?: string;
  titleId?: string;
}

/**
 * Sticky translucent page header shared by member pages: safe-area aware,
 * 44px controls, title in Montserrat with an optional caps eyebrow.
 */
export function AppHeader({ title, eyebrow, back, backLabel = "Back", onBack, actions, leading, children, className, titleId }: AppHeaderProps) {
  const navigate = useNavigate();
  const goBack = () => {
    if (onBack) return onBack();
    if (typeof back === "string") navigate(back);
    else navigate(-1);
  };
  return (
    <header className={cn("app-header", className)}>
      <div className="mx-auto flex min-h-14 w-full max-w-3xl items-center gap-2 px-3 py-2">
        {back ? (
          <button
            type="button"
            onClick={goBack}
            aria-label={backLabel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : leading}
        <div className={cn("min-w-0 flex-1", !back && !leading && "pl-1")}>
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          {title && (
            <h1 id={titleId} className="truncate font-display text-lg font-bold leading-tight text-foreground sm:text-xl">
              {title}
            </h1>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {children && <div className="mx-auto w-full max-w-3xl px-4 pb-3">{children}</div>}
    </header>
  );
}
