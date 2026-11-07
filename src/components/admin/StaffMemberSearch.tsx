import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { staff } from "@/lib/staff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberModerationSheet } from "@/components/admin/MemberModerationSheet";

interface MemberRow {
  id: string;
  first_name: string;
  city: string | null;
  country: string | null;
  is_verified: boolean | null;
  is_active: boolean | null;
  created_at: string;
}

type MemberListRow = MemberRow & { shadow_banned: boolean };

export type MemberFilter = "all" | "suspended" | "shadow" | "verified";

const FILTERS: [MemberFilter, string][] = [
  ["all", "All"],
  ["suspended", "Suspended"],
  ["shadow", "Shadow banned"],
  ["verified", "Verified"],
];

/**
 * Member search for staff: profiles are read on the server through the staff
 * SELECT policy (suspended members included, 0015 A3), 50 at a time; shadow
 * bans come from staff_get_shadow_bans (members cannot read them, 0015 K3);
 * a tap opens every staff action for that member.
 */
export function StaffMemberSearch({ initialFilter = "all", onChanged }: { initialFilter?: MemberFilter; onChanged?: () => void }) {
  const [members, setMembers] = useState<MemberListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>(initialFilter);
  const [memberId, setMemberId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // "Shadow banned": the banned ids first (staff RPC), then their profiles.
      const shadowIds = filter === "shadow" ? (await staff.shadowBans()).map((b) => b.profile_id) : null;
      if (shadowIds && shadowIds.length === 0) {
        setError(false);
        setMembers([]);
        return;
      }
      let q = supabase
        .from("profiles")
        .select("id, first_name, city, country, is_verified, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const term = query.trim().replace(/[%_,()*"\\]/g, " ").trim(); // PostgREST or() syntax characters
      if (term) q = q.or(`first_name.ilike.%${term}%,city.ilike.%${term}%`);
      if (filter === "suspended") q = q.eq("is_active", false);
      if (shadowIds) q = q.in("id", shadowIds.slice(0, 150)); // newest bans first; keeps the URL short
      if (filter === "verified") q = q.eq("is_verified", true);
      const { data, error: e } = await q;
      if (e) throw e;
      const rows = (data as MemberRow[] | null) ?? [];
      const banned = shadowIds
        ? new Set(shadowIds)
        : new Set(rows.length ? (await staff.shadowBans(rows.map((r) => r.id))).map((b) => b.profile_id) : []);
      setError(false);
      setMembers(rows.map((r) => ({ ...r, shadow_banned: banned.has(r.id) })));
    } catch {
      setError(true);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [query, filter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-3" data-testid="staff-members">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by first name or city" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" aria-label="Search members" />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter members">
        {FILTERS.map(([value, label]) => (
          <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>
            {label}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive" role="alert">Members could not be loaded. Try again.</p>}
      {loading && members.length === 0 && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      {!loading && !error && members.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No member found.</p>}
      <ul className="space-y-2">
        {members.map((u) => (
          <li key={u.id}>
            <button
              onClick={() => setMemberId(u.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/50"
              data-testid="staff-member"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{u.first_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[u.city, u.country].filter(Boolean).join(", ") || "—"} · joined {format(new Date(u.created_at), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {u.is_active === false && <Badge variant="destructive">Suspended</Badge>}
                {u.shadow_banned && <Badge variant="outline">Shadow</Badge>}
                {u.is_verified && <Badge variant="secondary">Verified</Badge>}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <MemberModerationSheet
        profileId={memberId}
        onOpenChange={(o) => !o && setMemberId(null)}
        onChanged={() => {
          void load();
          onChanged?.();
        }}
      />
    </div>
  );
}
