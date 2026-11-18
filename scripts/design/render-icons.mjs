#!/usr/bin/env node
// Renders the ISEXY app icons and the social preview image from the brand
// tokens (BRAND.md): the ISEXY flame mark (public/favicon.svg) on the
// electric-blue gradient, and a navy 1200x630 link preview. Local only: the
// page is built from strings and local font files, nothing is fetched.
//   node scripts/design/render-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const root = new URL("../../", import.meta.url);
const font = (pkg, file) => readFileSync(new URL(`node_modules/@fontsource/${pkg}/files/${file}`, root)).toString("base64");
const fontCss = `
@font-face { font-family: Montserrat; font-weight: 800; src: url(data:font/woff2;base64,${font("montserrat", "montserrat-latin-800-normal.woff2")}) format("woff2"); }
@font-face { font-family: Inter; font-weight: 500; src: url(data:font/woff2;base64,${font("inter", "inter-latin-500-normal.woff2")}) format("woff2"); }
@font-face { font-family: Inter; font-weight: 600; src: url(data:font/woff2;base64,${font("inter", "inter-latin-600-normal.woff2")}) format("woff2"); }`;

const FLAME = `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`;
const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1565D8"/><stop offset=".55" stop-color="#1F8BFF"/><stop offset="1" stop-color="#29C3FF"/></linearGradient>`;
// rx: rounded square (favicon) or 0 (full bleed: the OS applies its own mask). scale: flame size.
const mark = (size, { rx = 0, flame = 0.56 } = {}) => {
  const k = (64 * flame) / 24; // the flame path is drawn on a 24-unit grid
  const off = (64 - 24 * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs>${GRADIENT}<radialGradient id="r" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="64" height="64" rx="${rx}" fill="url(#g)"/><rect width="64" height="64" rx="${rx}" fill="url(#r)"/><g transform="translate(${off} ${off}) scale(${k})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${FLAME}</g></svg>`;
};

const og = `<!doctype html><html><head><style>${fontCss}
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; font-family: Inter, sans-serif; color: #F5F8FC;
  background: radial-gradient(760px 420px at 88% 18%, rgba(31,139,255,.38), transparent 62%),
              radial-gradient(520px 320px at 100% 100%, rgba(41,195,255,.22), transparent 60%),
              radial-gradient(1px 1px at 20px 20px, rgba(184,196,211,.16) 1px, transparent 1.5px) 0 0 / 28px 28px,
              #060D1F; }
.wrap { position: absolute; inset: 0; padding: 84px 96px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 22px; }
.brand svg { border-radius: 22px; box-shadow: 0 18px 50px -14px rgba(31,139,255,.8); }
.word { font-family: Montserrat; font-weight: 800; font-size: 56px; letter-spacing: .04em; }
.eyebrow { margin-top: 64px; font: 600 18px Inter; letter-spacing: .28em; text-transform: uppercase; color: #29C3FF; }
h1 { margin-top: 18px; font-family: Montserrat; font-weight: 800; font-size: 72px; line-height: 1.04; letter-spacing: -.01em; max-width: 900px; }
h1 span { background: linear-gradient(120deg, #1F8BFF, #29C3FF); -webkit-background-clip: text; color: transparent; }
p { margin-top: 26px; font: 500 26px Inter; color: #B8C4D3; }
.foot { position: absolute; left: 96px; bottom: 56px; font: 600 15px Inter; letter-spacing: .26em; text-transform: uppercase; color: #B8C4D3; }
.foot b { color: #F5F8FC; font-weight: 600; }
.badge { position: absolute; right: 96px; bottom: 50px; padding: 10px 18px; border-radius: 999px; border: 1px solid rgba(245,248,252,.16); background: rgba(11,27,61,.7); font: 600 18px Inter; color: #F5F8FC; }
</style></head><body><div class="wrap">
<div class="brand">${mark(96, { rx: 18 })}<div class="word">ISEXY</div></div>
<div class="eyebrow">Social network · 18+ · Canada</div>
<h1>Meet new people &amp; <span>make friends</span></h1>
<p>Verified profiles · Live translation EN/FR · Chat, phone and video calls</p>
</div><div class="foot">A <b>GROUPE TAKATAK</b> product</div><div class="badge">English · Français</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
async function png(html, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ type: "png", omitBackground: false, clip: { x: 0, y: 0, width: w, height: h } });
}
const square = (size, opts) => `<!doctype html><html><body style="margin:0;background:#060D1F">${mark(size, opts)}</body></html>`;

writeFileSync(new URL("public/icons/icon-192.png", root), await png(square(192), 192, 192));
writeFileSync(new URL("public/icons/icon-512.png", root), await png(square(512), 512, 512));
// Maskable: the flame stays inside the 80% safe zone.
writeFileSync(new URL("public/icons/maskable-512.png", root), await png(square(512, { flame: 0.46 }), 512, 512));
writeFileSync(new URL("public/apple-touch-icon.png", root), await png(square(180), 180, 180));
writeFileSync(new URL("public/og-image.png", root), await png(og, 1200, 630));

// favicon.ico: one 256x256 PNG entry in an ICO container.
const icoPng = await png(square(256), 256, 256);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(0, 6); header.writeUInt8(0, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(icoPng.length, 14); header.writeUInt32LE(22, 18);
writeFileSync(new URL("public/favicon.ico", root), Buffer.concat([header, icoPng]));

await browser.close();
console.log("icons, apple-touch-icon, favicon.ico and og-image.png rendered");
