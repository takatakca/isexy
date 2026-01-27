import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  Users, 
  ArrowLeft,
  Send,
  Phone,
  MoreVertical,
  AlertCircle,
  Loader2,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface ChatSession {
  id: string;
  user_id: string;
  agent_id: string | null;
  status: string;
  started_at: string;
  ticket_id: string | null;
}

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  created_at: string;
}

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
  created_at: string;
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'active' | 'tickets'>('queue');

  useEffect(() => {
    fetchData();
    
    // Set up realtime subscription for live chat
    const channel = supabase
      .channel('agent-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_chat_sessions' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_chat_messages' },
        (payload) => {
          if (selectedSession && payload.new.session_id === selectedSession.id) {
            setMessages(prev => [...prev, payload.new as ChatMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSession]);

  const fetchData = async () => {
    // Fetch waiting and active sessions
    const { data: sessionsData } = await supabase
      .from("live_chat_sessions")
      .select("*")
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: true });

    if (sessionsData) {
      setSessions(sessionsData);
    }

    // Fetch open tickets
    const { data: ticketsData } = await supabase
      .from("support_tickets")
      .select("*")
      .in("status", ["open", "in_progress"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });

    if (ticketsData) {
      setTickets(ticketsData);
    }

    setLoading(false);
  };

  const fetchMessages = async (sessionId: string) => {
    const { data } = await supabase
      .from("live_chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at");

    if (data) {
      setMessages(data);
    }
  };

  const handleAcceptSession = async (session: ChatSession) => {
    if (!profile) return;

    const { error } = await supabase
      .from("live_chat_sessions")
      .update({ 
        agent_id: profile.id, 
        status: "active" 
      })
      .eq("id", session.id);

    if (error) {
      toast.error("Failed to accept session");
      return;
    }

    // Send system message
    await supabase.from("live_chat_messages").insert({
      session_id: session.id,
      sender_type: "system",
      content: `${profile.first_name} has joined the chat.`
    });

    setSelectedSession({ ...session, agent_id: profile.id, status: "active" });
    fetchMessages(session.id);
    toast.success("Session accepted");
  };

  const handleSendMessage = async () => {
    if (!selectedSession || !newMessage.trim() || !profile) return;

    setSending(true);
    
    const { error } = await supabase.from("live_chat_messages").insert({
      session_id: selectedSession.id,
      sender_type: "agent",
      sender_id: profile.id,
      content: newMessage.trim()
    });

    if (error) {
      toast.error("Failed to send message");
    } else {
      setNewMessage("");
    }
    
    setSending(false);
  };

  const handleCloseSession = async () => {
    if (!selectedSession || !profile) return;

    await supabase.from("live_chat_messages").insert({
      session_id: selectedSession.id,
      sender_type: "system",
      content: "This chat session has been closed."
    });

    await supabase
      .from("live_chat_sessions")
      .update({ status: "closed", ended_at: new Date().toISOString() })
      .eq("id", selectedSession.id);

    setSelectedSession(null);
    setMessages([]);
    fetchData();
    toast.success("Session closed");
  };

  const waitingSessions = sessions.filter(s => s.status === "waiting");
  const activeSessions = sessions.filter(s => s.status === "active");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold">Agent Dashboard</h1>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/admin/knowledge-base")}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Knowledge Base
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-2 text-center">
              <Clock className="w-4 h-4 mx-auto text-orange-600 mb-1" />
              <span className="text-lg font-bold text-orange-600">{waitingSessions.length}</span>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2 text-center">
              <MessageCircle className="w-4 h-4 mx-auto text-green-600 mb-1" />
              <span className="text-lg font-bold text-green-600">{activeSessions.length}</span>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 text-center">
              <AlertCircle className="w-4 h-4 mx-auto text-blue-600 mb-1" />
              <span className="text-lg font-bold text-blue-600">{tickets.length}</span>
              <p className="text-xs text-muted-foreground">Tickets</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'queue' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
            }`}
          >
            Queue ({waitingSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'active' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
            }`}
          >
            Active ({activeSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'tickets' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
            }`}
          >
            Tickets
          </button>
        </div>

        {/* Session/Ticket list */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {activeTab === 'queue' && (
              waitingSessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No waiting sessions</p>
              ) : (
                waitingSessions.map(session => (
                  <div
                    key={session.id}
                    className="p-3 bg-card rounded-lg mb-2 border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        Waiting
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(session.started_at), "h:mm a")}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptSession(session)}
                      className="w-full mt-2"
                    >
                      Accept Chat
                    </Button>
                  </div>
                ))
              )
            )}

            {activeTab === 'active' && (
              activeSessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No active sessions</p>
              ) : (
                activeSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setSelectedSession(session);
                      fetchMessages(session.id);
                    }}
                    className={`w-full p-3 bg-card rounded-lg mb-2 border text-left ${
                      selectedSession?.id === session.id 
                        ? 'border-primary' 
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge className="bg-green-500">Active</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(session.started_at), "h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      Session ID: {session.id.substring(0, 8)}...
                    </p>
                  </button>
                ))
              )
            )}

            {activeTab === 'tickets' && (
              tickets.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No open tickets</p>
              ) : (
                tickets.map(ticket => (
                  <button
                    key={ticket.id}
                    onClick={() => navigate(`/admin/tickets?id=${ticket.id}`)}
                    className="w-full p-3 bg-card rounded-lg mb-2 border border-border text-left hover:border-muted-foreground"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">{ticket.priority}</Badge>
                      <span className="text-xs text-muted-foreground">
                        #{ticket.ticket_number}
                      </span>
                    </div>
                    <p className="font-medium text-sm truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {ticket.name} • {ticket.category}
                    </p>
                  </button>
                ))
              )
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Live Chat Session</h2>
                <p className="text-sm text-muted-foreground">
                  Started {format(new Date(selectedSession.started_at), "MMM d, h:mm a")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCloseSession}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Close Session
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_type === "agent" ? "justify-end" : 
                      msg.sender_type === "system" ? "justify-center" : "justify-start"
                    }`}
                  >
                    {msg.sender_type === "system" ? (
                      <p className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {msg.content}
                      </p>
                    ) : (
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.sender_type === "agent"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.sender_type === "agent" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {format(new Date(msg.created_at), "h:mm a")}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  disabled={sending}
                />
                <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No Active Chat
              </h2>
              <p className="text-muted-foreground max-w-sm">
                Accept a chat from the queue or select an active session to start helping users.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
