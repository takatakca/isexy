import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * Notification choices, stored in isexy.user_preferences.notification_settings
 * so the push and email functions can honour them. Missing keys mean "on".
 */
export interface NotificationSettings {
  email?: { new_matches?: boolean; new_messages?: boolean; promotions?: boolean };
  push?: Record<string, boolean | string>;
}

function asSettings(value: Json | undefined | null): NotificationSettings {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as NotificationSettings) : {};
}

/** null when nothing is stored yet (or the column is not deployed yet). */
export async function loadNotificationSettings(userId: string): Promise<NotificationSettings | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("notification_settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return asSettings(data.notification_settings);
}

/**
 * Merge one section ("email" or "push") into the stored settings. Creates the
 * preferences row when missing, keeping the member's current language choice.
 */
export async function saveNotificationSettings(
  userId: string,
  section: keyof NotificationSettings,
  values: NonNullable<NotificationSettings[keyof NotificationSettings]>,
  language: { preferred_language: string; auto_translate: boolean },
): Promise<boolean> {
  const current = (await loadNotificationSettings(userId)) ?? {};
  const next = { ...current, [section]: { ...(current[section] ?? {}), ...values } } as unknown as Json;

  const { data, error } = await supabase
    .from("user_preferences")
    .update({ notification_settings: next })
    .eq("user_id", userId)
    .select("id");
  if (error) return false;
  if (data && data.length > 0) return true;

  const { error: insertError } = await supabase
    .from("user_preferences")
    .insert({ user_id: userId, ...language, notification_settings: next });
  return !insertError;
}
