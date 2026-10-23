import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Ban, Clock, RefreshCw, Search, Shield, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { MemberModerationSheet } from "@/components/admin/MemberModerationSheet";
import { StaffReportsList } from "@/components/admin/StaffReportsList";
import { PhotoVerificationQueue } from "@/components/admin/PhotoVerificationQueue";
import { VoiceGreetingReviewQueue } from "@/components/admin/VoiceGreetingReviewQueue";
import { isActiveRestriction, staffErrorText } from "@/lib/staff";
import { goBack } from "@/lib/navigation";

interface ContentViolation {
  id: string;
  profile_id: string;
  violation_type: string;
  detected_content: string;
  action_taken: string | null;
  created_at: string;
  profile: { first_name: string } | null;
}

interface UserWarning {
  id: string;
  profile_id: string;
  warning_type: string;
  warning_level: number;
  ban_until: string | null;
  is_permanent_ban: boolean | null;
  evidence: string | null;
  created_at: string;
  lifted_at: string | null;
  lift_reason: string | null;
  profile: { first_name: string } | null;
}

const VIOLATION_LABELS: Record<string, string> = {
  phone_number: "Phone number",
  email: "Email address",
  address: "Address",
  social_media: "Social media",
  payment_info: "Payment details",
  other: "Other",
};

/**
 * Moderation for admins and moderators (AdminRoute allowModerator): reports,
 * messaging restrictions, contact-sharing attempts, photo verification and
 * Phone Line voice greetings. Every action is a staff RPC (lib/staff.ts); this
 * page only reads.
 */
export default function AdminModeration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<ContentViolation[]>([]);
  const [warnings, setWarnings] = useState<UserWarning[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [v, w] = await Promise.all([
      supabase
        .from("content_violations")
        .select("id, profile_id, violation_type, detected_content, action_taken, created_at, profile:profiles!content_violations_profile_id_fkey(first_name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("user_warnings")
        .select("id, profile_id, warning_type, warning_level, ban_until, is_permanent_ban, evidence, created_at, lifted_at, lift_reason, profile:profiles!user_warnings_profile_id_fkey(first_name)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setLoading(false);
    const e = v.error ?? w.error;
    setError(e ? staffErrorText(e) : null);
    setViolations((v.data as unknown as ContentViolation[] | null) ?? []);
    setWarnings((w.data as unknown as UserWarning[] | null) ?? []);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const refreshAll = () => {
    setRefreshKey((n) => n + 1);
    void fetchData();
  };

  const active = warnings.filter(isActiveRestriction);
  const restrictedMembers = Array.from(
    active.reduce((map, w) => {
      const prev = map.get(w.profile_id);
      if (!prev || w.is_permanent_ban || (!prev.is_permanent_ban && (w.ban_until ?? "") > (prev.ban_until ?? ""))) map.set(w.profile_id, w);
      return map;
    }, new Map<string, UserWarning>()).values(),
  );
  const stats = {
    violations: violations.length,
    warnings: warnings.length,
    temp: restrictedMembers.filter((w) => !w.is_permanent_ban).length,
    permanent: restrictedMembers.filter((w) => w.is_permanent_ban).length,
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredViolations = violations.filter((v) => {
    if (typeFilter !== "all" && v.violation_type !== typeFilter) return false;
    if (!q) return true;
    return v.detected_content.toLowerCase().includes(q) || (v.profile?.first_name ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack(navigate, "/admin")} className="p-2 -ml-2" aria-label="Back">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">Moderation</h1>
            <p className="text-sm text-muted-foreground truncate">Reports, restrictions, photo and voice checks</p>
          </div>
          <Button variant="outline" size="icon" onClick={refreshAll} aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: AlertTriangle, value: stats.violations, label: "Contact-sharing attempts", tone: "text-red-400 bg-red-500/20" },
          { icon: Shield, value: stats.warnings, label: "Warnings issued", tone: "text-yellow-400 bg-yellow-500/20" },
          { icon: Clock, value: stats.temp, label: "Restricted for now", tone: "text-orange-400 bg-orange-500/20" },
          { icon: Ban, value: stats.permanent, label: "Restricted until lifted", tone: "text-red-500 bg-red-600/20" },
        ].map(({ icon: Icon, value, label, tone }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${tone}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="px-4 pb-3 text-sm text-destructive" role="alert">{error}</p>}

      <Tabs defaultValue="reports" className="px-4">
        <TabsList className="mb-4 flex w-full overflow-x-auto justify-start">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="restricted">Restricted</TabsTrigger>
          <TabsTrigger value="violations">Attempts</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <StaffReportsList key={`r${refreshKey}`} onChanged={() => void fetchData()} />
        </TabsContent>

        <TabsContent value="restricted" className="space-y-3">
          {!loading && restrictedMembers.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No member is restricted right now.</p>
          )}
          {restrictedMembers.map((w) => (
            <Card key={w.profile_id} className="border-border">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 shrink-0 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{w.profile?.first_name ?? "Member"}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.warning_type.replace("_", " ")} ·{" "}
                    {w.is_permanent_ban ? "until lifted" : `until ${format(new Date(w.ban_until!), "MMM d, HH:mm")}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setMemberId(w.profile_id)}>Review</Button>
              </CardContent>
            </Card>
          ))}
          {warnings.length > 0 && (
            <>
              <h2 className="pt-4 text-xs font-semibold uppercase text-muted-foreground">All warnings</h2>
              {warnings.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setMemberId(w.profile_id)}
                  className="block w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{w.profile?.first_name ?? "Member"}</span>
                    <Badge variant="outline">{w.warning_type.replace("_", " ")}</Badge>
                    {isActiveRestriction(w) && <Badge variant="destructive">active</Badge>}
                    {w.lifted_at && <Badge variant="secondary">lifted</Badge>}
                    <span className="text-xs text-muted-foreground">{format(new Date(w.created_at), "MMM d, yyyy")}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="violations" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Messages the chat refused because they contained contact details. They were never delivered; each one
            counts towards the member's automatic restriction.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <select
              aria-label="Type"
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              {Object.entries(VIOLATION_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          {!loading && filteredViolations.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing found.</p>
          )}
          {filteredViolations.map((v) => (
            <button
              key={v.id}
              onClick={() => setMemberId(v.profile_id)}
              className="block w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{v.profile?.first_name ?? "Member"}</span>
                <Badge variant="outline">{VIOLATION_LABELS[v.violation_type] ?? v.violation_type}</Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(v.created_at), "MMM d, HH:mm")}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{v.detected_content}</p>
            </button>
          ))}
        </TabsContent>

        <TabsContent value="photos">
          <PhotoVerificationQueue key={`p${refreshKey}`} />
        </TabsContent>

        <TabsContent value="voice">
          <VoiceGreetingReviewQueue refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>

      <MemberModerationSheet
        profileId={memberId}
        onOpenChange={(o) => !o && setMemberId(null)}
        onChanged={() => void fetchData()}
      />
    </div>
  );
}
