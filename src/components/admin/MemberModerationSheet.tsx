import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { BadgeCheck, Ban, EyeOff, Loader2, PencilLine, ShieldAlert, ShieldCheck, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RESTRICTIONS,
  REPORT_REASON_LABELS,
  WARNING_TYPES,
  isActiveRestriction,
  staff,
  staffErrorText,
  type Restriction,
  type WarningType,
} from "@/lib/staff";

interface MemberRow {
  id: string;
  user_id: string;
  first_name: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean | null;
  is_verified: boolean | null;
  shadow_banned: boolean | null;
  shadow_banned_reason: string | null;
  created_at: string;
}

interface WarningRow {
  id: string;
  warning_type: string;
  warning_level: number;
  ban_until: string | null;
  is_permanent_ban: boolean | null;
  evidence: string | null;
  created_at: string;
  lifted_at: string | null;
  lift_reason: string | null;
}

interface ReportRow {
  id: string;
  reason: string;
  description: string | null;
  status: string | null;
  created_at: string;
  reporter: { first_name: string } | null;
}

type Panel = null | "warn" | "lift" | "shadow" | "suspend" | "edit";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Everything staff can do to one member, in one sheet: verify, warn (with a
 * messaging restriction), lift restrictions, shadow ban, suspend/reinstate,
 * edit the name or bio. Every button calls a staff RPC (lib/staff.ts); the
 * history below comes from tables staff can read (0015 A3).
 */
