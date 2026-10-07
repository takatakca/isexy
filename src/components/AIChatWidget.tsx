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
  related: string; disclaimer: string;
  actions: { label: string; query: string; icon: typeof Shield }[];
}> = {
  en: {
    title: "ISEXY Concierge",
    subtitle: "AI assistant · replies instantly",
    greeting: "Hi! 👋 I'm your **ISEXY Concierge**.\n\nI can help with your profile, matches, payments, safety, and connecting between **Canada 🇨🇦 and Cuba 🇨🇺**.\n\nPick a topic or ask me anything.",
    placeholder: "Ask me anything…",
    human: "Talk to a human",
    teaser: "Need help? I answer in English, Español & Français.",
    thinking: "Thinking…",
    error: "I couldn't reply just now.",
    retry: "Try again",
    newChat: "New chat",
    queued: "✅ **You're in the support queue.** A team member will reply here or by email shortly.\n\n📧 cubaresort.ca@gmail.com · 📞 Canada +1 450 999 4999 · 📞 Cuba +53 5307 1185",
    related: "Related articles",
    disclaimer: "AI can make mistakes. In an emergency call 911 (Canada) or 106 (Cuba).",
    actions: [
      { label: "Get more matches", query: "How can I get more matches?", icon: Heart },
      { label: "Safety & scams", query: "How do I stay safe and spot romance scams?", icon: Shield },
      { label: "Plans & billing", query: "What do the premium plans include and how do I manage billing?", icon: CreditCard },
      { label: "Account help", query: "I need help with my account.", icon: Users },
      { label: "Dating in Cuba", query: "Tips for meeting someone in Cuba and visiting safely?", icon: Plane },
      { label: "Report someone", query: "I want to report a user.", icon: AlertTriangle },
    ],
  },
  es: {
    title: "Conserje ISEXY",
    subtitle: "Asistente IA · responde al instante",
    greeting: "¡Hola! 👋 Soy tu **Conserje ISEXY**.\n\nTe ayudo con tu perfil, matches, pagos, seguridad y a conectar entre **Canadá 🇨🇦 y Cuba 🇨🇺**.\n\nElige un tema o pregúntame lo que quieras.",
    placeholder: "Escribe tu pregunta…",
    human: "Hablar con una persona",
    teaser: "¿Necesitas ayuda? Respondo en Español, English y Français.",
    thinking: "Pensando…",
    error: "No pude responder ahora.",
    retry: "Reintentar",
    newChat: "Nuevo chat",
    queued: "✅ **Estás en la cola de soporte.** Alguien del equipo te responderá aquí o por correo muy pronto.\n\n📧 cubaresort.ca@gmail.com · 📞 Canadá +1 450 999 4999 · 📞 Cuba +53 5307 1185",
    related: "Artículos relacionados",
    disclaimer: "La IA puede equivocarse. En una emergencia llama al 106 (Cuba) o 911 (Canadá).",
    actions: [
      { label: "Más matches", query: "¿Cómo consigo más matches?", icon: Heart },
      { label: "Seguridad y estafas", query: "¿Cómo me protejo de estafas románticas?", icon: Shield },
      { label: "Planes y pagos", query: "¿Qué incluyen los planes premium y cómo gestiono mis pagos?", icon: CreditCard },
      { label: "Mi cuenta", query: "Necesito ayuda con mi cuenta.", icon: Users },
      { label: "Citas en Cuba", query: "Consejos para conocer a alguien en Cuba de forma segura.", icon: Plane },
      { label: "Reportar a alguien", query: "Quiero reportar a un usuario.", icon: AlertTriangle },
    ],
  },
  fr: {
    title: "Concierge ISEXY",
    subtitle: "Assistant IA · réponse immédiate",
    greeting: "Bonjour ! 👋 Je suis votre **Concierge ISEXY**.\n\nJe vous aide avec votre profil, vos matchs, les paiements, la sécurité et les rencontres entre le **Canada 🇨🇦 et Cuba 🇨🇺**.\n\nChoisissez un sujet ou posez votre question.",
    placeholder: "Posez votre question…",
    human: "Parler à un humain",
    teaser: "Besoin d'aide ? Je réponds en Français, English et Español.",
    thinking: "Réflexion…",
    error: "Je n'ai pas pu répondre pour le moment.",
    retry: "Réessayer",
    newChat: "Nouvelle discussion",
    queued: "✅ **Vous êtes dans la file du support.** Un membre de l'équipe vous répondra ici ou par courriel sous peu.\n\n📧 cubaresort.ca@gmail.com · 📞 Canada +1 450 999 4999 · 📞 Cuba +53 5307 1185",
    related: "Articles liés",
    disclaimer: "L'IA peut se tromper. En cas d'urgence, composez le 911 (Canada) ou le 106 (Cuba).",
    actions: [
      { label: "Plus de matchs", query: "Comment obtenir plus de matchs ?", icon: Heart },
      { label: "Sécurité & arnaques", query: "Comment éviter les arnaques sentimentales ?", icon: Shield },
      { label: "Forfaits & paiement", query: "Que comprennent les forfaits premium et comment gérer la facturation ?", icon: CreditCard },
      { label: "Mon compte", query: "J'ai besoin d'aide avec mon compte.", icon: Users },
      { label: "Rencontres à Cuba", query: "Conseils pour rencontrer quelqu'un à Cuba en toute sécurité ?", icon: Plane },
      { label: "Signaler quelqu'un", query: "Je veux signaler un utilisateur.", icon: AlertTriangle },
    ],
  },
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const STORAGE_KEY = "isexy_assistant_v2";
const TEASER_KEY = "isexy_assistant_teaser_seen";
// Pages with their own fixed composer / call UI where a floating button gets in the way.
const HIDDEN_ON = [/^\/chat\//, /^\/group-chat\//, /^\/video-call\//, /^\/phone-line\/call\//, /^\/admin/, /^\/agent-dashboard/];

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
}

function loadPersisted(ownerId: string | null): Persisted {
  const saved = storageGet<Persisted | null>(STORAGE_KEY, null);
  if (saved && saved.ownerId === ownerId && Array.isArray(saved.messages)) return saved;
  return { ownerId, conversationId: null, guestSessionId: saved?.guestSessionId ?? newGuestSessionId(), messages: [] };
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
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              received += delta;
              patchLast({ content: received });
            }
          } catch {
            // Incomplete JSON line: put it back and wait for the next chunk.
            buffer = `${line}\n${buffer}`;
            break;
          }
        }
      }
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
  }, [streaming, session?.access_token, lang, t.error, patchLast]);

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
    setHandingOff(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          action: "handoff",
          conversationId: state.conversationId,
          guestSessionId: state.guestSessionId,
        },
      });
      if (error || !data?.ok) throw new Error("handoff failed");
      track("assistant_handoff");
      setState((prev) => ({
        ...prev,
        conversationId: data.conversationId ?? prev.conversationId,
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
    setState({ ownerId, conversationId: null, guestSessionId: newGuestSessionId(), messages: [] });
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
            <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
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
                {t.subtitle}
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
                  <AssistantBubble content={m.content} error={m.error} />
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
          </div>

          <div className="shrink-0 border-t border-border bg-background px-3 pt-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-center justify-between px-1 pb-2">
              <button onClick={handoff} disabled={handingOff || streaming} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                <Headphones className="w-3.5 h-3.5" />
                {t.human}
              </button>
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
                placeholder={t.placeholder}
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

function AssistantBubble({ content, error }: { content: string; error?: boolean }) {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-pink-500 text-white flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-4 h-4" />
      </div>
      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-md text-sm break-words ${error ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-card border border-border text-foreground"}`}>
        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => (
                <a href={href} target={href?.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="text-primary underline">{children}</a>
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
