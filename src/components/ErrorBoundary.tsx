import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { isChunkLoadError, recoverFromChunkError, reportError } from "@/lib/errorReporting";

interface Props {
  children: ReactNode;
  /** Changing this value (e.g. the route path) clears the error state. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors anywhere below it, reports them and shows a calm
 * recovery screen instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error) && recoverFromChunkError()) return;
    reportError(error, { source: "react", component: (info.componentStack ?? "").split("\n")[1]?.trim().slice(0, 120) ?? "" });
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-1">Our team has been notified automatically.</p>
          <p className="text-muted-foreground text-sm mb-8">Algo salió mal · Une erreur est survenue</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="h-12 rounded-full gradient-primary text-white font-bold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reload
            </button>
            <a href="/" className="h-12 rounded-full border border-border font-semibold text-foreground flex items-center justify-center gap-2 hover:bg-muted">
              <Home className="w-4 h-4" /> Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
