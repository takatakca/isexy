import { toast } from "sonner";

export interface ShareTarget {
  title: string;
  text?: string;
  /** Absolute URL, or an app path such as "/news#news-2". */
  url: string;
}

/** Absolute link on the host the member is using (isexy.ca, preview, local). */
export function shareUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure origins: fall back to a hidden textarea.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Copy a link and say so. */
export async function copyLink(url: string): Promise<void> {
  const link = shareUrl(url);
  if (await copy(link)) toast.success("Link copied");
  else toast.error(`Couldn't copy the link: ${link}`);
}

/**
 * Native share sheet when the device has one (phones), otherwise copy the
 * link with a toast. Closing the share sheet is not an error.
 */
export async function shareLink({ title, text, url }: ShareTarget): Promise<void> {
  const link = shareUrl(url);
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url: link });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      // Share sheet unavailable here (desktop, iframe): copy instead.
    }
  }
  await copyLink(link);
}
