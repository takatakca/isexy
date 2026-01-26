import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  sender_type: "user" | "agent" | "system";
  created_at: string;
}

export function LiveChatWidget() {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const startChat = async () => {
    setConnecting(true);
    try {
      // Create a new chat session
      const { data, error } = await supabase
        .from("live_chat_sessions" as any)
        .insert({
          user_id: user?.id || null,
          status: "waiting",
        } as any)
        .select()
        .single();

      if (error) throw error;

      setSessionId((data as any).id);

      // Add welcome message
      await supabase.from("live_chat_messages" as any).insert({
        session_id: (data as any).id,
        content: "Welcome to CubaDate Support! An agent will be with you shortly. In the meantime, feel free to describe your issue.",
        sender_type: "system",
      } as any);

      // Fetch initial messages
      const { data: msgs } = await supabase
        .from("live_chat_messages" as any)
        .select("*")
        .eq("session_id", (data as any).id)
        .order("created_at");

      setMessages((msgs as unknown as Message[]) || []);
    } catch (err: any) {
      toast.error("Failed to start chat session");
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !sessionId) return;

    const content = newMessage.trim();
    setNewMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.from("live_chat_messages" as any).insert({
        session_id: sessionId,
        content,
        sender_type: "user",
        sender_id: user?.id || null,
      } as any);

      if (error) throw error;
    } catch (err) {
      toast.error("Failed to send message");
      setNewMessage(content);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const endChat = async () => {
    if (sessionId) {
      await supabase
        .from("live_chat_sessions" as any)
        .update({ status: "closed", ended_at: new Date().toISOString() } as any)
        .eq("id", sessionId);
    }
    setSessionId(null);
    setMessages([]);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          if (!sessionId) startChat();
        }}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-24 right-4 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
        isMinimized ? "w-72 h-14" : "w-80 h-[450px]"
      }`}
    >
      {/* Header */}
      <div className="bg-primary text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-sm">Live Support</p>
            {!isMinimized && (
              <p className="text-xs text-white/80">
                {sessionId ? "Connected" : "Connecting..."}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/20 rounded"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>
          <button onClick={endChat} className="p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 h-[340px] overflow-y-auto p-3 space-y-3">
            {connecting ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender_type === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                      msg.sender_type === "user"
                        ? "bg-primary text-white rounded-br-sm"
                        : msg.sender_type === "system"
                        ? "bg-muted text-muted-foreground"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1"
              disabled={loading || !sessionId}
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !newMessage.trim() || !sessionId}
              size="icon"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
