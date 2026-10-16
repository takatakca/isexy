// Shared by the ISEXY Twilio webhooks (isexy-twilio-inbound-phone-line,
// isexy-twilio-phone-line-menu, isexy-twilio-call-status).
import { createHmac, timingSafeEqual } from "node:crypto";
import { isexyEnv } from "./env.ts";

/**
 * The URL Twilio signed: the public function URL configured in Twilio (plus
 * the query string of a Gather/Redirect URL we generated). Inside Supabase,
 * req.url is an internal URL, so the signature never matched it.
 * ISEXY_TWILIO_WEBHOOK_BASE overrides the base (e.g. a custom domain in front
 * of the functions); default `${SUPABASE_URL}/functions/v1`.
 */
export function functionsBase(): string {
  const base = isexyEnv("TWILIO_WEBHOOK_BASE") ?? `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1`;
  return base.replace(/\/+$/, "");
}

export function publicUrl(fn: string, req: Request): string {
  return `${functionsBase()}/${fn}${new URL(req.url).search}`;
}

/** Twilio request validation: HMAC-SHA1 over URL + sorted POST params, constant-time compare. */
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string, authToken: string): boolean {
  if (!authToken || !signature) return false;
  let data = url;
  for (const key of Object.keys(params).sort()) data += key + params[key];
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Reads the form body and checks the signature. Returns the params, or a 403
 * Response. ISEXY_TWILIO_SIGNATURE_BYPASS=true skips the check (local testing
 * only; never set it on V1).
 */
export async function readTwilioRequest(fn: string, req: Request): Promise<{ params: Record<string, string> } | { error: Response }> {
  const params: Record<string, string> = {};
  new URLSearchParams(await req.text()).forEach((v, k) => (params[k] = v));
  if (isexyEnv("TWILIO_SIGNATURE_BYPASS") === "true") {
    console.warn(`[${fn}] Twilio signature check bypassed (ISEXY_TWILIO_SIGNATURE_BYPASS)`);
    return { params };
  }
  const token = isexyEnv("TWILIO_AUTH_TOKEN") ?? "";
  const sig = req.headers.get("x-twilio-signature") ?? "";
  if (!validTwilioSignature(publicUrl(fn, req), params, sig, token)) {
    return { error: new Response("Invalid Twilio signature", { status: 403 }) };
  }
  const account = isexyEnv("TWILIO_ACCOUNT_SID");
  if (account && params["AccountSid"] && params["AccountSid"] !== account) {
    return { error: new Response("Wrong Twilio account", { status: 403 }) };
  }
  return { params };
}

export function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export const say = (text: string) => `<Say voice="Polly.Joanna" language="en-US">${xmlEscape(text)}</Say>`;

export function normalizeE164(raw: string | undefined | null): string | null {
  const trimmed = (raw ?? "").trim();
  if (/^\+\d{7,16}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 16 ? `+${digits}` : null;
}

export function isAdult(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  const d = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const eighteen = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return d.getTime() <= eighteen.getTime();
}

/**
 * The member calling from `from`: a verified phone_line_numbers row (linked in
 * the app with the SMS-confirmed sign-in number) and an active 18+ profile.
 * profiles has no age/status columns: birth_date and is_active are the real
 * ones. (A shadow ban is not revealed here; banned voices are left out of
 * browsing instead.)
 */
// deno-lint-ignore no-explicit-any
export async function identifyCaller(admin: any, from: string | null): Promise<{ profileId: string; firstName: string } | { reason: string }> {
  if (!from) return { reason: "no_caller_id" };
  const { data: numbers } = await admin
    .from("phone_line_numbers")
    .select("profile_id")
    .eq("phone_number_e164", from)
    .eq("phone_verified", true)
    .order("updated_at", { ascending: false })
    .limit(1);
  const profileId = numbers?.[0]?.profile_id as string | undefined;
  if (!profileId) return { reason: "unverified_caller" };
  const { data: prof } = await admin
    .from("profiles")
    .select("id, first_name, birth_date, is_active")
    .eq("id", profileId)
    .maybeSingle();
  if (!prof || prof.is_active === false || !isAdult(prof.birth_date)) {
    return { reason: "profile_inactive_or_underage" };
  }
  return { profileId: prof.id, firstName: String(prof.first_name ?? "").slice(0, 40) };
}

/**
 * The IVR main menu. `greeting` comes first (e.g. "Welcome back, Bea.").
 * No key pressed: the menu repeats with ?idle=n and the menu function hangs
 * up after a few silent rounds (no endless loop on a forgotten call).
 */
export function mainMenu(menuUrl: string, greeting = "ISEXY phone line.", idle = 0) {
  const action = xmlEscape(menuUrl);
  const again = xmlEscape(`${menuUrl}?idle=${idle + 1}`);
  return twiml(`<Gather numDigits="1" action="${action}" method="POST" timeout="6">${say(`${greeting} This line is for adults eighteen and over. Your phone number stays private. Press 1 for your voice profile status. Press 2 to browse voice profiles. Press 3 for your voice replies. Press 4 to check your phone minutes. Press 5 for safety tips. Press 9 to hear this menu again.`)}</Gather><Redirect method="POST">${again}</Redirect>`);
}
