// Sign-in routing + profile setup, against the preview build with a mocked backend.
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

async function otpSignIn(page, from = "/auth") {
  await page.goto(base + from);
  await page.fill("#takatak-email", "ana@example.com");
  const terms = page.getByRole("checkbox");
  if (await terms.isVisible().catch(() => false)) await terms.check();
  await page.getByRole("button", { name: /Send my code|Create my account/ }).click();
  await page.locator("#takatak-code").waitFor();
  await page.fill("#takatak-code", "123456");
  await page.getByRole("button", { name: "Continue" }).click();
}

// 1. Returning member with a complete profile, slow profile fetch: must land on Discover.
{
  const id = "aaaaaaaa-0000-4000-8000-000000000001";
  const user = makeUser(id);
  const state = newState({ delays: { "GET profiles": 700 } });
  completeProfile(state, id);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, null);
  await installMock(ctx, state, { user });
  const page = await ctx.newPage();
  const visited = [];
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) visited.push(new URL(f.url()).pathname); });
  await otpSignIn(page);
  await page.waitForURL((u) => u.pathname === "/discover", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const path = new URL(page.url()).pathname;
  check("returning member lands on /discover", path === "/discover", `path=${path} visited=${visited.join(">")}`);
  check("returning member never passes through /profile-setup", !visited.includes("/profile-setup"));
  await ctx.close();
}

