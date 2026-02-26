import { useState, useEffect } from "react";
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
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  TicketIcon, AlertTriangle, Users, CreditCard, Ban, FileText,
  ScrollText, Settings, Search, Eye, CheckCircle, XCircle, Clock,
  MessageCircle, Shield, ChevronRight, LogOut, ArrowLeft, Flame, Filter,
  User, Mail, Phone,
} from "lucide-react";
import { format } from "date-fns";

type StaffRole = "admin" | "moderator" | "support_agent";

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

interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string | null;
  status: string | null;
  created_at: string;
  reporter?: { first_name: string };
  reported?: { first_name: string };
}

function SupportSidebar({ role, counts }: { role: StaffRole; counts: { tickets: number; reports: number } }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const navItems = [
    { title: "Tickets", icon: TicketIcon, url: "#tickets", badge: counts.tickets },
    { title: "Reports", icon: AlertTriangle, url: "#reports", badge: counts.reports },
    { title: "Users", icon: Users, url: "#users" },
    { title: "Payments", icon: CreditCard, url: "#payments" },
    { title: "Bans & Appeals", icon: Ban, url: "#bans" },
    { title: "Saved Replies", icon: FileText, url: "#replies" },
  ];

  const adminItems = [
    { title: "Audit Log", icon: ScrollText, url: "#audit" },
    { title: "Settings", icon: Settings, url: "#settings" },
  ];

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
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} className="flex items-center gap-2 hover:bg-muted/50 rounded-md px-2 py-1.5 text-sm">
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
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {!collapsed && "Admin Only"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a href={item.url} className="flex items-center gap-2 hover:bg-muted/50 rounded-md px-2 py-1.5 text-sm">
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

function SupportContent({ role }: { role: StaffRole }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [responseText, setResponseText] = useState("");
  const [internalNote, setInternalNote] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchTickets(), fetchReports()]);
    setLoading(false);
  };

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setTickets(data || []);
  };

  const fetchReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select(`*, reporter:profiles!reports_reporter_id_fkey(first_name), reported:profiles!reports_reported_id_fkey(first_name)`)
      .order("created_at", { ascending: false })
      .limit(100);
    setReports(data || []);
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
    if (error) toast.error("Failed to update"); else { toast.success(`Ticket ${status}`); fetchTickets(); }
  };

  const submitResponse = async () => {
    if (!selectedTicket || !responseText.trim()) return;
    const updates: any = { response: responseText, status: "resolved", responded_at: new Date().toISOString() };
    if (internalNote) updates.admin_notes = (selectedTicket.admin_notes || "") + `\n[${new Date().toLocaleString()}] ${internalNote}`;
    const { error } = await supabase.from("support_tickets").update(updates).eq("id", selectedTicket.id);
    if (error) toast.error("Failed"); else {
      toast.success("Response sent");
      setSelectedTicket(null);
      setResponseText("");
      setInternalNote("");
      fetchTickets();
    }
  };

  const handleReportAction = async (reportId: string, action: string) => {
    const { error } = await supabase.from("reports").update({ status: action }).eq("id", reportId);
    if (error) toast.error("Failed"); else { toast.success(`Report ${action}`); fetchReports(); }
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch = searchQuery === "" ||
      t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const openCount = tickets.filter(t => t.status === "open").length;
  const pendingReports = reports.filter(r => !r.status || r.status === "pending").length;

  const priorityColor = (p: string) => {
    switch (p) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      default: return "secondary";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "open": return "destructive";
      case "investigating": return "default";
      case "resolved": return "secondary";
      case "closed": return "outline" as any;
      default: return "default";
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff-login");
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Flame className="w-5 h-5 text-primary" />
          <h1 className="text-sm font-bold text-foreground hidden sm:block">ISEXY Support</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">{role}</Badge>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-card border-b border-border px-4 py-3 grid grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{openCount}</p>
          <p className="text-[10px] text-muted-foreground">Open Tickets</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{pendingReports}</p>
          <p className="text-[10px] text-muted-foreground">Pending Reports</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{tickets.filter(t => t.priority === "urgent").length}</p>
          <p className="text-[10px] text-muted-foreground">Urgent</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{tickets.filter(t => t.status === "resolved").length}</p>
          <p className="text-[10px] text-muted-foreground">Resolved</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 grid grid-cols-4 w-full max-w-md">
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search tickets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ticket List — Card style like Airbnb inbox */}
            <div className="space-y-2">
              {filteredTickets.map(ticket => (
                <Card key={ticket.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelectedTicket(ticket)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
                          <Badge variant={priorityColor(ticket.priority)} className="text-[10px] h-5">{ticket.priority}</Badge>
                          <Badge variant={statusColor(ticket.status)} className="text-[10px] h-5">{ticket.status}</Badge>
                        </div>
                        <p className="font-semibold text-sm text-foreground truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{ticket.name}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{ticket.category}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">{format(new Date(ticket.created_at), "MMM d, h:mm a")}</p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto mt-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredTickets.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <TicketIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No tickets found</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  User Reports ({pendingReports} pending)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reporter</TableHead>
                      <TableHead>Reported</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map(report => (
                      <TableRow key={report.id}>
                        <TableCell className="text-sm">{(report.reporter as any)?.first_name || "Unknown"}</TableCell>
                        <TableCell className="text-sm">{(report.reported as any)?.first_name || "Unknown"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{report.reason}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={report.status === "resolved" ? "default" : report.status === "dismissed" ? "secondary" : "destructive"} className="text-xs">
                            {report.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(report.created_at), "MMM d")}</TableCell>
                        <TableCell>
                          {(!report.status || report.status === "pending") && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleReportAction(report.id, "resolved")}>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleReportAction(report.id, "dismissed")}>
                                <XCircle className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/web-profile/${report.reported_id}`)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-medium text-foreground mb-2">User Lookup</p>
                <p className="text-sm text-muted-foreground mb-4">Search and manage user profiles, view verification status, and chat history.</p>
                <Button onClick={() => navigate("/admin/users")}>
                  Open User Management
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardContent className="p-8 text-center">
                <CreditCard className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-medium text-foreground mb-2">Payments & Refunds</p>
                <p className="text-sm text-muted-foreground mb-4">View subscription disputes, process refunds, and manage billing issues.</p>
                <Button onClick={() => navigate("/manage-payment-account")}>
                  Open Payments
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Ticket Detail Sheet */}
      <Sheet open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedTicket && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">
                  <span className="font-mono text-xs text-muted-foreground block mb-1">{selectedTicket.ticket_number}</span>
                  {selectedTicket.subject}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* User Info */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedTicket.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{selectedTicket.email}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={priorityColor(selectedTicket.priority)}>{selectedTicket.priority}</Badge>
                    <Badge variant={statusColor(selectedTicket.status)}>{selectedTicket.status}</Badge>
                    <Badge variant="outline">{selectedTicket.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Created {format(new Date(selectedTicket.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>

                {/* Message */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">MESSAGE</p>
                  <p className="text-sm text-foreground bg-card border border-border rounded-xl p-4">{selectedTicket.message}</p>
                </div>

                {/* Previous Response */}
                {selectedTicket.response && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">RESPONSE</p>
                    <p className="text-sm text-foreground bg-primary/5 border border-primary/10 rounded-xl p-4">{selectedTicket.response}</p>
                  </div>
                )}

                {/* Admin Notes */}
                {selectedTicket.admin_notes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">INTERNAL NOTES</p>
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 whitespace-pre-wrap">{selectedTicket.admin_notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3 pt-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateTicketStatus(selectedTicket.id, "investigating")}>
                      <Clock className="w-3 h-3 mr-1" /> Investigating
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateTicketStatus(selectedTicket.id, "closed")}>
                      <XCircle className="w-3 h-3 mr-1" /> Close
                    </Button>
                  </div>

                  <Textarea
                    placeholder="Type your response..."
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Textarea
                    placeholder="Internal note (not visible to user)..."
                    value={internalNote}
                    onChange={e => setInternalNote(e.target.value)}
                    className="min-h-[60px] bg-muted/30"
                  />
                  <Button className="w-full" onClick={submitResponse} disabled={!responseText.trim()}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Send Response & Resolve
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

export default function SupportPortal() {
  const navigate = useNavigate();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/staff-login"); return; }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdmin = roles?.some(r => r.role === "admin");
      const hasMod = roles?.some(r => r.role === "moderator");

      if (hasAdmin) setRole("admin");
      else if (hasMod) setRole("moderator");
      else { navigate("/staff-login"); return; }

      // Get counts
      const [tickets, reports] = await Promise.all([
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setTicketCount(tickets.count || 0);
      setReportCount(reports.count || 0);
    } catch {
      navigate("/staff-login");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !role) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SupportSidebar role={role} counts={{ tickets: ticketCount, reports: reportCount }} />
        <SupportContent role={role} />
      </div>
    </SidebarProvider>
  );
}
