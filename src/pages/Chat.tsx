import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useContentModeration } from "@/hooks/useContentModeration";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MoreVertical, Languages, Loader2, Video, Phone, Check, CheckCheck, Calendar, AlertTriangle, Gift, Clock } from "lucide-react";
import { format } from "date-fns";
import { LanguageSelector } from "@/components/LanguageSelector";
import { TypingIndicator } from "@/components/TypingIndicator";
import { CallScheduleModal } from "@/components/CallScheduleModal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GiftModal } from "@/components/GiftModal";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  read_at?: string;
  translatedContent?: string;
  isTranslating?: boolean;
  /** Optimistic message not yet confirmed by the server. */
  pending?: boolean;
}

const HISTORY_LIMIT = 200;

/** Insert or merge a message, replacing my matching optimistic copy. */
function upsertMessage(list: Message[], incoming: Message): Message[] {
  if (list.some((m) => m.id === incoming.id)) {
    return list.map((m) => (m.id === incoming.id ? { ...m, ...incoming, translatedContent: m.translatedContent } : m));
  }
  const pendingIdx = list.findIndex((m) => m.pending && m.sender_id === incoming.sender_id && m.content === incoming.content);
  if (pendingIdx !== -1) {
    const next = [...list];
    next[pendingIdx] = { ...incoming };
    return next;
  }
  return [...list, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at));
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCountRef = useRef(0);
  const translateRef = useRef({ on: true, lang: "en" });
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { checkContent, reportViolation, checkUserBanStatus } = useContentModeration();

  useEffect(() => {
    if (matchId && profile) {
      fetchMatchDetails();
      fetchMessages();
      checkBanStatus();
    }
    // Load once per conversation, not on every profile refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, profile?.id]);

  translateRef.current = { on: translationsEnabled && autoTranslate, lang: language.code };

  // Scroll only when a message is added (not when one is translated or read),
  // and only if the reader is already near the bottom or it's my own message.
  useEffect(() => {
    const added = messages.length > prevCountRef.current;
    const first = prevCountRef.current === 0;
    prevCountRef.current = messages.length;
    if (!added) return;
    const last = messages[messages.length - 1];
    const scroller = document.scrollingElement;
    const nearBottom = !scroller || scroller.scrollHeight - scroller.scrollTop - window.innerHeight < 240;
    if (first || nearBottom || last?.sender_id === profile?.id) {
      messagesEndRef.current?.scrollIntoView({ behavior: first ? "auto" : "smooth" });
    }
  }, [messages, profile?.id]);

  // Translate messages when language changes
  useEffect(() => {
    if (translationsEnabled && autoTranslate && messages.length > 0) {
      translateAllMessages();
    }
  }, [language.code, translationsEnabled, autoTranslate]);

  // Live conversation: new messages, read receipts and typing (broadcast).
  useEffect(() => {
    if (!matchId || !profile?.id) return;
    const myId = profile.id;

    const channel = supabase
      .channel(`chat-${matchId}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "isexy", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const incoming = payload.new as Message;
          // Show immediately; translate afterwards.
          setMessages((prev) => upsertMessage(prev, incoming));
          if (incoming.sender_id !== myId) {
            setOtherIsTyping(false);
            markAsRead(incoming.id);
            if (translateRef.current.on) translateInto(incoming);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "isexy", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => setMessages((prev) => upsertMessage(prev, payload.new as Message)),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.profileId === myId) return;
        setOtherIsTyping(true);
        if (typingHideRef.current) clearTimeout(typingHideRef.current);
        typingHideRef.current = setTimeout(() => setOtherIsTyping(false), 3500);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      if (typingHideRef.current) clearTimeout(typingHideRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, profile?.id]);

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

    const { data: latest, error } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const data = (latest || []).reverse();

    if (error) {
      console.error("Error fetching messages:", error);
      toast.error("Couldn't load this conversation. Pull to refresh or try again.");
    } else {
      setMessages((prev) => {
        // Keep anything that arrived over realtime while history was loading.
        let merged: Message[] = data;
        for (const m of prev) merged = upsertMessage(merged, m);
        return merged;
      });
      if (translateRef.current.on) translateAllMessages(data);
      
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
      const response = await supabase.functions.invoke("isexy-translate-message", {
        body: { text, targetLanguage: translateRef.current.lang }
      });

      if (response.error) throw response.error;
      return response.data?.translatedText || null;
    } catch (error) {
      console.error("Translation error:", error);
      return null;
    }
  };

  const translateInto = async (msg: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isTranslating: true } : m)));
    const translated = await translateMessage(msg.content);
    setMessages((prev) => prev.map((m) =>
      m.id === msg.id ? { ...m, translatedContent: translated && translated !== m.content ? translated : undefined, isTranslating: false } : m,
    ));
  };

  /** Translate the other person's messages, 4 at a time, newest first. */
  const translateAllMessages = async (source: Message[] = messages) => {
    const todo = source.filter((m) => m.sender_id !== profile?.id && !m.translatedContent).reverse();
    for (let i = 0; i < todo.length; i += 4) {
      await Promise.all(todo.slice(i, i + 4).map(translateInto));
    }
  };

  const markAsRead = async (messageId: string) => {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", messageId);
  };

  const sendTypingIndicator = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { profileId: profile?.id } });
  }, [profile?.id]);

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
    if (!newMessage.trim() || !profile || !matchId || isBanned) return;

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

    const content = newMessage.trim();
    setNewMessage("");
    setIsTyping(false);

    // Optimistic: show the message instantly, confirm (or roll back) after.
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMessages((prev) => [...prev, {
      id: tempId, content, sender_id: profile.id, created_at: new Date().toISOString(), is_read: false, pending: true,
    }]);

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: profile.id, content })
      .select()
      .single();

    if (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage((current) => current || content);
      const msg = error.message || "";
      if (msg.includes("blocked")) {
        toast.error("You can't message this user.");
      } else if (msg.includes("no longer active") || msg.includes("not part") || msg.includes("Match not found")) {
        toast.error("This conversation is no longer available.");
        navigate("/matches");
      } else {
        toast.error("Failed to send message. Please try again.");
      }
    } else {
      if (inserted) {
        setMessages((prev) => {
          const withoutTemp = prev.some((m) => m.id === inserted.id) ? prev.filter((m) => m.id !== tempId) : prev;
          return upsertMessage(withoutTemp, inserted as Message);
        });
      }
      track("message_sent", { surface: "chat" });
      await supabase
        .from("matches")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", matchId);

      // Email the other member (server resolves the recipient; throttled per conversation).
      supabase.functions
        .invoke("isexy-send-notification-email", {
          body: { type: "new_message", matchId, data: { messagePreview: content.slice(0, 80) } },
        })
        .catch(() => undefined);
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
    navigate(`/video-call/${matchId}?type=video`);
  };

  const handlePhoneCall = () => {
    navigate(`/video-call/${matchId}?type=phone`);
  };

  const renderReadReceipt = (message: Message) => {
    if (message.sender_id !== profile?.id) return null;
    if (message.pending) return <Clock className="w-3.5 h-3.5 text-muted-foreground" aria-label="Sending" />;
    
    if (message.read_at || message.is_read) {
      return <CheckCheck className="w-4 h-4 text-primary" />;
    }
    return <Check className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <button
          onClick={() => navigate("/matches")}
          className="p-2 rounded-full hover:bg-muted/60 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        {otherProfile && (
          <div className="flex items-center gap-2.5 flex-1 min-w-0 px-1 py-1 text-left">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary/30 flex-shrink-0">
              {otherProfile.photo_url ? (
                <img
                  src={otherProfile.photo_url}
                  alt={otherProfile.first_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center">
                  <span className="font-bold text-muted-foreground">
                    {otherProfile.first_name[0]}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="font-bold text-foreground block truncate">{otherProfile.first_name}</span>
              {otherIsTyping && <span className="block text-xs text-primary whitespace-nowrap">typing…</span>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePhoneCall}
            className="text-foreground hover:text-primary h-9 w-9"
            aria-label="Phone call"
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleVideoCall}
            className="text-foreground hover:text-primary h-9 w-9"
            aria-label="Video call"
          >
            <Video className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowGiftModal(true)}
            className="text-foreground hover:text-primary h-9 w-9"
            aria-label="Send gift"
          >
            <Gift className="w-5 h-5" />
          </Button>
          <LanguageSelector variant="icon" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground hover:text-primary h-9 w-9" aria-label="More options">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setShowScheduleModal(true)}>
                <Calendar className="w-4 h-4 mr-2" /> Schedule a call
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTranslations}>
                <Languages className="w-4 h-4 mr-2" /> {translationsEnabled ? "Turn translation off" : "Turn translation on"}
              </DropdownMenuItem>
              {otherProfile && (
                <DropdownMenuItem onClick={() => navigate(`/block-report/${otherProfile.id}`)} className="text-destructive focus:text-destructive">
                  <AlertTriangle className="w-4 h-4 mr-2" /> Block or report
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Translation indicator */}
      {translationsEnabled && (
        <div className="px-4 py-1.5 bg-primary/10 text-primary text-xs text-center">
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
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
              <span className="text-3xl">👋</span>
            </div>
            <h3 className="font-bold text-foreground mb-1">You matched!</h3>
            <p className="text-sm text-muted-foreground">
              Say hi to {otherProfile?.first_name} — break the ice.
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
      <footer className="sticky bottom-0 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={isBanned ? "Messaging restricted…" : `Message ${otherProfile?.first_name ?? ""}…`}
            disabled={isBanned}
            className="flex-1 px-5 py-3 bg-muted/60 border border-border/60 rounded-full outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder:text-muted-foreground disabled:opacity-50 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending || isBanned}
            className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-primary to-secondary text-primary-foreground rounded-full shadow-lg shadow-primary/30 disabled:opacity-40 disabled:shadow-none enabled:active:scale-95 transition-all"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Your phone number stays private. Be kind. Report anything off.
        </p>
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
