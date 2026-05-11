// Twilio IVR menu router for the ISEXY phone line.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const SIG_BYPASS = Deno.env.get("TWILIO_SIGNATURE_BYPASS") === "true";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });

function verifyTwilioSignature(url: string, params: Record<string, string>, sig: string): boolean {
  if (SIG_BYPASS) return true;
  if (!TWILIO_AUTH_TOKEN || !sig) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];
  const expected = createHmac("sha1", TWILIO_AUTH_TOKEN).update(data).digest("base64");
  return expected === sig;
}

function normalizeE164(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (/^\+\d{7,16}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 16) return "+" + digits;
  return null;
}

const SELF = (req: Request) => new URL(req.url).origin + "/functions/v1/twilio-phone-line-menu";

function mainMenu(actionUrl: string) {
  return xml(`<Response>
<Gather numDigits="1" action="${actionUrl}" method="POST" timeout="6">
<Say voice="Polly.Joanna">ISEXY phone line. Press 1 for your voice profile status. Press 2 to browse voice profiles. Press 3 to listen to voice replies. Press 4 to check phone minutes. Press 5 for safety tips. Press 9 to repeat.</Say>
</Gather>
<Redirect method="POST">${actionUrl}?repeat=1</Redirect>
</Response>`);
}

function safetyTwiml(actionUrl: string) {
  return xml(`<Response>
<Say voice="Polly.Joanna">ISEXY safety tips. ISEXY is eighteen plus only. Your phone number stays private. Do not share personal details too quickly. You can block or report users in the ISEXY app. If you choose to meet someone offline, pick a public place.</Say>
<Redirect method="POST">${actionUrl}</Redirect>
</Response>`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = req.url;
  const sig = req.headers.get("x-twilio-signature") ?? "";
  const formText = await req.text();
  const form = new URLSearchParams(formText);
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = v));

  if (!verifyTwilioSignature(url, params, sig)) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const menuUrl = SELF(req);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const fromE164 = normalizeE164(params["From"] ?? "");
  const digits = (params["Digits"] ?? "").trim();
  const queryAction = new URL(req.url).searchParams.get("action");

  // Identify caller profile
  let profileId: string | null = null;
  let firstName: string | undefined;
  if (fromE164) {
    const { data: pln } = await supabase
      .from("phone_line_numbers")
      .select("profile_id")
      .eq("phone_number_e164", fromE164)
      .eq("phone_verified", true)
      .maybeSingle();
    if (pln?.profile_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, first_name, age, status")
        .eq("id", pln.profile_id)
        .maybeSingle();
      if (prof && (prof.age ?? 0) >= 18 && (prof.status ?? "active") !== "banned") {
        profileId = prof.id;
        firstName = prof.first_name ?? undefined;
      }
    }
  }

  if (!profileId) {
    return xml(`<Response><Say voice="Polly.Joanna">Your phone number is not verified with ISEXY. Please verify it in the ISEXY app. Goodbye.</Say><Hangup/></Response>`);
  }

  // Sub-actions
  if (queryAction === "browse_next") {
    return await browseNext(supabase, profileId, menuUrl, req);
  }

  switch (digits) {
    case "1": {
      const { data: pl } = await supabase
        .from("phone_line_profiles")
        .select("status, is_public")
        .eq("profile_id", profileId)
        .maybeSingle();
      const statusText = pl
        ? `Your voice profile is ${pl.status}, and ${pl.is_public ? "publicly browsable" : "private"}.`
        : `You do not have a voice profile yet. Set it up in the ISEXY app.`;
      return xml(`<Response><Say voice="Polly.Joanna">${statusText}</Say><Redirect method="POST">${menuUrl}</Redirect></Response>`);
    }
    case "2":
      return await browseNext(supabase, profileId, menuUrl, req);
    case "3": {
      const { count } = await supabase
        .from("phone_line_voice_replies")
        .select("id", { count: "exact", head: true })
        .eq("to_profile_id", profileId)
        .eq("is_read", false);
      const n = count ?? 0;
      return xml(`<Response><Say voice="Polly.Joanna">You have ${n} unread voice ${n === 1 ? "reply" : "replies"}. Listening to replies by phone is coming soon. Open the ISEXY app to listen.</Say><Redirect method="POST">${menuUrl}</Redirect></Response>`);
    }
    case "4": {
      const { data: c } = await supabase
        .from("user_credits")
        .select("phone_minutes")
        .eq("profile_id", profileId)
        .maybeSingle();
      const m = c?.phone_minutes ?? 0;
      const msg = m > 0
        ? `You have ${m} phone ${m === 1 ? "minute" : "minutes"} remaining.`
        : `You have no phone minutes left. Buy more in the ISEXY app.`;
      return xml(`<Response><Say voice="Polly.Joanna">${msg}</Say><Redirect method="POST">${menuUrl}</Redirect></Response>`);
    }
    case "5":
      return safetyTwiml(menuUrl);
    case "9":
    case "":
    default:
      return mainMenu(menuUrl);
  }
});

async function browseNext(
  supabase: ReturnType<typeof createClient>,
  callerProfileId: string,
  menuUrl: string,
  req: Request,
) {
  const seenParam = new URL(req.url).searchParams.get("seen") ?? "";
  const seen = new Set(seenParam.split(",").filter(Boolean));

  // Active public phone-line profiles, exclude self
  const { data: lines } = await supabase
    .from("phone_line_profiles")
    .select("id, profile_id")
    .eq("status", "active")
    .eq("is_public", true)
    .neq("profile_id", callerProfileId)
    .limit(50);

  if (!lines?.length) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">No voice profiles available right now. Try again later.</Say><Redirect method="POST">${menuUrl}</Redirect></Response>`,
      { headers: { "Content-Type": "text/xml; charset=utf-8" } },
    );
  }

  // Block list (either direction)
  const { data: blocks } = await supabase
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${callerProfileId},blocked_id.eq.${callerProfileId}`);
  const blocked = new Set<string>();
  for (const b of blocks ?? []) {
    blocked.add(b.blocker_id === callerProfileId ? b.blocked_id : b.blocker_id);
  }

  for (const line of lines) {
    if (seen.has(line.profile_id)) continue;
    if (blocked.has(line.profile_id)) continue;

    const { data: g } = await supabase
      .from("voice_greetings")
      .select("audio_path")
      .eq("phone_line_profile_id", line.id)
      .eq("moderation_status", "approved")
      .eq("is_active", true)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!g?.audio_path) continue;

    const { data: signed } = await supabase.storage
      .from("voice-greetings")
      .createSignedUrl(g.audio_path, 600);
    if (!signed?.signedUrl) continue;

    const newSeen = encodeURIComponent([...seen, line.profile_id].join(","));
    const nextUrl = `${menuUrl}?action=browse_next&seen=${newSeen}`;
    const repeatUrl = `${menuUrl}?action=browse_next&seen=${encodeURIComponent([...seen].join(","))}`;

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response>
<Play>${signed.signedUrl}</Play>
<Gather numDigits="1" action="${nextUrl}" method="POST" timeout="5">
<Say voice="Polly.Joanna">Press 1 for the next profile. Press 2 to repeat. Press 3 to leave a voice reply, coming soon. Press 9 for the main menu.</Say>
</Gather>
<Redirect method="POST">${menuUrl}</Redirect>
</Response>`,
      { headers: { "Content-Type": "text/xml; charset=utf-8" } },
    );
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">No more voice profiles to browse right now.</Say><Redirect method="POST">${menuUrl}</Redirect></Response>`,
    { headers: { "Content-Type": "text/xml; charset=utf-8" } },
  );
}
