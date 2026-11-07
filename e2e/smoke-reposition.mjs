import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const base = process.env.E2E_BASE ?? "http://127.0.0.1:4173", out = process.argv[2];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route("**/*.supabase.co/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
for (const [from, want] of [["/love-stories", "/community-stories"], ["/dating-regulations", "/regulations"], ["/double-date", "/double-hangout"], ["/matchmaker", "/introductions"]]) {
  await p.goto(base + from); await p.waitForTimeout(800);
  const path = new URL(p.url()).pathname;
  const text = (await p.locator("body").innerText()).toLowerCase();
  console.log(from, "->", path, path === want || path === "/auth" ? "ok" : "MISMATCH", "| dating words:", /dating|romance|romantic|soulmate|singles/.test(text));
}
await p.goto(base + "/"); await p.waitForTimeout(1200);
const t = (await p.locator("body").innerText()).toLowerCase();
console.log("home dating words:", /dating|romance|romantic|soulmate|singles|first date/.test(t), "| mentions friends:", /friend/.test(t));
await p.screenshot({ path: `${out}/reposition-home-390.png`, fullPage: false });
console.log("errors:", errs); await b.close();
