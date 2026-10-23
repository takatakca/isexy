import { supabase } from "@/integrations/supabase/client";

/**
 * Contact-details guard for chat messages.
 *
 * The browser only detects (so the message is never sent); the server records
 * the strike and decides the restriction (`record_contact_sharing`), reads it
 * back (`get_my_moderation_status`) and refuses messages from a restricted
 * member (messages trigger). Patterns use word boundaries: ordinary words such
 * as "want", "tonight", "next" or two numbers ("2024 2025") are not contact
 * details.
 */

export type ViolationType = "phone_number" | "email" | "address" | "social_media" | "payment_info" | "other";

export interface ModerationResult {
  isClean: boolean;
  violations: { type: ViolationType; content: string }[];
  sanitizedContent: string;
}

export interface ModerationStatus {
  isBanned: boolean;
  banUntil?: Date;
  isPermanent?: boolean;
  /** The server could not be asked (old database, offline): nothing is known. */
  unknown?: boolean;
}

/** Runs of digits with the usual separators; a phone number has 10+ digits (or 8+ after a "+"). */
const PHONE_CANDIDATE = /\+?\(?\d[\d\s().-]{6,}\d/g;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PLATFORMS = "instagram|insta|ig|facebook|fb|messenger|whatsapp|telegram|snapchat|snap|twitter|tiktok|kik|wechat|signal|onlyfans|discord";
const SOCIAL_PATTERNS = [
  // "ig: ana.b", "snap @ana", "whatsapp - ana_b"
  new RegExp(`\\b(?:${PLATFORMS})\\b\\s*[:@=\\-]\\s*@?[a-z0-9._]{2,}`, "gi"),
  // "add me on insta", "my snap is", "follow me on tiktok", "text me on whatsapp"
  new RegExp(`\\b(?:add|follow|find|dm|message|text|write|contact|reach)\\s+me\\s+(?:on|at|via)\\s+(?:${PLATFORMS})\\b`, "gi"),
  new RegExp(`\\bmy\\s+(?:${PLATFORMS})\\b(?:\\s+(?:is|=|:))?`, "gi"),
  // a bare @handle (not inside an email address)
  /(?:^|\s)@[a-z0-9._]{3,}/gi,
];
const ADDRESS_PATTERNS = [
  // "1234 Main Street", "55 Sherbrooke St" (the name is capitalised: "10 km on the road" is not an address)
  /\b\d{1,5}\s+(?:[A-Z][A-Za-z.'-]*\s+){1,3}(?:[Ss]treet|St|[Aa]venue|Ave|[Rr]oad|Rd|[Bb]oulevard|Blvd|[Dd]rive|Dr|[Ll]ane|Ln|[Cc]ourt|Ct|[Cc]rescent|Cres)\b/g,
  /\b\d{1,5},?\s+(?:rue|avenue|av|boulevard|boul|chemin|ch|rang|montée|place)\s+[a-zà-ÿ'-]+/gi,
  /\bcalle\s+[a-z0-9\s]+(?:,|\s+)?\s*(?:no\.?|#|numero)?\s*\d+/gi,
];

function digitsIn(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

export function checkContent(content: string): ModerationResult {
  const violations: ModerationResult["violations"] = [];
  let sanitizedContent = content;
  const hide = (match: string, type: ViolationType) => {
    violations.push({ type, content: match.trim() });
    sanitizedContent = sanitizedContent.replace(match, "[HIDDEN]");
  };

  // Emails first, so their "@domain" is not also read as a handle.
  for (const m of content.match(EMAIL_PATTERN) ?? []) hide(m, "email");
  const withoutEmails = content.replace(EMAIL_PATTERN, " ");

  for (const m of withoutEmails.match(PHONE_CANDIDATE) ?? []) {
    const n = digitsIn(m);
    if (n >= 10 || (m.trim().startsWith("+") && n >= 8)) hide(m, "phone_number");
  }
  for (const re of SOCIAL_PATTERNS) for (const m of withoutEmails.match(re) ?? []) hide(m, "social_media");
  for (const re of ADDRESS_PATTERNS) for (const m of withoutEmails.match(re) ?? []) hide(m, "address");

  return { isClean: violations.length === 0, violations, sanitizedContent };
}

function toStatus(r: { restricted?: boolean; permanent?: boolean; until?: string | null } | null): ModerationStatus {
  if (!r?.restricted) return { isBanned: false };
  return {
    isBanned: true,
    isPermanent: !!r.permanent,
    banUntil: r.until ? new Date(r.until) : undefined,
  };
}

/**
 * Records the refused message on the server (the caller only) and returns the
 * resulting restriction. `null` when the server could not record it.
 */
export async function reportViolation(
  violations: ModerationResult["violations"],
  matchId?: string | null,
): Promise<(ModerationStatus & { newStrike: boolean }) | null> {
  const types = [...new Set(violations.map((v) => v.type))];
  const excerpt = violations.map((v) => v.content).join(" | ").slice(0, 200);
  const { data, error } = await supabase.rpc("record_contact_sharing", {
    p_types: types,
    p_excerpt: excerpt,
    p_match_id: matchId ?? null,
  });
  if (error || !data) {
    console.error("record_contact_sharing failed:", error);
    return null;
  }
  const r = data as { restricted?: boolean; permanent?: boolean; until?: string | null; new_strike?: boolean };
  return { ...toStatus(r), newStrike: !!r.new_strike };
}

/** The signed-in member's own messaging restriction. */
export async function checkUserBanStatus(): Promise<ModerationStatus> {
  const { data, error } = await supabase.rpc("get_my_moderation_status");
  if (error) return { isBanned: false, unknown: true };
  return toStatus(data as { restricted?: boolean; permanent?: boolean; until?: string | null });
}

export function useContentModeration() {
  return { checkContent, reportViolation, checkUserBanStatus };
}
