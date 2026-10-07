/**
 * Client error reporting → Supabase report_client_error RPC (admin-only table).
 * Operational data only: message, stack, route (no query string), release.
 * Deduplicated and capped per page load so a render loop can't flood the API.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const RELEASE = (import.meta.env.VITE_RELEASE as string | undefined) ?? "web";
const MAX_REPORTS = 10;
const IGNORE = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /AbortError/i,
  /The user aborted a request/i,
  /Load failed$/i, // Safari network blip
];

const seen = new Set<string>();
let sent = 0;
let installed = false;

export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(msg);
}

export function reportError(error: unknown, context?: Record<string, string | number | boolean>) {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = `${err.name}: ${err.message}`.slice(0, 500);
  if (IGNORE.some((re) => re.test(message))) return;
  if (seen.has(message) || sent >= MAX_REPORTS) return;
  seen.add(message);
  sent++;

  if (import.meta.env.DEV) console.error("[reportError]", err, context);

  supabase
    .rpc("report_client_error", {
      p_message: message,
      p_stack: err.stack?.slice(0, 4000),
      p_path: window.location.pathname,
      p_context: (context ?? null) as Json,
      p_release: RELEASE,
      p_user_agent: navigator.userAgent.slice(0, 300),
    })
    .then(() => undefined);
}

/** Reload once to pick up a new deployment when an old lazy chunk is gone. */
export function recoverFromChunkError(): boolean {
  try {
    const key = "isexy_chunk_reload";
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error ?? event.message) && recoverFromChunkError()) return;
    reportError(event.error ?? event.message, { source: "window.onerror" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason) && recoverFromChunkError()) return;
    reportError(event.reason, { source: "unhandledrejection" });
  });
}
