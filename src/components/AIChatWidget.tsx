import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface QuickQuestion {
  label: string;
  icon: string;
  query: string;
}

const quickQuestions: QuickQuestion[] = [
  { label: "Billing", icon: "💳", query: "How do subscription plans and billing work?" },
  { label: "Credits", icon: "🪙", query: "How do credits work for video calls?" },
  { label: "Privacy", icon: "🔒", query: "How can I control my privacy settings?" },
  { label: "Safety", icon: "🛡️", query: "How do I report or block someone?" },
  { label: "Matches", icon: "💕", query: "How can I get more matches?" },
  { label: "Verification", icon: "✓", query: "How do I verify my profile?" },
];

export function AIChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startConversation = async () => {
    setConnecting(true);
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await supabase
      .from("chatbot_conversations")
      .insert({
        user_id: user?.id || null,
        session_id: sessionId,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to start chat");
      setConnecting(false);
      return;
    }

    setConversationId(data.id);

    const welcomeMessage: Message = {
      id: `welcome_${Date.now()}`,
      role: "assistant",
      content: "👋 Hi! I'm CubaDate's AI assistant.\n\nI can help you with subscriptions, credits, matching, privacy, safety, and more.\n\n**Choose a topic or type your question:**",
      created_at: new Date().toISOString(),
    };

    setMessages([welcomeMessage]);
    setConnecting(false);
  };

  const sendToAI = async (userContent: string) => {
    setLoading(true);

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: userContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Save user message to database
    if (conversationId) {
      await supabase.from("chatbot_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userContent,
      });
    }

    try {
      // Prepare messages for AI (last 10 for context)
      const contextMessages = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));
      contextMessages.push({ role: "user" as const, content: userContent });

      // Call AI edge function
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: contextMessages,
          conversationId,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to get AI response");
      }

      const aiContent = data?.message || "I'm having trouble right now. Please try again.";

      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: aiContent,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error("AI chat error:", error);
      
      // Add error message
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: "Sorry, I'm having trouble connecting right now. Please try again or contact support.",
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast.error("Failed to get response");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = async (question: QuickQuestion) => {
    setShowQuickQuestions(false);
    setNewMessage("");
    await sendToAI(question.query);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;
    setShowQuickQuestions(false);
    const content = newMessage.trim();
    setNewMessage("");
    await sendToAI(content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const transferToAgent = async () => {
    if (!conversationId) return;
    
    setLoading(true);
    
    try {
      const { data: liveSession } = await supabase
        .from("live_chat_sessions")
        .insert({
          user_id: user?.id || null,
          status: "waiting",
        })
        .select()
        .single();

      if (liveSession) {
        await supabase
          .from("chatbot_conversations")
          .update({ status: "transferred" })
          .eq("id", conversationId);

        const transferMessage: Message = {
          id: `transfer_${Date.now()}`,
          role: "assistant",
          content: "✅ You've been added to the support queue. An agent will be with you shortly!\n\nYou can continue chatting here - we'll notify you when an agent responds.",
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, transferMessage]);
        toast.success("Connected to support queue");
      }
    } catch (error) {
      toast.error("Failed to connect to support");
    } finally {
      setLoading(false);
    }
  };

  // Closed state
  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          if (!conversationId) startConversation();
        }}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-gradient-to-br from-primary to-pink-500 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        aria-label="Open chat support"
      >
        <Bot className="w-7 h-7" />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-4 bottom-20 z-40 max-w-sm mx-auto h-[60vh] max-h-[500px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-pink-500 text-white p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">AI Support</p>
            <p className="text-xs text-white/80">Powered by AI • Instant replies</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {connecting ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            
            {/* Quick Questions */}
            {showQuickQuestions && messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {quickQuestions.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => handleQuickQuestion(q)}
                    disabled={loading}
                    className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-full text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <span>{q.icon}</span>
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Transfer button */}
      <div className="px-4 py-2 border-t border-border flex-shrink-0">
        <button
          onClick={transferToAgent}
          disabled={loading}
          className="w-full text-sm text-primary hover:underline flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <ArrowRight className="w-4 h-4" />
          Talk to a human agent
        </button>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2 flex-shrink-0">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your question..."
          className="flex-1"
          disabled={loading || !conversationId}
        />
        <Button
          onClick={sendMessage}
          disabled={loading || !newMessage.trim() || !conversationId}
          size="icon"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
