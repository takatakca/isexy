import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useContentModeration } from "@/hooks/useContentModeration";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MoreVertical, Languages, Loader2, Video, Phone, Check, CheckCheck, Calendar, AlertTriangle, AlertCircle, Gift, Clock, ChevronDown, RefreshCw } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
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
  is_read: boolean | null;
  translatedContent?: string;
  /** Language the translation above is in. */
  translatedLang?: string;
  isTranslating?: boolean;
  /** Optimistic message not yet confirmed by the server. */
  pending?: boolean;
  /** Send failed: shown with Retry / Delete. */
  failed?: boolean;
}

const MESSAGE_COLUMNS = "id, sender_id, content, is_read, created_at";
/** Messages per history page (newest first, then "load older" while scrolling up). */
const PAGE_SIZE = 50;
/** On open, translate at most this many of the newest uncached messages. */
const AUTO_TRANSLATE_LIMIT = 30;

/** Insert or merge a message, replacing my matching optimistic copy. */
function upsertMessage(list: Message[], incoming: Message): Message[] {
  if (list.some((m) => m.id === incoming.id)) {
    return list.map((m) => (m.id === incoming.id ? { ...m, ...incoming, translatedContent: m.translatedContent, translatedLang: m.translatedLang } : m));
  }
  const pendingIdx = list.findIndex((m) => m.pending && m.sender_id === incoming.sender_id && m.content === incoming.content);
  if (pendingIdx !== -1) {
    const next = [...list];
    next[pendingIdx] = { ...incoming };
    return next;
  }
  return [...list, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function sameText(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function dayLabel(iso: string, locale: string) {
  const d = new Date(iso);
  if (isToday(d)) return locale === "fr" ? "Aujourd'hui" : locale === "es" ? "Hoy" : "Today";
  if (isYesterday(d)) return locale === "fr" ? "Hier" : locale === "es" ? "Ayer" : "Yesterday";
  return d.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function timeLabel(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  } catch {
    return format(new Date(iso), "h:mm a");
  }
}

/** HTTP status of a failed supabase.functions.invoke(), when there is one. */
function invokeStatus(error: unknown): number | undefined {
  const context = (error as { context?: { status?: number } } | null)?.context;
  return typeof context?.status === "number" ? context.status : undefined;
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
  const [loadError, setLoadError] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [translationsEnabled, setTranslationsEnabled] = useState(true);
  const [translationDown, setTranslationDown] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [otherHere, setOtherHere] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banMessage, setBanMessage] = useState("");
  const scrollerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const messagesRef = useRef<Message[]>([]);
  const prevCountRef = useRef(0);
  const prevLastIdRef = useRef<string | undefined>(undefined);
  const atBottomRef = useRef(true);
  const prependAnchorRef = useRef<{ height: number; top: number } | null>(null);
  const loadingOlderRef = useRef(false);
  const otherVisibleHereRef = useRef(false);
  const markReadRef = useRef({ inFlight: false, again: false, disabled: false });
  const translateFailuresRef = useRef(0);
  const { checkContent, reportViolation, checkUserBanStatus } = useContentModeration();

  const myId = profile?.id;
  // Wanted = show translations; down = the service failed, so ask it for no new ones.
  const translationOn = translationsEnabled && autoTranslate;
  const translateRef = useRef({ on: translationOn, lang: language.code, down: translationDown });
  translateRef.current = { on: translationOn, lang: language.code, down: translationDown };
  messagesRef.current = messages;

  // ---- Read state ----------------------------------------------------------------
  // Only the server flips is_read (RPC mark_messages_read): never a direct UPDATE.
  const unreadFromOther = useMemo(
    () => messages.filter((m) => m.sender_id !== myId && !m.is_read && !m.pending).length,
    [messages, myId],
  );

  const markRead = useCallback(async () => {
    const state = markReadRef.current;
    if (!matchId || !myId || state.disabled || document.visibilityState !== "visible") return;
    if (state.inFlight) {
      state.again = true;
      return;
    }
    state.inFlight = true;
    const { error } = await supabase.rpc("mark_messages_read", { p_match_id: matchId });
    state.inFlight = false;
    if (error) {
      console.warn("mark_messages_read failed:", error.message);
      // Not deployed yet (or not allowed): stop retrying for this conversation.
      if (error.code === "PGRST202" || error.code === "42501") state.disabled = true;
      return;
    }
    setMessages((prev) => prev.map((m) => (m.sender_id !== myId && !m.is_read && !m.pending ? { ...m, is_read: true } : m)));
    if (state.again) {
      state.again = false;
      void markRead();
    }
  }, [matchId, myId]);

  useEffect(() => {
    if (!loading && unreadFromOther > 0) void markRead();
  }, [loading, unreadFromOther, markRead]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && messagesRef.current.some((m) => m.sender_id !== myId && !m.is_read && !m.pending)) {
        void markRead();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead, myId]);

  // ---- Translation ---------------------------------------------------------------
  const translateOne = useCallback(async (msg: Message, lang: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isTranslating: true } : m)));
    const { data, error } = await supabase.functions.invoke("isexy-translate-message", {
      body: { text: msg.content, targetLanguage: lang, messageId: msg.id },
    });
    let translated: string | undefined;
    if (error) {
      const status = invokeStatus(error);
      translateFailuresRef.current += 1;
      // Not configured / not deployed, or failing repeatedly: stop for this visit.
      if (status === 404 || status === 503 || translateFailuresRef.current >= 3) setTranslationDown(true);
    } else {
      translateFailuresRef.current = 0;
      translated = typeof data?.translatedText === "string" ? data.translatedText : undefined;
    }
    const stillWanted = translateRef.current.on && translateRef.current.lang === lang;
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msg.id) return m;
      if (!stillWanted || !translated) return { ...m, isTranslating: false };
      return { ...m, isTranslating: false, translatedLang: lang, translatedContent: sameText(translated, m.content) ? undefined : translated };
    }));
  }, []);

  /** Cached translations first (one query), then the edge function for the rest, 4 at a time. */
  const translateBatch = useCallback(async (source: Message[], lang: string, limit?: number) => {
    let todo = source.filter((m) => m.sender_id !== myId && !m.pending && !m.failed && m.translatedLang !== lang);
    if (todo.length === 0) return;

    const { data: cached } = await supabase
      .from("message_translations")
      .select("message_id, translated_content")
      .in("message_id", todo.map((m) => m.id))
      .eq("target_language", lang);
    const cache = new Map<string, string>();
    for (const row of cached ?? []) if (row.message_id) cache.set(row.message_id, row.translated_content);
    if (cache.size > 0 && translateRef.current.lang === lang) {
      setMessages((prev) => prev.map((m) => {
        const t = cache.get(m.id);
        return t === undefined ? m : { ...m, translatedLang: lang, translatedContent: sameText(t, m.content) ? undefined : t };
      }));
    }

    todo = todo.filter((m) => !cache.has(m.id)).reverse(); // newest first
    if (limit !== undefined) todo = todo.slice(0, limit);
    for (let i = 0; i < todo.length; i += 4) {
      if (!translateRef.current.on || translateRef.current.down || translateRef.current.lang !== lang) break;
      await Promise.all(todo.slice(i, i + 4).map((m) => translateOne(m, lang)));
    }
  }, [myId, translateOne]);

  // Translate on open, and again whenever the language or the toggle changes.
  useEffect(() => {
    if (loading) return;
    if (!translationOn) {
      setMessages((prev) => prev.map((m) => (m.translatedContent || m.translatedLang || m.isTranslating
        ? { ...m, translatedContent: undefined, translatedLang: undefined, isTranslating: false }
        : m)));
      return;
    }
    const lang = language.code;
    setMessages((prev) => prev.map((m) => (m.translatedLang && m.translatedLang !== lang
      ? { ...m, translatedContent: undefined, translatedLang: undefined }
      : m)));
    void translateBatch(messagesRef.current, lang, AUTO_TRANSLATE_LIMIT);
  }, [loading, translationOn, language.code, translateBatch]);

  // ---- Loading ---------------------------------------------------------------------
  const fetchMatchDetails = useCallback(async () => {
    if (!myId || !matchId) return;

    const { data: match, error } = await supabase
      .from("matches")
      .select("profile1_id, profile2_id, is_active")
      .eq("id", matchId)
      .maybeSingle();

    if (error || !match) {
      toast.error("Conversation not found");
      navigate("/matches");
      return;
    }
    // Only matched participants may view this chat
    if (match.profile1_id !== myId && match.profile2_id !== myId) {
      toast.error("You don't have access to this conversation");
      navigate("/matches");
      return;
    }
    if (match.is_active === false) {
      toast.error("This conversation is no longer active");
      navigate("/matches");
      return;
    }

    const otherId = match.profile1_id === myId ? match.profile2_id : match.profile1_id;
    const [blockRes, otherRes, photoRes] = await Promise.all([
      supabase
        .from("blocks")
        .select("id")
        .or(`and(blocker_id.eq.${myId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${myId})`)
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("id, first_name").eq("id", otherId).maybeSingle(),
      supabase.from("profile_photos").select("photo_url").eq("profile_id", otherId).order("position").limit(1),
    ]);

    if (blockRes.data) {
      toast.error("Messaging is unavailable with this member");
      navigate("/matches");
      return;
    }

    setOtherProfile({
      id: otherId,
      first_name: otherRes.data?.first_name ?? "Member",
      photo_url: photoRes.data?.[0]?.photo_url,
    });
  }, [matchId, myId, navigate]);

  const fetchMessages = useCallback(async () => {
    if (!matchId) return;
    setLoadError(false);
    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (error) {
      console.error("Error fetching messages:", error);
      setLoadError(true);
    } else {
      const page = data ?? [];
      setHasOlder(page.length > PAGE_SIZE);
      const rows: Message[] = page.slice(0, PAGE_SIZE).reverse();
      setMessages((prev) => {
        // Keep anything that arrived over realtime (or was sent) while history was loading.
        let merged = rows;
        for (const m of prev) merged = upsertMessage(merged, m);
        return merged;
      });
    }
    setLoading(false);
  }, [matchId]);

  const loadOlder = useCallback(async () => {
    if (!matchId || loadingOlderRef.current) return;
    const oldest = messagesRef.current.find((m) => !m.pending && !m.failed);
    if (!oldest) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("match_id", matchId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (error) {
      toast.error("Couldn't load earlier messages.");
    } else {
      const rows: Message[] = (data ?? []).slice(0, PAGE_SIZE).reverse();
      const el = scrollerRef.current;
      prependAnchorRef.current = el ? { height: el.scrollHeight, top: el.scrollTop } : null;
      setHasOlder((data ?? []).length > PAGE_SIZE);
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...rows.filter((r) => !known.has(r.id)), ...prev];
      });
      if (translateRef.current.on) void translateBatch(rows, translateRef.current.lang);
    }
    loadingOlderRef.current = false;
    setLoadingOlder(false);
  }, [matchId, translateBatch]);

  const checkBanStatus = useCallback(async () => {
    if (!myId) return;
    const status = await checkUserBanStatus(myId);
    if (status.isBanned) {
      setIsBanned(true);
      if (status.isPermanent) {
        setBanMessage("Your account is permanently banned for violating community guidelines.");
      } else if (status.banUntil) {
        setBanMessage(`Messaging restricted until ${format(status.banUntil, "MMM d 'at' h:mm a")}`);
      }
    }
    // checkUserBanStatus is recreated on every render by its hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  useEffect(() => {
    if (!matchId || !myId) return;
    // A different conversation: start clean.
    setMessages([]);
    setLoading(true);
    prevCountRef.current = 0;
    prevLastIdRef.current = undefined;
    markReadRef.current = { inFlight: false, again: false, disabled: false };
    void fetchMatchDetails();
    void fetchMessages();
    void checkBanStatus();
  }, [matchId, myId, fetchMatchDetails, fetchMessages, checkBanStatus]);

  // ---- Scrolling -------------------------------------------------------------------
  // Open at the newest message; keep the reader's place when older history is
  // prepended; follow new messages only when already at the bottom (or mine).
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const anchor = prependAnchorRef.current;
    if (anchor) {
      prependAnchorRef.current = null;
      el.scrollTop = el.scrollHeight - anchor.height + anchor.top;
    } else if (prevCountRef.current === 0 && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
    } else if (messages.length > prevCountRef.current && last && last.id !== prevLastIdRef.current) {
      if (atBottomRef.current || last.sender_id === myId) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else {
        setNewBelow((n) => n + 1);
      }
    } else if (atBottomRef.current) {
      // A translation or receipt made the thread taller: stay pinned to the newest message.
      el.scrollTop = el.scrollHeight;
    }
    prevCountRef.current = messages.length;
    prevLastIdRef.current = last?.id;
  }, [messages, myId]);

  // Keep the newest message in view when the keyboard opens or the typing bubble appears.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (otherIsTyping && el && atBottomRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [otherIsTyping]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (atBottomRef.current && newBelow > 0) setNewBelow(0);
    if (el.scrollTop < 200 && hasOlder && !loadingOlderRef.current && !loading) void loadOlder();
  };

  const scrollToBottom = () => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewBelow(0);
  };

  // ---- Live conversation: new messages, read receipts, typing and presence ----------
  useEffect(() => {
    if (!matchId || !myId) return;
    const topic = `chat-${matchId}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const trackPresence = () => {
      void channel?.track({ visible: document.visibilityState === "visible" }).catch(() => undefined);
    };

    const open = async () => {
      // Both members must share this topic (typing, presence). If a previous
      // visit's channel is still closing, supabase.channel() would hand it
      // back and the new listeners would die with it: wait for it to go.
      const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
      if (stale) await supabase.removeChannel(stale);
      if (cancelled) return;

      const ch = supabase
        .channel(topic, { config: { broadcast: { self: false }, presence: { key: myId } } })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "isexy", table: "messages", filter: `match_id=eq.${matchId}` },
          (payload) => {
            const incoming = payload.new as Message;
            // Show immediately; translate afterwards.
            setMessages((prev) => upsertMessage(prev, incoming));
            if (incoming.sender_id !== myId) {
              setOtherIsTyping(false);
              if (translateRef.current.on) void translateBatch([incoming], translateRef.current.lang);
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
        .on("presence", { event: "sync" }, () => {
          const state = ch.presenceState<{ visible?: boolean }>();
          const others = Object.entries(state).filter(([key]) => key !== myId).flatMap(([, metas]) => metas);
          setOtherHere(others.length > 0);
          otherVisibleHereRef.current = others.some((meta) => meta.visible !== false);
        });
      channel = ch;
      channelRef.current = ch;
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") trackPresence();
      });
    };

    void open();
    document.addEventListener("visibilitychange", trackPresence);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", trackPresence);
      channelRef.current = null;
      otherVisibleHereRef.current = false;
      setOtherHere(false);
      if (typingHideRef.current) clearTimeout(typingHideRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [matchId, myId, translateBatch]);

  const sendTypingIndicator = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { profileId: myId } });
  }, [myId]);

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    resizeInput();

    // Re-announce every 2 s while typing: the other side hides "typing…" after
    // 3.5 s, and a single broadcast per burst made it vanish mid-sentence.
    const now = Date.now();
    if (e.target.value && now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      sendTypingIndicator();
    }
  };

  // ---- Sending ---------------------------------------------------------------------
  /** Tell the other member outside the app, unless they are looking at this chat. */
  const notifyOther = (content: string) => {
    if (!matchId || !otherProfile || otherVisibleHereRef.current) return;
    // Push (no message text on the lock screen) and email (server-throttled per conversation).
    supabase.functions
      .invoke("isexy-send-push-notification", {
        body: {
          userId: otherProfile.id,
          title: profile?.first_name ?? "ISEXY",
          body: "Sent you a message",
          tag: `chat-${matchId}`,
          data: { type: "message", matchId, url: `/chat/${matchId}` },
        },
      })
      .catch(() => undefined);
    supabase.functions
      .invoke("isexy-send-notification-email", {
        body: { type: "new_message", matchId, data: { messagePreview: content.slice(0, 80) } },
      })
      .catch(() => undefined);
  };

  /** Insert one message (new or retried). On failure the bubble stays with Retry. */
  const deliver = async (tempId: string, content: string) => {
    if (!myId || !matchId) return;
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: true, failed: false } : m)));

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: myId, content })
      .select(MESSAGE_COLUMNS)
      .single();

    if (error || !inserted) {
      console.error("Error sending message:", error);
      const text = error?.message ?? "";
      if (text.includes("blocked")) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error("You can't message this member.");
      } else if (text.includes("no longer active") || text.includes("not part") || text.includes("Match not found")) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error("This conversation is no longer available.");
        navigate("/matches");
      } else {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      }
      return;
    }

    setMessages((prev) => {
      const withoutTemp = prev.some((m) => m.id === inserted.id) ? prev.filter((m) => m.id !== tempId) : prev;
      const idx = withoutTemp.findIndex((m) => m.id === tempId);
      if (idx === -1) return upsertMessage(withoutTemp, inserted as Message);
      const next = [...withoutTemp];
      next[idx] = inserted as Message;
      return next;
    });
    track("message_sent", { surface: "chat" });
    notifyOther(content);
  };

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || !profile || !matchId || isBanned) return;

    // Check content for personal information
    const modResult = checkContent(content);
    if (!modResult.isClean) {
      await reportViolation(profile.id, null, modResult.violations);
      await checkBanStatus();
      toast.error("⚠️ Your message contains personal information which is not allowed. Please remove phone numbers, emails, or addresses.");
      return;
    }

    setNewMessage("");
    lastTypingSentRef.current = 0;
    requestAnimationFrame(resizeInput);

    // Optimistic: show the message instantly, confirm (or mark failed) after.
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMessages((prev) => [...prev, {
      id: tempId, content, sender_id: profile.id, created_at: new Date().toISOString(), is_read: false, pending: true,
    }]);
    await deliver(tempId, content);
  };

  const retrySend = (message: Message) => {
    if (isBanned) return;
    void deliver(message.id, message.content);
  };

  const discardFailed = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  // Back online: resend anything that failed.
  useEffect(() => {
    const onOnline = () => {
      for (const m of messagesRef.current) if (m.failed) void deliver(m.id, m.content);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  };

  const toggleTranslations = () => {
    const newValue = !translationsEnabled;
    setTranslationsEnabled(newValue);
    if (newValue) {
      setTranslationDown(false);
      translateFailuresRef.current = 0;
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
    if (message.sender_id !== myId || message.failed) return null;
    if (message.pending) return <Clock className="w-3.5 h-3.5 text-primary-foreground/70" aria-label="Sending" />;
    if (message.is_read) return <CheckCheck className="w-4 h-4 text-primary-foreground" aria-label="Read" />;
    return <Check className="w-4 h-4 text-primary-foreground/70" aria-label="Sent" />;
  };

  const locale = language.code;

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 z-20 flex items-center gap-2 px-3 py-2.5 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <button
          onClick={() => navigate("/matches")}
          className="p-2 rounded-full hover:bg-muted/60 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        {otherProfile ? (
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
              {otherIsTyping ? (
                <span className="block text-xs text-primary whitespace-nowrap">typing…</span>
              ) : otherHere ? (
                <span className="block text-xs text-muted-foreground whitespace-nowrap">In this chat now</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex-1" />
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
      {translationsEnabled && autoTranslate && (
        <div className="shrink-0 px-4 py-1.5 bg-primary/10 text-primary text-xs text-center">
          {translationDown
            ? "Translation is unavailable right now"
            : <>Auto-translating to {language.flag} {language.nativeName}</>}
        </div>
      )}

      {/* Messages */}
      <main
        ref={scrollerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        aria-busy={loading}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : loadError && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <p className="font-semibold text-foreground mb-1">Couldn't load this conversation</p>
            <p className="text-sm text-muted-foreground mb-4">Check your connection and try again.</p>
            <button
              onClick={() => { setLoading(true); void fetchMessages(); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
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
          <div className="space-y-3">
            {hasOlder ? (
              <div className="flex justify-center">
                <button
                  onClick={() => void loadOlder()}
                  disabled={loadingOlder}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/60 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  {loadingOlder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {loadingOlder ? "Loading…" : "Load earlier messages"}
                </button>
              </div>
            ) : (
              <p className="text-center text-[11px] text-muted-foreground/80 pb-1">Start of your conversation</p>
            )}

            {messages.map((message, index) => {
              const isMe = message.sender_id === myId;
              const showTranslation = !isMe && translationOn && message.translatedContent;
              const prev = messages[index - 1];
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(message.created_at).toDateString();

              return (
                <div key={message.id}>
                  {newDay && (
                    <div className="flex justify-center py-1">
                      <span className="px-3 py-0.5 rounded-full bg-muted/50 text-[11px] font-medium text-muted-foreground">
                        {dayLabel(message.created_at, locale)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] px-4 py-2 rounded-2xl ${
                        isMe
                          ? `bg-primary text-primary-foreground rounded-br-md ${message.failed ? "opacity-60" : ""}`
                          : "bg-muted text-foreground rounded-bl-md"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>

                      {message.isTranslating && (
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-foreground/10">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-xs opacity-70">Translating...</span>
                        </div>
                      )}

                      {showTranslation && (
                        <div className="mt-2 pt-2 border-t border-foreground/10">
                          <p className="text-sm italic opacity-80 whitespace-pre-wrap break-words">{message.translatedContent}</p>
                        </div>
                      )}

                      <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : ""}`}>
                        <p className={`text-xs ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {timeLabel(message.created_at, locale)}
                        </p>
                        {renderReadReceipt(message)}
                      </div>
                    </div>
                  </div>
                  {message.failed && (
                    <div className="flex items-center justify-end gap-3 mt-1 text-xs" role="alert">
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertCircle className="w-3.5 h-3.5" /> Not sent
                      </span>
                      <button onClick={() => retrySend(message)} className="font-semibold text-primary hover:underline">
                        Retry
                      </button>
                      <button onClick={() => discardFailed(message.id)} className="text-muted-foreground hover:text-foreground">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Typing indicator at bottom */}
        {otherIsTyping && otherProfile && (
          <div className="flex justify-start mt-3">
            <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-md">
              <TypingIndicator name={otherProfile.first_name} />
            </div>
          </div>
        )}
      </main>

      {newBelow > 0 && (
        <div className="relative shrink-0 h-0">
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/30"
          >
            <ChevronDown className="w-4 h-4" /> {newBelow === 1 ? "New message" : `${newBelow} new messages`}
          </button>
        </div>
      )}

      {/* Ban warning */}
      {isBanned && (
        <div className="shrink-0 px-4 py-3 bg-destructive/10 border-t border-destructive/30 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <p className="text-sm text-destructive">{banMessage}</p>
        </div>
      )}

      {/* Input */}
      <footer className="shrink-0 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            enterKeyHint="send"
            maxLength={2000}
            aria-label="Message"
            placeholder={isBanned ? "Messaging restricted…" : `Message ${otherProfile?.first_name ?? ""}…`}
            disabled={isBanned}
            className="flex-1 resize-none max-h-32 px-5 py-3 bg-muted/60 border border-border/60 rounded-3xl outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder:text-muted-foreground disabled:opacity-50 transition-all leading-6"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!newMessage.trim() || isBanned}
            className="w-12 h-12 shrink-0 flex items-center justify-center bg-gradient-to-br from-primary to-secondary text-primary-foreground rounded-full shadow-lg shadow-primary/30 disabled:opacity-40 disabled:shadow-none enabled:active:scale-95 transition-all"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
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
