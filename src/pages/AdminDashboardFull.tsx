import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  CheckCircle,
  Coins,
  Crown,
  DollarSign,
  EyeOff,
  Headphones,
  Heart,
  MessageCircle,
  Mic,
  RefreshCw,
  Shield,
  ShieldAlert,
  TicketIcon,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import { format } from "date-fns";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StaffMemberSearch } from "@/components/admin/StaffMemberSearch";
import { StaffReportsList } from "@/components/admin/StaffReportsList";
import { fetchDashboardStats, staffErrorText, useStaffRole, type DashboardStats } from "@/lib/staff";
import { goBack } from "@/lib/navigation";


const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#22c55e", "#ef4444"];

/**
 * Staff home (/admin, admins and moderators). Numbers come from
 * staff_dashboard_stats (one RPC: no profile rows in the browser; revenue and
 * tickets for admins only); members are searched on the server and every
 * action on a member opens MemberModerationSheet (staff RPCs).
 */
export default function AdminDashboardFull() {
  const navigate = useNavigate();
  const role = useStaffRole();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchDashboardStats());
      setStatsError(null);
    } catch (e) {
      setStatsError(staffErrorText(e));
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const [membersKey, setMembersKey] = useState(0);
  const refresh = () => {
    void loadStats();
    setMembersKey((n) => n + 1);
  };

  const m = stats?.members;
  const queues = stats?.queues;
  const signupData = (stats?.signups_14d ?? []).map((d) => ({ date: format(new Date(`${d.day}T12:00:00`), "MMM d"), count: d.count }));
  const genderData = Object.entries(stats?.by_gender ?? {}).map(([name, value]) => ({ name, value }));
  const tierData = Object.entries(stats?.by_tier ?? {}).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const queueTiles = [
    { label: "Reports to review", value: queues?.pending_reports, icon: AlertTriangle, to: "/admin/moderation" },
    { label: "Restricted members", value: queues?.active_restrictions, icon: ShieldAlert, to: "/admin/moderation" },
    { label: "Photo checks", value: queues?.pending_photo_checks, icon: Camera, to: "/admin/verifications" },
    { label: "Voice greetings", value: queues?.pending_voice_greetings, icon: Mic, to: "/admin/moderation" },
    { label: "Waiting live chats", value: queues?.waiting_live_chats, icon: Headphones, to: "/admin/agent" },
    ...(role.isAdmin ? [{ label: "Open tickets", value: queues?.open_tickets ?? 0, icon: TicketIcon, to: "/admin/tickets" }] : []),
  ];

  const tools = [
    { label: "Moderation", icon: AlertTriangle, to: "/admin/moderation", admin: false },
    { label: "Verifications", icon: Shield, to: "/admin/verifications", admin: false },
    { label: "Live chat", icon: MessageCircle, to: "/admin/agent", admin: false },
    { label: "Support portal", icon: Headphones, to: "/support", admin: false },
    { label: "Support tickets", icon: TicketIcon, to: "/admin/tickets", admin: true },
    { label: "Roles & VIP codes", icon: Users, to: "/admin/users", admin: true },
    { label: "Knowledge base", icon: BookOpen, to: "/admin/knowledge-base", admin: true },
    { label: "Email templates", icon: MessageCircle, to: "/admin/email-templates", admin: true },
    { label: "Ticket categories", icon: Coins, to: "/admin/categories", admin: true },
    { label: "Full analytics", icon: TrendingUp, to: "/admin/analytics", admin: true },
    { label: "Calls & voice tests", icon: Video, to: "/admin/call-tests", admin: true },
    { label: "Payment checks", icon: DollarSign, to: "/admin/payment-tests", admin: true },
  ].filter((t) => role.isAdmin || !t.admin);

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/settings")} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">Staff</h1>
            <p className="text-xs text-muted-foreground">{role.isAdmin ? "Admin" : "Moderator"}</p>
          </div>
          <Button variant="outline" size="icon" onClick={refresh} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {statsError && <p className="text-sm text-destructive" role="alert">{statsError}</p>}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: Users, value: m?.total, label: "Members", tone: "text-primary" },
            { icon: TrendingUp, value: m?.new_today, label: "New today", tone: "text-green-500" },
            { icon: CheckCircle, value: m?.active, label: "Active", tone: "text-blue-500" },
            { icon: Shield, value: m?.verified, label: "Verified", tone: "text-cyan-500" },
            { icon: Heart, value: m?.premium, label: "Premium", tone: "text-primary" },
            { icon: EyeOff, value: (m?.suspended ?? 0) + (m?.shadow_banned ?? 0), label: "Suspended / shadow", tone: "text-destructive" },
          ].map(({ icon: Icon, value, label, tone }) => (
            <Card key={label}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 shrink-0 ${tone}`} />
                  <div className="min-w-0">
                    <p className="text-2xl font-bold">{stats ? value ?? 0 : "–"}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <section aria-label="Waiting for staff" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {queueTiles.map(({ label, value, icon: Icon, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/50"
            >
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-lg font-bold text-foreground">{stats ? value ?? 0 : "–"}</span>
                <span className="block text-xs leading-tight text-muted-foreground">{label}</span>
              </span>
            </button>
          ))}
        </section>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="flex w-full overflow-x-auto justify-start">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            {role.isAdmin && <TabsTrigger value="revenue">Revenue</TabsTrigger>}
            <TabsTrigger value="analytics">Signups</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <StaffMemberSearch key={membersKey} onChanged={() => void loadStats()} />
          </TabsContent>

          <TabsContent value="reports">
            <StaffReportsList onChanged={() => void loadStats()} />
          </TabsContent>

          {role.isAdmin && (
            <TabsContent value="revenue" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: DollarSign, value: stats?.revenue?.credit_purchases, label: "Credit purchases" },
                  { icon: Coins, value: stats?.revenue?.credits_purchased, label: "Credits bought" },
                  { icon: Crown, value: stats?.revenue?.active_subscriptions, label: "Active plans (Stripe)" },
                  { icon: MessageCircle, value: stats?.revenue?.active_chat_subscriptions, label: "Chat subscriptions" },
                  { icon: Video, value: stats?.revenue?.call_credits_used, label: "Call minutes used" },
                  {
                    icon: TrendingUp,
                    value: m && m.total > 0 ? `${((m.premium / m.total) * 100).toFixed(1)}%` : "0%",
                    label: "Members on a paid plan",
                  },
                ].map(({ icon: Icon, value, label }) => (
                  <Card key={label}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 shrink-0 text-green-500" />
                        <div className="min-w-0">
                          <p className="text-2xl font-bold">{stats ? value ?? 0 : "–"}</p>
                          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={tierData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {tierData.map((_, index) => (
                            <Cell key={`tier-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sign-ups (14 days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={signupData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} name="Sign-ups" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gender</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={genderData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {genderData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tools.map(({ label, icon: Icon, to }) => (
                <Button key={to} variant="outline" className="h-20 flex flex-col gap-2 whitespace-normal text-center" onClick={() => navigate(to)}>
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
}
