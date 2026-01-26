import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MessageSquare, Pin, ChevronRight, ArrowLeft, Send, Clock } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface ForumCategory {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  post_count?: number;
}

interface ForumPost {
  id: string;
  category_id: string;
  author_id: string | null;
  author_name: string;
  title: string;
  content: string;
  is_pinned: boolean;
  reply_count: number;
  view_count: number;
  created_at: string;
}

interface ForumReply {
  id: string;
  post_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

type View = "categories" | "posts" | "thread" | "new-post";

export default function Forum() {
  const { profile } = useAuth();
  const [view, setView] = useState<View>("categories");
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ForumCategory | null>(null);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [loading, setLoading] = useState(true);
  
  // New post fields
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newReply, setNewReply] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("forum_categories" as any)
      .select("*")
      .order("sort_order");

    if (error) {
      console.error("Error fetching categories:", error);
      setLoading(false);
      return;
    }
    
    // Get post counts for each category
    const categoriesWithCounts = await Promise.all(
      ((data as any[]) || []).map(async (cat: any) => {
        const { count } = await supabase
          .from("forum_posts" as any)
          .select("*", { count: "exact", head: true })
          .eq("category_id", cat.id);
        return { ...cat, post_count: count || 0 } as ForumCategory;
      })
    );
    setCategories(categoriesWithCounts);
    setLoading(false);
  };

  const fetchPosts = async (categoryId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("forum_posts" as any)
      .select("*")
      .eq("category_id", categoryId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
    } else {
      setPosts((data as unknown as ForumPost[]) || []);
    }
    setLoading(false);
  };

  const fetchReplies = async (postId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("forum_replies" as any)
      .select("*")
      .eq("post_id", postId)
      .order("created_at");

    if (error) {
      console.error("Error fetching replies:", error);
    } else {
      setReplies((data as unknown as ForumReply[]) || []);
    }
    setLoading(false);
  };

  const handleCategoryClick = (category: ForumCategory) => {
    setSelectedCategory(category);
    fetchPosts(category.id);
    setView("posts");
  };

  const handlePostClick = async (post: ForumPost) => {
    setSelectedPost(post);
    fetchReplies(post.id);
    setView("thread");

    // Increment view count
    await supabase
      .from("forum_posts" as any)
      .update({ view_count: post.view_count + 1 })
      .eq("id", post.id);
  };

  const handleCreatePost = async () => {
    if (!profile || !selectedCategory) {
      toast.error("Please sign in to post");
      return;
    }

    if (!newPostTitle.trim() || !newPostContent.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("forum_posts" as any).insert({
      category_id: selectedCategory.id,
      author_id: profile.id,
      author_name: profile.first_name,
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
    } as any);

    if (error) {
      toast.error("Failed to create post");
    } else {
      toast.success("Post created!");
      setNewPostTitle("");
      setNewPostContent("");
      fetchPosts(selectedCategory.id);
      setView("posts");
    }

    setSubmitting(false);
  };

  const handleReply = async () => {
    if (!profile || !selectedPost) {
      toast.error("Please sign in to reply");
      return;
    }

    if (!newReply.trim()) {
      toast.error("Please enter a reply");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("forum_replies" as any).insert({
      post_id: selectedPost.id,
      author_id: profile.id,
      author_name: profile.first_name,
      content: newReply.trim(),
    } as any);

    if (error) {
      toast.error("Failed to post reply");
    } else {
      toast.success("Reply posted!");
      setNewReply("");
      fetchReplies(selectedPost.id);
    }

    setSubmitting(false);
  };

  const handleBack = () => {
    if (view === "thread") {
      setView("posts");
      setSelectedPost(null);
    } else if (view === "posts" || view === "new-post") {
      setView("categories");
      setSelectedCategory(null);
    }
  };

  if (loading && view === "categories") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Categories view
  if (view === "categories") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Community Forum</h2>
        </div>

        <div className="space-y-3">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category)}
              className={`w-full ${category.color} rounded-2xl p-4 text-left transition-transform active:scale-98 hover:opacity-90`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{category.emoji}</span>
                  <div>
                    <h3 className="font-bold text-white text-lg">{category.name}</h3>
                    <p className="text-white/80 text-sm">{category.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                  <MessageSquare className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">{category.post_count}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Posts list view
  if (view === "posts") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-muted rounded-full">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">{selectedCategory?.name}</h2>
            <p className="text-sm text-muted-foreground">{posts.length} discussions</p>
          </div>
          <Button
            onClick={() => setView("new-post")}
            size="sm"
            className="rounded-full"
          >
            New Post
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No posts yet. Be the first to start a discussion!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <button
                key={post.id}
                onClick={() => handlePostClick(post)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {post.is_pinned && (
                        <Pin className="w-4 h-4 text-primary" />
                      )}
                      <h3 className="font-semibold text-foreground line-clamp-1">{post.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-2">{post.content}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{post.author_name}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(post.created_at), "MMM d")}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {post.reply_count}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // New post view
  if (view === "new-post") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-muted rounded-full">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="text-xl font-bold text-foreground">New Post</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Title</label>
            <Input
              placeholder="Enter post title"
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Content</label>
            <Textarea
              placeholder="Write your post content..."
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              rows={6}
            />
          </div>

          <Button
            onClick={handleCreatePost}
            disabled={submitting || !newPostTitle.trim() || !newPostContent.trim()}
            className="w-full"
          >
            {submitting ? "Posting..." : "Create Post"}
          </Button>
        </div>
      </div>
    );
  }

  // Thread view
  if (view === "thread" && selectedPost) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-muted rounded-full">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="text-xl font-bold text-foreground line-clamp-1">{selectedPost.title}</h2>
        </div>

        {/* Original post */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="font-bold text-primary text-sm">
                {selectedPost.author_name[0]}
              </span>
            </div>
            <div>
              <span className="font-semibold text-foreground">{selectedPost.author_name}</span>
              <p className="text-xs text-muted-foreground">
                {format(new Date(selectedPost.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
          <p className="text-foreground whitespace-pre-wrap">{selectedPost.content}</p>
        </div>

        {/* Replies */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">
            {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            replies.map((reply) => (
              <div key={reply.id} className="bg-muted rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary text-xs">
                      {reply.author_name[0]}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground text-sm">{reply.author_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {format(new Date(reply.created_at), "MMM d 'at' h:mm a")}
                    </span>
                  </div>
                </div>
                <p className="text-foreground text-sm whitespace-pre-wrap">{reply.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Reply input */}
        <div className="flex gap-2 pt-4 border-t border-border">
          <Textarea
            placeholder="Write a reply..."
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            onClick={handleReply}
            disabled={submitting || !newReply.trim()}
            size="icon"
            className="h-auto"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
