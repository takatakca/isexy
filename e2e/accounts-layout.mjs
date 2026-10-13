// Phone layout sweep (390x844): no horizontal scroll, and every visible control can be
// brought on screen without being covered (bottom nav, assistant button, sticky bars).
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
import { newState, installMock, seedBrowser, makeUser, completeProfile } from "./accounts-mockdb.mjs";

const base = process.env.E2E_BASE ?? "http://127.0.0.1:4301";
const out = process.env.E2E_SHOTS ?? `${tmpdir()}/isexy-accounts-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

async function sweep(page, path, name) {
  await page.goto(base + path);
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${path}: no horizontal scroll`, overflow <= 0, `${overflow}px`);
  const covered = await page.evaluate(async () => {
    const sel = 'button, a[href], input:not([type="file"]):not([type="hidden"]), textarea, [role="switch"], [role="tab"]';
    const els = [...document.querySelectorAll(sel)].filter((el) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest('[aria-hidden="true"]');
    });
    const bad = [];
    for (const el of els) {
      el.scrollIntoView({ block: "center", inline: "center" });
      await new Promise((r) => requestAnimationFrame(() => r()));
      // Inline links that wrap have several boxes: test the first one.
      const r = el.getClientRects()[0] ?? el.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const hit = document.elementFromPoint(x, y);
      if (!hit || (hit !== el && !el.contains(hit) && !hit.contains(el))) {
        const label = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.tagName).trim().slice(0, 40);
        const by = hit ? (hit.closest("nav, header, [class*=fixed], button")?.className?.toString().slice(0, 50) || hit.tagName) : "nothing";
        bad.push(`${label} [covered by ${by}]`);
      }
    }
    window.scrollTo(0, 0);
    return bad;
  });
  check(`${path}: no covered controls`, covered.length === 0, covered.slice(0, 6).join("; "));
  await page.screenshot({ path: `${out}/layout-${name}-390.png`, fullPage: true });
}

const id = "dddddddd-0000-4000-8000-000000000001";
const user = makeUser(id);
{
  const state = newState();
  completeProfile(state, id, { subscription_tier: "gold" });
  state.blocks.push({ id: "b1", blocker_id: id, blocked_id: "dddddddd-0000-4000-8000-000000000002", created_at: new Date().toISOString() });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, user);
  await installMock(ctx, state, { user });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  for (const [path, name] of [["/profile", "profile"], ["/edit-profile", "edit-profile"], ["/edit-bio", "edit-bio"], ["/interests", "interests"], ["/settings", "settings"], ["/email-settings", "email"], ["/push-notifications", "push"], ["/dark-mode", "dark"], ["/active-status", "active"], ["/delete-account", "delete"], ["/block-contacts", "block"], ["/passport-mode", "passport"], ["/photo-verification", "verify"]]) {
    await sweep(page, path, name);
  }
  check("member pages: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
{
  const nid = "dddddddd-0000-4000-8000-000000000003";
  const nuser = makeUser(nid);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, nuser);
  await installMock(ctx, newState(), { user: nuser });
  const page = await ctx.newPage();
  await sweep(page, "/profile-setup", "setup");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, null);
  await installMock(ctx, newState(), {});
  const page = await ctx.newPage();
  for (const [path, name] of [["/auth", "auth"], ["/auth?mode=signup", "signup"], ["/onboarding", "onboarding"], ["/staff-login", "staff"]]) await sweep(page, path, name);
  await ctx.close();
}
await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;
