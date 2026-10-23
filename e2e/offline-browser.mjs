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

// Column privileges of 0015 K, for every script (also those with their own
// mocks): a member request that selects "*" (the default select), names or
// filters on profiles' shadow-ban columns or support_tickets.admin_notes is
// refused by the database since K. Such requests are listed at exit as a FAIL
// line (the script's own mock still answered them).
const HIDDEN = { profiles: ["shadow_banned", "shadow_banned_at", "shadow_banned_reason"], support_tickets: ["admin_notes"] };
const refused = [];
function columnPrivilegeProblem(url, method, prefer) {
  const m = url.pathname.match(/\/rest\/v1\/(profiles|support_tickets)$/);
  if (!m) return null;
  const hidden = HIDDEN[m[1]];
  const sel = url.searchParams.get("select");
  const reads = method === "GET" || method === "HEAD" || /return=representation/.test(prefer ?? "");
  if (reads) {
    const top = (sel ?? "*").replace(/\([^()]*\)/g, "").split(",").map((c) => c.split("::")[0].split(":").pop().trim());
    if (top.some((c) => c === "*" || hidden.includes(c))) return `${method} ${m[1]} select=${sel ?? "(default *)"}`;
  }
  for (const [k, v] of url.searchParams) {
    if (hidden.includes(k) || ((k === "or" || k === "and") && hidden.some((c) => v.includes(`${c}.`)))) return `${method} ${m[1]} filter ${k}=${v}`;
  }
  return null;
}
const watched = new WeakSet();
const watch = (ctx) => {
  if (watched.has(ctx)) return ctx;
  watched.add(ctx);
  ctx.on("request", (req) => {
    if (req.method() === "OPTIONS") return;
    const problem = columnPrivilegeProblem(new URL(req.url()), req.method(), req.headers()["prefer"]);
    if (problem) refused.push(problem);
  });
  return ctx;
};
const realLaunch = chromium.launch;
chromium.launch = async (options = {}) => {
  const browser = await realLaunch(options);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => watch(await newContext(...args));
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...args) => { const page = await newPage(...args); watch(page.context()); return page; };
  return browser;
};
process.on("exit", () => {
  const distinct = [...new Set(refused)];
  if (distinct.length) console.log(`FAIL column privileges (0015 K): ${distinct.length} kind(s) of request the database refuses: ${distinct.slice(0, 5).join(" | ")}`);
});
