import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Search, Ticket, Clock, CheckCircle, AlertCircle, 
  MessageSquare, RefreshCw, Filter, Send, Paperclip, ExternalLink,
  User, Mail, Calendar, BarChart3, Tag, UserPlus, FileText
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface SupportTicket {
  id: string;
  ticket_number: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  message: string;
  attachments: string[];
  admin_notes: string | null;
  response: string | null;
  responded_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminUser {
  user_id: string;
  role: string;
  first_name: string | null;
  profile_id: string | null;
}

const AdminTickets = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<SupportTicket[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [responseText, setResponseText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("unassigned");
  const [adminNotes, setAdminNotes] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchTickets();
      fetchAdminUsers();
      setupRealtimeSubscription();
    }
  }, [isAdmin]);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, statusFilter, priorityFilter]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Access denied", description: "Please log in", variant: "destructive" });
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdminRole = roles?.some(r => r.role === "admin");
      
      if (!hasAdminRole) {
        toast({ title: "Access denied", description: "Admin access required", variant: "destructive" });
        navigate("/settings");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/settings");
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets'
        },
        (payload) => {
          console.log('Ticket update:', payload);
          if (payload.eventType === 'INSERT') {
            setTickets(prev => [payload.new as SupportTicket, ...prev]);
            toast({ title: "New ticket received", description: `Ticket #${(payload.new as SupportTicket).ticket_number}` });
          } else if (payload.eventType === 'UPDATE') {
            setTickets(prev => prev.map(t => t.id === payload.new.id ? payload.new as SupportTicket : t));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets((data as SupportTicket[]) || []);
    } catch (error: any) {
      console.error("Error fetching tickets:", error);
      toast({ title: "Error", description: "Failed to load tickets", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase.rpc("get_admin_users");
      if (error) throw error;
      setAdminUsers((data as AdminUser[]) || []);
    } catch (error: any) {
      console.error("Error fetching admin users:", error);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.ticket_number.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query) ||
        t.email.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    setFilteredTickets(filtered);
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    setIsUpdating(true);
    try {
      const oldStatus = selectedTicket.status;
      const oldAssignee = selectedTicket.assigned_to;
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (newStatus && newStatus !== selectedTicket.status) {
        updateData.status = newStatus;
      }

      if (responseText.trim()) {
        updateData.response = responseText.trim();
        updateData.responded_at = new Date().toISOString();
      }

      if (adminNotes.trim()) {
        updateData.admin_notes = adminNotes.trim();
      }

      // Handle assignment
      const newAssigneeId = selectedAssignee === "unassigned" ? null : selectedAssignee;
      if (newAssigneeId !== selectedTicket.assigned_to) {
        updateData.assigned_to = newAssigneeId;
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", selectedTicket.id);

      if (error) throw error;

      // Send email notification if status changed
      if (newStatus && newStatus !== oldStatus) {
        try {
          await supabase.functions.invoke("send-ticket-status-update", {
            body: {
              email: selectedTicket.email,
              name: selectedTicket.name,
              ticketNumber: selectedTicket.ticket_number,
              subject: selectedTicket.subject,
              oldStatus,
              newStatus,
              response: responseText.trim() || undefined,
            }
          });
        } catch (emailError) {
          console.error("Error sending status update email:", emailError);
        }
      }

      toast({ title: "Ticket updated", description: `Ticket #${selectedTicket.ticket_number} has been updated` });
      setSelectedTicket(null);
      setResponseText("");
      setNewStatus("");
      setSelectedAssignee("unassigned");
      setAdminNotes("");
      fetchTickets();
    } catch (error: any) {
      console.error("Error updating ticket:", error);
      toast({ title: "Error", description: "Failed to update ticket", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return "Unassigned";
    const admin = adminUsers.find(a => a.user_id === userId);
    return admin?.first_name || "Unknown";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <AlertCircle className="w-4 h-4" />;
      case "in_progress": return <Clock className="w-4 h-4" />;
      case "resolved": return <CheckCircle className="w-4 h-4" />;
      case "closed": return <CheckCircle className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "in_progress": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "resolved": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "closed": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "high": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "urgent": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
    urgent: tickets.filter(t => t.priority === "urgent").length,
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link to="/settings" className="p-2 hover:bg-muted rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Link>
            <h1 className="text-xl font-bold text-foreground">Admin: Support Tickets</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/dashboard')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/categories')}>
              <Tag className="w-4 h-4 mr-2" />
              Categories
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/email-templates')}>
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchTickets} disabled={isLoading}>
              <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-card/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.open}</p>
              <p className="text-xs text-blue-400">Open</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.inProgress}</p>
              <p className="text-xs text-yellow-400">In Progress</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{stats.resolved}</p>
              <p className="text-xs text-green-400">Resolved</p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{stats.urgent}</p>
              <p className="text-xs text-red-400">Urgent</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ticket #, email, name, or subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-card/50 animate-pulse">
                  <CardContent className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => (
              <Card 
                key={ticket.id} 
                className="bg-card/50 border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer"
                onClick={() => {
                  setSelectedTicket(ticket);
                  setNewStatus(ticket.status);
                  setResponseText(ticket.response || "");
                  setSelectedAssignee(ticket.assigned_to || "unassigned");
                  setAdminNotes(ticket.admin_notes || "");
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Ticket className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="font-mono text-sm font-semibold text-primary">
                          #{ticket.ticket_number}
                        </span>
                        <Badge className={`${getStatusColor(ticket.status)} border`}>
                          {getStatusIcon(ticket.status)}
                          <span className="ml-1 capitalize">{ticket.status.replace("_", " ")}</span>
                        </Badge>
                        <Badge className={`${getPriorityColor(ticket.priority)} border`}>
                          {ticket.priority}
                        </Badge>
                      </div>
                      
                      <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
                        {ticket.subject}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {ticket.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {ticket.email}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.message}
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                        {ticket.category}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(ticket.created_at)}
                      </span>
                      {ticket.attachments && ticket.attachments.length > 0 && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {ticket.attachments.length} files
                        </span>
                      )}
                      {ticket.assigned_to && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <UserPlus className="w-3 h-3" />
                          {getAssigneeName(ticket.assigned_to)}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-card/50 border-dashed">
              <CardContent className="p-8 text-center">
                <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No tickets found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                    ? "Try adjusting your filters"
                    : "No support tickets yet"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-primary" />
                  Ticket #{selectedTicket.ticket_number}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Ticket Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium text-foreground">{selectedTicket.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{selectedTicket.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium text-foreground capitalize">{selectedTicket.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium text-foreground">{formatDate(selectedTicket.created_at)}</p>
                  </div>
                </div>

                {/* Subject & Message */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Subject</p>
                  <p className="font-semibold text-foreground">{selectedTicket.subject}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Message</p>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-foreground whitespace-pre-wrap">{selectedTicket.message}</p>
                  </div>
                </div>

                {/* Attachments */}
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.attachments.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm hover:bg-primary/20 transition-colors"
                        >
                          <Paperclip className="w-3 h-3" />
                          File {i + 1}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previous Response */}
                {selectedTicket.response && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Previous Response</p>
                    <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg">
                      <p className="text-foreground whitespace-pre-wrap">{selectedTicket.response}</p>
                      {selectedTicket.responded_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Responded: {formatDate(selectedTicket.responded_at)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Assignment */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <UserPlus className="w-4 h-4" />
                    Assign To
                  </p>
                  <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {adminUsers.map((admin) => (
                        <SelectItem key={admin.user_id} value={admin.user_id}>
                          {admin.first_name || "Unknown"} ({admin.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Update Status */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Update Status</p>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Response */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Response to User</p>
                  <Textarea
                    placeholder="Type your response here..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Admin Notes */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Admin Notes (Internal)</p>
                  <Textarea
                    placeholder="Internal notes not visible to user..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={2}
                    className="bg-yellow-500/5 border-yellow-500/30"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateTicket} disabled={isUpdating}>
                    {isUpdating ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Update & Notify
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTickets;
