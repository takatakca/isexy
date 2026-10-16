/**
 * When a member's ISEXY profile counts as "complete" (ProtectedRoute lets them
 * into the app, signup flows send them on to Discover), plus the "Show me"
 * values shared by the signup flows and Settings.
 */

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
