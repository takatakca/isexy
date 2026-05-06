import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useContentModeration } from "@/hooks/useContentModeration";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MoreVertical, Languages, Loader2, Video, Check, CheckCheck, Calendar, AlertTriangle, Gift } from "lucide-react";
import { format } from "date-fns";
import { LanguageSelector } from "@/components/LanguageSelector";
import { TypingIndicator } from "@/components/TypingIndicator";
import { CallScheduleModal } from "@/components/CallScheduleModal";
import { Button } from "@/components/ui/button";
import { GiftModal } from "@/components/GiftModal";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  read_at?: string;
  translatedContent?: string;
  isTranslating?: boolean;
}

interface OtherProfile {
  id: string;
  first_name: string;
  photo_url?: string;
}

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { language, autoTranslate } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherProfile, setOtherProfile] = useState<OtherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [translationsEnabled, setTranslationsEnabled] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banMessage, setBanMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { checkContent, reportViolation, checkUserBanStatus } = useContentModeration();

  useEffect(() => {
    if (matchId && profile) {
      fetchMatchDetails();
      fetchMessages();
      checkBanStatus();
    }
  }, [matchId, profile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Translate messages when language changes
  useEffect(() => {
    if (translationsEnabled && autoTranslate && messages.length > 0) {
      translateAllMessages();
    }
  }, [language.code, translationsEnabled, autoTranslate]);

  // Subscribe to new messages and typing indicators
  useEffect(() => {
    if (!matchId || !profile) return;

    // Messages channel
    const messagesChannel = supabase
      .channel(`messages-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          if (translationsEnabled && autoTranslate && newMsg.sender_id !== profile?.id) {
            const translatedContent = await translateMessage(newMsg.content);
            newMsg.translatedContent = translatedContent;
          }
          
          setMessages((prev) => [...prev, newMsg]);
          
          if (newMsg.sender_id !== profile?.id) {
            markAsRead(newMsg.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          );
        }
      )
      .subscribe();

    // Typing indicator channel
    const typingChannel = supabase
      .channel(`typing-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const match = payload.new as any;
          if (match.typing_user_id && match.typing_user_id !== profile?.id) {
            const typingTime = new Date(match.typing_at).getTime();
            const now = Date.now();
            if (now - typingTime < 5000) {
              setOtherIsTyping(true);
              setTimeout(() => setOtherIsTyping(false), 3000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [matchId, profile, translationsEnabled, autoTranslate, language.code]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMatchDetails = async () => {
    if (!profile || !matchId) return;

    const { data: match, error } = await supabase
      .from("matches")
      .select(`
        is_active,
        profile1:profiles!matches_profile1_id_fkey(id, first_name),
        profile2:profiles!matches_profile2_id_fkey(id, first_name)
      `)
      .eq("id", matchId)
      .maybeSingle();

    if (error || !match) {
      toast.error("Conversation not found");
      navigate("/matches");
      return;
    }

    const p1 = match.profile1 as any;
    const p2 = match.profile2 as any;

    // Only matched participants may view this chat
    if (p1.id !== profile.id && p2.id !== profile.id) {
      toast.error("You don't have access to this conversation");
      navigate("/matches");
      return;
    }

    if (match.is_active === false) {
      toast.error("This match is no longer active");
      navigate("/matches");
      return;
    }

    const other = p1.id === profile.id ? p2 : p1;

    // Check for blocks between the two users
    const { data: blockRow } = await supabase
      .from("blocks")
      .select("id")
      .or(
        `and(blocker_id.eq.${profile.id},blocked_id.eq.${other.id}),` +
        `and(blocker_id.eq.${other.id},blocked_id.eq.${profile.id})`
      )
      .limit(1)
      .maybeSingle();

    if (blockRow) {
      toast.error("Messaging is unavailable with this user");
      navigate("/matches");
      return;
    }

    const { data: photos } = await supabase
      .from("profile_photos")
      .select("photo_url")
      .eq("profile_id", (other as any).id)
      .order("position")
      .limit(1);

    setOtherProfile({
      id: (other as any).id,
      first_name: (other as any).first_name,
      photo_url: photos?.[0]?.photo_url,
    });
  };

  const fetchMessages = async () => {
    if (!matchId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
    } else {
      setMessages(data || []);
      
      const unreadIds = (data || [])
        .filter((m) => !m.is_read && m.sender_id !== profile?.id)
        .map((m) => m.id);
      
      if (unreadIds.length > 0) {
        await supabase
          .from("messages")
          .update({ is_read: true })
          .in("id", unreadIds);
      }
    }
    setLoading(false);
  };

  const translateMessage = async (text: string): Promise<string | null> => {
    try {
      const response = await supabase.functions.invoke("translate-message", {
        body: { text, targetLanguage: language.code }
      });

      if (response.error) throw response.error;
      return response.data?.translatedText || null;
    } catch (error) {
      console.error("Translation error:", error);
      return null;
    }
  };

  const translateAllMessages = async () => {
    const messagesToTranslate = messages.filter(
      m => m.sender_id !== profile?.id && !m.translatedContent
    );

    if (messagesToTranslate.length === 0) return;

    setMessages(prev => prev.map(m => 
      messagesToTranslate.find(mt => mt.id === m.id) 
        ? { ...m, isTranslating: true }
        : m
    ));

    for (const msg of messagesToTranslate) {
      const translated = await translateMessage(msg.content);
      setMessages(prev => prev.map(m => 
        m.id === msg.id 
          ? { ...m, translatedContent: translated || undefined, isTranslating: false }
          : m
      ));
    }
  };

  const markAsRead = async (messageId: string) => {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", messageId);
  };

  const sendTypingIndicator = useCallback(async () => {
    // Typing indicators use real-time broadcast instead of database updates
    // This is a UI-only feature using local state
  }, [matchId, profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  const checkBanStatus = async () => {
    if (!profile?.id) return;
    
    const status = await checkUserBanStatus(profile.id);
    if (status.isBanned) {
      setIsBanned(true);
      if (status.isPermanent) {
        setBanMessage("Your account is permanently banned for violating community guidelines.");
      } else if (status.banUntil) {
        setBanMessage(`Messaging restricted until ${format(status.banUntil, "MMM d 'at' h:mm a")}`);
      }
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !profile || !matchId || sending || isBanned) return;

    // Check content for personal information
    const modResult = checkContent(newMessage);
    
    if (!modResult.isClean) {
      // Report violation and potentially ban user
      await reportViolation(profile.id, null, modResult.violations);
      
      // Refresh ban status
      await checkBanStatus();
      
      // Show warning but don't send message
      toast.error("⚠️ Your message contains personal information which is not allowed. Please remove phone numbers, emails, or addresses.");
      return;
    }

    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");
    setIsTyping(false);

    const { error } = await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: profile.id,
      content,
    });

    if (error) {
      console.error("Error sending message:", error);
      setNewMessage(content);
    } else {
      await supabase
        .from("matches")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", matchId);

      // Send email notification to the recipient
      if (otherProfile) {
        try {
          // Get recipient's email through their profile
          const { data: otherUser } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("id", otherProfile.id)
            .single();

          if (otherUser?.user_id) {
            await supabase.functions.invoke("send-notification-email", {
              body: {
                email: otherUser.user_id, // Will be resolved in the edge function
                type: "new_message",
                data: {
                  senderName: profile.first_name,
                  messagePreview: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
                  firstName: otherProfile.first_name,
                },
              },
            });
          }
        } catch (err) {
          console.error("Failed to send message notification:", err);
        }
      }
    }

    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleTranslations = () => {
    const newValue = !translationsEnabled;
    setTranslationsEnabled(newValue);
    if (newValue) {
      translateAllMessages();
    } else {
      // Clear translations when disabled
      setMessages(prev => prev.map(m => ({ ...m, translatedContent: undefined })));
    }
    toast.success(newValue ? "Translations enabled" : "Translations disabled");
  };

  const handleVideoCall = () => {
    if (!profile?.is_premium && profile?.subscription_tier !== "gold" && profile?.subscription_tier !== "platinum") {
      toast.error("Video calling requires a premium subscription");
      navigate("/premium");
      return;
    }
    navigate(`/video-call/${matchId}`);
  };

  const renderReadReceipt = (message: Message) => {
    if (message.sender_id !== profile?.id) return null;
    
    if (message.read_at || message.is_read) {
      return <CheckCheck className="w-4 h-4 text-primary" />;
    }
    return <Check className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate("/matches")} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        
        {otherProfile && (
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full overflow-hidden">
              {otherProfile.photo_url ? (
                <img
                  src={otherProfile.photo_url}
                  alt={otherProfile.first_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="font-bold text-muted-foreground">
                    {otherProfile.first_name[0]}
                  </span>
                </div>
              )}
            </div>
            <div>
              <span className="font-bold text-foreground block">{otherProfile.first_name}</span>
              {otherIsTyping && (
                <span className="text-xs text-primary">typing...</span>
              )}
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowGiftModal(true)}
          className="text-yellow-500"
        >
          <Gift className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowScheduleModal(true)}
          className="text-muted-foreground"
        >
          <Calendar className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleVideoCall}
          className="text-primary"
        >
          <Video className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTranslations}
          className={translationsEnabled ? "text-primary" : "text-muted-foreground"}
        >
          <Languages className="w-5 h-5" />
        </Button>

        <LanguageSelector variant="icon" />

        <button className="p-2 -mr-2">
          <MoreVertical className="w-5 h-5 text-muted-foreground" />
        </button>
      </header>

      {/* Translation indicator */}
      {translationsEnabled && (
        <div className="px-4 py-2 bg-primary/10 text-primary text-xs text-center">
          Auto-translating to {language.flag} {language.nativeName}
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Say hi to {otherProfile?.first_name}! 👋
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isMe = message.sender_id === profile?.id;
            const showTranslation = !isMe && translationsEnabled && message.translatedContent;
            
            return (
              <div
                key={message.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  
                  {message.isTranslating && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-foreground/10">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs opacity-70">Translating...</span>
                    </div>
                  )}
                  
                  {showTranslation && (
                    <div className="mt-2 pt-2 border-t border-foreground/10">
                      <p className="text-sm italic opacity-80">{message.translatedContent}</p>
                    </div>
                  )}
                  
                  <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : ""}`}>
                    <p
                      className={`text-xs ${
                        isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {format(new Date(message.created_at), "h:mm a")}
                    </p>
                    {renderReadReceipt(message)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing indicator at bottom */}
        {otherIsTyping && otherProfile && (
          <div className="flex justify-start">
            <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-md">
              <TypingIndicator name={otherProfile.first_name} />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </main>

      {/* Ban warning */}
      {isBanned && (
        <div className="px-4 py-3 bg-destructive/10 border-t border-destructive/30 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <p className="text-sm text-destructive">{banMessage}</p>
        </div>
      )}

      {/* Input */}
      <footer className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={isBanned ? "Messaging restricted..." : "Type a message..."}
            disabled={isBanned}
            className="flex-1 px-4 py-3 bg-muted rounded-full outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending || isBanned}
            className="w-12 h-12 flex items-center justify-center bg-primary text-primary-foreground rounded-full disabled:opacity-50 transition-opacity"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {/* Schedule Call Modal */}
      {otherProfile && profile && (
        <CallScheduleModal
          open={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          matchId={matchId!}
          recipientId={otherProfile.id}
          recipientName={otherProfile.first_name}
          currentUserId={profile.id}
        />
      )}

      {/* Gift Modal */}
      {otherProfile && (
        <GiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          recipientId={otherProfile.id}
          recipientName={otherProfile.first_name}
        />
      )}
    </div>
  );
}
