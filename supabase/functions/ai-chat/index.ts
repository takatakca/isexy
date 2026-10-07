import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * ISEXY AI assistant.
 *
 * POST { action?: "chat", messages, conversationId?, guestSessionId?, locale? }
 *   → text/event-stream (OpenAI-compatible SSE). Response headers:
 *     X-Conversation-Id  conversation row the transcript is stored in
 *     X-KB-Sources       JSON [{id,title,category}] of articles used to ground the answer
 * POST { action: "handoff", conversationId, guestSessionId?, note? }
 *   → { ok, sessionId } — queues the conversation for a human agent.
 *
 * Works for guests and signed-in members. All database writes use the service
 * role so RLS on chatbot_* / live_chat_sessions never blocks a visitor; ownership
 * of an existing conversation is checked here instead.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "x-conversation-id, x-kb-sources",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = Deno.env.get("AI_CHAT_MODEL") ?? "google/gemini-3-flash-preview";
const MAX_MESSAGES = 12;
const MAX_CONTENT_CHARS = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUEST_SESSION_RE = /^guest_[a-z0-9_-]{8,64}$/i;

const SUPPORT = {
  email: "cubaresort.ca@gmail.com",
  canada: "+1 450 999 4999",
  cuba: "+53 5307 1185",
};

const SYSTEM_PROMPT = `You are "ISEXY Concierge", the AI assistant of ISEXY.CA — the premium dating platform connecting Canada and Cuba (and Cubans worldwide).

PERSONALITY: warm, discreet, confident and genuinely helpful — like a five-star hotel concierge who also understands modern dating. Short paragraphs, clear steps, a touch of charm. Use emojis sparingly (❤️ 🛡️ ✅ 💡 🇨🇦 🇨🇺).

LANGUAGE: Always reply in the language the user writes in (English, Español, or Français). Use natural Cuban-friendly Spanish when replying in Spanish.

SAFETY FIRST (overrides everything):
- If the user mentions threats, stalking, blackmail, sextortion, violence, self-harm, or being in danger: start with
  "🚨 **Your safety comes first.** If you are in immediate danger call 911 (Canada) or 106 (Cuba police)."
  then give support contacts and tell them they can tap **"Talk to a human"** to reach our team now.
- If someone is asking them for money, gift cards, crypto, remittances "for an emergency", investment tips, or to move off the app: warn clearly that this is a common romance-scam pattern, advise not to send money, and suggest blocking/reporting (profile → ••• → Report).
- Never ask for passwords, card numbers, or ID documents in chat.

WHAT YOU KNOW (high level — prefer the KNOWLEDGE BASE excerpts below when they apply):
- Matching: swipe Discover, Explore categories, Top Picks, Super Likes, Boosts, Passport Mode, Double Date, Who Liked You.
- Messaging: chat with live translation (EN/ES/FR and more), voice/video calls billed in credits, scheduled calls, missed-call alerts by email/WhatsApp.
- PhoneLine: private voice line to meet people by phone without sharing your number.
- Plans: Free, Plus, Gold, Platinum (manage under Settings → My Subscription; compare at /compare-plans). Credits for calls at /buy-credits.
- Cuba: Cuban verification badge (Carnet de Identidad), Cuban Rewards, Stars gifts and cash-out, ETECSA recharge and food-package gifts.
- Safety: photo verification, block/report, automatic personal-info protection in chat and calls.
- Account: reset password at /reset-password, edit profile at /edit-profile, delete account at /delete-account.
- Support: AI (you), Help Center /knowledge-base, FAQ /faq, tickets /contact-us, email ${SUPPORT.email}, Canada ${SUPPORT.canada}, Cuba ${SUPPORT.cuba}.

RULES:
1. Only answer about ISEXY, dating advice, safety and travel/culture between Canada and Cuba. Politely decline unrelated tasks.
2. Never invent prices, policies or features. If the knowledge base and this prompt don't cover it, say so and offer "Talk to a human".
3. When you use a knowledge-base article, mention its title so the user can open it.
4. For refunds, billing disputes or account bans, collect a short description and suggest "Talk to a human".
5. Keep answers under ~180 words unless the user asks for detail. End with one helpful next step.`;

type ChatMessage = { role: "user" | "assistant"; content: string };
type Article = { id: string; title: string; content: string; category: string; tags: string[] | null };

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

