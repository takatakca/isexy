import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  X, Send, Bot, Shield, CreditCard, Users, Heart, AlertTriangle, Plane,
  Headphones, BookOpen, Square, RotateCcw, Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { OPEN_ASSISTANT_EVENT, type OpenAssistantDetail } from "@/lib/assistant";
import { track } from "@/lib/analytics";

interface Source {
  id: string;
  title: string;
  category: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  error?: boolean;
}

type Lang = "en" | "es" | "fr";

const COPY: Record<Lang, {
  title: string; subtitle: string; greeting: string; placeholder: string; human: string;
  teaser: string; thinking: string; error: string; retry: string; newChat: string; queued: string;
  guestHuman: string; liveWaiting: string; liveActive: string; endChat: string; livePlaceholder: string;
  supportName: string; liveEnded: string; liveSendFailed: string; supportReplied: string;
  related: string; disclaimer: string;
  actions: { label: string; query: string; icon: typeof Shield }[];
}> = {
  en: {
    title: "ISEXY Concierge",
    subtitle: "AI assistant · replies instantly",
    greeting: "Hi! 👋 I'm your **ISEXY Concierge**.\n\nI can help with your profile, meeting new people, chats and calls, payments and safety — across **Canada 🇨🇦** and with **Cuba 🇨🇺**.\n\nPick a topic or ask me anything.",
    placeholder: "Ask me anything…",
    human: "Talk to a human",
    teaser: "Need help? I answer in English, Español & Français.",
    thinking: "Thinking…",
    error: "I couldn't reply just now.",
    retry: "Try again",
    newChat: "New chat",
    queued: "✅ **You're in the queue.** A member of our team will join this chat. Keep writing here; if you leave, their replies will be waiting when you open the assistant again.",
    guestHuman: "To chat with a person, **[sign in](/auth)** first, or **[send us a ticket](/contact-us)** and we'll answer by e-mail.",
    liveWaiting: "Live chat · waiting for a team member",
    liveActive: "Live chat with ISEXY Support",
    endChat: "End chat",
    livePlaceholder: "Write to the team…",
    supportName: "ISEXY Support",
    liveEnded: "The chat with our team has ended. I'm here if you need anything else.",
    liveSendFailed: "Not sent. Check your connection and try again.",
    supportReplied: "ISEXY Support replied to you.",
    related: "Related articles",
    disclaimer: "AI can make mistakes. In an emergency call 911 (Canada) or 106 (Cuba).",
    actions: [
      { label: "Meet more people", query: "How can I meet more people to talk with?", icon: Heart },
      { label: "Safety & scams", query: "How do I stay safe and spot scams and fraud?", icon: Shield },
      { label: "Plans & billing", query: "What do the premium plans include and how do I manage billing?", icon: CreditCard },
      { label: "Account help", query: "I need help with my account.", icon: Users },
      { label: "Connecting with people in Cuba", query: "Tips for connecting with people in Cuba and visiting safely?", icon: Plane },
      { label: "Report someone", query: "I want to report a user.", icon: AlertTriangle },
    ],
  },
  es: {
    title: "Conserje ISEXY",
    subtitle: "Asistente IA · responde al instante",
    greeting: "¡Hola! 👋 Soy tu **Conserje ISEXY**.\n\nTe ayudo con tu perfil, a conocer gente nueva, chats y llamadas, pagos y seguridad — en **Canadá 🇨🇦** y con **Cuba 🇨🇺**.\n\nElige un tema o pregúntame lo que quieras.",
    placeholder: "Escribe tu pregunta…",
    human: "Hablar con una persona",
    teaser: "¿Necesitas ayuda? Respondo en Español, English y Français.",
    thinking: "Pensando…",
    error: "No pude responder ahora.",
    retry: "Reintentar",
    newChat: "Nuevo chat",
    queued: "✅ **Estás en la cola.** Alguien del equipo se unirá a este chat. Sigue escribiendo aquí; si te vas, sus respuestas te esperarán al volver a abrir el asistente.",
    guestHuman: "Para hablar con una persona, primero **[inicia sesión](/auth)**, o **[envíanos un ticket](/contact-us)** y te responderemos por correo.",
    liveWaiting: "Chat en vivo · esperando a alguien del equipo",
    liveActive: "Chat en vivo con Soporte ISEXY",
    endChat: "Terminar chat",
    livePlaceholder: "Escribe al equipo…",
    supportName: "Soporte ISEXY",
    liveEnded: "El chat con el equipo terminó. Aquí sigo si necesitas algo más.",
    liveSendFailed: "No se envió. Revisa tu conexión e inténtalo de nuevo.",
    supportReplied: "Soporte ISEXY te respondió.",
    related: "Artículos relacionados",
    disclaimer: "La IA puede equivocarse. En una emergencia llama al 106 (Cuba) o 911 (Canadá).",
    actions: [
      { label: "Conocer más gente", query: "¿Cómo puedo conocer más personas para conversar?", icon: Heart },
      { label: "Seguridad y estafas", query: "¿Cómo me protejo de estafas y fraudes?", icon: Shield },
      { label: "Planes y pagos", query: "¿Qué incluyen los planes premium y cómo gestiono mis pagos?", icon: CreditCard },
      { label: "Mi cuenta", query: "Necesito ayuda con mi cuenta.", icon: Users },
      { label: "Conectar con gente en Cuba", query: "Consejos para conectar con gente en Cuba y visitar de forma segura.", icon: Plane },
      { label: "Reportar a alguien", query: "Quiero reportar a un usuario.", icon: AlertTriangle },
    ],
  },
  fr: {
    title: "Concierge ISEXY",
    subtitle: "Assistant IA · réponse immédiate",
    greeting: "Bonjour ! 👋 Je suis votre **Concierge ISEXY**.\n\nJe vous aide avec votre profil, à rencontrer de nouvelles personnes, les clavardages et appels, les paiements et la sécurité — partout au **Canada 🇨🇦** et avec **Cuba 🇨🇺**.\n\nChoisissez un sujet ou posez votre question.",
    placeholder: "Posez votre question…",
    human: "Parler à un humain",
    teaser: "Besoin d'aide ? Je réponds en Français, English et Español.",
    thinking: "Réflexion…",
    error: "Je n'ai pas pu répondre pour le moment.",
    retry: "Réessayer",
    newChat: "Nouvelle discussion",
    queued: "✅ **Vous êtes dans la file.** Un membre de l'équipe va se joindre à cette discussion. Continuez à écrire ici; si vous partez, ses réponses vous attendront à votre retour dans l'assistant.",
    guestHuman: "Pour clavarder avec une personne, **[connectez-vous](/auth)** d'abord, ou **[envoyez-nous un billet](/contact-us)** et nous répondrons par courriel.",
    liveWaiting: "Clavardage en direct · en attente d'un membre de l'équipe",
    liveActive: "Clavardage en direct avec le Soutien ISEXY",
    endChat: "Terminer",
    livePlaceholder: "Écrivez à l'équipe…",
    supportName: "Soutien ISEXY",
    liveEnded: "La discussion avec l'équipe est terminée. Je reste là si vous avez besoin d'autre chose.",
    liveSendFailed: "Non envoyé. Vérifiez votre connexion et réessayez.",
    supportReplied: "Le Soutien ISEXY vous a répondu.",
    related: "Articles liés",
    disclaimer: "L'IA peut se tromper. En cas d'urgence, composez le 911 (Canada) ou le 106 (Cuba).",
    actions: [
      { label: "Rencontrer plus de monde", query: "Comment rencontrer plus de personnes avec qui discuter ?", icon: Heart },
      { label: "Sécurité & arnaques", query: "Comment repérer et éviter les arnaques et la fraude ?", icon: Shield },
      { label: "Forfaits & paiement", query: "Que comprennent les forfaits premium et comment gérer la facturation ?", icon: CreditCard },
      { label: "Mon compte", query: "J'ai besoin d'aide avec mon compte.", icon: Users },
      { label: "Se connecter avec des gens à Cuba", query: "Conseils pour échanger avec des gens à Cuba et visiter en toute sécurité ?", icon: Plane },
      { label: "Signaler quelqu'un", query: "Je veux signaler un utilisateur.", icon: AlertTriangle },
    ],
  },
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/isexy-ai-chat`;
const STORAGE_KEY = "isexy_assistant_v2";
const TEASER_KEY = "isexy_assistant_teaser_seen";
// Pages with their own fixed composer / call UI / buy button bar where a floating button gets in the way.
const HIDDEN_ON = [/^\/discover/, /^\/explore\/./, /^\/chat\//, /^\/group-chat\//, /^\/video-call\//, /^\/phone-line\/call\//, /^\/admin/, /^\/agent-dashboard/,
  /^\/(premium|compare-plans|my-subscription|get-boosts|get-super-likes|buy-credits|buy-minutes)\/?$/];

function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function storageSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — the chat still works in memory */
  }
}

function newGuestSessionId() {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `guest_${rand.slice(0, 32)}`;
}

interface Persisted {
  ownerId: string | null;
  conversationId: string | null;
  guestSessionId: string;
  messages: Message[];
  /** Open live chat with a person (signed-in members only). */
  liveSessionId?: string | null;
}

interface LiveMessage {
  id: string;
  sender_type: "user" | "agent" | "system";
  content: string;
  created_at: string;
}

function loadPersisted(ownerId: string | null): Persisted {
  const saved = storageGet<Persisted | null>(STORAGE_KEY, null);
  if (saved && saved.ownerId === ownerId && Array.isArray(saved.messages)) return saved;
  return { ownerId, conversationId: null, guestSessionId: saved?.guestSessionId ?? newGuestSessionId(), messages: [], liveSessionId: null };
}

export function AIChatWidget() {
  const { user, session } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const lang: Lang = language.code === "es" || language.code === "fr" ? language.code : "en";
  const t = COPY[lang];
  const ownerId = user?.id ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<Persisted>(() => loadPersisted(ownerId));
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [handingOff, setHandingOff] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Switching account (sign in / out) starts a fresh, correctly-owned conversation.
  useEffect(() => {
    setState(loadPersisted(ownerId));
  }, [ownerId]);

  useEffect(() => {
    storageSet(STORAGE_KEY, { ...state, messages: state.messages.slice(-40) });
  }, [state]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages, streaming]);

  useEffect(() => {
    if (isOpen) {
      setShowTeaser(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // One gentle proactive greeting per browser session.
  useEffect(() => {
    if (isOpen) return;
    let seen = false;
    try { seen = sessionStorage.getItem(TEASER_KEY) === "1"; } catch { seen = true; }
    if (seen) return;
    const timer = setTimeout(() => {
      setShowTeaser(true);
      try { sessionStorage.setItem(TEASER_KEY, "1"); } catch { /* ignore */ }
    }, 7000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // ---- Live chat with a person (signed-in members; isexy.live_chat_*) ----------
  const liveSessionId = user ? state.liveSessionId ?? null : null;
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [liveStatus, setLiveStatus] = useState<"waiting" | "active" | "closed" | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [unreadLive, setUnreadLive] = useState(0);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const liveOpen = !!liveSessionId && (liveStatus === "waiting" || liveStatus === "active");

  useEffect(() => {
    if (isOpen) setUnreadLive(0);
  }, [isOpen]);

  useEffect(() => {
    if (!liveSessionId) {
      setLiveMessages([]);
      setLiveStatus(null);
      return;
    }
    let alive = true;
    void (async () => {
      const [sess, msgs] = await Promise.all([
        supabase.from("live_chat_sessions").select("status").eq("id", liveSessionId).maybeSingle(),
        supabase
          .from("live_chat_messages")
          .select("id, sender_type, content, created_at")
          .eq("session_id", liveSessionId)
          .order("created_at")
          .limit(200),
      ]);
      if (!alive || sess.error || msgs.error) return;
      if (!sess.data || sess.data.status === "closed") {
        // Ended while the member was away: back to the assistant.
        setState((prev) => ({ ...prev, liveSessionId: null }));
        return;
      }
      setLiveStatus(sess.data.status === "active" ? "active" : "waiting");
      setLiveMessages((msgs.data ?? []) as LiveMessage[]);
    })();
    const channel = supabase
      .channel(`assistant-live-${liveSessionId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "isexy", table: "live_chat_messages", filter: `session_id=eq.${liveSessionId}` },
        (payload) => {
          const m = payload.new as LiveMessage;
          setLiveMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_type === "agent" && !isOpenRef.current) setUnreadLive((n) => n + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "isexy", table: "live_chat_sessions", filter: `id=eq.${liveSessionId}` },
        (payload) => {
          const st = (payload.new as { status?: string }).status;
          if (st === "closed" || st === "active" || st === "waiting") setLiveStatus(st);
        },
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [liveSessionId]);

  const sendLive = useCallback(async (content: string) => {
    if (!user || !liveSessionId) return;
    setInput("");
    setLiveError(false);
    const { data, error } = await supabase
      .from("live_chat_messages")
      .insert({ session_id: liveSessionId, sender_type: "user", sender_id: user.id, content })
      .select("id, sender_type, content, created_at")
      .single();
    if (error || !data) {
      console.error("Live chat send failed:", error);
      setInput(content);
      setLiveError(true);
      return;
    }
    const sent = data as LiveMessage;
    setLiveMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
  }, [user, liveSessionId]);

  const endLiveChat = async () => {
    if (!liveSessionId) return;
    const { error } = await supabase.rpc("end_my_live_chat", { p_session_id: liveSessionId });
    if (error) console.error("End live chat failed:", error);
    setLiveStatus("closed");
  };

  const patchLast = useCallback((patch: Partial<Message>) => {
    setState((prev) => {
      const messages = [...prev.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") messages[messages.length - 1] = { ...last, ...patch };
      return { ...prev, messages };
    });
  }, []);

  const send = useCallback(async (text: string) => {
    const content = text.trim().slice(0, 2000);
    if (!content || streaming) return;
    // A person is on (or joining) the chat: the message goes to them, not to the AI.
    if (liveOpen) {
      await sendLive(content);
      return;
    }

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content };
    const assistantMsg: Message = { id: `a_${Date.now()}`, role: "assistant", content: "" };
    const history = [...stateRef.current.messages.filter((m) => !m.error && m.content), userMsg];
    setState((prev) => ({ ...prev, messages: [...prev.messages.filter((m) => !m.error), userMsg, assistantMsg] }));
    setInput("");
    setStreaming(true);
    track("assistant_message", { locale: lang, signed_in: !!session });

    const controller = new AbortController();
    abortRef.current = controller;
    let received = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: history.slice(-12).map(({ role, content }) => ({ role, content })),
          conversationId: stateRef.current.conversationId,
          guestSessionId: stateRef.current.guestSessionId,
          locale: lang,
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : t.error);
      }

      const conversationId = resp.headers.get("x-conversation-id");
      let sources: Source[] = [];
      try {
        sources = JSON.parse(decodeURIComponent(resp.headers.get("x-kb-sources") ?? "[]"));
      } catch { sources = []; }
      if (conversationId) setState((prev) => ({ ...prev, conversationId }));

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // One SSE line: `data: {"choices":[{"delta":{"content":"..."}}]}` (or [DONE]).
      const readLine = (raw: string) => {
        const line = raw.trim();
        if (!line.startsWith("data:")) return;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            received += delta;
            patchLast({ content: received });
          }
        } catch {
          // A complete line that is not JSON (lines are only read up to a newline): skip it.
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          readLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
      // The last line may arrive without a final newline.
      buffer += decoder.decode();
      if (buffer.trim()) readLine(buffer);
      if (!received) throw new Error(t.error);
      patchLast({ content: received, sources });
    } catch (e) {
      if (controller.signal.aborted) {
        patchLast({ content: received || "…" });
      } else {
        patchLast({ content: e instanceof Error && e.message ? e.message : t.error, error: true });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [streaming, session?.access_token, lang, t.error, patchLast, liveOpen, sendLive]);

  // External "Ask AI" triggers (Help Center, FAQ…).
  useEffect(() => {
    const handler = (e: Event) => {
      const { query } = (e as CustomEvent<OpenAssistantDetail>).detail ?? {};
      setIsOpen(true);
      if (query) setTimeout(() => send(query), 50);
    };
    window.addEventListener(OPEN_ASSISTANT_EVENT, handler);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, handler);
  }, [send]);

  const retryLast = () => {
    const lastUser = [...state.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setState((prev) => {
      const idx = prev.messages.lastIndexOf(lastUser);
      return { ...prev, messages: prev.messages.slice(0, idx) };
    });
    setTimeout(() => send(lastUser.content), 0);
  };

  const handoff = async () => {
    if (handingOff) return;
    // A guest session has no owner an agent's reply could reach: sign in or send a ticket.
    if (!user) {
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, { id: `h_${Date.now()}`, role: "assistant", content: t.guestHuman }],
      }));
      return;
    }
    setHandingOff(true);
    try {
      const { data, error } = await supabase.functions.invoke("isexy-ai-chat", {
        body: {
          action: "handoff",
          conversationId: state.conversationId,
          guestSessionId: state.guestSessionId,
        },
      });
      if (error || !data?.ok || !data.sessionId) throw new Error("handoff failed");
      track("assistant_handoff");
      setLiveStatus("waiting");
      setState((prev) => ({
        ...prev,
        conversationId: data.conversationId ?? prev.conversationId,
        liveSessionId: data.sessionId,
        messages: [...prev.messages, { id: `h_${Date.now()}`, role: "assistant", content: t.queued }],
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, {
          id: `h_${Date.now()}`, role: "assistant", error: true,
          content: "📧 cubaresort.ca@gmail.com · 📞 Canada +1 450 999 4999 · 📞 Cuba +53 5307 1185",
        }],
      }));
    } finally {
      setHandingOff(false);
    }
  };

  const resetChat = () => {
    abortRef.current?.abort();
    // Starting over also leaves the queue (an agent would otherwise join an empty chat).
    if (liveOpen && liveSessionId) void supabase.rpc("end_my_live_chat", { p_session_id: liveSessionId });
    setState({ ownerId, conversationId: null, guestSessionId: newGuestSessionId(), messages: [], liveSessionId: null });
  };

  if (HIDDEN_ON.some((re) => re.test(location.pathname))) return null;

  const empty = state.messages.length === 0;
  const lastMsg = state.messages[state.messages.length - 1];

  return (
    <>
      {!isOpen && (
        <div className="fixed right-4 bottom-20 md:bottom-6 z-40 flex items-end gap-3">
          {showTeaser && (
            <div className="relative max-w-[240px] bg-card border border-border rounded-2xl rounded-br-sm shadow-xl px-4 py-3 text-sm text-foreground animate-fade-in">
              <button
                onClick={() => setShowTeaser(false)}
                className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
              <button onClick={() => setIsOpen(true)} className="text-left">
                <span className="font-semibold block mb-0.5">{t.title} ✨</span>
                {t.teaser}
              </button>
            </div>
          )}
          <button
            onClick={() => setIsOpen(true)}
            className="relative w-14 h-14 rounded-full bg-gradient-to-br from-primary to-pink-500 text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            aria-label={`Open ${t.title}`}
          >
            <Sparkles className="w-6 h-6" />
            {unreadLive > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-white text-[11px] font-bold flex items-center justify-center border-2 border-white" aria-label={t.supportReplied}>
                {unreadLive}
              </span>
            ) : (
              <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
            )}
          </button>
        </div>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label={t.title}
          className="fixed z-50 inset-0 md:inset-auto md:right-6 md:bottom-6 md:w-[400px] md:h-[min(680px,calc(100vh-48px))] bg-background md:rounded-3xl md:border md:border-border shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        >
          <header className="bg-gradient-to-r from-primary to-pink-500 text-white px-4 py-3 flex items-center gap-3 shrink-0" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold leading-tight">{t.title}</p>
              <p className="text-xs text-white/85 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300" />
                {liveOpen ? (liveStatus === "active" ? t.liveActive : t.liveWaiting) : t.subtitle}
              </p>
            </div>
            {!empty && (
              <button onClick={resetChat} className="p-2 rounded-full hover:bg-white/20" aria-label={t.newChat} title={t.newChat}>
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setIsOpen(false)} className="p-2 rounded-full hover:bg-white/20" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/30">
            <AssistantBubble content={t.greeting} />

            {empty && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {t.actions.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => send(a.query)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border hover:border-primary/40 hover:bg-primary/5 rounded-xl text-xs font-medium text-foreground transition-colors text-left"
                  >
                    <a.icon className="w-4 h-4 text-primary shrink-0" />
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            {state.messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-sm whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                </div>
              ) : m.content ? (
                <div key={m.id}>
                  <AssistantBubble content={m.content} error={m.error} onNavigate={() => setIsOpen(false)} />
                  {m.error && (
                    <button onClick={retryLast} className="ml-1 mt-1 text-xs text-primary font-semibold hover:underline">{t.retry}</button>
                  )}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 ml-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{t.related}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.sources.map((s) => (
                          <Link
                            key={s.id}
                            to={`/knowledge-base/${s.id}`}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-card border border-border hover:border-primary/50 text-foreground"
                          >
                            <BookOpen className="w-3 h-3 text-primary" />
                            {s.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null,
            )}

            {streaming && lastMsg?.role === "assistant" && !lastMsg.content && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-1" aria-live="polite">
                <span className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
                {t.thinking}
              </div>
            )}

            {liveMessages.map((m) =>
              m.sender_type === "system" ? (
                <p key={m.id} className="text-center text-xs text-muted-foreground px-4">{m.content}</p>
              ) : m.sender_type === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-sm whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-2 items-start">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div className="max-w-[85%]">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">{t.supportName}</p>
                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-md text-sm bg-card border border-border text-foreground whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                  </div>
                </div>
              ),
            )}
            {liveSessionId && liveStatus === "closed" && (
              <AssistantBubble content={t.liveEnded} />
            )}
            {liveError && (
              <p className="text-xs text-destructive text-right px-1" role="alert">{t.liveSendFailed}</p>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-background px-3 pt-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-center justify-between px-1 pb-2">
              {liveOpen ? (
                <button onClick={() => void endLiveChat()} className="text-xs font-semibold text-destructive hover:underline flex items-center gap-1">
                  <X className="w-3.5 h-3.5" />
                  {t.endChat}
                </button>
              ) : (
                <button onClick={handoff} disabled={handingOff || streaming} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                  <Headphones className="w-3.5 h-3.5" />
                  {t.human}
                </button>
              )}
              <Link to="/knowledge-base" onClick={() => setIsOpen(false)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                Help Center
              </Link>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                rows={1}
                maxLength={2000}
                placeholder={liveOpen ? t.livePlaceholder : t.placeholder}
                className="flex-1 resize-none max-h-32 min-h-[44px] rounded-2xl bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              {streaming ? (
                <button type="button" onClick={() => abortRef.current?.abort()} className="w-11 h-11 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0" aria-label="Stop">
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40" aria-label="Send">
                  <Send className="w-4 h-4" />
                </button>
              )}
            </form>
            <p className="text-[10px] text-center text-muted-foreground mt-1.5">{t.disclaimer}</p>
          </div>
        </div>
      )}
    </>
  );
}

function AssistantBubble({ content, error, onNavigate }: { content: string; error?: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-pink-500 text-white flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-4 h-4" />
      </div>
      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-md text-sm break-words ${error ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-card border border-border text-foreground"}`}>
        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
          <ReactMarkdown
            components={{
              a: ({ href, children }) =>
                href?.startsWith("/") ? (
                  <Link to={href} onClick={onNavigate} className="text-primary underline">{children}</Link>
                ) : (
                  <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">{children}</a>
                ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
