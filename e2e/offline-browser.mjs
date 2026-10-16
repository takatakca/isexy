// Preload for every e2e script: the browser can reach 127.0.0.1 (vite preview)
// and nothing else. Requests the script mocks (context.route / routeWebSocket)
// never leave the browser; anything unmocked fails DNS instead of reaching
// production (Supabase REST, realtime websockets, Render, isexy.ca...).
//
//   node --import ./e2e/offline-browser.mjs e2e/<file>.mjs
//
// It patches chromium.launch of the same Playwright module the scripts import.
const mod = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const { chromium } = await import(mod);

const RULES = "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost";
const launch = chromium.launch.bind(chromium);
chromium.launch = (options = {}) =>
  launch({
    ...options,
    executablePath: options.executablePath ?? process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
    args: [...(options.args ?? []), RULES, "--no-proxy-server"],
  });
