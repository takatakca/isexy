import { useState, useEffect, useRef, useCallback } from "react";
import { X, Send, Loader2, Bot, ArrowRight, Shield, CreditCard, Users, HelpCircle, AlertTriangle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  query: string;
  category: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const quickActions: QuickAction[] = [
  { label: "Safety Issue", icon: <Shield className="w-4 h-4" />, query: "I need help with a safety issue", category: "safety" },
  { label: "Billing & Payments", icon: <CreditCard className="w-4 h-4" />, query: "I need help with billing or payments", category: "billing" },
  { label: "Account Help", icon: <Users className="w-4 h-4" />, query: "I need help with my account", category: "account" },
  { label: "Report Someone", icon: <AlertTriangle className="w-4 h-4" />, query: "I want to report a user for inappropriate behavior", category: "report" },
  { label: "Matches & Dating", icon: <HelpCircle className="w-4 h-4" />, query: "How can I get more matches and improve my dating experience?", category: "dating" },
  { label: "Contact Support", icon: <Phone className="w-4 h-4" />, query: "I want to talk to a human support agent", category: "contact" },
];

async function streamChat(
  messages: { role: string; content: string }[],
  conversationId: string | null,
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, conversationId, stream: true }),
    });

    if (!resp.ok || !resp.body) {
      if (resp.status === 429) { onError(new Error("Rate limited. Please wait a moment.")); return; }
      if (resp.status === 402) { onError(new Error("Service temporarily unavailable.")); return; }
      onError(new Error("Failed to connect to AI")); return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { onDone(); return; }
        try {
          const parsed = JSON.parse(json);
          const c = parsed.choices?.[0]?.delta?.content;
          if (c) onDelta(c);
        } catch { buf = line + "\n" + buf; break; }
      }
    }
    onDone();
  } catch (e: any) {
    onError(e);
  }
}

export function AIChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showActions, setShowActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const startConversation = async () => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { data, error } = await supabase
      .from("chatbot_conversations")
      .insert({ user_id: user?.id || null, session_id: sessionId, status: "active" })
      .select()
      .single();

    if (error) { toast.error("Failed to start chat"); return; }
    setConversationId(data.id);

    setMessages([{
      id: `welcome_${Date.now()}`,
      role: "assistant",
      content: "👋 Hi! I'm your **ISEXY Support AI**.\n\nI can help with safety issues, billing, account questions, reporting users, and more.\n\nIf there's an emergency in progress, contact emergency services immediately.\n\n**Choose a topic below or type your question:**",
      created_at: new Date().toISOString(),
    }]);
  };

  const sendToAI = async (userContent: string) => {
    setLoading(true);
    setShowActions(false);

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: userContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    if (conversationId) {
      await supabase.from("chatbot_messages").insert({
        conversation_id: conversationId, role: "user", content: userContent,
      });
    }

    const contextMessages = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    contextMessages.push({ role: "user", content: userContent });

    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id.startsWith("stream_")) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { id: `stream_${Date.now()}`, role: "assistant", content: assistantSoFar, created_at: new Date().toISOString() }];
      });
    };

    await streamChat(
      contextMessages,
      conversationId,
      upsert,
      () => {
        setLoading(false);
        // Save final message to DB
        if (conversationId && assistantSoFar) {
          supabase.from("chatbot_messages").insert({
            conversation_id: conversationId, role: "assistant", content: assistantSoFar,
          });
        }
      },
      (err) => {
        setLoading(false);
        setMessages(prev => [...prev, {
          id: `err_${Date.now()}`, role: "assistant",
          content: "Sorry, I'm having trouble connecting. Please try again or contact support at **cubaresort.ca@gmail.com**.",
          created_at: new Date().toISOString(),
        }]);
        toast.error(err.message || "Failed to get response");
      },
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId) return;
    const content = newMessage.trim();
    setNewMessage("");
    await sendToAI(content);
  };

  const transferToAgent = async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      await supabase.from("live_chat_sessions").insert({ user_id: user?.id || null, status: "waiting" });
      await supabase.from("chatbot_conversations").update({ status: "transferred" }).eq("id", conversationId);
      setMessages(prev => [...prev, {
        id: `transfer_${Date.now()}`, role: "assistant",
        content: "✅ **You've been connected to the support queue.**\n\nAn agent will be with you shortly. You can also reach us:\n\n📧 **Email:** cubaresort.ca@gmail.com\n📞 **Canada:** +1 450 999 4999\n📞 **Cuba:** +53 5307 1185\n\nWe'll notify you when an agent responds.",
        created_at: new Date().toISOString(),
      }]);
      toast.success("Connected to support queue");
    } catch { toast.error("Failed to connect to support"); } finally { setLoading(false); }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); if (!conversationId) startConversation(); }}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-gradient-to-br from-primary to-pink-500 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        aria-label="Open support chat"
      >
        <Bot className="w-7 h-7" />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 max-w-md mx-auto h-[65vh] max-h-[550px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header — Airbnb style */}
      <div className="bg-gradient-to-r from-primary to-pink-500 text-white p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">ISEXY Support</p>
            <p className="text-xs text-white/80">AI-Powered • Instant Help</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-full">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}

          {/* Quick Actions — Airbnb style category cards */}
          {showActions && messages.length === 1 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {quickActions.map((q) => (
                <button
                  key={q.label}
                  onClick={() => sendToAI(q.query)}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-3 bg-muted hover:bg-muted/70 rounded-xl text-xs font-medium text-foreground transition-colors disabled:opacity-50 text-left"
                >
                  <span className="text-primary flex-shrink-0">{q.icon}</span>
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Streaming indicator */}
          {loading && !messages.some(m => m.id.startsWith("stream_")) && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Transfer + Contact */}
      <div className="px-4 py-2 border-t border-border flex items-center justify-between flex-shrink-0">
        <button onClick={transferToAgent} disabled={loading} className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
          <ArrowRight className="w-3 h-3" />
          Talk to a human
        </button>
        <a href="tel:+14509994999" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
          <Phone className="w-3 h-3" />
          Call us
        </a>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2 flex-shrink-0">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Write a message..."
          className="flex-1"
          disabled={loading || !conversationId}
        />
        <Button onClick={handleSend} disabled={loading || !newMessage.trim() || !conversationId} size="icon">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
