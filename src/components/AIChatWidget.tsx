import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User, ArrowRight, HelpCircle } from "lucide-react";
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

// Comprehensive knowledge base responses
const knowledgeResponses: Record<string, string> = {
  "premium": "CubaDate offers three subscription tiers:\n\n**Plus** - $9.99/week:\n• Unlimited Likes & Rewinds\n• Passport Mode\n• Hide Ads\n\n**Gold** - $14.99/week:\n• All Plus features\n• See Who Likes You\n• 1 Free Boost/month\n• 5 Super Likes/week\n\n**Platinum** - $19.99/week:\n• All Gold features\n• Priority Likes\n• Unlimited Super Likes\n• Message before matching\n\nWould you like help subscribing?",
  "subscription": "To manage your subscription:\n1. Go to Settings\n2. Tap 'My Subscription'\n3. Choose your plan or modify existing one\n\nYou can cancel anytime and your benefits continue until the end of the billing period.\n\nFor refunds, contact support within 14 days of purchase.",
  "billing": "**Billing & Payments**\n\nWe accept:\n• Credit/Debit cards\n• Apple Pay / Google Pay\n\n**Subscription Plans:**\n• Plus: $9.99/week\n• Gold: $14.99/week  \n• Platinum: $19.99/week\n\n**Credits for Video Calls:**\n• 100 credits - $9.99\n• 500 credits - $39.99\n• 1000 credits - $69.99\n\nRefunds available within 14 days.",
  "credits": "**Credits System**\n\nCredits are used for video calls at $1/minute.\n\n**How to get credits:**\n• Purchase in Buy Credits section\n• Refer friends (10 credits each)\n• Loyalty rewards program\n\n**Credit Packages:**\n• 100 credits - $9.99\n• 500 credits - $39.99\n• 1000 credits - $69.99\n\nCredits never expire!",
  "video": "**Video Calls**\n\nVideo calls cost 1 credit per minute.\n\n**To start a video call:**\n1. Open a chat with your match\n2. Tap the video icon in the header\n3. Both users need credits to participate\n\n**Tips:**\n• Ensure stable internet connection\n• Good lighting helps!\n• Credits are deducted per minute\n\nPremium subscribers get priority connections.",
  "match": "**Getting More Matches**\n\nTips to increase your matches:\n\n1. **Add 4+ photos** - 70% more matches\n2. **Write a bio** - 25% more matches\n3. **Get verified** - Builds trust\n4. **Be active daily** - Higher visibility\n5. **Use Super Likes** - 3x higher match rate\n6. **Complete your profile** - More prompts = more conversations\n\nComplete your profile to stand out!",
  "block": "**Blocking Someone**\n\nTo block a user:\n1. Go to their profile\n2. Tap the menu (three dots)\n3. Select 'Block'\n\nBlocked users:\n• Can't see your profile\n• Can't contact you\n• Won't appear in your stack\n\nYou can unblock anytime in Settings > Blocked Users.",
  "report": "**Reporting Users**\n\nTo report inappropriate behavior:\n1. Go to the user's profile\n2. Tap the menu (three dots)\n3. Select 'Report'\n4. Choose a reason\n5. Add details (optional)\n\nOur safety team reviews all reports within 24 hours.\n\nYou can also block them simultaneously for immediate protection.",
  "safety": "**Safety Features**\n\n• **Photo Verification** - Verify your identity\n• **Block & Report** - Protect yourself\n• **Hide Profile** - Control visibility\n• **Block Contacts** - Hide from people you know\n\n**Safety Tips:**\n• Never share financial info\n• Meet in public places first\n• Tell a friend about dates\n• Trust your instincts\n\nReport any suspicious behavior!",
  "delete": "**Delete Account**\n\nTo delete your account:\n1. Go to Settings\n2. Scroll to 'Delete Account'\n3. Confirm your decision\n\n⚠️ **Warning:** This action is permanent!\n• All matches are lost\n• Messages are deleted\n• Subscription is cancelled\n• Credits are forfeited\n\nConsider pausing instead if you need a break.",
  "photo": "**Photo Requirements**\n\n✅ Required:\n• Clear photos showing your face\n• At least 2 photos\n• Recent photos\n\n❌ Not allowed:\n• Group photos as main\n• Explicit content\n• Celebrities/others\n• Heavy filters\n\n💡 **Tip:** Profiles with 4+ photos get 70% more matches!",
  "verify": "**Photo Verification**\n\nGet the blue checkmark:\n\n1. Go to Settings > Photo Verification\n2. Take a selfie matching the pose shown\n3. Our team verifies within 24 hours\n4. Get your verification badge!\n\n**Benefits:**\n• Blue checkmark on profile\n• 30% more matches\n• Higher trust from others\n• Priority in stacks",
  "password": "**Password & Login**\n\nForgot your password?\n1. Tap 'Forgot Password' on login\n2. Enter your email\n3. Check inbox for reset link\n4. Create new password\n\n**Troubleshooting:**\n• Check spam folder\n• Wait a few minutes\n• Try different email\n• Contact support if stuck",
  "privacy": "**Privacy Settings**\n\nControl your privacy:\n\n1. **Web Profile** - Toggle public visibility\n2. **Active Status** - Hide online status\n3. **Block Contacts** - Hide from phone contacts\n4. **Read Receipts** - Premium feature\n5. **Location** - Control sharing\n\nFind all options in Settings > Privacy.\n\nYour exact location is never shared!",
  "refund": "**Refund Policy**\n\nRefund eligibility:\n• Available within 14 days of purchase\n• Unused credits are refundable\n• Pro-rated for subscriptions\n\n**To request a refund:**\n1. Contact support\n2. Provide order details\n3. State reason\n\nProcessing time: 5-10 business days\n\nNote: Features used cannot be refunded.",
  "account": "**Account Management**\n\n• **Edit Profile** - Update photos, bio, interests\n• **Settings** - Privacy, notifications, preferences\n• **Subscription** - Manage your plan\n• **Delete Account** - Permanently remove\n\n**Account Recovery:**\n• Use forgot password\n• Check spam folder\n• Contact support with ID",
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

const defaultResponse = "I'm here to help! I can answer questions about:\n\n• 💳 **Billing** - Subscriptions & payments\n• 🪙 **Credits** - Video call credits\n• 🔒 **Privacy** - Control your visibility\n• 🛡️ **Safety** - Report & block users\n• 💕 **Matches** - Get more matches\n• ✓ **Verification** - Verify your profile\n\nClick a topic above or type your question!";

export function AIChatWidget() {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [transferring, setTransferring] = useState(false);
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
      content: "👋 Hi! I'm CubaDate's AI assistant.\n\nI can help you with subscriptions, credits, matching, privacy, and more.\n\n**Quick Topics:**",
      created_at: new Date().toISOString(),
    };

    setMessages([welcomeMessage]);

    await supabase.from("chatbot_messages").insert({
      conversation_id: data.id,
      role: "assistant",
      content: welcomeMessage.content,
    });

    setConnecting(false);
  };

  const handleQuickQuestion = async (question: QuickQuestion) => {
    setShowQuickQuestions(false);
    setNewMessage(question.query);
    
    // Simulate sending the message
    const userContent = question.query;
    setNewMessage("");
    setLoading(true);

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: userContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    if (conversationId) {
      await supabase.from("chatbot_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userContent,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    const aiContent = findBestResponse(userContent) || defaultResponse;

    const aiMessage: Message = {
      id: `ai_${Date.now()}`,
      role: "assistant",
      content: aiContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, aiMessage]);

    if (conversationId) {
      await supabase.from("chatbot_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: aiContent,
      });
    }

    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    setShowQuickQuestions(false);
    const userContent = newMessage.trim();
    setNewMessage("");
    setLoading(true);

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: userContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    await supabase.from("chatbot_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userContent,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    let aiContent = findBestResponse(userContent);
    
    if (!aiContent) {
      if (userContent.toLowerCase().includes("agent") || 
          userContent.toLowerCase().includes("human") ||
          userContent.toLowerCase().includes("person") ||
          userContent.toLowerCase().includes("support") ||
          userContent.toLowerCase().includes("talk to")) {
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

    await supabase.from("chatbot_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: aiContent,
    });

    if (transferring) {
      setTimeout(async () => {
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

  // Closed state - positioned above bottom nav
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
            
            {/* Quick Questions - shown after welcome message */}
            {showQuickQuestions && messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {quickQuestions.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => handleQuickQuestion(q)}
                    className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-full text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors"
                  >
                    <span>{q.icon}</span>
                    {q.label}
                  </button>
                ))}
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
      <div className="p-3 border-t border-border flex gap-2 flex-shrink-0">
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
