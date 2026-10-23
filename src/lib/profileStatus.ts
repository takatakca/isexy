/**
 * When a member's ISEXY profile counts as "complete" (ProtectedRoute lets them
 * into the app, signup flows send them on to Discover), plus the "Show me"
 * values shared by the signup flows and Settings.
 */

/**
 * Columns of isexy.profiles a member may read: every column but the staff-only
 * shadow_banned, shadow_banned_at, shadow_banned_reason (0015 K3, column
 * privileges). Since K3 the database refuses select("*") on profiles for
 * members, so reads name their columns. A column added to profiles later is
 * readable only after its own GRANT (see 0015 K).
 */
// One string literal (not concatenated) so the typed client can parse the column list.
export const MEMBER_PROFILE_COLUMNS = "id, user_id, first_name, birth_date, gender, sexual_orientation, interested_in, looking_for, bio, school, job_title, company, city, country, distance_preference, age_min, age_max, show_gender, show_orientation, is_premium, subscription_tier, subscription_expires_at, likes_remaining, super_likes_remaining, boosts_remaining, last_boost_at, is_verified, is_active, created_at, updated_at, drinking, smoking, workout, pets, communication_style, love_language, education, interests, prompts, latitude, longitude, location_enabled, privacy_accepted, blocked_contacts, is_cuban, last_active_at, referral_code, first_purchase_promo_used, promo_expires_at, super_boost_until, swipe_cooldown_until, daily_swipe_count, last_swipe_reset_at, relationship_type, languages, zodiac, family_plans, social_media" as const;

/** Birth date CubanSignup writes before the member reaches /profile-setup. */
export const PLACEHOLDER_BIRTH_DATE = "2000-01-01";

/** Minimum "About me" length; isexy.get_discover_feed ranks bios from 10 characters. */
export const MIN_BIO_LENGTH = 10;

export function isAdult(birthDate?: string | null): boolean {
  if (!birthDate) return false;
  const ageMs = Date.now() - new Date(birthDate).getTime();
  return ageMs / (365.25 * 24 * 60 * 60 * 1000) >= 18;
}

interface ProfileLike {
  first_name?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  interested_in?: string[] | null;
  bio?: string | null;
}

/** Required fields + 18+ + a bio + at least one photo. */
export function isProfileComplete(profile: ProfileLike | null | undefined, photoCount: number): boolean {
  return (
    !!profile &&
    !!profile.first_name &&
    isAdult(profile.birth_date) &&
    !!profile.gender &&
    Array.isArray(profile.interested_in) &&
    profile.interested_in.length > 0 &&
    !!profile.bio &&
    photoCount >= 1
  );
}

export type ShowMe = "women" | "men" | "everyone";

/**
 * Read interested_in as the "Show me" choice. Older rows may hold male/female;
 * isexy.normalize_gender reads them the same way.
 */
export function showMeFrom(values?: string[] | null): ShowMe[] {
  const v = new Set((values ?? []).map((x) => x.trim().toLowerCase()));
  if (v.has("everyone") || v.has("all") || v.has("any")) return ["everyone"];
  const women = v.has("women") || v.has("woman") || v.has("female");
  const men = v.has("men") || v.has("man") || v.has("male");
  return [...(women ? ["women" as const] : []), ...(men ? ["men" as const] : [])];
}

export const SHOW_ME_LABELS: Record<ShowMe, string> = { women: "Women", men: "Men", everyone: "Everyone" };

/** Toggle one "Show me" chip: "Everyone" stands alone, so members of every gender are included. */
export function toggleShowMe(current: ShowMe[], value: ShowMe): ShowMe[] {
  if (value === "everyone") return current.includes("everyone") ? [] : ["everyone"];
  const rest = current.filter((x) => x !== "everyone" && x !== value);
  return current.includes(value) ? rest : [...rest, value];
}
