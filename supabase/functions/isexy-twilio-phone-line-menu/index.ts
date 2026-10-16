// Twilio IVR menu router for the ISEXY phone line (Gather/Redirect target).
// Every URL in the TwiML is absolute, XML-escaped and points at the public
// function URL, so Twilio's signature on the next request matches.
import { createClient } from "../_shared/supabase.ts";
import { functionsBase, identifyCaller, mainMenu, normalizeE164, readTwilioRequest, say, twiml, xmlEscape } from "../_shared/twilio.ts";

const FN = "isexy-twilio-phone-line-menu";
const MAX_IDLE_ROUNDS = 3;
/** Twilio <Play> plays MP3 and WAV (not WebM/Opus or MP4/AAC from browsers). */
const PLAYABLE = /\.(wav|mp3)$/i;

// deno-lint-ignore no-explicit-any
type Admin = any;

const menuBase = () => `${functionsBase()}/${FN}`;
const url = (params: Record<string, string>) => `${menuBase()}?${new URLSearchParams(params).toString()}`;
const back = (text: string) => twiml(`${say(text)}<Redirect method="POST">${xmlEscape(menuBase())}</Redirect>`);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const read = await readTwilioRequest(FN, req);
  if ("error" in read) return read.error;
  const params = read.params;
  const query = new URL(req.url).searchParams;

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });
  const caller = await identifyCaller(admin, normalizeE164(params["From"]));
  if ("reason" in caller) {
    return twiml(`${say("Your phone number is not linked to ISEXY. Link it in the app under Phone Line. Goodbye.")}<Hangup/>`);
  }

  const digits = (params["Digits"] ?? "").trim();
  const action = query.get("action");
  const seen = (query.get("seen") ?? "").split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(-30);

  if (action === "browse") {
    const current = query.get("current") ?? "";
    switch (digits) {
      case "1":
        return browseNext(admin, caller.profileId, seen);
      case "2":
        return browseNext(admin, caller.profileId, seen.filter((id) => id !== current), current);
      case "3":
        return twiml(`${say("Voice replies are sent from the ISEXY app for now. Open Phone Line, Browse voices, then Voice reply.")}<Redirect method="POST">${xmlEscape(url({ action: "browse_next", seen: seen.join(",") }))}</Redirect>`);
      case "9":
        return mainMenu(menuBase());
      default:
        return mainMenu(menuBase(), "Back to the main menu.");
    }
  }
  if (action === "browse_next") return browseNext(admin, caller.profileId, seen);

  switch (digits) {
    case "1": {
      const { data: pl } = await admin
        .from("phone_line_profiles")
        .select("id, status, is_public")
        .eq("profile_id", caller.profileId)
        .maybeSingle();
      if (!pl) return back("You do not have a voice profile yet. Record your greeting in the ISEXY app under Phone Line.");
      const { data: g } = await admin
        .from("voice_greetings")
        .select("moderation_status")
        .eq("phone_line_profile_id", pl.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);
      const review = g?.[0]?.moderation_status;
      const text = pl.status === "banned"
        ? "Your voice profile was removed by moderation."
        : pl.status === "active" && pl.is_public
          ? review === "approved"
            ? "Your voice profile is live. Members can hear your greeting and call you."
            : review === "rejected"
              ? "Your greeting was not approved. Record a new one in the app."
              : "Your voice profile is live, and your greeting is waiting for review."
          : pl.status === "paused"
            ? "Your voice profile is paused. Members cannot hear it until you go live again in the app."
            : "Your voice profile is a draft. Go live in the app when you are ready.";
      return back(text);
    }
    case "2":
      return browseNext(admin, caller.profileId, []);
    case "3": {
      const { count } = await admin
        .from("phone_line_voice_replies")
        .select("id", { count: "exact", head: true })
        .eq("to_profile_id", caller.profileId)
        .eq("is_read", false)
        .eq("is_hidden", false)
        .neq("moderation_status", "rejected");
      const n = count ?? 0;
      return back(`You have ${n === 0 ? "no" : n} new voice ${n === 1 ? "reply" : "replies"}. Open Phone Line in the ISEXY app to listen.`);
    }
    case "4": {
      const { data: c } = await admin.from("user_credits").select("phone_minutes").eq("profile_id", caller.profileId).maybeSingle();
      const m = c?.phone_minutes ?? 0;
      return back(m > 0 ? `You have ${m} phone ${m === 1 ? "minute" : "minutes"} left.` : "You have no phone minutes left. You can buy more in the ISEXY app.");
    }
    case "5":
      return back("Safety tips. ISEXY is for adults eighteen and over. Your phone number stays private. Take your time before sharing personal details. You can block or report anyone in the app. If you meet someone in person, choose a public place and tell a friend.");
    case "9":
      return mainMenu(menuBase());
    case "": {
      const idle = Number(query.get("idle") ?? "0") || 0;
      if (idle >= MAX_IDLE_ROUNDS) return twiml(`${say("Goodbye.")}<Hangup/>`);
      return mainMenu(menuBase(), idle ? "Are you still there?" : "ISEXY phone line.", idle);
    }
    default:
      return mainMenu(menuBase(), "Sorry, that is not an option.");
  }
});

