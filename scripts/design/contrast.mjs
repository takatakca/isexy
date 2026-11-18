#!/usr/bin/env node
// WCAG AA contrast check for the ISEXY design tokens (src/index.css).
// Reads the HSL custom properties of the dark-first :root block, checks that
// .dark mirrors it, then checks every foreground/background pair the app uses:
//   text  4.5:1 (body text)    large 3:1 (18.66px bold / 24px+)    ui 3:1 (focus rings, field borders, controls)
// Exits 1 on any failure. Usage: node scripts/design/contrast.mjs [--markdown]
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../src/index.css", import.meta.url), "utf8");

function block(selector) {
  const start = css.search(new RegExp(`^\\s*${selector.replace(".", "\\.")}\\s*\\{`, "m"));
  if (start < 0) throw new Error(`no ${selector} block in src/index.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const vars = {};
  for (const m of css.slice(open + 1, close).matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const root = block(":root");
const dark = block(".dark");

function hslToRgb(value, name) {
  const m = value.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) throw new Error(`--${name} is not "H S% L%": ${value}`);
  const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const color = (name) => {
  if (!(name in root)) throw new Error(`--${name} missing from :root`);
  return hslToRgb(root[name], name);
};

const MIN = { text: 4.5, large: 3, ui: 3 };
// [foreground, background, kind, where it is used]
const PAIRS = [
  ["foreground", "background", "text", "body text on navy"],
  ["foreground", "card", "text", "text on midnight cards"],
  ["card-foreground", "card", "text", "card text"],
  ["popover-foreground", "popover", "text", "menus, dialogs, sheets"],
  ["foreground", "secondary", "text", "text on raised surfaces"],
  ["foreground", "muted", "text", "text on muted surfaces"],
  ["muted-foreground", "background", "text", "secondary text on navy"],
  ["muted-foreground", "card", "text", "secondary text on cards"],
  ["muted-foreground", "muted", "text", "secondary text on muted"],
  ["muted-foreground", "secondary", "text", "secondary text on raised surfaces"],
  ["muted-foreground", "popover", "text", "secondary text in menus"],
  ["primary-foreground", "primary-solid", "text", "filled buttons (bg-primary)"],
  ["primary-foreground", "gradient-start", "text", "gradient buttons, start"],
  ["primary-foreground", "gradient-end", "text", "gradient buttons, end"],
  ["primary", "background", "text", "text-primary on navy"],
  ["primary", "card", "text", "text-primary on cards"],
  ["primary", "muted", "text", "text-primary on muted"],
  ["primary", "secondary", "text", "text-primary on raised surfaces"],
  ["secondary-foreground", "secondary", "text", "secondary buttons"],
  ["accent-foreground", "accent", "text", "cyan highlight chips"],
  ["accent", "background", "text", "cyan labels on navy"],
  ["accent", "card", "text", "cyan labels on cards"],
  ["glow-start", "background", "large", "gradient headline, start"],
  ["glow-end", "background", "large", "gradient headline, end"],
  ["link", "background", "text", "links on navy"],
  ["link", "card", "text", "links on cards"],
  ["destructive-foreground", "destructive-solid", "text", "destructive buttons (bg-destructive)"],
  ["destructive", "background", "text", "error text on navy"],
  ["destructive", "card", "text", "error text on cards"],
  ["success", "background", "text", "success text on navy"],
  ["success", "card", "text", "success text on cards"],
  ["success-foreground", "success", "text", "success badges"],
  ["warning", "background", "text", "warning text on navy"],
  ["warning", "card", "text", "warning text on cards"],
  ["warning-foreground", "warning", "text", "warning badges"],
  ["ring", "background", "ui", "focus ring on navy"],
  ["ring", "card", "ui", "focus ring on cards"],
  ["input", "background", "ui", "form field border on navy"],
  ["input", "card", "ui", "form field border on cards"],
  ["primary-solid", "background", "ui", "filled button edge on navy"],
  ["primary", "card", "ui", "selected state / active tab on cards"],
  ["sidebar-foreground", "sidebar-background", "text", "sidebar text"],
  ["sidebar-primary-foreground", "sidebar-primary", "text", "sidebar active item"],
  ["sidebar-accent-foreground", "sidebar-accent", "text", "sidebar hover item"],
  ["sidebar-ring", "sidebar-background", "ui", "sidebar focus ring"],
];
// Decorative only (no contrast requirement): border, sidebar-border, primary-light, primary-dark.

const failures = [];
const rows = PAIRS.map(([fg, bg, kind, use]) => {
  const r = ratio(color(fg), color(bg));
  const ok = r >= MIN[kind];
  if (!ok) failures.push(`${fg} on ${bg}: ${r.toFixed(2)}:1 < ${MIN[kind]}:1 (${use})`);
  return { fg, bg, kind, use, r, ok, fgHex: hex(color(fg)), bgHex: hex(color(bg)) };
});

const mirror = Object.keys(dark).filter((k) => dark[k] !== root[k]);
const missingInDark = Object.keys(root).filter((k) => k.match(/^(background|foreground|card|popover|primary|secondary|muted|accent|destructive|success|warning|border|input|ring|gradient|glow|link|sidebar)/) && !(k in dark));
if (mirror.length) failures.push(`.dark differs from :root for ${mirror.map((k) => "--" + k).join(", ")}`);
if (missingInDark.length) failures.push(`.dark is missing ${missingInDark.map((k) => "--" + k).join(", ")}`);

if (process.argv.includes("--markdown")) {
  console.log("| Foreground | Background | Use | Ratio | Needs | Result |\n|---|---|---|---|---|---|");
  for (const x of rows) console.log(`| \`--${x.fg}\` ${x.fgHex} | \`--${x.bg}\` ${x.bgHex} | ${x.use} | ${x.r.toFixed(2)}:1 | ${MIN[x.kind]}:1 (${x.kind}) | ${x.ok ? "pass" : "FAIL"} |`);
} else {
  for (const x of rows) console.log(`${x.ok ? "PASS" : "FAIL"} ${x.r.toFixed(2).padStart(5)}:1 >= ${MIN[x.kind]} ${x.kind.padEnd(5)} --${x.fg} ${x.fgHex} on --${x.bg} ${x.bgHex}  (${x.use})`);
  console.log(`${mirror.length || missingInDark.length ? "FAIL" : "PASS"} .dark mirrors :root (${Object.keys(dark).length} tokens)`);
}
if (failures.length) {
  console.error(`\n${failures.length} contrast failure(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.error(`\nAll ${rows.length} pairs pass WCAG AA.`);
