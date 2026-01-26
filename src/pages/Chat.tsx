import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MoreVertical, Languages, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchId && profile) {
      fetchMatchDetails();
      fetchMessages();
    }
  }, [matchId, profile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Translate messages when language changes or messages are fetched
  useEffect(() => {
    if (translationsEnabled && autoTranslate && messages.length > 0) {
      translateAllMessages();
    }
  }, [language.code, translationsEnabled, autoTranslate]);

  // Subscribe to new messages
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
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
          
          // If translation is enabled and it's not our message, translate it
          if (translationsEnabled && autoTranslate && newMsg.sender_id !== profile?.id) {
            const translatedContent = await translateMessage(newMsg.content);
            newMsg.translatedContent = translatedContent;
          }
          
          setMessages((prev) => [...prev, newMsg]);
          
          // Mark as read if we're the recipient
          if (newMsg.sender_id !== profile?.id) {
            markAsRead(newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
        profile1:profiles!matches_profile1_id_fkey(id, first_name),
        profile2:profiles!matches_profile2_id_fkey(id, first_name)
      `)
      .eq("id", matchId)
      .single();

    if (error || !match) {
      console.error("Error fetching match:", error);
      return;
    }

    const other = (match.profile1 as any).id === profile.id 
      ? match.profile2 
      : match.profile1;

    // Get photo
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
      
      // Mark unread messages as read
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
    // Only translate messages from the other person
    const messagesToTranslate = messages.filter(
      m => m.sender_id !== profile?.id && !m.translatedContent
    );

    if (messagesToTranslate.length === 0) return;

    // Mark messages as translating
    setMessages(prev => prev.map(m => 
      messagesToTranslate.find(mt => mt.id === m.id) 
        ? { ...m, isTranslating: true }
        : m
    ));

    // Translate each message
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

  const handleSend = async () => {
    if (!newMessage.trim() || !profile || !matchId || sending) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: profile.id,
      content,
    });

    if (error) {
      console.error("Error sending message:", error);
      setNewMessage(content);
    } else {
      // Update last_message_at on match
      await supabase
        .from("matches")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", matchId);
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
    setTranslationsEnabled(!translationsEnabled);
    if (!translationsEnabled) {
      translateAllMessages();
    }
    toast.success(translationsEnabled ? "Translations disabled" : "Translations enabled");
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
            <span className="font-bold text-foreground">{otherProfile.first_name}</span>
          </div>
        )}

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
                  {/* Original message */}
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  
                  {/* Translated message */}
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
                  
                  <p
                    className={`text-xs mt-1 ${
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(message.created_at), "h:mm a")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-muted rounded-full outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="w-12 h-12 flex items-center justify-center bg-primary text-primary-foreground rounded-full disabled:opacity-50 transition-opacity"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
