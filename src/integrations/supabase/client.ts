import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ISEXY runs on TAKATAK V1. Its tables live in the `isexy` schema; auth is the
// shared Takatak Auth (auth.users), so a member has one identity across TAKATAK.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const ISEXY_SCHEMA = 'isexy' as const;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database, typeof ISEXY_SCHEMA>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: ISEXY_SCHEMA },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
