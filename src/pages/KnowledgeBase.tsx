import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  BookOpen, 
  ChevronRight, 
  ThumbsUp, 
  ThumbsDown,
  MessageCircle,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSelector } from "@/components/LanguageSelector";

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
}

interface CategoryGroup {
  name: string;
  articles: Article[];
}

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = articles.filter(
        article =>
          article.title.toLowerCase().includes(query) ||
          article.content.toLowerCase().includes(query) ||
          article.tags.some(tag => tag.toLowerCase().includes(query))
      );
      setFilteredArticles(filtered);
    } else {
      setFilteredArticles(articles);
    }
  }, [searchQuery, articles]);

  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("is_published", true)
      .order("view_count", { ascending: false });

    if (!error && data) {
      setArticles(data);
      setFilteredArticles(data);
    }
    setLoading(false);
  };

  const handleArticleClick = async (article: Article) => {
    setSelectedArticle(article);
    setFeedback(null);
    
    // Increment view count
    await supabase
      .from("knowledge_base")
      .update({ view_count: article.view_count + 1 })
      .eq("id", article.id);
  };

  const handleFeedback = async (isHelpful: boolean) => {
    if (!selectedArticle || feedback) return;

    setFeedback(isHelpful ? 'helpful' : 'not_helpful');
    
    await supabase
      .from("knowledge_base")
      .update({
        [isHelpful ? 'helpful_count' : 'not_helpful_count']: 
          (isHelpful ? selectedArticle.helpful_count : selectedArticle.not_helpful_count) + 1
      })
      .eq("id", selectedArticle.id);
  };

  const groupByCategory = (articles: Article[]): CategoryGroup[] => {
    const groups: { [key: string]: Article[] } = {};
    articles.forEach(article => {
      if (!groups[article.category]) {
        groups[article.category] = [];
      }
      groups[article.category].push(article);
    });
    return Object.entries(groups).map(([name, articles]) => ({ name, articles }));
  };

  if (loading) {
    return (
      <AuthLayout showBack variant="white">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AuthLayout>
    );
  }

  // Article detail view
  if (selectedArticle) {
    return (
      <AuthLayout showBack={false} variant="white">
        <div className="flex-1 flex flex-col pb-20">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setSelectedArticle(null)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Help
            </button>
            <LanguageSelector variant="icon" />
          </div>

          <article className="prose dark:prose-invert max-w-none">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {selectedArticle.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                {selectedArticle.category}
              </span>
              <span>•</span>
              <span>{selectedArticle.view_count} views</span>
            </div>

            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {selectedArticle.content}
            </div>
          </article>

          {/* Feedback section */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-center text-muted-foreground mb-4">
              Was this article helpful?
            </p>
            <div className="flex justify-center gap-4">
              <Button
                variant={feedback === 'helpful' ? 'default' : 'outline'}
                onClick={() => handleFeedback(true)}
                disabled={feedback !== null}
                className="gap-2"
              >
                <ThumbsUp className="w-4 h-4" />
                Yes
              </Button>
              <Button
                variant={feedback === 'not_helpful' ? 'destructive' : 'outline'}
                onClick={() => handleFeedback(false)}
                disabled={feedback !== null}
                className="gap-2"
              >
                <ThumbsDown className="w-4 h-4" />
                No
              </Button>
            </div>
            {feedback && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Thank you for your feedback!
              </p>
            )}
          </div>

          {/* Still need help */}
          <div className="mt-8 bg-muted/50 rounded-xl p-6 text-center">
            <MessageCircle className="w-10 h-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-2">
              Still need help?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Our support team is here for you
            </p>
            <Button onClick={() => navigate("/contact-us")} className="w-full">
              Contact Support
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Main knowledge base view
  const categoryGroups = groupByCategory(filteredArticles);

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col pb-20">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
          <LanguageSelector variant="icon" />
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => navigate("/contact-us")}
            className="bg-primary text-primary-foreground rounded-xl p-4 text-left"
          >
            <MessageCircle className="w-6 h-6 mb-2" />
            <span className="font-semibold">Contact Us</span>
            <p className="text-xs opacity-80 mt-1">Get human support</p>
          </button>
          <button
            onClick={() => navigate("/faq")}
            className="bg-muted rounded-xl p-4 text-left"
          >
            <BookOpen className="w-6 h-6 mb-2 text-foreground" />
            <span className="font-semibold text-foreground">FAQ</span>
            <p className="text-xs text-muted-foreground mt-1">Quick answers</p>
          </button>
        </div>

        {/* Articles by category */}
        {categoryGroups.length === 0 ? (
          <div className="text-center py-10">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? "No articles found" : "No help articles available"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {categoryGroups.map((group) => (
              <div key={group.name}>
                <h2 className="text-lg font-semibold text-foreground mb-3">
                  {group.name}
                </h2>
                <div className="space-y-2">
                  {group.articles.map((article) => (
                    <button
                      key={article.id}
                      onClick={() => handleArticleClick(article)}
                      className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 transition flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {article.content.substring(0, 60)}...
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
