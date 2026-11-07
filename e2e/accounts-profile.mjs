// Profile, Edit profile (photos), Edit bio, Interests: values load, save, survive a reload.
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
import { newState, installMock, seedBrowser, makeUser, completeProfile, PNG, SB } from "./accounts-mockdb.mjs";

const base = process.env.E2E_BASE ?? "http://127.0.0.1:4301";
const out = process.env.E2E_SHOTS ?? `${tmpdir()}/isexy-accounts-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const visible = async (loc) => loc.evaluate((el) => { const s = getComputedStyle(el); return s.backgroundColor !== s.color; });

const id = "bbbbbbbb-0000-4000-8000-000000000001";
const user = makeUser(id);
const state = newState();
completeProfile(state, id, { interests: ["Coffee", "Hiking", "Reading"], job_title: "" });
state.profile_photos.push({ id: "p2", profile_id: id, photo_url: `${SB}/storage/v1/object/public/isexy-profile-photos/${id}/b.png`, position: 1, created_at: "2026-10-01" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await seedBrowser(ctx, user);
await installMock(ctx, state, { user });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
const toast = async () => (await page.locator("[data-sonner-toast]").last().innerText().catch(() => "")).replace(/\s+/g, " ");

// Profile page
await page.goto(base + "/profile");
const editBtn = page.getByRole("button", { name: "Edit profile" });
await editBtn.waitFor();
check("Edit profile button readable", await visible(editBtn));
await page.screenshot({ path: `${out}/profile-390.png`, fullPage: true });
await page.getByRole("button", { name: "Safety" }).click();
check("Safety icon opens /safety", new URL(page.url()).pathname === "/safety");
await page.goBack();
await page.getByRole("button", { name: /Boosts/ }).click();
check("Boosts tile opens /get-boosts", new URL(page.url()).pathname === "/get-boosts", new URL(page.url()).pathname);
await page.goto(base + "/profile");
await editBtn.click();
await page.waitForURL((u) => u.pathname === "/edit-profile");

// Edit profile: bio validation
await page.locator("#field-bio").waitFor();
await page.waitForTimeout(300);
check("bio loaded", (await page.locator("#field-bio").inputValue()).startsWith("Montréal"));
await page.locator("#field-bio").fill("short");
await page.getByRole("button", { name: "Save" }).click();
check("short bio refused", await page.getByText("Write at least 10 characters").isVisible());
await page.locator("#field-bio").fill("J'aime le café, la randonnée et les bons livres.");
await page.locator("#field-job-title").fill("Designer");
await page.screenshot({ path: `${out}/edit-profile-390.png`, fullPage: true });
await page.getByRole("button", { name: "Save" }).click();
await page.waitForURL((u) => u.pathname === "/profile", { timeout: 5000 }).catch(() => {});
const prof = () => state.profiles.find((p) => p.id === id);
check("edit profile saved bio + job", prof().bio.startsWith("J'aime") && prof().job_title === "Designer");
await page.goto(base + "/edit-profile");
await page.locator("#field-job-title").waitFor();
await page.waitForTimeout(400);
check("job title shows after reload", (await page.locator("#field-job-title").inputValue()) === "Designer");

// Photos: make main, delete, last-photo guard, upload
await page.getByRole("button", { name: "Make photo 2 your main photo" }).click();
await page.waitForTimeout(500);
const pos = Object.fromEntries(state.profile_photos.filter((p) => p.profile_id === id).map((p) => [p.photo_url.split("/").pop(), p.position]));
check("make main reorders positions", pos["b.png"] === 0 && pos["a.png"] === 1, JSON.stringify(pos));
await page.getByRole("button", { name: "Remove photo 2" }).click();
await page.waitForTimeout(500);
check("photo row deleted", state.profile_photos.filter((p) => p.profile_id === id).length === 1);
check("photo file removed from isexy-profile-photos", state.log.some((l) => l.startsWith("storage DELETE isexy-profile-photos") && l.includes(`${id}/a.png`)));
await page.getByRole("button", { name: "Remove photo 1" }).click();
await page.waitForTimeout(300);
check("last photo cannot be removed", state.profile_photos.filter((p) => p.profile_id === id).length === 1 && (await page.getByText("Keep at least one photo").isVisible()));
const add = page.getByRole("button", { name: "Add a photo" }).first();
check("add-photo button readable", await visible(add));
await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "new.png", mimeType: "image/png", buffer: PNG });
await page.getByAltText("Photo 2").waitFor({ timeout: 5000 }).catch(() => {});
const rows = state.profile_photos.filter((p) => p.profile_id === id);
check("uploaded photo saved at position 1", rows.length === 2 && rows.some((r) => r.position === 1 && r.photo_url.includes("/isexy-profile-photos/")), JSON.stringify(rows.map((r) => r.position)));
await page.screenshot({ path: `${out}/edit-photos-390.png` });

// Edit bio: loads, validates, saves and refreshes the profile shown elsewhere
await page.goto(base + "/edit-bio");
await page.getByLabel("About me").waitFor();
await page.waitForTimeout(300);
check("edit bio loads saved bio", (await page.getByLabel("About me").inputValue()).startsWith("J'aime"));
const tip = page.getByText("Bio tip");
check("bio tip readable", await visible(tip));
await page.getByLabel("About me").fill("Bonjour!");
await page.getByRole("button", { name: "Save bio" }).click();
await page.waitForTimeout(300);
check("edit bio refuses < 10 chars", prof().bio.startsWith("J'aime") && (await page.getByText("Write at least 10 characters").first().isVisible()));
await page.getByLabel("About me").fill("Toujours partante pour un café et une bonne discussion.");
await page.screenshot({ path: `${out}/edit-bio-390.png` });
await page.getByRole("button", { name: "Save bio" }).click();
await page.waitForURL((u) => u.pathname === "/profile", { timeout: 5000 }).catch(() => {});
check("edit bio saved", prof().bio.startsWith("Toujours"), new URL(page.url()).pathname);
await page.getByRole("button", { name: "Edit profile" }).click();
await page.locator("#field-bio").waitFor();
check("edit profile shows the new bio without reload", (await page.locator("#field-bio").inputValue()).startsWith("Toujours"));

// Interests: direct visit keeps saved interests, saves, reload shows them
await page.goto(base + "/interests");
await page.getByText("Selected").waitFor({ timeout: 5000 }).catch(() => {});
check("interests preselected on direct visit", (await page.getByText("3 of 10").isVisible()));
await page.getByRole("button", { name: "Yoga", exact: true }).click();
await page.screenshot({ path: `${out}/interests-390.png` });
await page.getByRole("button", { name: "Save Interests" }).click();
await page.waitForTimeout(600);
check("interests saved", JSON.stringify(prof().interests) === JSON.stringify(["Coffee", "Hiking", "Reading", "Yoga"]), JSON.stringify(prof().interests));
await page.goto(base + "/interests");
await page.waitForTimeout(800);
check("interests after reload", await page.getByText("4 of 10").isVisible());

// A refresh that fails after a save keeps the member on their profile (no retry screen, no setup).
await page.goto(base + "/edit-bio");
await page.getByLabel("About me").waitFor();
await page.waitForTimeout(400);
state.failures["GET profiles"] = { status: 503, body: { message: "upstream unavailable" } };
await page.getByLabel("About me").fill("Toujours partante pour un café et une bonne discussion.");
await page.getByRole("button", { name: "Save bio" }).click();
await page.waitForTimeout(1500);
delete state.failures["GET profiles"];
check("save then failed refresh: bio saved", prof().bio.startsWith("Toujours partante"), prof().bio);
check("save then failed refresh: still on the profile", new URL(page.url()).pathname === "/profile" && await page.getByRole("button", { name: "Edit profile" }).isVisible(), new URL(page.url()).pathname);

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;
