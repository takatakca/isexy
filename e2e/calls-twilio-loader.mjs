// Node loader for e2e/calls-twilio-test.mjs: the Deno edge functions import
// supabase-js from esm.sh; map it to a fake whose client the test controls
// (globalThis.__fakeSupabase). Nothing leaves the machine.
import { register } from "node:module";

const FAKE = `data:text/javascript,${encodeURIComponent(
  "export function createClient(...args) { return globalThis.__fakeSupabase(...args); }",
)}`;

register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("https://esm.sh/@supabase/supabase-js")) return { url: ${JSON.stringify(FAKE)}, shortCircuit: true };
  if (specifier.startsWith("https://") || specifier.startsWith("http://")) throw new Error("network import blocked in test: " + specifier);
  return next(specifier, context);
}`)}`);
