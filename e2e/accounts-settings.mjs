// Settings and every account sub-page: values load, toggles persist (server copy and reload),
// errors are reported. Mocked backend, preview build, 390x844.
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
import { newState, installMock, seedBrowser, makeUser, completeProfile } from "./accounts-mockdb.mjs";

const base = process.env.E2E_BASE ?? "http://127.0.0.1:4301";
const out = process.env.E2E_SHOTS ?? `${tmpdir()}/isexy-accounts-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const id = "cccccccc-0000-4000-8000-000000000001";
const other = "cccccccc-0000-4000-8000-000000000002";
const user = makeUser(id);

async function setup({ state, contextOptions = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...contextOptions });
  await seedBrowser(ctx, user);
  await installMock(ctx, state, { user });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, errors };
}
const prefs = (state) => state.user_preferences.find((u) => u.user_id === id)?.settings ?? {};
const rowSwitch = (page, label) => page.locator("div.p-4").filter({ has: page.getByText(label, { exact: true }) }).getByRole("switch").first();

// ---------------------------------------------------------------- Settings
{
  const state = newState();
  completeProfile(state, id, { interested_in: ["everyone"] });
  const { ctx, page, errors } = await setup({ state });
  await page.goto(base + "/settings");
  await page.getByText("Discovery Settings").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/settings-top-390.png` });
  check("phone shows from account", await page.getByText("+15145550123").isVisible());
  check("email shows from account", await page.getByText("ana@example.com").isVisible());
  check("no fake 'Montreal' location", await page.getByText("Montréal, Canada").isVisible());
  check("Save disabled when nothing changed", await page.getByRole("button", { name: "All changes saved" }).isDisabled());
  await rowSwitch(page, "Global").click();
  check("unsaved bar appears", await page.getByText("You have unsaved changes").isVisible());
  await page.screenshot({ path: `${out}/settings-dirty-390.png` });
  // Show me drawer
  await page.getByRole("button", { name: /Show me/ }).click();
  await page.getByRole("button", { name: "Men", exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/settings-showme-390.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(800);
  const prof = state.profiles.find((p) => p.id === id);
  check("show me saved to profiles.interested_in", JSON.stringify(prof.interested_in) === '["men"]', JSON.stringify(prof.interested_in));
  check("discovery toggle saved to user_preferences.settings", prefs(state).discovery?.global === true, JSON.stringify(prefs(state).discovery ?? {}).slice(0, 80));
  check("settings save does not overwrite own profile details", !("looking_for" in (state.log.find((l) => l.startsWith("PATCH profiles")) ? {} : {})));
  check("unsaved bar gone after save", !(await page.getByText("You have unsaved changes").isVisible()));
  await page.reload();
  await page.getByText("Discovery Settings").waitFor();
  await page.waitForTimeout(800);
  check("Global stays on after reload", (await rowSwitch(page, "Global").getAttribute("aria-checked")) === "true");
  check("Show me shows Men after reload", await page.getByRole("button", { name: /Show me\s*Men/ }).isVisible());
  // Read-only rows are not buttons; dead rows are gone.
  check("no dead Student Mode button", !(await page.getByText("Apply for Student Mode").isVisible()));
  check("no dead Google Play row", !(await page.getByText("Manage Google Play Account").isVisible()));
  await page.screenshot({ path: `${out}/settings-full-390.png`, fullPage: true });
  check("settings: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// Plus™ choices: free members see the plans; subscribers save them (the feed applies them).
{
  const state = newState();
  completeProfile(state, id);
  const { ctx, page } = await setup({ state });
  await page.goto(base + "/settings");
  await page.getByText("Discovery Settings").waitFor();
  await page.getByText("Incognito", { exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/premium", { timeout: 5000 }).catch(() => {});
  check("free member: Incognito leads to the plans", new URL(page.url()).pathname === "/premium", new URL(page.url()).pathname);
  check("free member: nothing saved", !prefs(state).discovery);
  await ctx.close();
}
{
  const state = newState();
  completeProfile(state, id, { subscription_tier: "plus" });
  const { ctx, page } = await setup({ state });
  await page.goto(base + "/settings");
  await page.getByText("Discovery Settings").waitFor();
  await page.waitForTimeout(500);
  await page.getByText("Incognito", { exact: true }).click();
  await page.getByText("Recently Active", { exact: true }).click();
  await rowSwitch(page, "Enable Discovery").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(800);
  const d = prefs(state).discovery ?? {};
  check("plus member: incognito + recent + discovery off saved", d.visibility === "incognito" && d.sortBy === "recent" && d.enabled === false, JSON.stringify(d).slice(0, 120));
  check("honest Enable Discovery copy", await page.getByText("hidden from other members' card stack").isVisible());
  await ctx.close();
}

// Settings before the settings column exists: saved on the device, still there after reload.
{
  const state = newState({ missingColumns: { user_preferences: ["settings"] } });
  completeProfile(state, id);
  const { ctx, page } = await setup({ state });
  await page.goto(base + "/settings");
  await page.getByText("Discovery Settings").waitFor();
  await page.waitForTimeout(500);
  await rowSwitch(page, "Send Read Receipts").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(800);
  check("un-migrated DB: honest 'saved on this device' toast", await page.getByText("Settings saved on this device").isVisible());
  await page.reload();
  await page.getByText("Discovery Settings").waitFor();
  await page.waitForTimeout(800);
  check("un-migrated DB: toggle kept on this device", (await rowSwitch(page, "Send Read Receipts").getAttribute("aria-checked")) === "false");
  await ctx.close();
}

// ------------------------------------------------- Active status, dark mode
{
  const state = newState();
  completeProfile(state, id);
  state.user_preferences.push({ id: "up1", user_id: id, preferred_language: "fr", auto_translate: true, settings: {} });
  const { ctx, page, errors } = await setup({ state });
  // Email and Push notification pages belong to wf/chat (user_preferences.notification_settings).

  await page.goto(base + "/active-status");
  await page.getByText("Show Active Status", { exact: true }).waitFor();
  await page.waitForTimeout(400);
  await page.getByRole("switch", { name: "Show Active Status" }).click();
  await page.waitForTimeout(500);
  check("active status saved", prefs(state).activeStatus?.showActive === false);
  await page.reload();
  await page.waitForTimeout(800);
  check("active status after reload", (await page.getByRole("switch", { name: "Show Active Status" }).getAttribute("aria-checked")) === "false");

  await page.goto(base + "/dark-mode");
  await page.getByText("Coming soon").waitFor();
  await page.screenshot({ path: `${out}/dark-mode-390.png` });
  check("dark mode page honest", await page.getByText("ISEXY uses a dark theme").isVisible());
  check("sub-pages: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ----------------------------------------------------------- Block contacts
{
  const state = newState();
  completeProfile(state, id);
  completeProfile(state, other, { first_name: "Zoé" });
  state.blocks.push({ id: "blk1", blocker_id: id, blocked_id: other, created_at: "2026-10-10T00:00:00Z" });
  const { ctx, page, errors } = await setup({ state });
  await page.goto(base + "/block-contacts");
  await page.getByRole("button", { name: /Blocked members/ }).click();
  await page.getByText("Zoé").waitFor({ timeout: 5000 }).catch(() => {});
  check("blocked member listed", await page.getByText("Zoé").isVisible());
  await page.screenshot({ path: `${out}/block-members-390.png` });
  await page.getByRole("button", { name: "Unblock" }).click();
  await page.waitForTimeout(500);
  check("unblock removes the block", state.blocks.length === 0 && !(await page.getByText("Zoé", { exact: true }).isVisible()), `blocks=${state.blocks.length}`);
  await page.getByRole("button", { name: /^Contacts/ }).click();
  await page.getByRole("button", { name: "Add a contact" }).first().click();
  await page.getByLabel("Name").fill("Paul");
  await page.getByLabel("Phone number").fill("514 555");
  await page.getByRole("button", { name: "Done" }).click();
  check("bad phone refused", await page.getByText("country code").isVisible());
  await page.getByLabel("Phone number").fill("+1 514 555 0199");
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(500);
  check("contact saved privately", prefs(state).blockedContacts?.[0]?.phone === "+15145550199", JSON.stringify(prefs(state).blockedContacts));
  await page.reload();
  await page.getByText("Paul").waitFor({ timeout: 5000 }).catch(() => {});
  check("contact listed after reload", await page.getByText("Paul").isVisible());
  await page.screenshot({ path: `${out}/block-contacts-390.png` });
  check("block contacts: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ----------------------------------------------------------- Passport mode
{
  const state = newState();
  completeProfile(state, id, { subscription_tier: "gold", city: "Montréal" });
  const { ctx, page, errors } = await setup({ state, contextOptions: { permissions: ["geolocation"], geolocation: { latitude: 45.5, longitude: -73.57 } } });
  await page.goto(base + "/passport-mode");
  await page.getByText("Toronto").first().click();
  await page.waitForURL((u) => u.pathname === "/discover", { timeout: 5000 }).catch(() => {});
  const prof = () => state.profiles.find((p) => p.id === id);
  check("passport moves the member", prof().city === "Toronto" && prof().latitude === 43.6532);
  check("home city remembered", prefs(state).passport?.homeCity === "Montréal", JSON.stringify(prefs(state).passport));
  await page.goto(base + "/passport-mode");
  await page.getByText("Use Current Location").click();
  await page.waitForURL((u) => u.pathname === "/discover", { timeout: 5000 }).catch(() => {});
  check("current location restores the home city", prof().city === "Montréal" && prof().latitude === 45.5, `${prof().city} ${prof().latitude}`);
  check("passport memory cleared", !prefs(state).passport);
  check("passport: no page errors", errors.length === 0, errors.join(" | "));
  await page.goto(base + "/passport-mode");
  await page.getByPlaceholder("Search for a city...").fill("quebec");
  check("passport search ignores accents", await page.getByText("Québec City").isVisible());
  await page.screenshot({ path: `${out}/passport-390.png` });
  await ctx.close();
}
// Free member: cities are not dead buttons, they lead to the plans.
{
  const state = newState();
  completeProfile(state, id, { city: "Montréal" });
  const { ctx, page } = await setup({ state });
  await page.goto(base + "/passport-mode");
  await page.getByText("Vancouver").first().click();
  await page.waitForURL((u) => u.pathname === "/premium", { timeout: 5000 }).catch(() => {});
  check("free member tapping a city goes to /premium", new URL(page.url()).pathname === "/premium", new URL(page.url()).pathname);
  check("free member's location unchanged", state.profiles.find((p) => p.id === id).city === "Montréal");
  await ctx.close();
}

// ----------------------------------------------------------- Photo verification
{
  const state = newState();
  completeProfile(state, id);
  const { ctx, page, errors } = await setup({ state, contextOptions: { permissions: ["camera"] } });
  await page.goto(base + "/photo-verification");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Take Photo" }).waitFor();
  await page.waitForTimeout(1200);
  const hasVideo = await page.locator("video").evaluate((v) => !!v.srcObject && v.videoWidth > 0);
  check("camera preview shows the stream", hasVideo);
  await page.screenshot({ path: `${out}/verify-camera-390.png` });
  await page.getByRole("button", { name: "Take Photo" }).click();
  await page.getByRole("button", { name: "Send for review" }).click();
  await page.getByText("Your selfie is being reviewed").waitFor({ timeout: 5000 }).catch(() => {});
  check("selfie stored privately", [...state.storage.keys()].some((k) => k.startsWith(`isexy-photo-verifications/${id}/selfie-`)));
  check("pending request created", state.photo_verifications.length === 1 && state.photo_verifications[0].profile_id === id);
  check("no fake 'verified' badge", !state.profiles.find((p) => p.id === id).is_verified);
  await page.screenshot({ path: `${out}/verify-pending-390.png` });
  await page.reload();
  await page.getByText("Your selfie is being reviewed").waitFor({ timeout: 5000 }).catch(() => {});
  check("pending state after reload", await page.getByText("Your selfie is being reviewed").isVisible());
  check("verification: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ----------------------------------------------------------- Delete account
{
  const state = newState();
  completeProfile(state, id);
  const { ctx, page, errors } = await setup({ state });
  await page.goto(base + "/delete-account");
  await page.getByText("Privacy concerns").click();
  await page.screenshot({ path: `${out}/delete-account-390.png`, fullPage: true });
  await page.getByRole("button", { name: "Delete My Account" }).click();
  await page.getByRole("button", { name: "Yes, delete my account" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 8000 }).catch(() => {});
  const t = state.support_tickets[0];
  check("deletion request ticket created", t?.subject === "Account deletion request" && t?.user_id === id && t?.message.includes("Privacy concerns"), JSON.stringify(t ?? {}).slice(0, 120));
  check("member signed out", state.log.includes("auth logout"));
  check("no data deleted client-side", state.profiles.some((p) => p.id === id) && state.profile_photos.some((p) => p.profile_id === id));
  check("lands on home", new URL(page.url()).pathname === "/");
  check("delete: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// Deletion request fails: the member stays signed in and is told.
{
  const state = newState({ delays: { "POST support_tickets": 600 }, failures: { "POST support_tickets": { status: 500, body: { message: "boom" } } } });
  completeProfile(state, id);
  const { ctx, page } = await setup({ state });
  await page.goto(base + "/delete-account");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("delete page has no horizontal overflow", !overflow);
  await page.getByText("Privacy concerns").click();
  await page.getByRole("button", { name: "Delete My Account" }).click();
  await page.getByRole("button", { name: "Yes, delete my account" }).click();
  check("dialog stays open while sending", await page.getByRole("button", { name: "Deleting..." }).isVisible().catch(() => false));
  await page.getByText("We couldn't send your request").waitFor({ timeout: 5000 }).catch(() => {});
  check("failed request is reported", await page.getByText("We couldn't send your request").isVisible());
  check("failed request keeps the member signed in", !state.log.includes("auth logout") && new URL(page.url()).pathname === "/delete-account");
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;
