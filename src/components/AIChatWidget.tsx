import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface KnowledgeArticle {
  title: string;
  content: string;
}

// Predefined responses based on keywords
const knowledgeResponses: Record<string, string> = {
  "premium": "CubaDate offers three subscription tiers:\n\n**Gold** - $14.99/month: Unlimited likes, see who likes you, 5 Super Likes/day\n\n**Platinum** - $29.99/month: All Gold features plus priority profile, read receipts, and advanced filters\n\n**Diamond** - $49.99/month: All Platinum features plus Passport mode, profile boosts, and video calls\n\nWould you like help subscribing?",
  "subscription": "To manage your subscription:\n1. Go to Settings\n2. Tap 'My Subscription'\n3. Choose your plan or modify existing one\n\nYou can cancel anytime and your benefits continue until the end of the billing period.",
  "credits": "Credits are used for video calls ($1/minute) and special features.\n\n**How to get credits:**\n- Purchase directly in Buy Credits\n- Refer friends (10 credits each)\n- Loyalty rewards\n\nWould you like to buy credits now?",
  "video": "Video calls cost 1 credit per minute. To start a video call:\n1. Open a chat with your match\n2. Tap the video icon\n3. Both users need credits to participate\n\nMake sure you have a stable internet connection!",
  "match": "When both you and another user swipe right on each other, you'll get a match! You can then:\n- Send messages\n- Make video calls\n- Share photos\n\nTip: Complete your profile to get more matches!",
  "block": "To block someone:\n1. Go to their profile\n2. Tap the menu (three dots)\n3. Select 'Block'\n\nBlocked users can't see your profile or contact you.",
  "report": "To report inappropriate behavior:\n1. Go to the user's profile\n2. Tap the menu (three dots)\n3. Select 'Report'\n4. Choose a reason\n\nOur team reviews all reports within 24 hours.",
  "delete": "To delete your account:\n1. Go to Settings\n2. Scroll to 'Delete Account'\n3. Confirm your decision\n\n⚠️ This action is permanent and cannot be undone.",
  "photo": "Photo requirements:\n- Clear photos showing your face\n- No group photos as main\n- No explicit content\n- Minimum 2 photos required\n\nTip: Profiles with 4+ photos get 70% more matches!",
  "verify": "Photo verification helps prove you're real:\n1. Go to Settings > Photo Verification\n2. Take a selfie matching the pose shown\n3. Our team verifies within 24 hours\n\nVerified profiles get a blue checkmark!",
  "password": "To reset your password:\n1. Tap 'Forgot Password' on login\n2. Enter your email\n3. Check your inbox for reset link\n4. Create a new password\n\nIf you don't receive the email, check spam folder.",
};

const findBestResponse = (message: string): string | null => {
  const lowerMessage = message.toLowerCase();
  
  for (const [keyword, response] of Object.entries(knowledgeResponses)) {
    if (lowerMessage.includes(keyword)) {
      return response;
    }
  }
  
  return null;
};

const defaultResponse = "I'm here to help! I can answer questions about:\n\n• Subscriptions & Premium features\n• Credits & Video calls\n• Matching & Messaging\n• Account settings\n• Safety & Privacy\n\nWhat would you like to know more about?";

export function AIChatWidget() {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [transferring, setTransferring] = useState(false);
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

    // Create conversation record
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

    // Add welcome message
    const welcomeMessage: Message = {
      id: `welcome_${Date.now()}`,
      role: "assistant",
      content: "👋 Hi! I'm CubaDate's AI assistant. I can help you with questions about the app, subscriptions, matching, and more.\n\nHow can I help you today?",
      created_at: new Date().toISOString(),
    };

    setMessages([welcomeMessage]);

    // Save to database
    await supabase.from("chatbot_messages").insert({
      conversation_id: data.id,
      role: "assistant",
      content: welcomeMessage.content,
    });

    setConnecting(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    const userContent = newMessage.trim();
    setNewMessage("");
    setLoading(true);

    // Add user message to UI
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: userContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Save user message
    await supabase.from("chatbot_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userContent,
    });

    // Generate AI response
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate thinking

    let aiContent = findBestResponse(userContent);
    
    if (!aiContent) {
      // Check if user wants to talk to human
      if (userContent.toLowerCase().includes("agent") || 
          userContent.toLowerCase().includes("human") ||
          userContent.toLowerCase().includes("person") ||
          userContent.toLowerCase().includes("support")) {
        aiContent = "I'll connect you with a support agent. Please wait...";
        setTransferring(true);
      } else {
        aiContent = defaultResponse;
      }
    }

    const aiMessage: Message = {
      id: `ai_${Date.now()}`,
      role: "assistant",
      content: aiContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, aiMessage]);

    // Save AI message
    await supabase.from("chatbot_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: aiContent,
    });

    // Handle transfer to agent
    if (transferring) {
      setTimeout(async () => {
        // Create live chat session
        const { data: liveSession } = await supabase
          .from("live_chat_sessions")
          .insert({
            user_id: user?.id || null,
            status: "waiting",
          })
          .select()
          .single();

        if (liveSession) {
          // Update chatbot conversation
          await supabase
            .from("chatbot_conversations")
            .update({ status: "transferred" })
            .eq("id", conversationId);

          // Add transfer message
          await supabase.from("live_chat_messages").insert({
            session_id: liveSession.id,
            sender_type: "system",
            content: "User transferred from AI assistant. Previous context: " + userContent,
          });

          const transferMessage: Message = {
            id: `transfer_${Date.now()}`,
            role: "assistant",
            content: "✅ You've been connected to our support queue. An agent will be with you shortly.\n\nIn the meantime, you can continue chatting here or close this window - we'll notify you when an agent responds.",
            created_at: new Date().toISOString(),
          };
          setMessages(prev => [...prev, transferMessage]);
        }
        setTransferring(false);
      }, 2000);
    }

    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const transferToAgent = async () => {
    if (!conversationId) return;
    
    setTransferring(true);
    
    // Create live chat session
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
        content: "✅ You've been added to the support queue. An agent will be with you shortly!",
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, transferMessage]);
      toast.success("Connected to support queue");
    }
    
    setTransferring(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          if (!conversationId) startConversation();
        }}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-gradient-to-br from-primary to-pink-500 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <Bot className="w-7 h-7" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 w-80 h-[450px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-pink-500 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">AI Assistant</p>
            <p className="text-xs text-white/80">Online • Instant replies</p>
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
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Transfer button */}
      <div className="px-4 py-2 border-t border-border">
        <button
          onClick={transferToAgent}
          disabled={transferring}
          className="w-full text-sm text-primary hover:underline flex items-center justify-center gap-1"
        >
          {transferring ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              Talk to a human agent
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
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
