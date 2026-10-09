import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Shield, Search, Smile, X, CreditCard, Smartphone, AlertTriangle, CheckCheck, Lock, BadgeCheck, RefreshCw } from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { OnlineStatusIndicator } from "@/components/OnlineStatusIndicator";
import { ScheduledCallsList } from "@/components/ScheduledCallsList";
import { MissedCallBanner } from "@/components/MissedCallBanner";
import { ContactMethodModal } from "@/components/ContactMethodModal";
import { fetchInbox, relativeTime, type Conversation } from "@/lib/inbox";

const SAFETY_SEEN_KEY = "cubadate_safety_seen";

const safetySlides = [
  {
    id: 1,
    icon: "respect",
    title: "Be respectful",
    content: "Don't bully, harass, or threaten others. We don't support discrimination of any kind. ISEXY is no place for hate.",
    subtitle: "Respect boundaries",
    subcontent: "Always get consent from people before talking about sex or expressing sexual desires.",
  },
  {
    id: 2,
    icon: "scam",
    title: "Is it a scam?",
    content: "Be mindful of someone playing on your emotions or claiming they desperately need money. It's okay to say \"no.\"",
    subtitle: "Spot a get-rich-quick scheme",
    subcontent: "If someone promises a big cash-out that sounds too good to be true – it probably is. Trust your gut.",
  },
  {
    id: 3,
    icon: "verify",
    title: "Take your time, if you want",
    content: "You can always ask someone to get Photo Verified or video chat first before sharing too much info or meeting up.",
    subtitle: "Unmatch, block, or report",
    subcontent: "If someone crosses a line, tell us. Reports are treated confidentially. You can also block or unmatch them.",
  },
];

