import { useCallback, useState } from "react";

/**
 * A small preference remembered on this device (localStorage). Storage can be
 * blocked (private mode, cleared site data): the setting then simply falls
 * back to its default and the page keeps working.
 */
export function useDeviceSetting(key: string, fallback: boolean): readonly [boolean, (next: boolean) => void];
export function useDeviceSetting<T extends string>(key: string, fallback: T): readonly [T, (next: T) => void];
export function useDeviceSetting(key: string, fallback: string | boolean) {
  const [value, setValue] = useState<string | boolean>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return typeof fallback === "boolean" ? raw === "true" : raw;
    } catch {
      return fallback;
    }
  });

  const update = useCallback((next: string | boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // Not persisted on this device; the in-memory value still applies.
    }
  }, [key]);

  return [value, update] as const;
}
