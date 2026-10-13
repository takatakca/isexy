import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * Private app settings that have no profile column (notification choices,
 * discovery toggles, active status...). Stored in
 * isexy.user_preferences.settings (jsonb), which only the member can read,
 * one section per page. A copy is cached on the device, so a choice still
 * sticks here if the server save fails (for example before the settings
 * column exists); the server copy wins when both exist.
 */
export interface MemberSettings {
  discovery?: {
    global?: boolean;
    showFurtherAway?: boolean;
    showOutOfAgeRange?: boolean;
    enabled?: boolean;
    sortBy?: "balanced" | "recent";
    visibility?: "standard" | "incognito";
    photoVerifiedChatOnly?: boolean;
    readReceipts?: boolean;
    distanceUnit?: "km" | "mi";
    minPhotos?: number;
    requireBio?: boolean;
    /** Who the member would like to see (filters, not their own profile details). */
    filters?: Record<string, string | string[]>;
  };
  email?: { newMatches?: boolean; newMessages?: boolean; promotions?: boolean };
  push?: Record<string, boolean | string>;
  activeStatus?: { showActive?: boolean; showRecentlyActive?: boolean };
  webProfile?: { enabled?: boolean; searchEngines?: boolean };
  blockedContacts?: { id: string; name: string; phone?: string; email?: string }[];
  /** City shown before Passport mode moved the member, restored by "Use current location". */
  passport?: { homeCity?: string | null };
  deletionRequestedAt?: string;
}

const cacheKey = (userId: string) => `isexy_settings_${userId}`;

function readCache(userId?: string): MemberSettings {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(userId: string, settings: MemberSettings) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(settings));
  } catch {
    /* storage blocked: the server copy still applies */
  }
}

export function useMemberSettings() {
  const { user } = useAuth();
  const { language, autoTranslate } = useLanguage();
  const userId = user?.id;
  const [settings, setSettings] = useState<MemberSettings>(() => readCache(userId));
  const [loading, setLoading] = useState(true);
  const latest = useRef(settings);
  latest.current = settings;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setSettings(readCache(userId));
    setLoading(true);
    supabase
      .from("user_preferences")
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("Settings not loaded from the server:", error.message);
        } else if (data?.settings && typeof data.settings === "object" && !Array.isArray(data.settings)) {
          const merged = { ...readCache(userId), ...(data.settings as MemberSettings) };
          setSettings(merged);
          writeCache(userId, merged);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Merge `patch` into the settings and save. Resolves false when only the device copy was saved. */
  const save = useCallback(
    async (patch: Partial<MemberSettings>): Promise<boolean> => {
      if (!userId) return false;
      const next = { ...latest.current, ...patch };
      latest.current = next;
      setSettings(next);
      writeCache(userId, next);

      // Update the existing row; create it (with the current language) only if there is none,
      // so saving a toggle never resets the member's language choice.
      const { data, error } = await supabase
        .from("user_preferences")
        .update({ settings: next as unknown as Json })
        .eq("user_id", userId)
        .select("id");
      if (!error && data && data.length > 0) return true;
      if (!error) {
        const { error: insertError } = await supabase.from("user_preferences").insert({
          user_id: userId,
          preferred_language: language.code,
          auto_translate: autoTranslate,
          settings: next as unknown as Json,
        });
        if (!insertError) return true;
        console.warn("Settings saved on this device only:", insertError.message);
        return false;
      }
      console.warn("Settings saved on this device only:", error.message);
      return false;
    },
    [userId, language.code, autoTranslate],
  );

  return { settings, loading, save };
}
