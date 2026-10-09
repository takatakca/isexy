import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";

/**
 * ISEXY ⇄ TAKATAK v1 bridge (server-to-server).
 *
 * TAKATAK v1 is the shared identity authority for TAKATAK apps. Its master API
 * (/api/v1/*) is bearer-key protected and must never be called from a browser,
 * so every call goes through this function.
 *
 * Required secrets (Supabase → Edge Functions → Secrets):
 *   TAKATAK_API_URL         e.g. https://takatak.ca
 *   TAKATAK_ISEXY_API_KEY   dedicated ≥32-char key issued by TAKATAK for ISEXY
 *
 * Actions (POST JSON { action, ... }):
 *   status        → { enabled, phoneLogin }                       (public)
 *   sync          → project the signed-in member into TAKATAK     (member JWT)
 *   phone_send    { phone, intent?, fullName? } → OTP via TAKATAK (public, rate limited)
 *   phone_verify  { phone, code } → { tokenHash, email, isNewUser } (public, rate limited)
 *                 The client exchanges tokenHash with supabase.auth.verifyOtp
 *                 ({ type: "magiclink" }) to obtain a normal ISEXY session.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCE_APPLICATION = "isexy";
const SYNTHETIC_EMAIL_DOMAIN = "phone.isexy.ca";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function config() {
  const url = (isexyEnv("TAKATAK_API_URL") ?? "").trim().replace(/\/+$/, "");
  const key = (isexyEnv("TAKATAK_ISEXY_API_KEY") ?? "").trim();
  return { url, key, enabled: /^https:\/\//.test(url) && key.length >= 32 };
}

/** E.164 normalisation matching TAKATAK's normalizePhone (CA/US default). */
function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) buckets.clear();
    return false;
  }
  b.count++;
  return b.count > limit;
}

class BridgeError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

async function takatak<T>(path: string, payload: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const { url, key } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${url}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
      const message = typeof body?.error === "string" ? body.error : `TAKATAK request failed (${res.status})`;
      // 400/409 are user-facing validation problems; everything else is upstream.
      throw new BridgeError(message, res.status === 400 || res.status === 409 ? res.status : 502);
    }
    return body as T;
  } catch (e) {
    if (e instanceof BridgeError) throw e;
    throw new BridgeError("TAKATAK is unreachable right now. Please try again shortly.", 503);
  } finally {
    clearTimeout(timer);
  }
}

interface TakatakIdentity {
  id: string;
  phone: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  locale: string | null;
}

