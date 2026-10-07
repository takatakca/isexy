import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorHandlers } from "@/lib/errorReporting";

installGlobalErrorHandlers();

// Pre-rendered head tags (index.html / scripts/generate-seo.mjs) serve crawlers
// and link previews. Once the app boots, react-helmet owns them — drop the
// static copies so client-side navigation never leaves stale or duplicate
// canonical/description/social tags behind.
document.head
  .querySelectorAll(
    [
      'link[rel="canonical"]',
      'meta[name="description"]',
      'meta[name="robots"]',
      'meta[property^="og:title"]',
      'meta[property^="og:description"]',
      'meta[property^="og:url"]',
      'meta[property^="og:type"]',
      'meta[property^="og:image"]',
      'meta[property="og:locale"]',
      'meta[name^="twitter:title"]',
      'meta[name^="twitter:description"]',
      'meta[name^="twitter:image"]',
    ]
      .map((sel) => `${sel}:not([data-rh])`)
      .join(","),
  )
  .forEach((el) => el.remove());

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
