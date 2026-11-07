import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { staffErrorText, useStaffRole } from "@/lib/staff";
import { goBack } from "@/lib/navigation";

interface ChatSession {
  id: string;
  user_id: string | null;
  agent_id: string | null;
  status: string;
  started_at: string;
  ticket_id: string | null;
  chatbot_conversation_id: string | null;
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
  subject: string;
  category: string;
  priority: string;
  status: string;
}

type Tab = "queue" | "active" | "tickets";

/**
 * Live chat with members ("Talk to a person" in the assistant), for admins
 * and moderators. Accept and close go through staff_accept_live_chat /
 * staff_close_live_chat (they post the "joined" / "ended" lines); the agent's
 * messages are inserted as "agent" in a chat assigned to them (RLS, 0015 G).
 * Phone first: the list and the open chat take the whole screen in turn.
 */
export default function AgentDashboard() {
  const navigate = useNavigate();
  const role = useStaffRole();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transcript, setTranscript] = useState<{ role: string; content: string; created_at: string }[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("queue");
  const endRef = useRef<HTMLDivElement>(null);
  const me = role.userId;

  const fetchData = useCallback(async () => {
    const { data: sessionsData } = await supabase
      .from("live_chat_sessions")
      .select("id, user_id, agent_id, status, started_at, ticket_id, chatbot_conversation_id")
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: true });
    const list = (sessionsData as ChatSession[] | null) ?? [];
    setSessions(list);
    const ids = [...new Set(list.flatMap((s) => [s.user_id, s.agent_id]).filter((x): x is string => !!x))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, first_name").in("user_id", ids);
      const map: Record<string, string> = {};
      for (const p of (profs as { user_id: string; first_name: string }[] | null) ?? []) map[p.user_id] = p.first_name;
      setNames(map);
    }
    if (role.isAdmin) {
      const { data: ticketsData } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, name, subject, category, priority, status")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: true })
        .limit(100);
      setTickets((ticketsData as Ticket[] | null) ?? []);
    }
    setLoading(false);
  }, [role.isAdmin]);

  const openSession = useCallback(async (s: ChatSession) => {
    setSelected(s);
    setShowTranscript(false);
    const [msgs, tr] = await Promise.all([
      supabase.from("live_chat_messages").select("*").eq("session_id", s.id).order("created_at").limit(500),
      supabase.rpc("staff_get_live_chat_transcript", { p_session_id: s.id }),
    ]);
    setMessages((msgs.data as ChatMessage[] | null) ?? []);
    setTranscript((tr.data as { role: string; content: string; created_at: string }[] | null) ?? []);
  }, []);

  useEffect(() => {
    if (role.loading) return;
    void fetchData();
    const channel = supabase
      .channel(`agent-dashboard-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "isexy", table: "live_chat_sessions" }, () => void fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role.loading, fetchData]);

  useEffect(() => {
    if (!selected) return;
    const channel = supabase
      .channel(`agent-chat-${selected.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "isexy", table: "live_chat_messages", filter: `session_id=eq.${selected.id}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keep the open chat's status in step with the list (closed by the member, taken by someone else).
  useEffect(() => {
    if (!selected) return;
    const fresh = sessions.find((s) => s.id === selected.id);
    if (!fresh) setSelected((prev) => (prev ? { ...prev, status: "closed" } : prev));
    else if (fresh.status !== selected.status || fresh.agent_id !== selected.agent_id) setSelected(fresh);
  }, [sessions, selected]);

  const handleAccept = async (s: ChatSession) => {
    setBusy(s.id);
    const { data, error } = await supabase.rpc("staff_accept_live_chat", { p_session_id: s.id });
    setBusy(null);
    if (error || !data) {
      toast.error(staffErrorText(error));
      void fetchData();
      return;
    }
    toast.success("You joined the chat");
    setActiveTab("active");
    await openSession(data as unknown as ChatSession);
    void fetchData();
  };

  const handleSend = async () => {
    if (!selected || !me || !newMessage.trim()) return;
    setSending(true);
    const content = newMessage.trim();
    const { data, error } = await supabase
      .from("live_chat_messages")
      .insert({ session_id: selected.id, sender_type: "agent", sender_id: me, content })
      .select("*")
      .single();
    setSending(false);
    if (error || !data) {
      toast.error("Not sent. Is the chat still open and assigned to you?");
      return;
    }
    setNewMessage("");
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as ChatMessage]));
  };

  const handleClose = async () => {
    if (!selected) return;
    setBusy(selected.id);
    const { error } = await supabase.rpc("staff_close_live_chat", { p_session_id: selected.id });
    setBusy(null);
    if (error) {
      toast.error(staffErrorText(error));
      return;
    }
    toast.success("Chat closed");
    setSelected(null);
    setMessages([]);
    void fetchData();
  };

  const waiting = sessions.filter((s) => s.status === "waiting");
  const active = sessions.filter((s) => s.status === "active");
  const mine = !!selected && selected.agent_id === me && selected.status === "active";

  if (role.loading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const memberName = (s: ChatSession) => (s.user_id ? names[s.user_id] ?? "Member" : "Guest");

  return (
    <div className="h-[100dvh] bg-background flex overflow-hidden">
      {/* List */}
      <div className={`${selected ? "hidden md:flex" : "flex"} w-full md:w-80 md:border-r border-border flex-col min-h-0`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => goBack(navigate, "/admin")} className="p-2 -ml-2 hover:bg-muted rounded-full" aria-label="Back">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold truncate">Live chat</h1>
            </div>
            {role.isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/knowledge-base")}>
                <BookOpen className="w-4 h-4 mr-1" /> Articles
              </Button>
            )}
          </div>
          <div className={`grid ${role.isAdmin ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-2 text-center">
              <Clock className="w-4 h-4 mx-auto text-orange-600 mb-1" />
              <span className="text-lg font-bold text-orange-600">{waiting.length}</span>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2 text-center">
              <MessageCircle className="w-4 h-4 mx-auto text-green-600 mb-1" />
              <span className="text-lg font-bold text-green-600">{active.length}</span>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            {role.isAdmin && (
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 text-center">
                <AlertCircle className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                <span className="text-lg font-bold text-blue-600">{tickets.length}</span>
                <p className="text-xs text-muted-foreground">Tickets</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex border-b border-border" role="tablist">
          {([
            ["queue", `Queue (${waiting.length})`],
            ["active", `Active (${active.length})`],
            ...(role.isAdmin ? [["tickets", "Tickets"]] : []),
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-3 text-sm font-medium ${activeTab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === "queue" &&
            (waiting.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nobody is waiting.</p>
            ) : (
              waiting.map((s) => (
                <div key={s.id} className="p-3 bg-card rounded-lg mb-2 border border-border" data-testid="queue-session">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{memberName(s)}</span>
                    <span className="text-xs text-muted-foreground">waiting since {format(new Date(s.started_at), "h:mm a")}</span>
                  </div>
                  <Button size="sm" onClick={() => handleAccept(s)} disabled={busy === s.id} className="w-full">
                    {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept chat"}
                  </Button>
                </div>
              ))
            ))}

          {activeTab === "active" &&
            (active.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No chat in progress.</p>
            ) : (
              active.map((s) => (
                <button
                  key={s.id}
                  onClick={() => void openSession(s)}
                  className={`w-full p-3 bg-card rounded-lg mb-2 border text-left ${selected?.id === s.id ? "border-primary" : "border-border hover:border-muted-foreground"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{memberName(s)}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(s.started_at), "h:mm a")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.agent_id === me ? "With you" : `With ${s.agent_id ? names[s.agent_id] ?? "a colleague" : "nobody"}`}
                  </p>
                </button>
              ))
            ))}

          {activeTab === "tickets" && role.isAdmin &&
            (tickets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No open tickets.</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate("/admin/tickets")}
                  className="w-full p-3 bg-card rounded-lg mb-2 border border-border text-left hover:border-muted-foreground"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline">{t.priority}</Badge>
                    <span className="text-xs text-muted-foreground">#{t.ticket_number}</span>
                  </div>
                  <p className="font-medium text-sm truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">{t.name} • {t.category}</p>
                </button>
              ))
            ))}
        </div>
      </div>

      {/* Chat */}
      <div className={`${selected ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0 min-h-0`}>
        {selected ? (
          <>
            <div className="p-3 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => setSelected(null)} className="md:hidden p-2 -ml-1 hover:bg-muted rounded-full" aria-label="Back to the list">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{memberName(selected)}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.status === "closed" ? "Ended" : `Started ${format(new Date(selected.started_at), "MMM d, h:mm a")}`}
                  </p>
                </div>
              </div>
              {selected.status !== "closed" && (mine || role.isAdmin) && (
                <Button variant="outline" size="sm" onClick={handleClose} disabled={busy === selected.id}>
                  <CheckCircle className="w-4 h-4 mr-1" /> Close
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcript.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30">
                  <button
                    onClick={() => setShowTranscript((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium"
                    aria-expanded={showTranscript}
                  >
                    <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Conversation with the assistant ({transcript.length})</span>
                    {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showTranscript && (
                    <div className="space-y-2 px-3 pb-3">
                      {transcript.map((m, i) => (
                        <p key={i} className="text-xs whitespace-pre-wrap break-words">
                          <span className="font-semibold">{m.role === "user" ? "Member" : "Assistant"}:</span> {m.content}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === "agent" ? "justify-end" : msg.sender_type === "system" ? "justify-center" : "justify-start"}`}
                >
                  {msg.sender_type === "system" ? (
                    <p className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full text-center">{msg.content}</p>
                  ) : (
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.sender_type === "agent" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.sender_type === "agent" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {format(new Date(msg.created_at), "h:mm a")}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {mine ? (
              <div className="p-3 border-t border-border" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
                <div className="flex gap-2">
                  <Input
                    placeholder="Write to the member…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void handleSend()}
                    disabled={sending}
                    maxLength={2000}
                  />
                  <Button onClick={() => void handleSend()} disabled={sending || !newMessage.trim()} aria-label="Send">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="p-3 border-t border-border text-center text-xs text-muted-foreground">
                {selected.status === "closed" ? "This chat has ended." : "Another team member is answering this chat."}
              </p>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-6">
            <div>
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No chat open</h2>
              <p className="text-muted-foreground max-w-sm">Accept a chat from the queue or open one in progress.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
