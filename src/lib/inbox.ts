import { supabase } from "@/integrations/supabase/client";

export interface Conversation {
  match_id: string;
  matched_at: string;
  other_id: string;
  first_name: string;
  photo_url: string | null;
  is_verified: boolean;
  last_active_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_mine: boolean | null;
  unread_count: number;
  is_unlocked: boolean;
}

/**
 * The signed-in member's inbox. One RPC call (get_my_conversations); while
 * that migration is not deployed, a batched fallback (6 queries total,
 * independent of the number of matches) is used.
 */
export async function fetchInbox(me: { id: string; is_premium?: boolean | null }): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc("get_my_conversations");
  if (!error && data) return data;
  if (error && error.code !== "PGRST202" && !/get_my_conversations/.test(error.message)) throw error;
  return legacyInbox(me);
}

async function legacyInbox(me: { id: string; is_premium?: boolean | null }): Promise<Conversation[]> {
  const [matchesRes, blocksRes] = await Promise.all([
    supabase
      .from("matches")
      .select("id, matched_at, last_message_at, profile1_id, profile2_id")
      .or(`profile1_id.eq.${me.id},profile2_id.eq.${me.id}`)
      .eq("is_active", true),
    supabase.from("blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${me.id},blocked_id.eq.${me.id}`),
  ]);
  if (matchesRes.error) throw matchesRes.error;
  const blocked = new Set((blocksRes.data ?? []).map((b) => (b.blocker_id === me.id ? b.blocked_id : b.blocker_id)));
  const matches = (matchesRes.data ?? [])
    .map((m) => ({ ...m, other: m.profile1_id === me.id ? m.profile2_id : m.profile1_id }))
    .filter((m) => !blocked.has(m.other));
  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);
  const otherIds = matches.map((m) => m.other);
  const [profiles, photos, messages, unlocks] = await Promise.all([
    supabase.from("profiles").select("id, first_name, is_verified, last_active_at").in("id", otherIds),
    supabase.from("profile_photos").select("profile_id, photo_url, position").in("profile_id", otherIds).order("position"),
    supabase.from("messages").select("match_id, sender_id, content, is_read, created_at").in("match_id", matchIds).order("created_at", { ascending: false }).limit(1000),
    supabase.from("conversation_unlocks").select("match_id").in("match_id", matchIds).eq("unlocked_by", me.id).eq("unlock_type", "chat"),
  ]);

  const profileBy = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const photoBy = new Map<string, string>();
  for (const ph of photos.data ?? []) if (!photoBy.has(ph.profile_id)) photoBy.set(ph.profile_id, ph.photo_url);
  const lastBy = new Map<string, { content: string; created_at: string; sender_id: string }>();
  const unreadBy = new Map<string, number>();
  for (const msg of messages.data ?? []) {
    if (!lastBy.has(msg.match_id)) lastBy.set(msg.match_id, msg);
    if (msg.sender_id !== me.id && msg.is_read === false) unreadBy.set(msg.match_id, (unreadBy.get(msg.match_id) ?? 0) + 1);
  }
  const unlocked = new Set((unlocks.data ?? []).map((u) => u.match_id));

  return matches
    .map((m) => {
      const p = profileBy.get(m.other);
      const last = lastBy.get(m.id);
      return {
        match_id: m.id,
        matched_at: m.matched_at,
        other_id: m.other,
        first_name: p?.first_name ?? "Member",
        photo_url: photoBy.get(m.other) ?? null,
        is_verified: !!p?.is_verified,
        last_active_at: p?.last_active_at ?? null,
        last_message_at: last?.created_at ?? m.last_message_at ?? null,
        last_message_preview: last?.content?.slice(0, 140) ?? null,
        last_message_mine: last ? last.sender_id === me.id : null,
        unread_count: unreadBy.get(m.id) ?? 0,
        is_unlocked: !!me.is_premium || unlocked.has(m.id),
      };
    })
    .sort((a, b) =>
      new Date(b.last_message_at ?? b.matched_at).getTime() - new Date(a.last_message_at ?? a.matched_at).getTime(),
    );
}

/** "now", "5m", "3h", "Yesterday", "Mon", "12 Mar" */
export function relativeTime(iso: string | null, locale = "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return locale === "fr" ? "maintenant" : locale === "es" ? "ahora" : "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return locale === "fr" ? "Hier" : locale === "es" ? "Ayer" : "Yesterday";
  if (diff < 604800) return d.toLocaleDateString(locale, { weekday: "short" });
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}
