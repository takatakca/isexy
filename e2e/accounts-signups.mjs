// Tourist signup end to end, plus layout smoke checks of the other account entry pages.
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
import { newState, installMock, seedBrowser, makeUser, completeProfile, PNG } from "./accounts-mockdb.mjs";

const base = process.env.E2E_BASE ?? "http://127.0.0.1:4301";
const out = process.env.E2E_SHOTS ?? `${tmpdir()}/isexy-accounts-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

// Tourist signup
{
  const id = "dddddddd-0000-4000-8000-000000000001";
  const user = makeUser(id);
  const state = newState();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, user);
  await installMock(ctx, state, { user });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/tourist-signup");
  const cont = () => page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByPlaceholder("First name").fill("Sam");
  const colors = await page.getByRole("button", { name: "Continue", exact: true }).evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color]; });
  check("tourist Continue button readable", colors[0] !== colors[1], colors.join(" / "));
  await cont();
  await page.locator('input[type="date"]').fill("1990-07-07");
  await cont();
  await page.getByRole("button", { name: "Man", exact: true }).click();
  check("show me required", await page.getByRole("button", { name: "Continue", exact: true }).isDisabled());
  await page.getByRole("button", { name: "Women", exact: true }).click();
  await page.screenshot({ path: `${out}/tourist-3-390.png` });
  await cont();
  const inputs = page.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
  await page.getByAltText("Photo 1").waitFor({ timeout: 5000 }).catch(() => {});
  await inputs.nth(1).setInputFiles({ name: "b.png", mimeType: "image/png", buffer: PNG });
  await page.getByAltText("Photo 2").waitFor({ timeout: 5000 }).catch(() => {});
  check("tourist photo upload works (signed-in uploads)", await page.getByAltText("Photo 2").isVisible());
  await cont();
  await page.getByPlaceholder("Share a bit about yourself...").fill("Visiting Havana in December, love salsa and street food.");
  await cont();
  await cont();
  await cont();
  for (const i of ["Coffee", "Hiking", "Reading"]) await page.getByRole("button", { name: i, exact: true }).click();
  await cont();
  await page.getByPlaceholder("Your country").fill("Canada");
  await cont();
  await page.getByRole("button", { name: "Create my profile" }).click();
  await page.waitForURL((u) => u.pathname === "/discover", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const prof = state.profiles.find((p) => p.user_id === id);
  check("tourist profile complete → stays on /discover", new URL(page.url()).pathname === "/discover", new URL(page.url()).pathname);
  check("tourist interested_in + bio saved", JSON.stringify(prof?.interested_in) === '["women"]' && prof?.bio?.startsWith("Visiting"));
  check("tourist photos saved", state.profile_photos.filter((p) => p.profile_id === id).length === 2);
  check("tourist: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// Smoke + layout of entry pages
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, null);
  await installMock(ctx, newState(), {});
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  for (const [path, name] of [["/auth", "auth"], ["/auth?mode=signup", "auth-signup"], ["/onboarding", "onboarding"], ["/staff-login", "staff-login"], ["/cuban-signup", "cuban-signup"], ["/tourist-signup", "tourist-signin"]]) {
    await page.goto(base + path);
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`${path} has no horizontal overflow`, !overflow);
    await page.screenshot({ path: `${out}/${name}-390.png`, fullPage: true });
  }
  for (const path of ["/settings", "/interests", "/email-settings", "/delete-account", "/photo-verification"]) {
    await page.goto(base + path);
    await page.waitForTimeout(700);
    check(`${path} requires sign-in`, new URL(page.url()).pathname === "/auth", new URL(page.url()).pathname);
  }
  check("entry pages: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// Home page: visitors see it; signed-in members go to Discover. Back on a page opened directly stays in ISEXY.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, null);
  await installMock(ctx, newState(), {});
  const page = await ctx.newPage();
  await page.goto(base + "/");
  await page.waitForTimeout(1200);
  check("visitor stays on the home page", new URL(page.url()).pathname === "/", new URL(page.url()).pathname);
  await page.goto(base + "/auth");
  await page.getByRole("button", { name: "Go back" }).click();
  await page.waitForTimeout(600);
  check("back on /auth opened directly goes home", new URL(page.url()).pathname === "/", page.url());
  await ctx.close();
}
{
  const id = "eeeeeeee-0000-4000-8000-000000000009";
  const user = makeUser(id);
  const state = newState();
  completeProfile(state, id);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, user);
  await installMock(ctx, state, { user });
  const page = await ctx.newPage();
  await page.goto(base + "/?source=pwa");
  await page.waitForURL((u) => u.pathname === "/discover", { timeout: 8000 }).catch(() => {});
  check("signed-in member opening the app goes to Discover", new URL(page.url()).pathname === "/discover", new URL(page.url()).pathname);
  await page.goto(base + "/email-settings");
  await page.getByRole("button", { name: "Go back" }).click();
  await page.waitForURL((u) => u.pathname !== "/email-settings", { timeout: 5000 }).catch(() => {});
  check("back on a settings page opened directly stays in ISEXY", new URL(page.url()).origin === base && new URL(page.url()).pathname === "/discover", page.url());
  await ctx.close();
}

// Staff portal: members without a staff role are refused; moderators reach the support desk.
for (const [role, expectDenied] of [[null, true], ["moderator", false]]) {
  const sid = role ? "eeeeeeee-0000-4000-8000-00000000000b" : "eeeeeeee-0000-4000-8000-00000000000a";
  const suser = makeUser(sid);
  const state = newState({ user_roles: role ? [{ id: "r1", user_id: sid, role }] : [] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, suser);
  await installMock(ctx, state, { user: suser });
  const page = await ctx.newPage();
  await page.goto(base + "/staff-login");
  await page.waitForTimeout(1500);
  if (expectDenied) {
    check("staff portal refuses a member without a role", await page.getByText("Access denied").isVisible());
    await page.getByRole("button", { name: "Use another account" }).click();
    await page.waitForTimeout(500);
    check("staff portal: switch account signs out", state.log.includes("auth logout"));
  } else {
    check("staff portal lets a moderator in", new URL(page.url()).pathname === "/support", new URL(page.url()).pathname);
  }
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;
