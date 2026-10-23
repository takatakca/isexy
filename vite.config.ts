import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** Replace __SITE_URL__ / __SUPABASE_URL__ placeholders in index.html. */
function siteUrlPlugin(env: Record<string, string>): Plugin {
  const site = (env.VITE_SITE_URL || "https://isexy.onrender.com").replace(/\/+$/, "");
  const supabase = env.VITE_SUPABASE_URL || "https://pcjfahhlozsseqqevimi.supabase.co";
  return {
    name: "isexy-site-url",
    transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", site).replaceAll("__SUPABASE_URL__", supabase),
  };
}

/**
 * Google AdSense site verification, only when VITE_ADSENSE_CLIENT is set at
 * build (docs/ADS.md): <meta name="google-adsense-account"> in index.html
 * (every pre-rendered page copies it) and dist/ads.txt. Unset or malformed:
 * nothing is written.
 */
function adsensePlugin(env: Record<string, string>): Plugin {
  const raw = (env.VITE_ADSENSE_CLIENT || "").trim();
  const client = /^ca-pub-\d{10,20}$/.test(raw) ? raw : null;
  if (raw && !client) {
    console.warn(`[adsense] VITE_ADSENSE_CLIENT must look like ca-pub-1234567890123456: no AdSense tag or ads.txt written.`);
  }
  return {
    name: "isexy-adsense",
    transformIndexHtml: (html) =>
      client ? html.replace("</head>", `  <meta name="google-adsense-account" content="${client}" />\n  </head>`) : html,
    generateBundle() {
      if (!client) return;
      // ads.txt names the publisher id without the "ca-" prefix; f08c47fec0942fa0 is Google's certification id.
      this.emitFile({ type: "asset", fileName: "ads.txt", source: `google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

/**
 * Google Search Console ownership check, only when VITE_GOOGLE_SITE_VERIFICATION
 * is set at build (docs/DEPLOYMENT.md › Google Search Console): the token of
 * Search Console's "HTML tag" method becomes <meta name="google-site-verification">
 * in index.html (every pre-rendered page copies it). The whole pasted tag is
 * accepted too. Unset or malformed: nothing is written.
 */
function searchConsolePlugin(env: Record<string, string>): Plugin {
  const raw = (env.VITE_GOOGLE_SITE_VERIFICATION || "").trim();
  const pasted = raw.match(/content\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ?? raw;
  const token = /^[A-Za-z0-9_-]{10,100}$/.test(pasted) ? pasted : null;
  if (raw && !token) {
    console.warn(`[search-console] VITE_GOOGLE_SITE_VERIFICATION must be the token of Search Console's HTML tag (letters, digits, - and _): no verification tag written.`);
  }
  return {
    name: "isexy-search-console",
    transformIndexHtml: (html) =>
      token ? html.replace("</head>", `  <meta name="google-site-verification" content="${token}" />\n  </head>`) : html,
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    siteUrlPlugin(loadEnv(mode, process.cwd(), "")),
    adsensePlugin(loadEnv(mode, process.cwd(), "")),
    searchConsolePlugin(loadEnv(mode, process.cwd(), "")),
  ],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query"],
          motion: ["framer-motion"],
          markdown: ["react-markdown"],
          charts: ["recharts"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
