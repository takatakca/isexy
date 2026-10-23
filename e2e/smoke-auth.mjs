import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const [, , out] = process.argv;
const base = process.env.E2E_BASE ?? "http://127.0.0.1:4173";
const USER = "aaaaaaaa-0000-4000-8000-000000000001";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const calls = [];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await ctx.route("**/*.supabase.co/**", async (route) => {
  const req = route.request(); const url = req.url();
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
  if (url.includes("/auth/v1/otp")) { calls.push("otp " + req.postData()); return json({}); }
  if (url.includes("/auth/v1/verify")) {
    calls.push("verify " + req.postData());
    const now = Math.floor(Date.now() / 1000);
    return json({ access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r",
      user: { id: USER, aud: "authenticated", role: "authenticated", email: "ana@example.com", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-10-09T00:00:00Z" } });
  }
  if (url.includes("/auth/v1/user")) return json({ id: USER, aud: "authenticated", role: "authenticated", email: "ana@example.com", app_metadata: {}, user_metadata: {} });
  if (url.includes("/rest/v1/")) { calls.push("rest " + (req.headers()["accept-profile"] || req.headers()["content-profile"] || "-") + " " + url.split("/rest/v1/")[1].split("?")[0]); return json([]); }
  return json({});
});
await page.goto(base + "/auth?mode=signup");
await page.getByRole("button", { name: /essential only/i }).click();
await page.getByRole("button", { name: "Continue with Google" }).waitFor();
console.log("google button:", await page.getByRole("button", { name: "Continue with Google" }).isVisible());
await page.screenshot({ path: `${out}/v1-auth-390.png`, fullPage: true });
// email code, terms required
await page.fill("#takatak-email", "Ana@Example.com");
await page.getByRole("button", { name: "Create my account" }).click();
console.log("terms enforced:", await page.getByText("Please confirm you're 18+").isVisible());
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create my account" }).click();
await page.locator("#takatak-code").waitFor();
await page.screenshot({ path: `${out}/v1-auth-code-390.png` });
await page.fill("#takatak-code", "123456");
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 10000 }).catch(() => {});
console.log("after verify url:", new URL(page.url()).pathname);
console.log("stored session key:", await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("auth-token"))));
// phone tab validation (fresh context)
const p2 = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p2.context().route("**/*.supabase.co/**", (r) => { if (r.request().url().includes("/auth/v1/otp")) calls.push("otp " + r.request().postData()); r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
await p2.goto(base + "/phone");
await p2.getByRole("button", { name: /essential only/i }).click();
console.log("/phone ->", new URL(p2.url()).pathname + new URL(p2.url()).search, "phone tab selected:", await p2.getByRole("tab", { name: "Phone" }).getAttribute("aria-selected"));
await p2.fill("#takatak-phone", "5307 1185");
await p2.getByRole("button", { name: "Send my code" }).click();
console.log("bad phone rejected:", await p2.getByText("country code").first().isVisible());
await p2.fill("#takatak-phone", "+53 5307 1185");
await p2.getByRole("button", { name: "Send my code" }).click();
await p2.locator("#takatak-code").waitFor();
// google redirect target
const p3 = await (await browser.newContext()).newPage();
await p3.goto(base + "/auth");
await p3.getByRole("button", { name: /essential only/i }).click();
const [nav] = await Promise.all([p3.waitForRequest((r) => r.url().includes("/auth/v1/authorize"), { timeout: 10000 }), p3.getByRole("button", { name: "Continue with Google" }).click()]);
const u = new URL(nav.url());
console.log("google:", u.host, u.searchParams.get("provider"), "redirect_to=", u.searchParams.get("redirect_to"));
for (const c of calls) console.log("  ", c.slice(0, 140));
console.log("pageerrors:", errors);
await browser.close();
