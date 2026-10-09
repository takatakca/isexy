// Every ISEXY edge function talks to TAKATAK V1 through this client so it
// reads and writes the `isexy` schema, never V1's public schema.
import { createClient as createSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
export type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export const ISEXY_SCHEMA = "isexy";

// deno-lint-ignore no-explicit-any
export function createClient(url: string, key: string, options: Record<string, any> = {}) {
  return createSupabaseClient(url, key, {
    ...options,
    db: { ...(options.db ?? {}), schema: ISEXY_SCHEMA },
  });
}
