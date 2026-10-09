// Edge-function secrets are project-wide on TAKATAK V1, shared with V1's own
// functions. ISEXY reads ISEXY_<NAME> first so it never depends on, or
// overwrites, a V1 secret. Payment keys and feature flags must be set
// explicitly for ISEXY (no fallback); shared provider keys (Resend, Twilio,
// WhatsApp, VAPID) may fall back to the V1 value of the same name.
const ISEXY_ONLY = new Set([
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PAYMENTS_LIVE_ENABLED",
  "CRON_SECRET",
  "SEED_PROFILES_ENABLED",
  "TWILIO_SIGNATURE_BYPASS",
  "ANTHROPIC_API_KEY",
  "AI_CHAT_MODEL",
  "APP_URL",
]);

export function isexyEnv(name: string): string | undefined {
  const own = Deno.env.get(`ISEXY_${name}`);
  if (own !== undefined && own !== "") return own;
  return ISEXY_ONLY.has(name) ? undefined : Deno.env.get(name);
}
