import type { NavigateFunction } from "react-router-dom";

/**
 * Go back one page, or to `fallback` when this page was opened directly
 * (a link, a reload): navigate(-1) would otherwise leave ISEXY.
 * React Router keeps the in-app history index in history.state.idx.
 */
export function goBack(navigate: NavigateFunction, fallback: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}
