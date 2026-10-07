import { supabase } from "@/integrations/supabase/client";
import type { SwipeCardProfile } from "@/components/SwipeCard";

export interface FeedProfile {
  id: string;
  first_name: string;
  birth_date: string;
  bio?: string | null;
  city?: string | null;
  job_title?: string | null;
  company?: string | null;
  school?: string | null;
  is_verified: boolean;
  interests?: string[] | null;
  distance_km?: number | null;
  photos: string[];
}

export interface FeedViewer {
  id: string;
  gender?: string | null;
  interested_in?: string[] | null;
  age_min?: number | null;
  age_max?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface FeedOptions {
  viewer: FeedViewer;
  limit?: number;
  exclude?: string[];
  verifiedOnly?: boolean;
  interests?: string[];
}

export function ageFrom(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function toCardProfile(p: FeedProfile, translatedBio?: string): SwipeCardProfile {
  return {
    id: p.id,
    first_name: p.first_name,
    age: ageFrom(p.birth_date),
    bio: p.bio ?? undefined,
    translatedBio,
    city: p.city ?? undefined,
    job_title: p.job_title ?? undefined,
    company: p.company ?? undefined,
    school: p.school ?? undefined,
    is_verified: p.is_verified,
    distance: p.distance_km ?? undefined,
    photos: p.photos,
  };
}

/**
 * One ranked page of the Discover deck.
 * Uses the get_discover_feed RPC (single round trip); falls back to an
 * optimized client query while the migration is not yet deployed.
 */
export async function fetchDiscoverFeed(opts: FeedOptions): Promise<FeedProfile[]> {
  const { data, error } = await supabase.rpc("get_discover_feed", {
    p_limit: opts.limit ?? 30,
    p_exclude: opts.exclude ?? [],
    p_verified_only: opts.verifiedOnly ?? false,
    p_interests: opts.interests?.length ? opts.interests : undefined,
  });
  if (!error && data) {
    return data.map((p) => ({ ...p, photos: p.photos ?? [] }));
  }
  // PGRST202 = function not found (migration pending). Anything else is a real error.
  if (error && error.code !== "PGRST202" && !/get_discover_feed/.test(error.message)) {
    throw error;
  }
  return legacyFeed(opts);
}

// ---------------------------------------------------------------------------
// Legacy path — same rules as the RPC, done client-side, but batched:
// 3 parallel exclusion queries + 1 profile query + 1 photo query.
// ---------------------------------------------------------------------------
function normalizeGender(value?: string | null): string {
  const v = (value || "").toLowerCase().trim();
  if (["man", "male", "men", "m"].includes(v)) return "men";
  if (["woman", "female", "women", "w", "f"].includes(v)) return "women";
  if (["nonbinary", "non-binary", "non binary", "nb", "enby"].includes(v)) return "nonbinary";
  if (["everyone", "all", "any"].includes(v)) return "everyone";
  return v;
}

function wants(preferences: string[] | null | undefined, gender?: string | null): boolean {
  if (!preferences?.length) return false;
  const prefs = preferences.map(normalizeGender);
  return prefs.includes("everyone") || prefs.includes(normalizeGender(gender));
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

type LegacyRow = FeedProfile & {
  gender?: string | null;
  interested_in?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  subscription_tier?: string | null;
  last_boost_at?: string | null;
  super_boost_until?: string | null;
};

async function legacyFeed({ viewer, limit = 30, exclude = [], verifiedOnly, interests }: FeedOptions): Promise<FeedProfile[]> {
  const [swiped, blockedByMe, blockedMe] = await Promise.all([
    supabase.from("swipes").select("swiped_id").eq("swiper_id", viewer.id),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", viewer.id),
    supabase.from("blocks").select("blocker_id").eq("blocked_id", viewer.id),
  ]);
  const excluded = new Set<string>([
    viewer.id,
    ...exclude,
    ...(swiped.data ?? []).map((r) => r.swiped_id),
    ...(blockedByMe.data ?? []).map((r) => r.blocked_id),
    ...(blockedMe.data ?? []).map((r) => r.blocker_id),
  ]);

  const today = new Date();
  const minAge = Math.max(18, viewer.age_min ?? 18);
  const maxAge = Math.min(99, viewer.age_max ?? 99);
  const maxBirth = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
  const minBirth = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10);

  let query = supabase
    .from("profiles")
    .select("id, first_name, birth_date, bio, city, job_title, company, school, is_verified, latitude, longitude, gender, interested_in, interests, subscription_tier, last_boost_at, super_boost_until")
    .eq("is_active", true)
    .neq("shadow_banned", true)
    .not("first_name", "is", null)
    .lte("birth_date", maxBirth)
    .gte("birth_date", minBirth)
    .limit(200);
  if (verifiedOnly) query = query.eq("is_verified", true);
  // Keep the URL short: only push small exclusion lists to the server.
  if (excluded.size <= 150) query = query.not("id", "in", `(${[...excluded].join(",")})`);

  const { data, error } = await query;
  if (error) throw error;

  const terms = (interests ?? []).map((t) => t.toLowerCase());
  const candidates = ((data ?? []) as unknown as LegacyRow[]).filter((p) =>
    !excluded.has(p.id)
    && wants(viewer.interested_in, p.gender)
    && wants(p.interested_in, viewer.gender)
    && (terms.length === 0 || (p.interests ?? []).some((i) => terms.some((t) => i.toLowerCase().includes(t)))),
  );
  if (candidates.length === 0) return [];

  const { data: photoRows } = await supabase
    .from("profile_photos")
    .select("profile_id, photo_url, position")
    .in("profile_id", candidates.map((c) => c.id))
    .order("position");
  const photosBy = new Map<string, string[]>();
  for (const row of photoRows ?? []) {
    photosBy.set(row.profile_id, [...(photosBy.get(row.profile_id) ?? []), row.photo_url]);
  }

  const now = Date.now();
  const tierMult: Record<string, number> = { platinum: 2, gold: 1.5, plus: 1.2 };
  return candidates
    .map((p) => {
      const photos = photosBy.get(p.id) ?? [];
      let score = photos.length * 7
        + ((p.bio?.length ?? 0) >= 10 ? 20 : 0)
        + ((p.interests?.length ?? 0) >= 3 ? 12 : 0)
        + (p.is_verified ? 8 : 0) + (p.job_title ? 8 : 0) + (p.school ? 6 : 0) + (p.city ? 6 : 0);
      score *= tierMult[p.subscription_tier ?? ""] ?? 1;
      if (p.super_boost_until && new Date(p.super_boost_until).getTime() > now) score *= 5;
      else if (p.last_boost_at && new Date(p.last_boost_at).getTime() > now - 30 * 60_000) score *= 3;
      const dist = viewer.latitude != null && p.latitude != null
        ? distanceKm(viewer.latitude, viewer.longitude ?? 0, p.latitude, p.longitude ?? 0)
        : null;
      return { profile: { ...p, photos, is_verified: !!p.is_verified, distance_km: dist }, score, dist };
    })
    .filter((x) => x.profile.photos.length > 0)
    .sort((a, b) => b.score - a.score || (a.dist ?? Infinity) - (b.dist ?? Infinity))
    .slice(0, limit)
    .map((x) => x.profile);
}
