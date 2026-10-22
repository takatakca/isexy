import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Staff tools (admin and moderator). Every action on a member goes through a
 * SECURITY DEFINER RPC that checks the role on the server and writes the audit
 * log (supabase/isexy-migrations/0015_trust_and_moderation.sql): the browser
 * never updates profiles, reports or warnings directly (0014 blocks the
 * protected profile columns, and staff have no UPDATE policy on those tables).
 */

export interface StaffRole {
  loading: boolean;
  userId: string | null;
  isAdmin: boolean;
  isModerator: boolean;
  isStaff: boolean;
}

/** The signed-in account's staff roles (members read only their own roles). */
export function useStaffRole(): StaffRole {
  const [state, setState] = useState<StaffRole>({
    loading: true,
    userId: null,
    isAdmin: false,
    isModerator: false,
    isStaff: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setState({ loading: false, userId: null, isAdmin: false, isModerator: false, isStaff: false });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "moderator"]);
      if (cancelled) return;
      const roles = new Set((data ?? []).map((r) => r.role as string));
      const isAdmin = roles.has("admin");
      const isModerator = roles.has("moderator");
      setState({ loading: false, userId: user.id, isAdmin, isModerator, isStaff: isAdmin || isModerator });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Plain-language text for a staff RPC error. */
export function staffErrorText(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  const msg = e?.message ?? "";
  if (/function .* does not exist|PGRST202/i.test(msg) || e?.code === "PGRST202") {
    return "This tool needs the latest database update (migration 0015). Ask the owner to apply it.";
  }
  if (/staff account/i.test(msg)) return "Only an admin can act on a staff account.";
  if (/own account/i.test(msg)) return "You can't use staff tools on your own account.";
  if (/reason is required/i.test(msg)) return "Please give a reason.";
  if (/Admins only|admins can/i.test(msg)) return "Only admins can do this.";
  if (e?.code === "42501" || /not allowed|staff/i.test(msg)) return "You don't have permission to do this.";
  if (/not found/i.test(msg)) return "Not found. It may have been removed or handled by someone else.";
  return msg || "Something went wrong. Check your connection and try again.";
}

export type WarningType = "contact_sharing" | "harassment" | "spam" | "fake_profile" | "other";
export type Restriction = "none" | "24h" | "7d" | "permanent";
export type ReportStatus = "reviewing" | "resolved" | "dismissed";

export const WARNING_TYPES: { value: WarningType; label: string }[] = [
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "fake_profile", label: "Fake profile" },
  { value: "contact_sharing", label: "Sharing contact details" },
  { value: "other", label: "Other" },
];

export const RESTRICTIONS: { value: Restriction; label: string }[] = [
  { value: "none", label: "Warning only" },
  { value: "24h", label: "No messages for 24 hours" },
  { value: "7d", label: "No messages for 7 days" },
  { value: "permanent", label: "No messages until lifted" },
];

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // The generated client types every RPC; the names below are all in types.ts.
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as T;
}

export const staff = {
  issueWarning: (profileId: string, type: WarningType, restriction: Restriction, note: string) =>
    call("staff_issue_warning", { p_profile_id: profileId, p_warning_type: type, p_restriction: restriction, p_note: note.trim() || null }),
  liftRestrictions: (profileId: string, reason: string) =>
    call<number>("staff_lift_restrictions", { p_profile_id: profileId, p_reason: reason.trim() || null }),
  setShadowBan: (profileId: string, banned: boolean, reason: string) =>
    call("staff_set_shadow_ban", { p_profile_id: profileId, p_banned: banned, p_reason: reason.trim() || null }),
  setAccountActive: (profileId: string, active: boolean, reason: string) =>
    call("staff_set_account_active", { p_profile_id: profileId, p_active: active, p_reason: reason.trim() || null }),
  setVerified: (profileId: string, verified: boolean) =>
    call("staff_set_profile_verified", { p_profile_id: profileId, p_verified: verified }),
  resolveReport: (reportId: string, status: ReportStatus, note: string) =>
    call("staff_resolve_report", { p_report_id: reportId, p_status: status, p_note: note.trim() || null }),
  updateProfileText: (profileId: string, changes: { firstName?: string; bio?: string }, reason: string) =>
    call("staff_update_profile", {
      p_profile_id: profileId,
      p_first_name: changes.firstName ?? null,
      p_bio: changes.bio ?? null,
      p_reason: reason.trim() || null,
    }),
  listRoles: (userIds: string[]) =>
    call<{ user_id: string; role: string }[]>("staff_list_roles", { p_user_ids: userIds }),
  grantRole: (userId: string, role: "admin" | "moderator") =>
    call<{ already?: boolean }>("staff_grant_role", { p_user_id: userId, p_role: role }),
};

export interface DashboardStats {
  members: {
    total: number;
    active: number;
    suspended: number;
    shadow_banned: number;
    premium: number;
    verified: number;
    new_today: number;
    new_week: number;
  };
  by_gender: Record<string, number>;
  by_tier: Record<string, number>;
  signups_14d: { day: string; count: number }[];
  queues: {
    pending_reports: number;
    active_restrictions: number;
    pending_photo_checks: number;
    waiting_live_chats: number;
    pending_voice_greetings: number;
    open_tickets: number | null;
  };
  revenue: {
    credits_purchased: number;
    credit_purchases: number;
    active_subscriptions: number;
    active_chat_subscriptions: number;
    call_credits_used: number;
  } | null;
  is_admin: boolean;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return call<DashboardStats>("staff_dashboard_stats", {});
}

/** Is a messaging restriction from user_warnings still running? */
export function isActiveRestriction(w: { lifted_at?: string | null; is_permanent_ban: boolean | null; ban_until: string | null }): boolean {
  if (w.lifted_at) return false;
  if (w.is_permanent_ban) return true;
  return !!w.ban_until && new Date(w.ban_until).getTime() > Date.now();
}

export const REPORT_REASON_LABELS: Record<string, string> = {
  fake: "Fake profile",
  harassment: "Harassment",
  scam: "Scam",
  inappropriate: "Inappropriate content",
  underage: "May be under 18",
  spam: "Spam",
  other: "Other",
};
