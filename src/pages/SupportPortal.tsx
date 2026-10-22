import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  TicketIcon, AlertTriangle, Users, Ban, ScrollText, Settings, Search, CheckCircle, XCircle, Clock,
  Shield, ChevronRight, LogOut, Flame, User, Mail, CreditCard, Loader2, MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
import { StaffReportsList } from "@/components/admin/StaffReportsList";
import { StaffMemberSearch } from "@/components/admin/StaffMemberSearch";
import { StaffAuditLog } from "@/components/admin/StaffAuditLog";
import { staffErrorText, useStaffRole } from "@/lib/staff";

type Tab = "tickets" | "reports" | "members" | "bans" | "audit";

interface Ticket {
  id: string;
  ticket_number: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  message: string;
  admin_notes: string | null;
  response: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

/** Canned answers for common tickets (inserted into the reply, then edited). */
const SAVED_REPLIES: { label: string; text: string }[] = [
  {
    label: "Account access",
    text: "Thanks for reaching out. Sign in with the same email or phone number you used before; we send a one-time code, no password needed. If the code doesn't arrive, check your spam folder or try the other sign-in method.",
  },
  {
    label: "Billing question",
    text: "Thanks for your message. We checked your account: you can see your plan, renewal date and receipts under Settings > My subscription, and cancel there at any time.",
  },
  {
    label: "Report received",
    text: "Thank you for telling us. Our safety team reviewed the member you reported and took action under our community guidelines. For privacy reasons we can't share the details.",
  },
  {
    label: "Need more details",
    text: "Thanks for contacting ISEXY Support. Could you tell us a bit more (what you tried, what you saw, and roughly when)? A screenshot helps too.",
  },
];

function SupportSidebar({
  isAdmin,
  tab,
  onTab,
  counts,
}: {
  isAdmin: boolean;
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: { tickets: number; reports: number };
}) {
  const { state, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const items: { title: string; icon: typeof TicketIcon; tab: Tab; badge?: number; admin?: boolean }[] = [
    { title: "Tickets", icon: TicketIcon, tab: "tickets", badge: counts.tickets, admin: true },
    { title: "Reports", icon: AlertTriangle, tab: "reports", badge: counts.reports },
    { title: "Members", icon: Users, tab: "members" },
    { title: "Suspended", icon: Ban, tab: "bans" },
    { title: "Audit log", icon: ScrollText, tab: "audit", admin: true },
  ];
  const links: { title: string; icon: typeof TicketIcon; to: string; admin?: boolean }[] = [
    { title: "Live chat", icon: MessageCircle, to: "/admin/agent" },
    { title: "Moderation", icon: Shield, to: "/admin/moderation" },
    { title: "Payment checks", icon: CreditCard, to: "/admin/payment-tests", admin: true },
    { title: "Staff home", icon: Settings, to: "/admin" },
  ];

  const pick = (t: Tab) => {
    onTab(t);
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {!collapsed && <span>Support Portal</span>}
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.filter((i) => isAdmin || !i.admin).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={tab === item.tab} onClick={() => pick(item.tab)} tooltip={item.title}>
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && (
                      <span className="flex-1 flex items-center justify-between">
                        {item.title}
                        {item.badge ? (
                          <Badge variant="destructive" className="text-[10px] h-5 min-w-5 flex items-center justify-center">
                            {item.badge}
                          </Badge>
                        ) : null}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && "Other tools"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.filter((l) => isAdmin || !l.admin).map((l) => (
                <SidebarMenuItem key={l.title}>
                  <SidebarMenuButton onClick={() => navigate(l.to)} tooltip={l.title}>
                    <l.icon className="w-4 h-4" />
                    {!collapsed && <span>{l.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function TicketsPanel({ onCounts }: { onCounts: () => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("open_any");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [responseText, setResponseText] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setTickets((data as Ticket[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  /** Status / reply e-mail; the function reads the ticket back (admins only). */
  const notifyMember = async (ticketId: string, withResponse: boolean) => {
    const { error } = await supabase.functions.invoke("isexy-send-ticket-status-update", { body: { ticketId, withResponse } });
    if (error) console.error("Ticket e-mail failed:", error);
  };

  // Ticket changes go through staff_update_ticket (admin checked on the server, main's 0009 rule).
  const updateTicketStatus = async (ticket: Ticket, status: string) => {
    setSaving(true);
    const { data, error } = await supabase.rpc("staff_update_ticket", { p_ticket_id: ticket.id, p_status: status });
    setSaving(false);
    if (error) { toast.error(staffErrorText(error)); return; }
    if ((data as { notify?: boolean } | null)?.notify) await notifyMember(ticket.id, false);
    toast.success(`Ticket ${status.replace("_", " ")}`);
    setSelectedTicket(null);
    void fetchTickets();
    onCounts();
  };

  const submitResponse = async () => {
    if (!selectedTicket || !responseText.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("staff_update_ticket", {
      p_ticket_id: selectedTicket.id,
      p_status: "resolved",
      p_response: responseText.trim(),
      p_note: internalNote.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(staffErrorText(error)); return; }
    if ((data as { notify?: boolean } | null)?.notify) await notifyMember(selectedTicket.id, true);
    toast.success("Reply sent, ticket resolved");
    setSelectedTicket(null);
    setResponseText("");
    setInternalNote("");
    void fetchTickets();
    onCounts();
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = tickets.filter((t) => {
    const matchSearch = !q ||
      t.ticket_number.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" ||
      (statusFilter === "open_any" ? t.status === "open" || t.status === "in_progress" : t.status === statusFilter);
    return matchSearch && matchStatus;
  });

  const priorityColor = (p: string) => (p === "urgent" || p === "high" ? "destructive" : p === "medium" ? "default" : "secondary");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tickets…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
        </div>
        <select
          aria-label="Status"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="open_any">Open + in progress</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading && tickets.length === 0 && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      <div className="space-y-2">
        {filtered.map((ticket) => (
          <Card key={ticket.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelectedTicket(ticket)} data-testid="portal-ticket">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
                    <Badge variant={priorityColor(ticket.priority)} className="text-[10px] h-5">{ticket.priority}</Badge>
                    <Badge variant="outline" className="text-[10px] h-5">{ticket.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="font-semibold text-sm text-foreground truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">{ticket.name} · {ticket.category}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{format(new Date(ticket.created_at), "MMM d, h:mm a")}</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <TicketIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No tickets here</p>
          </div>
        )}
      </div>

      <Sheet open={!!selectedTicket} onOpenChange={(o) => !o && setSelectedTicket(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedTicket && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left pr-6">
                  <span className="font-mono text-xs text-muted-foreground block mb-1">{selectedTicket.ticket_number}</span>
                  {selectedTicket.subject}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedTicket.name}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground truncate">{selectedTicket.email}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={priorityColor(selectedTicket.priority)}>{selectedTicket.priority}</Badge>
                    <Badge variant="outline">{selectedTicket.status.replace("_", " ")}</Badge>
                    <Badge variant="outline">{selectedTicket.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Created {format(new Date(selectedTicket.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">MESSAGE</p>
                  <p className="text-sm text-foreground bg-card border border-border rounded-xl p-4 whitespace-pre-wrap break-words">{selectedTicket.message}</p>
                </div>

                {selectedTicket.response && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">LAST REPLY</p>
                    <p className="text-sm text-foreground bg-primary/5 border border-primary/10 rounded-xl p-4 whitespace-pre-wrap break-words">{selectedTicket.response}</p>
                  </div>
                )}

                {selectedTicket.admin_notes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">INTERNAL NOTES</p>
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 whitespace-pre-wrap break-words">{selectedTicket.admin_notes}</p>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => updateTicketStatus(selectedTicket, "in_progress")}>
                      <Clock className="w-3 h-3 mr-1" /> In progress
                    </Button>
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => updateTicketStatus(selectedTicket, "closed")}>
                      <XCircle className="w-3 h-3 mr-1" /> Close
                    </Button>
                  </div>

                  <div>
                    <label htmlFor="saved-reply" className="text-xs font-semibold text-muted-foreground">Saved replies</label>
                    <select
                      id="saved-reply"
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value=""
                      onChange={(e) => {
                        const r = SAVED_REPLIES.find((x) => x.label === e.target.value);
                        if (r) setResponseText((prev) => (prev.trim() ? `${prev.trim()}\n\n${r.text}` : r.text));
                      }}
                    >
                      <option value="">Insert a saved reply…</option>
                      {SAVED_REPLIES.map((r) => <option key={r.label} value={r.label}>{r.label}</option>)}
                    </select>
                  </div>
                  <Textarea
                    placeholder="Reply to the member (sent by e-mail)…"
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Textarea
                    placeholder="Internal note (not visible to the member)…"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    className="min-h-[60px] bg-muted/30"
                  />
                  <Button className="w-full" onClick={submitResponse} disabled={saving || !responseText.trim()}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-2" /> Send reply & resolve</>}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * Support portal for staff. Admins: tickets (main's 0009 rule: only admins
 * change tickets), reports, members, suspended members, audit log.
 * Moderators: reports, members, suspended members. Every action is a staff
 * RPC.
 */
export default function SupportPortal() {
  const navigate = useNavigate();
  const role = useStaffRole();
  const [tab, setTab] = useState<Tab>("reports");
  const [counts, setCounts] = useState({ tickets: 0, reports: 0 });

  const loadCounts = useCallback(async () => {
    const [tickets, reports] = await Promise.all([
      role.isAdmin
        ? supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"])
        : Promise.resolve({ count: 0 }),
      supabase.from("reports").select("id", { count: "exact", head: true }).or("status.is.null,status.in.(pending,reviewing)"),
    ]);
    setCounts({ tickets: tickets.count ?? 0, reports: reports.count ?? 0 });
  }, [role.isAdmin]);

  useEffect(() => {
    if (role.loading) return;
    if (!role.userId) {
      navigate("/staff-login", { replace: true });
      return;
    }
    if (!role.isStaff) {
      toast.error("The support portal is for the ISEXY team.");
      navigate("/discover", { replace: true });
      return;
    }
    if (role.isAdmin) setTab("tickets");
    void loadCounts();
  }, [role.loading, role.userId, role.isStaff, role.isAdmin, navigate, loadCounts]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff-login");
  };

  if (role.loading || !role.isStaff) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const titles: Record<Tab, string> = {
    tickets: "Tickets",
    reports: "Reports",
    members: "Members",
    bans: "Suspended members",
    audit: "Audit log",
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SupportSidebar isAdmin={role.isAdmin} tab={tab} onTab={setTab} counts={counts} />
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center justify-between gap-2 px-3">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger aria-label="Menu" />
              <Flame className="w-5 h-5 shrink-0 text-primary" />
              <h1 className="text-sm font-bold text-foreground truncate">{titles[tab]}</h1>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs capitalize">{role.isAdmin ? "admin" : "moderator"}</Badge>
              <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 overflow-auto">
            {tab === "tickets" && role.isAdmin && <TicketsPanel onCounts={() => void loadCounts()} />}
            {tab === "reports" && <StaffReportsList onChanged={() => void loadCounts()} />}
            {tab === "members" && <StaffMemberSearch />}
            {tab === "bans" && <StaffMemberSearch initialFilter="suspended" />}
            {tab === "audit" && role.isAdmin && <StaffAuditLog />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