/**
 * Next live voice (or `replay` again): active + public voice profile with an
 * approved greeting, not me, no block either way, owner active and not
 * shadow-banned. Greetings Twilio can play are played; others are introduced
 * by name and headline.
 */
async function browseNext(admin: Admin, me: string, seen: string[], replay?: string): Promise<Response> {
  const { data: lines } = await admin
    .from("phone_line_profiles")
    .select("id, profile_id, display_name, age, city, headline")
    .eq("status", "active")
    .eq("is_public", true)
    .neq("profile_id", me)
    .order("last_active_at", { ascending: false, nullsFirst: false })
    .limit(60);
  const candidates = (lines ?? []).filter((l: { profile_id: string }) =>
    replay ? l.profile_id === replay : !seen.includes(l.profile_id));
  if (!candidates.length) {
    return back(seen.length ? "That's everyone for now. Try again later." : "No voice profiles are available right now. Try again later.");
  }

  const ids = candidates.map((l: { profile_id: string }) => l.profile_id);
  const [{ data: blocks }, { data: owners }] = await Promise.all([
    admin.from("blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${me},blocked_id.eq.${me}`),
    admin.from("profiles").select("id, is_active, shadow_banned").in("id", ids),
  ]);
  const blocked = new Set<string>();
  for (const b of blocks ?? []) blocked.add(b.blocker_id === me ? b.blocked_id : b.blocker_id);
  const ok = new Set((owners ?? []).filter((o: { is_active: boolean | null; shadow_banned: boolean | null }) =>
    o.is_active !== false && o.shadow_banned !== true).map((o: { id: string }) => o.id));

  for (const line of candidates) {
    if (blocked.has(line.profile_id) || !ok.has(line.profile_id)) continue;
    const { data: g } = await admin
      .from("voice_greetings")
      .select("audio_url")
      .eq("phone_line_profile_id", line.id)
      .eq("moderation_status", "approved")
      .eq("is_active", true)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(1);
    const audio = g?.[0]?.audio_url as string | undefined;
    if (!audio) continue;

    const intro = `${line.display_name}, ${line.age}${line.city ? `, from ${line.city}` : ""}.`;
    let body = say(intro);
    if (PLAYABLE.test(audio)) {
      const { data: signed } = await admin.storage.from("isexy-voice-greetings").createSignedUrl(audio, 600);
      if (signed?.signedUrl) body += `<Play>${xmlEscape(signed.signedUrl)}</Play>`;
      else if (line.headline) body += say(line.headline);
    } else if (line.headline) {
      body += say(line.headline);
    }
    const nextSeen = [...seen.filter((id) => id !== line.profile_id), line.profile_id].join(",");
    const keys = url({ action: "browse", seen: nextSeen, current: line.profile_id });
    body += `<Gather numDigits="1" action="${xmlEscape(keys)}" method="POST" timeout="6">${say("Press 1 for the next voice. Press 2 to hear this one again. Press 3 to leave a voice reply. Press 9 for the main menu.")}</Gather>`;
    body += `<Redirect method="POST">${xmlEscape(menuBase())}</Redirect>`;
    return twiml(body);
  }
  return back(seen.length ? "That's everyone for now. Try again later." : "No voice profiles are available right now. Try again later.");
}
