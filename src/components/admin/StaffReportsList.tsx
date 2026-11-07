import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, Eye, Loader2, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MemberModerationSheet } from "@/components/admin/MemberModerationSheet";
import { REPORT_REASON_LABELS, staff, staffErrorText, type ReportStatus } from "@/lib/staff";

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string | null;
  status: string | null;
  source: string | null;
  resolution_note: string | null;
  created_at: string;
  reporter: { first_name: string } | null;
  reported: { first_name: string; is_active: boolean | null } | null;
}

/**
 * Member reports for staff (admin + moderator): read through the staff
 * SELECT policy (0015 A3), reviewed through staff_resolve_report (the row is
 * kept with its reviewer and note). "Review member" opens every action on the
 * reported member.
 */
export function StaffReportsList({ onChanged }: { onChanged?: () => void }) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("reports")
      .select(
        "id, reporter_id, reported_id, reason, description, status, source, resolution_note, created_at, reporter:profiles!reports_reporter_id_fkey(first_name), reported:profiles!reports_reported_id_fkey(first_name, is_active)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter === "open") q = q.or("status.is.null,status.in.(pending,reviewing)");
    const { data, error: e } = await q;
    setLoading(false);
    setError(e ? staffErrorText(e) : null);
    setReports((data as unknown as ReportRow[] | null) ?? []);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (r: ReportRow, status: ReportStatus) => {
    setBusy(r.id);
    try {
      await staff.resolveReport(r.id, status, notes[r.id] ?? "");
      toast.success(status === "resolved" ? "Report resolved" : status === "dismissed" ? "Report dismissed" : "Marked as in review");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(staffErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card data-testid="staff-reports">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Member reports</span>
          <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh reports">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <div className="flex gap-2" role="group" aria-label="Which reports">
          <Button size="sm" variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>To review</Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {loading && reports.length === 0 && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
        {!loading && !error && reports.length === 0 && (
          <p className="text-sm text-muted-foreground">{filter === "open" ? "No report waiting. Nice." : "No reports yet."}</p>
        )}
        {reports.map((r) => {
          const open = !r.status || r.status === "pending" || r.status === "reviewing";
          return (
            <div key={r.id} className="rounded-lg border border-border p-3 text-sm" data-testid="staff-report">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</Badge>
                <Badge variant={open ? "destructive" : "secondary"}>{r.status ?? "pending"}</Badge>
                {r.reported?.is_active === false && <Badge variant="secondary">suspended</Badge>}
                <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, HH:mm")}{r.source ? ` · from ${r.source}` : ""}</span>
              </div>
              <p className="mt-1">
                <span className="font-semibold">{r.reporter?.first_name ?? "A member"}</span> reported{" "}
                <span className="font-semibold">{r.reported?.first_name ?? "a member"}</span>
              </p>
              {r.description && <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">{r.description}</p>}
              {r.resolution_note && <p className="mt-1 text-xs text-muted-foreground">Staff note: {r.resolution_note}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setMemberId(r.reported_id)}>
                  <Eye className="mr-1 h-4 w-4" /> Review member
                </Button>
                {open && (
                  <>
                    <Input
                      className="h-8 min-w-0 flex-1 basis-40"
                      placeholder="Note (optional)"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      maxLength={2000}
                      aria-label="Note for this report"
                    />
                    <Button size="sm" disabled={busy === r.id} onClick={() => act(r, "resolved")}>
                      <CheckCircle className="mr-1 h-4 w-4" /> Resolve
                    </Button>
                    <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => act(r, "dismissed")}>
                      <XCircle className="mr-1 h-4 w-4" /> Dismiss
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
      <MemberModerationSheet
        profileId={memberId}
        onOpenChange={(o) => !o && setMemberId(null)}
        onChanged={() => {
          void load();
          onChanged?.();
        }}
      />
    </Card>
  );
}