export default function Messages() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { language } = useLanguage();
  // Read once synchronously so the safety dialog never flashes for returning members.
  const [showSafetyModal, setShowSafetyModal] = useState(() => {
    try { return !localStorage.getItem(SAFETY_SEEN_KEY); } catch { return false; }
  });
  const [safetySlide, setSafetySlide] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [contactModal, setContactModal] = useState<{
    matchId: string;
    otherName: string;
    otherPhotoUrl?: string;
  } | null>(null);
  const refreshTimer = useRef<number>();

  const load = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setConversations(await fetchInbox(profile));
      setLoadError(false);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.is_premium]);

  useEffect(() => { load(); }, [load]);

  // Live inbox: new messages, reads and new matches refresh the list (debounced).
  useEffect(() => {
    if (!profile?.id) return;
    const schedule = () => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(load, 400);
    };
    const channel = supabase
      .channel(`inbox-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "isexy", table: "messages" }, schedule)
      .on("postgres_changes", { event: "*", schema: "isexy", table: "matches" }, schedule)
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && schedule();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", onFocus);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? conversations.filter((c) => c.first_name.toLowerCase().includes(q)) : conversations;
  }, [conversations, query]);
  const newMatches = filtered.filter((c) => !c.last_message_preview);
  const threads = filtered.filter((c) => c.last_message_preview);
  const totalUnread = conversations.reduce((n, c) => n + c.unread_count, 0);

  const open = (c: Conversation) => {
    if (c.is_unlocked) navigate(`/chat/${c.match_id}`);
    else setContactModal({ matchId: c.match_id, otherName: c.first_name, otherPhotoUrl: c.photo_url ?? undefined });
  };

  const handleSafetyNext = () => {
    if (safetySlide < safetySlides.length - 1) {
      setSafetySlide(safetySlide + 1);
    } else {
      try { localStorage.setItem(SAFETY_SEEN_KEY, "true"); } catch { /* ignore */ }
      setShowSafetyModal(false);
    }
  };

  const renderSafetyIcon = (icon: string) => {
    switch (icon) {
      case "respect":
        return (
          <div className="w-24 h-24 bg-muted rounded-xl flex items-center justify-center mx-auto mb-6">
            <div className="relative">
              <div className="w-16 h-10 bg-cyan-400 rounded-lg flex items-center justify-center">
                <span className="text-white text-2xl">💙</span>
              </div>
              <Smile className="absolute -top-2 -right-2 w-6 h-6 text-cyan-600" />
            </div>
          </div>
        );
      case "scam":
        return (
          <div className="w-24 h-24 bg-muted rounded-xl flex items-center justify-center mx-auto mb-6">
            <div className="relative">
              <CreditCard className="w-12 h-12 text-cyan-400" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-muted-foreground rounded-full flex items-center justify-center">
                <span className="text-background text-xs">$</span>
              </div>
            </div>
          </div>
        );
      case "verify":
        return (
          <div className="w-24 h-24 bg-muted rounded-xl flex items-center justify-center mx-auto mb-6">
            <div className="relative">
              <Smartphone className="w-12 h-12 text-cyan-400" />
              <AlertTriangle className="absolute -top-1 -left-1 w-5 h-5 text-cyan-600" />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Safety Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-3xl max-w-sm w-full p-6 relative">
            <button
              onClick={() => {
                try { localStorage.setItem(SAFETY_SEEN_KEY, "true"); } catch { /* ignore */ }
                setShowSafetyModal(false);
              }}
              className="absolute top-4 right-4 p-2"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-cyan-500" />
              <span className="font-semibold text-foreground">Date Safely</span>
            </div>

            {renderSafetyIcon(safetySlides[safetySlide].icon)}

            <h3 className="font-bold text-lg text-foreground mb-2">
              {safetySlides[safetySlide].title}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {safetySlides[safetySlide].content}
            </p>

            <h4 className="font-bold text-foreground mb-1">
              {safetySlides[safetySlide].subtitle}
            </h4>
            <p className="text-muted-foreground text-sm mb-8">
              {safetySlides[safetySlide].subcontent}
            </p>

            {/* Dots */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {safetySlides.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all ${
                    idx === safetySlide ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <AuthButton variant="dark" onClick={handleSafetyNext}>
              {safetySlide === safetySlides.length - 1 ? "Got it" : "Next"}
            </AuthButton>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl px-4 pt-12 pb-4 border-b border-border/40">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Chat{totalUnread > 0 && <span className="sr-only">, {totalUnread} unread</span>}
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSafetyModal(true)} className="p-2 rounded-full hover:bg-muted/60 transition-colors" aria-label="Safety tips">
              <Shield className="w-5 h-5 text-muted-foreground" />
            </button>
            <button onClick={() => navigate("/referrals")} className="p-2 rounded-full hover:bg-muted/60 transition-colors relative" aria-label="Referrals">
              <Smile className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-background" />
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-muted/40 border border-border/40 focus-within:border-primary/60 transition-colors">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${conversations.length} ${conversations.length === 1 ? "match" : "matches"}`}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            aria-label="Search matches by name"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search"><X className="w-4 h-4 text-muted-foreground" /></button>
          )}
        </label>
      </div>

      <div className="px-4 pt-4">
        <ScheduledCallsList />
        <MissedCallBanner />
      </div>

      <div className="flex-1 px-4">
        {loading ? (
          <div className="space-y-2 mt-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-14 h-14 rounded-full bg-muted/40 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-muted/40 rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-muted/30 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError && conversations.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-semibold text-foreground mb-1">Couldn't load your chats</p>
            <p className="text-sm text-muted-foreground mb-4">Check your connection and try again.</p>
            <button onClick={() => { setLoading(true); load(); }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-secondary/20 blur-2xl" />
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-xl shadow-primary/30">
                <Smile className="w-12 h-12 text-primary-foreground" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Get swiping</h2>
            <p className="text-muted-foreground max-w-xs mb-6">When you match with other users they'll appear here, ready to chat.</p>
            <button onClick={() => navigate("/discover")} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-lg shadow-primary/30">
              Start swiping
            </button>
          </div>
        ) : (
          <>
            {newMatches.length > 0 && (
              <section className="mt-3" aria-label="New matches">
                <h2 className="text-sm font-bold text-foreground mb-3">New matches</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                  {newMatches.map((c) => (
                    <button key={c.match_id} onClick={() => open(c)} className="shrink-0 w-[76px] text-center">
                      <div className="relative w-[76px] h-[96px] rounded-2xl overflow-hidden bg-muted ring-2 ring-primary/70">
                        {c.photo_url ? (
                          <img src={c.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">{c.first_name[0]}</span>
                        )}
                        {!c.is_unlocked && <Lock className="absolute top-1.5 right-1.5 w-4 h-4 text-white drop-shadow" />}
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-foreground truncate">{c.first_name}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {threads.length > 0 && (
              <section className="mt-3" aria-label="Messages">
                {newMatches.length > 0 && <h2 className="text-sm font-bold text-foreground mb-2">Messages</h2>}
                <div className="space-y-2">
                  {threads.map((c) => (
                    <button
                      key={c.match_id}
                      onClick={() => open(c)}
                      className="w-full flex items-center gap-3 p-3 bg-card/60 backdrop-blur-sm rounded-2xl border border-border/60 hover:bg-card hover:border-primary/40 active:scale-[0.99] transition-all"
                    >
                      <div className="relative w-14 h-14 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-2 ring-border/40">
                        {c.photo_url ? (
                          <img src={c.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-muted-foreground text-xl font-bold">{c.first_name[0]}</div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-card rounded-full">
                          <OnlineStatusIndicator lastActiveAt={c.last_active_at} size="sm" />
                        </div>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className={`truncate flex items-center gap-1 ${c.unread_count > 0 ? "font-bold text-foreground" : "font-semibold text-foreground/90"}`}>
                            {c.first_name}
                            {c.is_verified && <BadgeCheck className="w-4 h-4 text-cyan-400 shrink-0" aria-label="Verified" />}
                          </h3>
                          <span className={`text-xs shrink-0 ${c.unread_count > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            {relativeTime(c.last_message_at, language.code)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${c.unread_count > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground"}`}>
                            {!c.is_unlocked ? (
                              <span className="flex items-center gap-1 text-amber-500"><Lock className="w-3 h-3" />Unlock to reply</span>
                            ) : (
                              <>
                                {c.last_message_mine && <CheckCheck className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-muted-foreground" aria-label="You:" />}
                                {c.last_message_preview}
                              </>
                            )}
                          </p>
                          {c.unread_count > 0 && (
                            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary flex items-center justify-center">
                              <span className="text-[10px] font-bold text-primary-foreground">{c.unread_count > 9 ? "9+" : c.unread_count}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-10">No match named “{query}”.</p>
            )}
          </>
        )}
      </div>

      {contactModal && (
        <ContactMethodModal
          isOpen={true}
          onClose={() => { setContactModal(null); load(); }}
          matchId={contactModal.matchId}
          otherName={contactModal.otherName}
          otherPhotoUrl={contactModal.otherPhotoUrl}
        />
      )}

      <BottomNav />
    </div>
  );
}
