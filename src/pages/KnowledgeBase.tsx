import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { articleSchema, breadcrumbSchema } from "@/seo/structuredData";
import ReactMarkdown from "react-markdown";
import {
  Search, BookOpen, ChevronRight, ThumbsUp, ThumbsDown, MessageCircle,
  ArrowLeft, Loader2, Sparkles, X, HelpCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSelector } from "@/components/LanguageSelector";
import { openAssistant } from "@/lib/assistant";
import { track } from "@/lib/analytics";

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[] | null;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at?: string;
  updated_at?: string;
}

const VOTES_KEY = "isexy_kb_votes";

function readVotes(): Record<string, "up" | "down"> {
  try {
    return JSON.parse(localStorage.getItem(VOTES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Repair legacy seed content (literal "\\n" sequences, old CubaDate brand). */
function cleanContent(text: string) {
  return text
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/cubadate\.com/gi, "isexy.ca")
    .replace(/CubaDate/g, "ISEXY");
}

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function scoreArticle(article: Article, terms: string[]): number {
  const title = normalize(article.title);
  const body = normalize(article.content);
  const tags = (article.tags ?? []).map(normalize);
  let score = 0;
  for (const t of terms) {
    if (title.includes(t)) score += 5;
    if (tags.some((tag) => tag.includes(t))) score += 3;
    if (body.includes(t)) score += 1;
  }
  return score;
}

function excerpt(content: string, length = 110) {
  const plain = content.replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > length ? `${plain.slice(0, length)}…` : plain;
}

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [votes, setVotes] = useState<Record<string, "up" | "down">>(readVotes);

  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const { articleId: articleParam } = useParams<{ articleId?: string }>();
  // Legacy ?article= links keep working; canonical form is /knowledge-base/:id.
  const articleId = articleParam ?? searchParams.get("article");

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setSearchParams(next, { replace: !("article" in patch) });
  };

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("knowledge_base")
      .select("id, title, content, category, tags, view_count, helpful_count, not_helpful_count, created_at, updated_at")
      .eq("is_published", true)
      .order("view_count", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadError(true);
        else {
          setArticles(((data ?? []) as Article[]).map((a) => ({
            ...a,
            title: cleanContent(a.title),
            content: cleanContent(a.content),
          })));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => articles.find((a) => a.id === articleId) ?? null, [articles, articleId]);

  useEffect(() => {
    if (!selected) return;
    window.scrollTo({ top: 0 });
    supabase.rpc("kb_record_view", { p_article_id: selected.id }).then(() => undefined);
    track("help_article_view", { category: selected.category });
  }, [selected]);

  const categories = useMemo(
    () => Array.from(new Set(articles.map((a) => a.category))).sort(),
    [articles],
  );

  const results = useMemo(() => {
    let list = category ? articles.filter((a) => a.category === category) : articles;
    const terms = normalize(query).split(/\s+/).filter((t) => t.length > 1);
    if (terms.length > 0) {
      list = list
        .map((a) => ({ a, s: scoreArticle(a, terms) }))
        .filter((x) => x.s > 0)
        .sort((x, y) => y.s - x.s)
        .map((x) => x.a);
    }
    return list;
  }, [articles, query, category]);

  const grouped = useMemo(() => {
    if (query) return [{ name: `Results for “${query}”`, articles: results }];
    const map = new Map<string, Article[]>();
    for (const a of results) map.set(a.category, [...(map.get(a.category) ?? []), a]);
    return Array.from(map, ([name, list]) => ({ name, articles: list }));
  }, [results, query]);

  const vote = async (article: Article, helpful: boolean) => {
    if (votes[article.id]) return;
    const next = { ...votes, [article.id]: helpful ? "up" : "down" } as Record<string, "up" | "down">;
    setVotes(next);
    try { localStorage.setItem(VOTES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setArticles((prev) => prev.map((a) => a.id === article.id
      ? { ...a, helpful_count: a.helpful_count + (helpful ? 1 : 0), not_helpful_count: a.not_helpful_count + (helpful ? 0 : 1) }
      : a));
    await supabase.rpc("kb_record_feedback", { p_article_id: article.id, p_helpful: helpful });
  };

  const header = (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-3xl mx-auto flex items-center justify-between px-4 h-14">
        <button
          onClick={() => (selected ? navigate("/knowledge-base") : navigate(-1))}
          className="p-2 -ml-2 text-foreground hover:opacity-70 flex items-center gap-2"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
          {selected && <span className="text-sm font-medium">Help Center</span>}
        </button>
        <LanguageSelector variant="icon" />
      </div>
    </header>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (selected) {
    const articlePath = `/knowledge-base/${selected.id}`;
    const articleSeo = (
      <Seo
        title={`${selected.title} — ISEXY Help Center`}
        description={excerpt(selected.content, 160)}
        path={articlePath}
        type="article"
        jsonLd={[
          articleSchema({
            title: selected.title,
            description: excerpt(selected.content, 160),
            path: articlePath,
            category: selected.category,
            createdAt: selected.created_at,
            updatedAt: selected.updated_at,
          }),
          breadcrumbSchema([
            { name: "Help Center", path: "/knowledge-base" },
            { name: selected.category, path: `/knowledge-base?category=${encodeURIComponent(selected.category)}` },
            { name: selected.title, path: articlePath },
          ]),
        ]}
      />
    );
    const related = articles.filter((a) => a.category === selected.category && a.id !== selected.id).slice(0, 3);
    const myVote = votes[selected.id];
    return (
      <div className="min-h-screen bg-background">
        {articleSeo}
        {header}
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-28">
          <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold mb-3">
            {selected.category}
          </span>
          <h1 className="text-3xl font-extrabold text-foreground mb-6 leading-tight">{selected.title}</h1>
          <article className="prose prose-neutral dark:prose-invert max-w-none prose-a:text-primary">
            <ReactMarkdown>{selected.content}</ReactMarkdown>
          </article>

          <div className="mt-10 rounded-2xl border border-border p-5 text-center">
            <p className="font-semibold text-foreground mb-3">Was this article helpful?</p>
            {myVote ? (
              <p className="text-sm text-muted-foreground">Thanks for your feedback! 💜</p>
            ) : (
              <div className="flex justify-center gap-3">
                <button onClick={() => vote(selected, true)} className="flex items-center gap-2 px-5 py-2 rounded-full border border-border hover:border-primary hover:text-primary transition-colors">
                  <ThumbsUp className="w-4 h-4" /> Yes
                </button>
                <button onClick={() => vote(selected, false)} className="flex items-center gap-2 px-5 py-2 rounded-full border border-border hover:border-destructive hover:text-destructive transition-colors">
                  <ThumbsDown className="w-4 h-4" /> No
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-gradient-to-br from-primary/10 to-pink-500/10 border border-primary/20 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-primary shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-foreground">Still have a question?</h3>
                <p className="text-sm text-muted-foreground mb-3">Our AI concierge answers instantly in English, Español and Français — or connects you with a person.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openAssistant(`I read "${selected.title}" and still need help.`)} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    Ask the concierge
                  </button>
                  <button onClick={() => navigate("/contact-us")} className="px-4 py-2 rounded-full border border-border text-sm font-semibold text-foreground hover:bg-muted">
                    Contact support
                  </button>
                </div>
              </div>
            </div>
          </div>

          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-bold text-foreground mb-3">Related articles</h2>
              <div className="space-y-2">
                {related.map((a) => <ArticleRow key={a.id} article={a} onOpen={() => navigate(`/knowledge-base/${a.id}`)} />)}
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {header}
      <main className="max-w-3xl mx-auto px-4 pb-28">
        <section className="pt-6 pb-6">
          <h1 className="text-3xl font-extrabold text-foreground mb-1">How can we help?</h1>
          <p className="text-muted-foreground mb-5">Guides for meeting people safely in Canada — and Cuba — your account, payments and more.</p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => updateParams({ q: e.target.value || null })}
              placeholder="Search: refund, verification, recargas, mot de passe…"
              className="w-full h-14 pl-12 pr-12 rounded-2xl bg-card border border-border text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              aria-label="Search help articles"
            />
            {query && (
              <button onClick={() => updateParams({ q: null })} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <button onClick={() => openAssistant(query || undefined)} className="rounded-2xl p-4 text-left bg-gradient-to-br from-primary to-pink-500 text-white shadow-md">
            <Sparkles className="w-6 h-6 mb-2" />
            <span className="font-semibold text-sm block">Ask AI</span>
            <span className="text-xs opacity-85">Instant answers</span>
          </button>
          <button onClick={() => navigate("/contact-us")} className="rounded-2xl p-4 text-left bg-card border border-border">
            <MessageCircle className="w-6 h-6 mb-2 text-primary" />
            <span className="font-semibold text-sm block text-foreground">Contact us</span>
            <span className="text-xs text-muted-foreground">Human support</span>
          </button>
          <button onClick={() => navigate("/faq")} className="rounded-2xl p-4 text-left bg-card border border-border">
            <HelpCircle className="w-6 h-6 mb-2 text-primary" />
            <span className="font-semibold text-sm block text-foreground">FAQ</span>
            <span className="text-xs text-muted-foreground">Quick answers</span>
          </button>
        </div>

        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-hide">
            {["", ...categories].map((c) => (
              <button
                key={c || "all"}
                onClick={() => updateParams({ category: c || null })}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${category === c ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:border-primary/50"}`}
              >
                {c || "All"}
              </button>
            ))}
          </div>
        )}

        {loadError ? (
          <EmptyState title="Help articles couldn't load" body="Check your connection, or ask the AI concierge instead." query={query} />
        ) : results.length === 0 ? (
          <EmptyState
            title={query ? `No articles match “${query}”` : "No help articles yet"}
            body="Our AI concierge can probably answer this right away."
            query={query}
          />
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.name}>
                <h2 className="text-lg font-bold text-foreground mb-3">{group.name}</h2>
                <div className="space-y-2">
                  {group.articles.map((a) => <ArticleRow key={a.id} article={a} onOpen={() => navigate(`/knowledge-base/${a.id}`)} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ArticleRow({ article, onOpen }: { article: Article; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/50 hover:shadow-sm transition flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <BookOpen className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground">{article.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{excerpt(article.content)}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
    </button>
  );
}

function EmptyState({ title, body, query }: { title: string; body: string; query: string }) {
  return (
    <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-border">
      <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{body}</p>
      <button onClick={() => openAssistant(query || undefined)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
        <Sparkles className="w-4 h-4" /> Ask the AI concierge
      </button>
    </div>
  );
}
