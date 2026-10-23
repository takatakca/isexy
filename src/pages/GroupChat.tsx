import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Users, Info, X, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { fetchHiddenMemberIds } from "@/lib/blocks";

interface Person {
  first_name: string;
  photo_url?: string;
}

interface GroupMember {
  profile_id: string;
  profile: Person;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const HISTORY_LIMIT = 200;

/** Names and first photos for a set of profiles: two queries, whatever the group size. */
async function loadPeople(ids: string[]): Promise<Map<string, Person>> {
  const people = new Map<string, Person>();
  if (ids.length === 0) return people;
  const [profiles, photos] = await Promise.all([
    supabase.from("profiles").select("id, first_name").in("id", ids),
    supabase.from("profile_photos").select("profile_id, photo_url, position").in("profile_id", ids).order("position"),
  ]);
  const photoBy = new Map<string, string>();
  for (const ph of photos.data ?? []) if (!photoBy.has(ph.profile_id)) photoBy.set(ph.profile_id, ph.photo_url);
  for (const id of ids) {
    const p = (profiles.data ?? []).find((row) => row.id === id);
    people.set(id, { first_name: p?.first_name ?? "Member", photo_url: photoBy.get(id) });
  }
  return people;
}

export default function GroupChat() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const myId = profile?.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [groupName, setGroupName] = useState("Group chat");
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"unavailable" | "network" | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const peopleRef = useRef(people);
  peopleRef.current = people;
  /** Members blocked either way: their messages are not shown. */
  const hiddenRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!groupId || !myId) return;
    setLoadError(null);
    const [groupRes, membersRes, messagesRes, hidden] = await Promise.all([
      supabase.from("group_chats").select("name").eq("id", groupId).maybeSingle(),
      supabase.from("group_chat_members").select("profile_id").eq("group_chat_id", groupId),
      supabase
        .from("group_messages")
        .select("id, sender_id, content, created_at")
        .eq("group_chat_id", groupId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      fetchHiddenMemberIds(myId),
    ]);
    hiddenRef.current = hidden;

    if (groupRes.error || membersRes.error || messagesRes.error) {
      console.error("Group chat load failed:", groupRes.error ?? membersRes.error ?? messagesRes.error);
      setLoadError("network");
      setLoading(false);
      return;
    }
    // RLS hides groups the member is not part of.
    if (!groupRes.data || !(membersRes.data ?? []).some((m) => m.profile_id === myId)) {
      setLoadError("unavailable");
      setLoading(false);
      return;
    }

    const memberIds = (membersRes.data ?? []).map((m) => m.profile_id);
    const history = (messagesRes.data ?? []).reverse().filter((m) => !hidden.has(m.sender_id));
    const senderIds = [...new Set(history.map((m) => m.sender_id))];
    const map = await loadPeople([...new Set([...memberIds, ...senderIds])]);

    if (groupRes.data.name) setGroupName(groupRes.data.name);
    setPeople(map);
    setMembers(memberIds.map((id) => ({ profile_id: id, profile: map.get(id) ?? { first_name: "Member" } })));
    setMessages(history);
    setLoading(false);
  }, [groupId, myId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live messages (sender details from the member list, fetched only for strangers).
  useEffect(() => {
    if (!groupId || !myId) return;
    const channel = supabase
      .channel(`group-${groupId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "isexy", table: "group_messages", filter: `group_chat_id=eq.${groupId}` },
        async (payload) => {
          const incoming = payload.new as Message;
          if (hiddenRef.current.has(incoming.sender_id)) return;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (!peopleRef.current.has(incoming.sender_id)) {
            const extra = await loadPeople([incoming.sender_id]);
            setPeople((prev) => new Map([...prev, ...extra]));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, myId]);

  // Open at the newest message; follow new ones only when already at the bottom (or mine).
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const added = messages.length > prevCountRef.current;
    const first = prevCountRef.current === 0;
    prevCountRef.current = messages.length;
    if (!added) return;
    const last = messages[messages.length - 1];
    if (first) el.scrollTop = el.scrollHeight;
    else if (atBottomRef.current || last?.sender_id === myId) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, myId]);

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !myId || !groupId || isSending) return;

    setIsSending(true);
    const { data, error } = await supabase
      .from("group_messages")
      .insert({ group_chat_id: groupId, sender_id: myId, content })
      .select("id, sender_id, content, created_at")
      .single();
    setIsSending(false);

    if (error || !data) {
      console.error("Group message failed:", error);
      toast.error("Message not sent. Please try again.");
      return;
    }
    setNewMessage("");
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-background/85 backdrop-blur-xl border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-foreground truncate">{groupName}</h1>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading…" : `${members.length} ${members.length === 1 ? "member" : "members"}`}
              </p>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={() => setShowMembers(true)} disabled={loading || !!loadError} aria-label="Group members">
            <Info className="w-5 h-5" />
          </Button>
        </div>

        {members.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 pl-12">
            {members.slice(0, 6).map((member) => (
              <Avatar key={member.profile_id} className="w-7 h-7 border-2 border-background">
                <AvatarImage src={member.profile.photo_url} alt="" />
                <AvatarFallback className="text-xs">{member.profile.first_name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
            {members.length > 6 && <span className="text-xs text-muted-foreground">+{members.length - 6}</span>}
          </div>
        )}
      </header>

      {/* Messages */}
      <div
        ref={scrollerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        }}
        className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20" aria-busy="true">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : loadError === "unavailable" ? (
          <div className="text-center py-16 px-6">
            <p className="font-semibold text-foreground mb-1">This group chat isn't available</p>
            <p className="text-sm text-muted-foreground mb-4">It may have ended, or you're not a member.</p>
            <Button onClick={() => navigate("/matches")}>Back to chats</Button>
          </div>
        ) : loadError === "network" ? (
          <div className="text-center py-16 px-6">
            <p className="font-semibold text-foreground mb-1">Couldn't load this group chat</p>
            <p className="text-sm text-muted-foreground mb-4">Check your connection and try again.</p>
            <Button onClick={() => { setLoading(true); void load(); }}>
              <RefreshCw className="w-4 h-4 mr-2" /> Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="font-semibold text-foreground mb-1">No messages yet</p>
            <p className="text-sm text-muted-foreground">Say hi to the group.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === myId;
            const sender = people.get(msg.sender_id);

            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                {!isMe && (
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={sender?.photo_url} alt="" />
                    <AvatarFallback>{sender?.first_name?.charAt(0) ?? "?"}</AvatarFallback>
                  </Avatar>
                )}

                <div className="max-w-[75%]">
                  {!isMe && (
                    <p className="text-xs text-muted-foreground mb-1">{sender?.first_name ?? "Member"}</p>
                  )}
                  <div className={`rounded-2xl px-4 py-2 ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-md"
                      : "bg-muted text-foreground rounded-tl-md"
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</p>
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-1 ${isMe ? "text-right" : ""}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 bg-background border-t border-border px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the group…"
            aria-label="Message"
            maxLength={2000}
            disabled={loading || !!loadError}
            className="flex-1 px-5 py-3 bg-muted/60 border border-border/60 rounded-full outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground disabled:opacity-50"
          />
          <Button
            onClick={() => void sendMessage()}
            disabled={!newMessage.trim() || isSending || loading || !!loadError}
            size="icon"
            className="rounded-full shrink-0 w-12 h-12"
            aria-label="Send message"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Members sheet (z-[60]: above the bottom nav) */}
      {showMembers && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowMembers(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Group members"
            className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">{groupName}</h2>
              <button onClick={() => setShowMembers(false)} className="p-2 rounded-full hover:bg-muted" aria-label="Close">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <ul className="space-y-3">
              {members.map((m) => (
                <li key={m.profile_id} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={m.profile.photo_url} alt="" />
                    <AvatarFallback>{m.profile.first_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">{m.profile.first_name}{m.profile_id === myId ? " (you)" : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