export function MemberModerationSheet({
  profileId,
  onOpenChange,
  onChanged,
}: {
  profileId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [member, setMember] = useState<MemberRow | null>(null);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [warnType, setWarnType] = useState<WarningType>("harassment");
  const [restriction, setRestriction] = useState<Restriction>("none");
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError(null);
    const [m, w, r] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, first_name, bio, city, country, is_active, is_verified, shadow_banned, shadow_banned_reason, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("user_warnings")
        .select("id, warning_type, warning_level, ban_until, is_permanent_ban, evidence, created_at, lifted_at, lift_reason")
        .eq("profile_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("reports")
        .select("id, reason, description, status, created_at, reporter:profiles!reports_reporter_id_fkey(first_name)")
        .eq("reported_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setLoading(false);
    if (m.error || !m.data) {
      setLoadError(m.error ? staffErrorText(m.error) : "This member could not be found.");
      setMember(null);
      return;
    }
    setMember(m.data as MemberRow);
    setWarnings((w.data as WarningRow[] | null) ?? []);
    setReports((r.data as unknown as ReportRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    setPanel(null);
    setReason("");
    if (profileId) void load(profileId);
    else setMember(null);
  }, [profileId, load]);

  const open = (p: Panel) => {
    setReason("");
    if (p === "edit" && member) {
      setEditName(member.first_name);
      setEditBio(member.bio ?? "");
    }
    setPanel(panel === p ? null : p);
  };

  const run = async (label: string, action: () => Promise<unknown>) => {
    if (!member) return;
    setBusy(true);
    try {
      await action();
      toast.success(label);
      setPanel(null);
      setReason("");
      await load(member.id);
      onChanged?.();
    } catch (e) {
      toast.error(staffErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const activeRestrictions = warnings.filter(isActiveRestriction);

  return (
    <Sheet open={!!profileId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="member-sheet">
        <SheetHeader className="text-left pr-6">
          <SheetTitle>{member ? member.first_name : "Member"}</SheetTitle>
          <SheetDescription>
            {member
              ? [member.city, member.country].filter(Boolean).join(", ") + ` · joined ${format(new Date(member.created_at), "MMM d, yyyy")}`
              : "Staff tools"}
          </SheetDescription>
        </SheetHeader>

        {loading && !member && (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        )}
        {loadError && <p className="mt-6 text-sm text-destructive" role="alert">{loadError}</p>}

        {member && (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap gap-2">
              {member.is_active === false ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>}
              {member.is_verified && <Badge className="gap-1"><BadgeCheck className="h-3 w-3" /> Verified</Badge>}
              {member.shadow_banned && <Badge variant="outline" className="gap-1"><EyeOff className="h-3 w-3" /> Shadow banned</Badge>}
              {activeRestrictions.length > 0 && <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Messaging restricted</Badge>}
            </div>
            {member.bio && <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground whitespace-pre-wrap break-words">{member.bio}</p>}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run(member.is_verified ? "Verification removed" : "Member verified", () => staff.setVerified(member.id, !member.is_verified))}>
                <ShieldCheck className="mr-1 h-4 w-4" /> {member.is_verified ? "Unverify" : "Verify"}
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => open("warn")}>
                <ShieldAlert className="mr-1 h-4 w-4" /> Warn
              </Button>
              <Button variant="outline" size="sm" disabled={busy || activeRestrictions.length === 0} onClick={() => open("lift")}>
                <Undo2 className="mr-1 h-4 w-4" /> Lift restriction
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => open("shadow")}>
                <EyeOff className="mr-1 h-4 w-4" /> {member.shadow_banned ? "End shadow ban" : "Shadow ban"}
              </Button>
              <Button variant={member.is_active === false ? "default" : "destructive"} size="sm" disabled={busy} onClick={() => open("suspend")}>
                <Ban className="mr-1 h-4 w-4" /> {member.is_active === false ? "Reinstate" : "Suspend"}
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => open("edit")}>
                <PencilLine className="mr-1 h-4 w-4" /> Edit name / bio
              </Button>
            </div>

            {panel === "warn" && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <label className="block text-xs font-semibold text-muted-foreground" htmlFor="warn-type">Reason</label>
                <select id="warn-type" className={selectClass} value={warnType} onChange={(e) => setWarnType(e.target.value as WarningType)}>
                  {WARNING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label className="block text-xs font-semibold text-muted-foreground" htmlFor="warn-restriction">Messaging</label>
                <select id="warn-restriction" className={selectClass} value={restriction} onChange={(e) => setRestriction(e.target.value as Restriction)}>
                  {RESTRICTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <Textarea placeholder="Note for the team (what happened)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
                <Button className="w-full" disabled={busy} onClick={() => run("Warning recorded", () => staff.issueWarning(member.id, warnType, restriction, reason))}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record warning"}
                </Button>
              </div>
            )}
            {panel === "lift" && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Start the reason with "mistake" if the restriction should not count as a strike.</p>
                <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                <Button className="w-full" disabled={busy} onClick={() => run("Restriction lifted", () => staff.liftRestrictions(member.id, reason))}>
                  Lift every active restriction
                </Button>
              </div>
            )}
            {panel === "shadow" && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {member.shadow_banned
                    ? "The member shows up in Discover, Top Picks and the phone line again."
                    : "The member keeps using ISEXY but no longer shows up in Discover, Top Picks, likes or the phone line."}
                </p>
                {!member.shadow_banned && <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}
                <Button className="w-full" disabled={busy} onClick={() => run(member.shadow_banned ? "Shadow ban ended" : "Shadow ban on", () => staff.setShadowBan(member.id, !member.shadow_banned, reason))}>
                  {member.shadow_banned ? "End shadow ban" : "Shadow ban"}
                </Button>
              </div>
            )}
            {panel === "suspend" && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {member.is_active === false
                    ? "The member can use ISEXY again and shows up to others."
                    : "Suspended members are hidden from everyone, cannot send messages and see a 'suspended' screen with a link to support."}
                </p>
                <Input placeholder={member.is_active === false ? "Note (optional)" : "Reason (required)"} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                <Button
                  className="w-full"
                  variant={member.is_active === false ? "default" : "destructive"}
                  disabled={busy || (member.is_active !== false && !reason.trim())}
                  onClick={() => run(member.is_active === false ? "Account reinstated" : "Account suspended", () => staff.setAccountActive(member.id, member.is_active === false, reason))}
                >
                  {member.is_active === false ? "Reinstate account" : "Suspend account"}
                </Button>
              </div>
            )}
            {panel === "edit" && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Input aria-label="First name" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} />
                <Textarea aria-label="Bio" value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={500} placeholder="Bio (empty = removed)" />
                <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                <Button
                  className="w-full"
                  disabled={busy || !reason.trim() || !editName.trim()}
                  onClick={() =>
                    run("Profile updated", () =>
                      staff.updateProfileText(
                        member.id,
                        {
                          firstName: editName.trim() !== member.first_name ? editName : undefined,
                          bio: editBio !== (member.bio ?? "") ? editBio : undefined,
                        },
                        reason,
                      ),
                    )
                  }
                >
                  Save changes
                </Button>
              </div>
            )}

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Warnings ({warnings.length})</h3>
              {warnings.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
              <ul className="space-y-2">
                {warnings.map((w) => (
                  <li key={w.id} className="rounded-lg border border-border p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{w.warning_type.replace("_", " ")}</Badge>
                      {isActiveRestriction(w) && <Badge variant="destructive">{w.is_permanent_ban ? "until lifted" : `until ${format(new Date(w.ban_until!), "MMM d, HH:mm")}`}</Badge>}
                      {w.lifted_at && <Badge variant="secondary">lifted</Badge>}
                      <span className="text-xs text-muted-foreground">{format(new Date(w.created_at), "MMM d, yyyy")}</span>
                    </div>
                    {w.lift_reason && <p className="mt-1 text-xs text-muted-foreground">Lifted: {w.lift_reason}</p>}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Reports about this member ({reports.length})</h3>
              {reports.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
              <ul className="space-y-2">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</Badge>
                      <Badge variant={!r.status || r.status === "pending" ? "destructive" : "secondary"}>{r.status ?? "pending"}</Badge>
                      <span className="text-xs text-muted-foreground">by {r.reporter?.first_name ?? "a member"} · {format(new Date(r.created_at), "MMM d")}</span>
                    </div>
                    {r.description && <p className="mt-1 text-xs text-foreground whitespace-pre-wrap break-words">{r.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
