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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    siteUrlPlugin(loadEnv(mode, process.cwd(), "")),
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
