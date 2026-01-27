import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  BookOpen,
  Loader2,
  Save,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_published: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  "Account",
  "Billing",
  "Credits",
  "Matches",
  "Messages",
  "Privacy",
  "Safety",
  "Subscription",
  "Technical",
  "Verification",
  "Other"
];

export default function AdminKnowledgeBase() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Partial<KnowledgeArticle> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .order("category")
      .order("title");

    if (error) {
      toast.error("Failed to load articles");
    } else {
      setArticles(data || []);
    }
    setLoading(false);
  };

  const handleCreateNew = () => {
    setEditingArticle({
      title: "",
      content: "",
      category: "Account",
      tags: [],
      is_published: false
    });
    setIsEditing(true);
  };

  const handleEdit = (article: KnowledgeArticle) => {
    setEditingArticle(article);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editingArticle?.title || !editingArticle?.content || !editingArticle?.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);

    if (editingArticle.id) {
      // Update existing
      const { error } = await supabase
        .from("knowledge_base")
        .update({
          title: editingArticle.title,
          content: editingArticle.content,
          category: editingArticle.category,
          tags: editingArticle.tags || [],
          is_published: editingArticle.is_published,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingArticle.id);

      if (error) {
        toast.error("Failed to update article");
      } else {
        toast.success("Article updated");
        setIsEditing(false);
        setEditingArticle(null);
        fetchArticles();
      }
    } else {
      // Create new
      const { error } = await supabase
        .from("knowledge_base")
        .insert({
          title: editingArticle.title,
          content: editingArticle.content,
          category: editingArticle.category,
          tags: editingArticle.tags || [],
          is_published: editingArticle.is_published
        });

      if (error) {
        toast.error("Failed to create article");
      } else {
        toast.success("Article created");
        setIsEditing(false);
        setEditingArticle(null);
        fetchArticles();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;

    const { error } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete article");
    } else {
      toast.success("Article deleted");
      fetchArticles();
    }
  };

  const handleTogglePublish = async (article: KnowledgeArticle) => {
    const { error } = await supabase
      .from("knowledge_base")
      .update({ is_published: !article.is_published })
      .eq("id", article.id);

    if (error) {
      toast.error("Failed to update article");
    } else {
      toast.success(article.is_published ? "Article unpublished" : "Article published");
      fetchArticles();
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = !searchQuery || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isEditing && editingArticle) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => { setIsEditing(false); setEditingArticle(null); }} className="p-2">
                <X className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold">
                {editingArticle.id ? "Edit Article" : "New Article"}
              </h1>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Title *</label>
              <Input
                value={editingArticle.title || ""}
                onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                placeholder="Article title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Category *</label>
              <select
                value={editingArticle.category || ""}
                onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                className="w-full p-3 bg-background border border-border rounded-lg"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Content *</label>
              <textarea
                value={editingArticle.content || ""}
                onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                placeholder="Write the article content here... Supports markdown formatting."
                rows={15}
                className="w-full p-3 bg-background border border-border rounded-lg resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Tags (comma separated)</label>
              <Input
                value={editingArticle.tags?.join(", ") || ""}
                onChange={(e) => setEditingArticle({ 
                  ...editingArticle, 
                  tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean)
                })}
                placeholder="billing, payment, subscription"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="published"
                checked={editingArticle.is_published || false}
                onChange={(e) => setEditingArticle({ ...editingArticle, is_published: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="published" className="text-sm font-medium text-foreground">
                Publish article (visible to AI chatbot and users)
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold">Knowledge Base</h1>
              <p className="text-sm text-muted-foreground">
                Manage support articles for the AI chatbot
              </p>
            </div>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            New Article
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {CATEGORIES.slice(0, 5).map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Articles List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No articles found</h2>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Create your first knowledge base article"}
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Create Article
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredArticles.map(article => (
              <div
                key={article.id}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground truncate">{article.title}</h3>
                      <Badge variant={article.is_published ? "default" : "secondary"}>
                        {article.is_published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {article.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="bg-muted px-2 py-1 rounded">{article.category}</span>
                      <span>{article.view_count} views</span>
                      <span>👍 {article.helpful_count}</span>
                      <span>👎 {article.not_helpful_count}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTogglePublish(article)}
                      title={article.is_published ? "Unpublish" : "Publish"}
                    >
                      {article.is_published ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(article)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(article.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