// 2. New member: no profile → /profile-setup; complete the 10 steps; lands on /discover; data saved.
{
  const id = "aaaaaaaa-0000-4000-8000-000000000002";
  const user = makeUser(id, { email: "new@example.com" });
  const state = newState();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["geolocation"], geolocation: { latitude: 45.50884, longitude: -73.58781 } });
  await seedBrowser(ctx, null);
  await installMock(ctx, state, { user });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await otpSignIn(page, "/auth?mode=signup");
  await page.waitForURL((u) => u.pathname === "/profile-setup", { timeout: 10000 }).catch(() => {});
  check("new member lands on /profile-setup", new URL(page.url()).pathname === "/profile-setup", new URL(page.url()).pathname);
  const next = () => page.getByRole("button", { name: /^Next/ }).click();
  await page.getByPlaceholder("First name").fill("  Léa ");
  await page.screenshot({ path: `${out}/setup-1-name.png` });
  await next();
  // Under-18 date is refused with a clear message.
  await page.locator('input[type="date"]').fill("2012-01-01");
  check("under-18 birth date blocks Next", await page.getByRole("button", { name: /^Next/ }).isDisabled());
  check("under-18 message shown", await page.getByText("You must be 18 or older").isVisible());
  await page.locator('input[type="date"]').fill("1996-03-04");
  await next();
  await page.getByRole("button", { name: "Woman", exact: true }).click();
  await page.getByRole("button", { name: "Women", exact: true }).click();
  await page.getByRole("button", { name: "Everyone", exact: true }).click();
  const pressed = await page.locator('button[aria-pressed="true"]').allInnerTexts();
  check("Everyone stands alone", pressed.join(",") === "Everyone", pressed.join(","));
  await page.screenshot({ path: `${out}/setup-3-gender.png` });
  await next();
  // Photos: the "+" must be visible (not background-on-background).
  const addBtn = page.getByRole("button", { name: "Add a photo" }).first();
  const addColors = await addBtn.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color]; });
  check("add-photo button is visible", addColors[0] !== addColors[1], addColors.join(" / "));
  await page.locator('input[type="file"]').first().setInputFiles({ name: "me.png", mimeType: "image/png", buffer: (await import("./mockdb.mjs")).PNG });
  await page.getByAltText("Photo 1").waitFor();
  await page.screenshot({ path: `${out}/setup-4-photos.png` });
  await next();
  await page.locator("#setup-bio").fill("Hi");
  check("short bio blocks Next", await page.getByRole("button", { name: /^Next/ }).isDisabled());
  await page.locator("#setup-bio").fill("Montréal, café et randonnée le week-end.");
  await page.screenshot({ path: `${out}/setup-5-bio.png` });
  await next();
  await next(); // lifestyle (optional)
  await next(); // personality (optional)
  for (const i of ["Coffee", "Hiking", "Reading"]) await page.getByRole("button", { name: i, exact: true }).click();
  await next();
  // Location: real geolocation.
  await page.screenshot({ path: `${out}/setup-9-location.png` });
  const allow = page.getByRole("button", { name: "Allow" });
  const allowColors = await allow.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color]; });
  check("Allow button text visible", allowColors[0] !== allowColors[1], allowColors.join(" / "));
  await allow.click();
  await page.getByRole("button", { name: "I accept" }).waitFor();
  await page.screenshot({ path: `${out}/setup-10-privacy.png` });
  // Personalize opens the consent dialog instead of the (protected) settings page.
  await page.getByRole("button", { name: "Personalize" }).click();
  await page.waitForTimeout(400);
  check("Personalize opens privacy choices", new URL(page.url()).pathname === "/profile-setup" && (await page.getByText(/analytics/i).first().isVisible().catch(() => false)));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const saveBtn = page.getByRole("button", { name: /Save my choices|Save|Essential only/i }).first();
  if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click();
  await page.getByRole("button", { name: "I accept" }).click();
  await page.waitForURL((u) => u.pathname === "/discover", { timeout: 10000 }).catch(() => {});
  check("setup completes on /discover", new URL(page.url()).pathname === "/discover", new URL(page.url()).pathname);
  const prof = state.profiles.find((p) => p.user_id === id);
  check("profile saved with trimmed name", prof?.first_name === "Léa", prof?.first_name);
  check("interested_in saved as everyone", JSON.stringify(prof?.interested_in) === '["everyone"]', JSON.stringify(prof?.interested_in));
  check("location saved (~1 km)", prof?.latitude === 45.51 && prof?.longitude === -73.59 && prof?.location_enabled === true, `${prof?.latitude},${prof?.longitude}`);
  check("photo row saved", state.profile_photos.filter((p) => p.profile_id === id).length === 1);
  check("uploaded to isexy-profile-photos", [...state.storage.keys()].some((k) => k.startsWith(`isexy-profile-photos/${id}/`)));
  check("no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 3. Member whose profile lost its bio: setup is prefilled (name, photos) and saving keeps photos.
{
  const id = "aaaaaaaa-0000-4000-8000-000000000003";
  const user = makeUser(id);
  const state = newState();
  completeProfile(state, id, { bio: "", first_name: "Marc", gender: "man", interested_in: ["female"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, user);
  await installMock(ctx, state, { user });
  const page = await ctx.newPage();
  await page.goto(base + "/discover");
  await page.waitForURL((u) => u.pathname === "/profile-setup", { timeout: 10000 }).catch(() => {});
  check("incomplete profile is sent to setup", new URL(page.url()).pathname === "/profile-setup");
  await page.waitForFunction(() => (document.querySelector("input[placeholder=\"First name\"]"))?.value === "Marc", null, { timeout: 3000 }).catch(() => {});
  check("name prefilled", (await page.getByPlaceholder("First name").inputValue()) === "Marc", await page.getByPlaceholder("First name").inputValue());
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: /^Next/ }).click();
  const pressed = await page.locator('button[aria-pressed="true"]').allInnerTexts();
  check("legacy 'female' shows as Women", pressed.join(",") === "Women", pressed.join(","));
  await page.getByRole("button", { name: /^Next/ }).click();
  check("existing photo prefilled", await page.getByAltText("Photo 1").isVisible());
  await ctx.close();
}

// 4. Complete member opening /profile-setup is sent to Discover.
{
  const id = "aaaaaaaa-0000-4000-8000-000000000004";
  const user = makeUser(id);
  const state = newState();
  completeProfile(state, id);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, user);
  await installMock(ctx, state, { user });
  const page = await ctx.newPage();
  await page.goto(base + "/profile-setup");
  await page.waitForTimeout(1200);
  check("complete member on /profile-setup goes to /discover", new URL(page.url()).pathname === "/discover", new URL(page.url()).pathname);
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;