// ---------------------------------------------------------------------------
// Best-effort rate limiting (per isolate). Protects the AI budget from bursts.
// ---------------------------------------------------------------------------
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string, limit: number, windowMs = 5 * 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) buckets.clear();
    return false;
  }
  bucket.count++;
  return bucket.count > limit;
}

// ---------------------------------------------------------------------------
// Knowledge base retrieval (small table → cached in memory, ranked in code).
// ---------------------------------------------------------------------------
let kbCache: { at: number; articles: Article[] } | null = null;
const STOP = new Set(
  "the a an and or to of in on for is are i my me you your it this that with how what can do does be have from at as by not no yes please help el la los las de del y o en un una por para que como mi tu es son le les des et ou du pour est comment".split(" "),
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

async function loadArticles(admin: SupabaseClient): Promise<Article[]> {
  if (kbCache && Date.now() - kbCache.at < 5 * 60_000) return kbCache.articles;
  const { data, error } = await admin
    .from("knowledge_base")
    .select("id, title, content, category, tags")
    .eq("is_published", true)
    .limit(500);
  if (error) {
    console.error("KB load failed:", error.message);
    return kbCache?.articles ?? [];
  }
  const clean = (t: string) =>
    t.replace(/\\r\\n|\\n/g, "\n").replace(/cubadate\.com/gi, "isexy.ca").replace(/CubaDate/g, "ISEXY");
  kbCache = {
    at: Date.now(),
    articles: ((data ?? []) as Article[]).map((a) => ({ ...a, title: clean(a.title), content: clean(a.content) })),
  };
  return kbCache.articles;
}

function rankArticles(query: string, articles: Article[], limit = 3): Article[] {
  const q = tokens(query);
  if (q.length === 0) return [];
  const scored = articles.map((a) => {
    const title = new Set(tokens(a.title));
    const tags = new Set((a.tags ?? []).flatMap((t) => tokens(t)));
    const body = tokens(a.content);
    const bodySet = new Set(body);
    let score = 0;
    for (const t of q) {
      if (title.has(t)) score += 4;
      if (tags.has(t)) score += 3;
      if (bodySet.has(t)) score += 1;
      // prefix match helps with plurals / conjugations (refund ↔ refunds, pago ↔ pagos)
      else if (t.length > 4 && body.some((b) => b.startsWith(t.slice(0, 5)))) score += 0.5;
    }
    return { a, score };
  });
  return scored
    .filter((s) => s.score >= 2)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((s) => s.a);
}

function kbContext(articles: Article[]): string {
  if (articles.length === 0) return "";
  const parts = articles.map(
    (a, i) => `[${i + 1}] "${a.title}" (${a.category})\n${a.content.slice(0, 1500)}`,
  );
  return `\n\n=== KNOWLEDGE BASE EXCERPTS (authoritative; cite titles) ===\n${parts.join("\n\n")}`;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return null;
  const out: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== "object") return null;
    const role = (m as Record<string, unknown>).role;
    const content = (m as Record<string, unknown>).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const trimmed = content.trim().slice(0, MAX_CONTENT_CHARS);
    if (trimmed) out.push({ role, content: trimmed });
  }
  if (out.length === 0 || out[out.length - 1].role !== "user") return null;
  return out;
}

// ---------------------------------------------------------------------------
// Conversation ownership
// ---------------------------------------------------------------------------
async function resolveConversation(
  admin: SupabaseClient,
  userId: string | null,
  conversationId: unknown,
  guestSessionId: string | null,
): Promise<string | null> {
  if (typeof conversationId === "string" && UUID_RE.test(conversationId)) {
    const { data } = await admin
      .from("chatbot_conversations")
      .select("id, user_id, session_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (data) {
      const owned = userId ? data.user_id === userId : !data.user_id && data.session_id === guestSessionId;
      if (owned) return data.id;
    }
  }
  const sessionId = guestSessionId ?? `member_${crypto.randomUUID()}`;
  const { data, error } = await admin
    .from("chatbot_conversations")
    .insert({ user_id: userId, session_id: sessionId, status: "active" })
    .select("id")
    .single();
  if (error) {
    console.error("Conversation create failed:", error.message);
    return null;
  }
  return data.id;
}

