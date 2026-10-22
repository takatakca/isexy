import { supabase } from "@/integrations/supabase/client";

/**
 * Blocks and reports. The server RPCs (docs/handoff/trust.sql T2) work both
 * ways; until they are deployed the old table writes are used, which only
 * know the member's own blocks.
 */

export type ReportReason = "fake" | "harassment" | "scam" | "inappropriate" | "underage" | "spam" | "other";

function rpcMissing(error: { code?: string; message?: string } | null, fn: string): boolean {
  return !!error && (error.code === "PGRST202" || new RegExp(fn).test(error.message ?? ""));
}

/**
 * Profile ids hidden from the member: people they blocked and people who
 * blocked them. Never throws: an empty set when nothing can be read.
 */
export async function fetchHiddenMemberIds(meId: string): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("get_my_hidden_member_ids");
  if (!error && Array.isArray(data)) return new Set(data as string[]);
  if (error && !rpcMissing(error, "get_my_hidden_member_ids")) console.error("Hidden members failed:", error);
  // Older database: only the member's own blocks are readable.
  const { data: own } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", meId);
  return new Set((own ?? []).map((b) => b.blocked_id));
}

/** Blocks a member. Blocking someone already blocked is not an error. */
export async function blockMember(meId: string, otherId: string): Promise<void> {
  const { error } = await supabase.rpc("block_member", { p_profile_id: otherId });
  if (!error) return;
  if (!rpcMissing(error, "block_member")) throw error;
  const { error: insertError } = await supabase.from("blocks").insert({ blocker_id: meId, blocked_id: otherId });
  if (insertError && insertError.code !== "23505") throw insertError;
}

export interface ReportResult {
  /** A pending report on this member existed: the details were added to it. */
  duplicate: boolean;
  blocked: boolean;
}

export async function reportMember(
  meId: string,
  input: { reportedId: string; reason: ReportReason; details?: string; block: boolean; source?: string },
): Promise<ReportResult> {
  const { data, error } = await supabase.rpc("report_member", {
    p_reported_id: input.reportedId,
    p_reason: input.reason,
    p_details: input.details?.trim() || null,
    p_block: input.block,
    p_source: input.source ?? null,
  });
  if (!error) {
    const r = (data ?? {}) as { duplicate?: boolean; blocked?: boolean };
    return { duplicate: !!r.duplicate, blocked: !!r.blocked };
  }
  if (!rpcMissing(error, "report_member")) throw error;
  const { error: insertError } = await supabase.from("reports").insert({
    reporter_id: meId,
    reported_id: input.reportedId,
    reason: input.reason,
    description: input.details?.trim() || null,
  });
  if (insertError) throw insertError;
  let blocked = false;
  if (input.block) {
    try {
      await blockMember(meId, input.reportedId);
      blocked = true;
    } catch (e) {
      console.error("Block after report failed:", e);
    }
  }
  return { duplicate: false, blocked };
}

/** Friendly text for a block/report error from the server. */
export function blockReportErrorText(error: unknown): string {
  const msg = (error as { message?: string } | null)?.message ?? "";
  if (/yourself/i.test(msg)) return "You can't do that on your own profile.";
  if (/Too many reports/i.test(msg)) return "You've sent a lot of reports today. Please contact support instead.";
  if (/not found/i.test(msg)) return "This member is no longer on ISEXY.";
  return "Something went wrong. Check your connection and try again.";
}
