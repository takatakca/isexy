import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, RefreshCw, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { staffErrorText } from "@/lib/staff";

interface ActionRow {
  id: string;
  actor_user_id: string;
  action: string;
  target_profile_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  issue_warning: "Warning",
  lift_restrictions: "Restriction lifted",
  shadow_ban: "Shadow ban",
  shadow_unban: "Shadow ban ended",
  suspend: "Suspended",
  reinstate: "Reinstated",
  report_resolved: "Report resolved",
  report_dismissed: "Report dismissed",
  report_reviewing: "Report in review",
  edit_profile: "Profile edited",
  grant_role: "Role granted",
  update_ticket: "Ticket updated",
  bulk_update_tickets: "Tickets updated",
  accept_live_chat: "Live chat accepted",
  close_live_chat: "Live chat closed",
};

function detailText(d: Record<string, unknown> | null): string {
  if (!d) return "";
  const parts: string[] = [];
  for (const key of ["type", "restriction", "role", "ticket_number", "new_status", "reason", "note"]) {
    const v = d[key];
    if (typeof v === "string" && v) parts.push(key === "reason" || key === "note" ? `“${v}”` : v.replace("_", " "));
  }
  return parts.join(" · ");
}

/** Every staff action (staff_actions, written by the staff RPCs). Admins only (RLS). */
export function StaffAuditLog() {
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [names, setNames] = useState<{ byUser: Record<string, string>; byProfile: Record<string, string> }>({ byUser: {}, byProfile: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("staff_actions")
      .select("id, actor_user_id, action, target_profile_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (e) {
      setError(staffErrorText(e));
      setLoading(false);
      return;
    }
    const list = (data as ActionRow[] | null) ?? [];
    const userIds = [...new Set(list.map((r) => r.actor_user_id))];
    const profileIds = [...new Set(list.map((r) => r.target_profile_id).filter((x): x is string => !!x))];
    const [actors, targets] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("user_id, first_name").in("user_id", userIds) : Promise.resolve({ data: [] }),
      profileIds.length ? supabase.from("profiles").select("id, first_name").in("id", profileIds) : Promise.resolve({ data: [] }),
    ]);
    const byUser: Record<string, string> = {};
    for (const p of (actors.data as { user_id: string; first_name: string }[] | null) ?? []) byUser[p.user_id] = p.first_name;
    const byProfile: Record<string, string> = {};
    for (const p of (targets.data as { id: string; first_name: string }[] | null) ?? []) byProfile[p.id] = p.first_name;
    setNames({ byUser, byProfile });
    setRows(list);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card data-testid="audit-log">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><ScrollText className="h-5 w-5 text-primary" /> Staff actions</span>
          <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh audit log">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {loading && rows.length === 0 && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
        {!loading && !error && rows.length === 0 && <p className="text-sm text-muted-foreground">No staff action yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{ACTION_LABELS[r.action] ?? r.action}</Badge>
              <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, HH:mm")}</span>
            </div>
            <p className="mt-1">
              <span className="font-semibold">{names.byUser[r.actor_user_id] ?? "Staff"}</span>
              {r.target_profile_id && <> → <span className="font-semibold">{names.byProfile[r.target_profile_id] ?? "a member"}</span></>}
            </p>
            {detailText(r.details) && <p className="text-xs text-muted-foreground break-words">{detailText(r.details)}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
