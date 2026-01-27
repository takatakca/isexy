import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GroupMember {
  profile_id: string;
  profile: {
    first_name: string;
    photo_url?: string;
  };
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    first_name: string;
    photo_url?: string;
  };
}

export default function GroupChat() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState("Group Chat");
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupId || !profile?.id) return;
    
    fetchGroupData();
    fetchMessages();
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_chat_id=eq.${groupId}`,
        },
        async (payload) => {
          const { data: senderData } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", payload.new.sender_id)
            .single();
          
          const { data: photoData } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", payload.new.sender_id)
            .eq("position", 0)
            .maybeSingle();

          setMessages((prev) => [
            ...prev,
            {
              ...payload.new as Message,
              sender: {
                first_name: senderData?.first_name || "Unknown",
                photo_url: photoData?.photo_url,
              },
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, profile?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchGroupData = async () => {
    // Fetch group info
    const { data: group } = await supabase
      .from("group_chats")
      .select("name")
      .eq("id", groupId)
      .single();

    if (group?.name) setGroupName(group.name);

    // Fetch members
    const { data: membersData } = await supabase
      .from("group_chat_members")
      .select("profile_id")
      .eq("group_chat_id", groupId);

    if (membersData) {
      const membersWithProfiles = await Promise.all(
        membersData.map(async (m) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", m.profile_id)
            .single();

          const { data: photoData } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", m.profile_id)
            .eq("position", 0)
            .maybeSingle();

          return {
            profile_id: m.profile_id,
            profile: {
              first_name: profileData?.first_name || "Unknown",
              photo_url: photoData?.photo_url,
            },
          };
        })
      );
      setMembers(membersWithProfiles);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("group_messages")
      .select("*")
      .eq("group_chat_id", groupId)
      .order("created_at", { ascending: true });

    if (data) {
      const messagesWithSenders = await Promise.all(
        data.map(async (msg) => {
          const { data: senderData } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", msg.sender_id)
            .single();

          const { data: photoData } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", msg.sender_id)
            .eq("position", 0)
            .maybeSingle();

          return {
            ...msg,
            sender: {
              first_name: senderData?.first_name || "Unknown",
              photo_url: photoData?.photo_url,
            },
          };
        })
      );
      setMessages(messagesWithSenders);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !profile?.id || isSending) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from("group_messages").insert({
        group_chat_id: groupId,
        sender_id: profile.id,
        content: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage("");
    } catch (err) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          
          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-foreground">{groupName}</h1>
              <p className="text-xs text-muted-foreground">{members.length} members</p>
            </div>
          </div>

          <Button variant="ghost" size="icon">
            <Info className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Member Avatars */}
      <div className="px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          {members.slice(0, 4).map((member) => (
            <Avatar key={member.profile_id} className="w-8 h-8 border-2 border-background">
              <AvatarImage src={member.profile.photo_url} />
              <AvatarFallback className="text-xs">{member.profile.first_name?.charAt(0)}</AvatarFallback>
            </Avatar>
          ))}
          {members.length > 4 && (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">+{members.length - 4}</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender_id === profile?.id;
          
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
              {!isMe && (
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={msg.sender?.photo_url} />
                  <AvatarFallback>{msg.sender?.first_name?.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
              
              <div className={`max-w-[75%] ${isMe ? "order-first" : ""}`}>
                {!isMe && (
                  <p className="text-xs text-muted-foreground mb-1">{msg.sender?.first_name}</p>
                )}
                <div className={`rounded-2xl px-4 py-2 ${
                  isMe 
                    ? "bg-primary text-primary-foreground rounded-tr-md" 
                    : "bg-muted text-foreground rounded-tl-md"
                }`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
                <p className={`text-[10px] text-muted-foreground mt-1 ${isMe ? "text-right" : ""}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 safe-area-inset-bottom">
        <div className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 rounded-full"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isSending}
            size="icon"
            className="rounded-full shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