/** Tee the SSE stream so the full assistant reply can be stored once finished. */
function captureStream(body: ReadableStream<Uint8Array>, onComplete: (text: string) => void) {
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        buffer += decoder.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
            if (typeof delta === "string") text += delta;
          } catch {
            /* partial JSON across chunks is re-assembled via buffer */
          }
        }
      },
      flush() {
        if (text) onComplete(text);
      },
    }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    // Identify the caller. A member sends their session JWT; a guest sends the
    // publishable key, which simply fails getUser() and falls back to guest mode.
    let userId: string | null = null;
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (token) {
      const { data } = await admin.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const guestSessionId =
      typeof body.guestSessionId === "string" && GUEST_SESSION_RE.test(body.guestSessionId)
        ? body.guestSessionId
        : null;
    if (!userId && !guestSessionId) return json({ error: "Missing guest session" }, 400);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limiterKey = userId ? `u:${userId}` : `g:${ip}`;
    if (rateLimited(limiterKey, userId ? 60 : 25)) {
      return json({ error: "You're sending messages quickly — please wait a moment and try again." }, 429);
    }

    // ---- Human handoff --------------------------------------------------
    if (body.action === "handoff") {
      const conversationId = await resolveConversation(admin, userId, body.conversationId, guestSessionId);
      if (!conversationId) return json({ error: "Conversation not found" }, 404);
      await admin.from("chatbot_conversations").update({ status: "transferred" }).eq("id", conversationId);
      const { data, error } = await admin
        .from("live_chat_sessions")
        .insert({ user_id: userId, status: "waiting", chatbot_conversation_id: conversationId })
        .select("id")
        .single();
      if (error) {
        // Older databases without the chatbot_conversation_id column.
        const retry = await admin
          .from("live_chat_sessions")
          .insert({ user_id: userId, status: "waiting" })
          .select("id")
          .single();
        if (retry.error) {
          console.error("Handoff failed:", retry.error.message);
          return json({ error: "Could not reach the support queue" }, 500);
        }
        return json({ ok: true, sessionId: retry.data.id, conversationId });
      }
      return json({ ok: true, sessionId: data.id, conversationId });
    }

    // ---- Chat -----------------------------------------------------------
    const messages = sanitizeMessages(body.messages);
    if (!messages) return json({ error: "A non-empty messages array ending with a user message is required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI assistant is not configured yet" }, 503);

    const latest = messages[messages.length - 1].content;
    const articles = rankArticles(
      // Include the previous user turn so follow-ups ("how much is it?") keep context.
      messages.filter((m) => m.role === "user").slice(-2).map((m) => m.content).join(" "),
      await loadArticles(admin),
    );

    const conversationId = await resolveConversation(admin, userId, body.conversationId, guestSessionId);
    if (conversationId) {
      await admin.from("chatbot_messages").insert({ conversation_id: conversationId, role: "user", content: latest });
    }

    const locale = typeof body.locale === "string" ? body.locale.slice(0, 8) : "";
    const system =
      SYSTEM_PROMPT +
      (locale ? `\n\nThe app UI language is "${locale}"; if the user's language is unclear, use it.` : "") +
      (userId ? "\n\nThe user is a signed-in member." : "\n\nThe user is a guest who has not signed in yet; you may invite them to create a free account when relevant.") +
      kbContext(articles);

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: system }, ...messages],
        temperature: 0.5,
        max_tokens: 900,
        stream: true,
      }),
    });

    if (!aiResponse.ok || !aiResponse.body) {
      const detail = await aiResponse.text().catch(() => "");
      console.error("AI gateway error:", aiResponse.status, detail.slice(0, 300));
      if (aiResponse.status === 429) return json({ error: "The assistant is busy right now. Please try again in a moment." }, 429);
      if (aiResponse.status === 402) return json({ error: "The assistant is temporarily unavailable." }, 503);
      return json({ error: "The assistant could not answer right now." }, 502);
    }

    const sources = articles.map((a) => ({ id: a.id, title: a.title, category: a.category }));
    const stream = captureStream(aiResponse.body, (text) => {
      if (!conversationId) return;
      admin
        .from("chatbot_messages")
        .insert({ conversation_id: conversationId, role: "assistant", content: text })
        .then(({ error }) => error && console.error("Store reply failed:", error.message));
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Conversation-Id": conversationId ?? "",
        "X-KB-Sources": encodeURIComponent(JSON.stringify(sources)),
      },
    });
  } catch (error) {
    console.error("ai-chat error:", error instanceof Error ? error.message : error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
