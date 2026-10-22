import { Fragment, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, ChevronRight, Search, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { shareLink } from "@/lib/share";
import { AdSlot } from "@/components/AdSlot";
import { feedAdAfter } from "@/lib/ads";

const newsArticles = [
  {
    id: 1,
    title: "ISEXY Is Now a Social Network for Adults in Canada",
    subtitle: "ISEXY is a place for adults (18+) to meet new people and make friends: profiles, swipes, chat with live translation, phone calls and video calls — in English and Canadian French.",
    date: "03 December 2025",
    category: "Trends",
    image: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600&h=400&fit=crop",
  },
  {
    id: 2,
    title: "New Safety Features Rolling Out Globally",
    subtitle: "Profile verification, block and report on every profile, and moderation help keep conversations on ISEXY safe and respectful.",
    date: "22 October 2025",
    category: "Safety",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop",
  },
  {
    id: 3,
    title: "Introducing Double Hangout",
    subtitle: "Bring a friend and meet another pair of friends: a relaxed way to start a group conversation with new people.",
    date: "10 September 2025",
    category: "Features",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=400&fit=crop",
  },
  {
    id: 4,
    title: "Profile Verification Explained",
    subtitle: "How verification helps confirm members are real and look like their profile photos.",
    date: "15 August 2025",
    category: "Safety",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=400&fit=crop",
  },
  {
    id: 5,
    title: "Talk in Any Language: Live Chat Translation",
    subtitle: "Write in English, French or Spanish and your messages are translated live, so language is never a barrier to making a new friend.",
    date: "28 July 2025",
    category: "Research",
    image: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600&h=400&fit=crop",
  },
];

const categories = ["All", "Trends", "Safety", "Features", "Research"];

type Article = (typeof newsArticles)[number];

/** Each article has a shareable link: /news#news-<id>. */
const articleHash = (a: Article) => `news-${a.id}`;

export default function News() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [openArticle, setOpenArticle] = useState<Article | null>(null);

  // Open the article a shared link points to.
  useEffect(() => {
    const id = location.hash.replace("#", "");
    const found = newsArticles.find((a) => articleHash(a) === id);
    if (found) setOpenArticle(found);
  }, [location.hash]);

  const open = (article: Article) => {
    setOpenArticle(article);
    navigate({ hash: articleHash(article) }, { replace: true });
  };
  const close = () => {
    setOpenArticle(null);
    navigate({ hash: "" }, { replace: true });
  };
  const share = (article: Article) => shareLink({
    title: article.title,
    text: article.subtitle,
    url: `/news#${articleHash(article)}`,
  });

  const filteredArticles = newsArticles.filter((article) => {
    const matchesCategory = selectedCategory === "All" || article.category === selectedCategory;
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="p-2 -ml-2" aria-label="Go back">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">News & Updates</h1>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search news"
            className="w-full pl-10 pr-4 py-3 bg-muted rounded-xl outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              aria-pressed={selectedCategory === category}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Article */}
      {filteredArticles.length > 0 && (
        <div className="px-4 mb-6">
          <button
            onClick={() => open(filteredArticles[0])}
            className="w-full bg-card rounded-2xl overflow-hidden shadow-sm border border-border text-left"
          >
            <div className="aspect-video relative">
              <img
                src={filteredArticles[0].image}
                alt={filteredArticles[0].title}
                className="w-full h-full object-cover"
                decoding="async"
              />
              <div className="absolute top-3 left-3">
                <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                  {filteredArticles[0].category}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h2 className="text-lg font-bold text-foreground mb-2">
                {filteredArticles[0].title}
              </h2>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {filteredArticles[0].subtitle}
              </p>
              <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="w-4 h-4 mr-1" />
                {filteredArticles[0].date}
              </div>
            </div>
          </button>
          {feedAdAfter(0, filteredArticles.length) && <AdSlot placement="isexy-feed-inline" className="mt-4" />}
        </div>
      )}

      {/* Article List */}
      <div className="px-4 pb-8">
        <h3 className="text-lg font-bold text-foreground mb-4">Recent News</h3>
        <div className="space-y-4">
          {filteredArticles.slice(1).map((article, i) => (
            <Fragment key={article.id}>
            <button
              onClick={() => open(article)}
              className="w-full flex gap-4 p-3 bg-card rounded-xl border border-border text-left hover:bg-muted/50 transition-colors"
            >
              <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={article.image}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-primary">
                  {article.category}
                </span>
                <h4 className="font-semibold text-foreground line-clamp-2 mb-1">
                  {article.title}
                </h4>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1" />
                  {article.date}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 self-center" />
            </button>
            {/* Free members and visitors: one inline card every 6 articles (the featured one counts). */}
            {feedAdAfter(i + 1, filteredArticles.length) && <AdSlot placement="isexy-feed-inline" />}
            </Fragment>
          ))}
        </div>
      </div>

      {filteredArticles.length === 0 && (
        <div className="px-4 py-16 text-center">
          <p className="text-muted-foreground">No articles found matching your search.</p>
        </div>
      )}

      <Dialog open={!!openArticle} onOpenChange={(o) => { if (!o) close(); }}>
        {openArticle && (
          <DialogContent className="w-[calc(100%-2rem)] max-w-lg p-0 overflow-hidden rounded-2xl max-h-[90dvh] overflow-y-auto">
            <div className="relative aspect-video">
              <img src={openArticle.image} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/60 to-transparent" />
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{openArticle.category}</span>
                <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{openArticle.date}</span>
              </div>
              <DialogTitle className="text-xl font-bold text-foreground leading-snug">{openArticle.title}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">{openArticle.subtitle}</DialogDescription>
              <Button variant="outline" className="w-full" onClick={() => share(openArticle)}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
