import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Camera, Check, Loader2, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { staffErrorText } from "@/lib/staff";

interface RequestRow {
  id: string;
  profile_id: string;
  selfie_path: string;
  status: string;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  profile: { first_name: string } | null;
}

interface Loaded extends RequestRow {
  selfieUrl: string | null;
  photos: string[];
}

/**
 * Photo verification requests (the member's selfie next to their profile
 * photos). Admins and moderators approve or reject with
 * review_photo_verification (0013 B2): approval marks the member verified.
 * The selfie bucket is private; staff get a 10-minute signed URL.
 */
export function PhotoVerificationQueue({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("photo_verifications")
      .select("id, profile_id, selfie_path, status, rejection_reason, submitted_at, reviewed_at, profile:profiles!photo_verifications_profile_id_fkey(first_name)")
      .order("submitted_at", { ascending: filter === "pending" })
      .limit(50);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data, error: e } = await q;
    if (e) {
      setError(staffErrorText(e));
      setRows([]);
      setLoading(false);
      return;
    }
    setError(null);
    const list = (data as unknown as RequestRow[] | null) ?? [];
    const ids = [...new Set(list.map((r) => r.profile_id))];
    const { data: photos } = ids.length
      ? await supabase.from("profile_photos").select("profile_id, photo_url, position").in("profile_id", ids).order("position")
      : { data: [] as { profile_id: string; photo_url: string; position: number }[] };
    const byProfile = new Map<string, string[]>();
    for (const p of photos ?? []) {
      const arr = byProfile.get(p.profile_id) ?? [];
      if (arr.length < 3) arr.push(p.photo_url);
      byProfile.set(p.profile_id, arr);
    }
    const loaded = await Promise.all(
      list.map(async (r) => {
        const { data: signed } = await supabase.storage.from("isexy-photo-verifications").createSignedUrl(r.selfie_path, 600);
        return { ...r, selfieUrl: signed?.signedUrl ?? null, photos: byProfile.get(r.profile_id) ?? [] };
      }),
    );
    setRows(loaded);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (r: Loaded, approve: boolean) => {
    if (!approve && !reasons[r.id]?.trim()) {
      toast.error("Tell the member why (shown to them).");
      return;
    }
    setBusy(r.id);
    const { error: e } = await supabase.rpc("review_photo_verification", {
      p_request_id: r.id,
      p_approve: approve,
      p_reason: approve ? null : reasons[r.id].trim(),
    });
    setBusy(null);
    if (e) {
      toast.error(staffErrorText(e));
      return;
    }
    toast.success(approve ? `${r.profile?.first_name ?? "Member"} is now verified` : "Request rejected");
    await load();
    onChanged?.();
  };

  return (
    <Card data-testid="photo-checks">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> Photo verification</span>
          <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh photo checks">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <div className="flex gap-2" role="group" aria-label="Which requests">
          <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Waiting</Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Recent</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Approve only when the selfie clearly shows the same person as the profile photos.</p>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {loading && rows.length === 0 && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
        {!loading && !error && rows.length === 0 && <p className="text-sm text-muted-foreground">No request waiting.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3 text-sm" data-testid="photo-check">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.profile?.first_name ?? "Member"}</span>
              <Badge variant={r.status === "pending" ? "destructive" : "secondary"}>{r.status}</Badge>
              <span className="text-xs text-muted-foreground">{format(new Date(r.submitted_at), "MMM d, HH:mm")}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <figure className="col-span-1">
                {r.selfieUrl ? (
                  <img src={r.selfieUrl} alt={`Selfie sent by ${r.profile?.first_name ?? "the member"}`} className="aspect-square w-full rounded-md object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">no selfie</div>
                )}
                <figcaption className="mt-1 text-center text-[10px] text-muted-foreground">Selfie</figcaption>
              </figure>
              {r.photos.map((url, i) => (
                <img key={url} src={url} alt={`Profile photo ${i + 1}`} className="aspect-square w-full rounded-md object-cover" />
              ))}
            </div>
            {r.rejection_reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {r.rejection_reason}</p>}
            {r.status === "pending" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  className="h-8 min-w-0 flex-1 basis-40"
                  placeholder="Reason if rejected (shown to the member)"
                  value={reasons[r.id] ?? ""}
                  onChange={(e) => setReasons((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  maxLength={500}
                />
                <Button size="sm" disabled={busy === r.id} onClick={() => review(r, true)}>
                  <Check className="mr-1 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => review(r, false)}>
                  <X className="mr-1 h-4 w-4" /> Reject
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
