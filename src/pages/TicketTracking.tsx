import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Ticket, Clock, CheckCircle, AlertCircle, MessageSquare, RefreshCw, Bell, Paperclip, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { goBack } from "@/lib/navigation";

interface SupportTicket {
  id?: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  message: string;
  attachments?: string[];
  response: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

const TicketTracking = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchedTicket, setSearchedTicket] = useState<SupportTicket | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  // Signed in: the sign-in e-mail is the usual ticket address.
  useEffect(() => {
    if (user?.email) setSearchEmail((prev) => prev || user.email!);
  }, [user?.email]);

  useEffect(() => {
    fetchUserTickets();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('user-tickets')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'isexy',
          table: 'support_tickets'
        },
        (payload) => {
          console.log('Ticket updated:', payload);
          const updatedTicket = payload.new as SupportTicket;
          
          // Update local state
          setTickets(prev => prev.map(t => 
            t.id === updatedTicket.id ? updatedTicket : t
          ));
          
          // Update searched ticket if it's the same
          setSearchedTicket(prev => 
            prev?.id === updatedTicket.id ? updatedTicket : prev
          );
          
          // Show notification
          sonnerToast.success(`Ticket #${updatedTicket.ticket_number} updated!`, {
            description: `Status: ${updatedTicket.status.replace('_', ' ')}`,
            icon: <Bell className="w-4 h-4" />
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserTickets = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Own tickets only (staff can read every ticket under RLS).
        const email = user.email?.toLowerCase().replace(/"/g, "");
        const { data, error } = await supabase
          .from("support_tickets")
          .select("id, ticket_number, subject, category, priority, status, message, attachments, response, responded_at, created_at, updated_at")
          .or(email ? `user_id.eq.${user.id},email.eq."${email}"` : `user_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        setTickets((data as SupportTicket[]) || []);
      }
    } catch (error: unknown) {
      console.error("Error fetching tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Number + the e-mail the ticket was sent from (works for guests too).
  const searchTicket = async () => {
    const number = searchQuery.trim().toUpperCase();
    const email = searchEmail.trim();
    if (!number || !email) {
      toast({
        title: "Ticket number and e-mail",
        description: "Enter the ticket number and the e-mail address you used to send it.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc("get_ticket_status", {
        p_ticket_number: number,
        p_email: email,
      });

      if (error) throw error;

      const found = (data ?? [])[0] as SupportTicket | undefined;
      if (found) {
        setSearchedTicket(found);
      } else {
        toast({
          title: "Ticket not found",
          description: "No ticket matches this number and e-mail. Check both and try again.",
          variant: "destructive",
        });
        setSearchedTicket(null);
      }
    } catch (error: unknown) {
      console.error("Error searching ticket:", error);
      toast({
        title: "Search failed",
        description: "Unable to search for ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="w-4 h-4" />;
      case "in_progress":
        return <Clock className="w-4 h-4" />;
      case "resolved":
        return <CheckCircle className="w-4 h-4" />;
      case "closed":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "in_progress":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "resolved":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "closed":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "urgent":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
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

  const TicketCard = ({ ticket }: { ticket: SupportTicket }) => (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-primary" />
            <span className="font-mono text-sm font-semibold text-primary">
              #{ticket.ticket_number}
            </span>
          </div>
          <div className="flex gap-2">
            <Badge className={`${getStatusColor(ticket.status)} border`}>
              {getStatusIcon(ticket.status)}
              <span className="ml-1 capitalize">{ticket.status.replace("_", " ")}</span>
            </Badge>
            <Badge className={`${getPriorityColor(ticket.priority)} border`}>
              {ticket.priority}
            </Badge>
          </div>
        </div>

        <h3 className="font-semibold text-foreground mb-2 line-clamp-1">
          {ticket.subject}
        </h3>

        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {ticket.message}
        </p>

        {ticket.response && (
          <div className="mb-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <p className="text-xs font-semibold text-foreground mb-1">
              Reply from ISEXY Support{ticket.responded_at ? ` · ${formatDate(ticket.responded_at)}` : ""}
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.response}</p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="bg-muted/50 px-2 py-1 rounded">{ticket.category}</span>
          <span>{formatDate(ticket.created_at)}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack(navigate, "/help-support")} className="p-2 hover:bg-muted rounded-full transition-colors" aria-label="Back">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Ticket Tracking</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchUserTickets}
            disabled={isLoading}
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Search Section */}
        <Card className="bg-gradient-to-br from-primary/10 to-pink-500/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Search className="w-5 h-5 text-primary" />
              Find a ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Ticket number (e.g. IS-ABC123)"
                aria-label="Ticket number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && searchTicket()}
                className="font-mono"
              />
              <Input
                type="email"
                placeholder="E-mail used for the ticket"
                aria-label="E-mail used for the ticket"
                autoComplete="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchTicket()}
              />
              <Button onClick={searchTicket} disabled={isSearching} aria-label="Search">
                {isSearching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Searched Ticket Result */}
            {searchedTicket && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Search Result:</h3>
                <TicketCard ticket={searchedTicket} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-3 justify-center">
          <div className="flex items-center gap-2 text-sm">
            <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <AlertCircle className="w-3 h-3 mr-1" />
              Open
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              <Clock className="w-3 h-3 mr-1" />
              In Progress
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Resolved
            </Badge>
          </div>
        </div>

        {/* User's Tickets */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            Your Support Tickets
          </h2>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-card/50 animate-pulse">
                  <CardContent className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tickets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {tickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          ) : (
            <Card className="bg-card/50 border-dashed">
              <CardContent className="p-8 text-center">
                <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">{user ? "No tickets yet" : "Sent a ticket as a guest?"}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {user
                    ? "You haven't submitted any support tickets. Need help?"
                    : "Find it above with its number and your e-mail, or sign in to see the tickets sent from your account."}
                </p>
                <Link to="/contact-us">
                  <Button>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Help Section */}
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-foreground mb-2">Need more help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Check our FAQ or contact our support team directly.
            </p>
            <div className="flex justify-center gap-3">
              <Link to="/faq">
                <Button variant="outline">View FAQ</Button>
              </Link>
              <Link to="/contact-us">
                <Button>New Ticket</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TicketTracking;