async function storeLink(admin: SupabaseClient, userId: string, masterIdentityId: string, phone: string | null) {
  const { error } = await admin
    .from("takatak_identity_links")
    .upsert(
      { user_id: userId, master_identity_id: masterIdentityId, phone, last_synced_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) console.error("takatak link store failed:", error.message);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function syncMember(admin: SupabaseClient, req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Sign in required" }, 401);

  if (rateLimited(`sync:${user.id}`, 6, 10 * 60_000)) return json({ ok: true, skipped: "rate_limited" });

  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, country, created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: existing } = await admin
    .from("takatak_identity_links")
    .select("master_identity_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const isSynthetic = user.email?.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
  const result = await takatak<{ id: string; source_profile_id: string | null }>(
    "/api/v1/identity/resolve-person",
    {
      source_application: SOURCE_APPLICATION,
      master_identity_id: existing?.master_identity_id ?? null,
      local_profile_id: user.id,
      email: isSynthetic ? null : user.email ?? null,
      phone: user.phone ? normalizePhone(`+${user.phone.replace(/^\+/, "")}`) : null,
      full_name: profile?.first_name ?? null,
      preferred_language: (user.user_metadata?.locale as string | undefined) ?? null,
      country: profile?.country ?? null,
      account_created_at: user.created_at,
    },
  );

  await storeLink(admin, user.id, result.id, user.phone ?? null);
  return json({ ok: true, masterIdentityId: result.id });
}

async function phoneSend(body: Record<string, unknown>, ip: string) {
  const phone = normalizePhone(body.phone);
  if (!phone) return json({ error: "Enter a valid phone number with country code." }, 400);
  if (rateLimited(`send:${phone}`, 3, 10 * 60_000) || rateLimited(`send-ip:${ip}`, 10, 10 * 60_000)) {
    return json({ error: "Too many codes requested. Please wait a few minutes." }, 429);
  }
  const intent = body.intent === "signup" ? "signup" : "login";
  await takatak("/api/v1/auth/otp/send", {
    phone,
    intent,
    full_name: typeof body.fullName === "string" ? body.fullName.slice(0, 200) : null,
    preferred_language: typeof body.locale === "string" ? body.locale.slice(0, 16) : null,
  });
  return json({ ok: true, phone });
}

async function phoneVerify(admin: SupabaseClient, body: Record<string, unknown>, ip: string) {
  const phone = normalizePhone(body.phone);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!phone || !/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit code." }, 400);
  if (rateLimited(`verify:${phone}`, 6, 10 * 60_000) || rateLimited(`verify-ip:${ip}`, 20, 10 * 60_000)) {
    return json({ error: "Too many attempts. Please request a new code in a few minutes." }, 429);
  }

  const verified = await takatak<{ identity: TakatakIdentity }>("/api/v1/auth/otp/verify", { phone, code });
  const identity = verified.identity;
  if (!identity?.id || normalizePhone(identity.phone) !== phone) {
    return json({ error: "Phone verification could not be confirmed." }, 400);
  }

  // 1. Already linked → sign that ISEXY account in.
  let userId: string | null = null;
  let email: string | null = null;
  let isNewUser = false;

  const { data: link } = await admin
    .from("takatak_identity_links")
    .select("user_id")
    .eq("master_identity_id", identity.id)
    .maybeSingle();

  if (link?.user_id) {
    const { data } = await admin.auth.admin.getUserById(link.user_id);
    if (data?.user) {
      userId = data.user.id;
      email = data.user.email ?? null;
    }
  }

  // 2. New to ISEXY → create the account, phone already verified by TAKATAK.
  if (!userId) {
    email = `${identity.id}@${SYNTHETIC_EMAIL_DOMAIN}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      phone: phone.replace(/^\+/, ""),
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        first_name: identity.first_name ?? undefined,
        last_name: identity.last_name ?? undefined,
        locale: identity.locale ?? undefined,
        takatak_identity_id: identity.id,
        signup_method: "takatak_phone",
      },
    });
    if (error || !data?.user) {
      const msg = error?.message?.toLowerCase() ?? "";
      if (msg.includes("phone") && (msg.includes("exists") || msg.includes("registered"))) {
        // An older ISEXY account already owns this number; never auto-merge.
        return json({
          error: "This number is already attached to an ISEXY account. Sign in with your email, then link your phone from Settings.",
        }, 409);
      }
      console.error("createUser failed:", error?.message);
      return json({ error: "We couldn't create your account. Please try again." }, 500);
    }
    userId = data.user.id;
    isNewUser = true;
  }

  await storeLink(admin, userId, identity.id, phone);

  // 3. Mint a one-time sign-in token the browser exchanges for a session.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email!,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("generateLink failed:", linkError?.message);
    return json({ error: "Verified, but we couldn't start your session. Please try again." }, 500);
  }

  return json({ ok: true, tokenHash, email, isNewUser });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const cfg = config();
  if (body.action === "status") {
    return json({ enabled: cfg.enabled, phoneLogin: cfg.enabled });
  }
  if (!cfg.enabled) {
    // Not an error for the UI: callers degrade gracefully (email login still works).
    return json({ ok: false, error: "TAKATAK integration is not configured.", disabled: true }, 503);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  try {
    switch (body.action) {
      case "sync":
        return await syncMember(admin, req);
      case "phone_send":
        return await phoneSend(body, ip);
      case "phone_verify":
        return await phoneVerify(admin, body, ip);
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    if (e instanceof BridgeError) return json({ error: e.message }, e.status);
    console.error("takatak-bridge error:", e instanceof Error ? e.message : e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
