import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Shield, Search, Smile, X, CreditCard, Smartphone, AlertTriangle, CheckCheck, Lock } from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { OnlineStatusIndicator } from "@/components/OnlineStatusIndicator";
import { ScheduledCallsList } from "@/components/ScheduledCallsList";
import { MissedCallBanner } from "@/components/MissedCallBanner";
import { ContactMethodModal } from "@/components/ContactMethodModal";

interface Match {
  id: string;
  other_profile: {
    id: string;
    first_name: string;
    photo_url?: string;
    last_active_at?: string | null;
  };
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  is_unlocked: boolean;
}

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
  const [showSafetyModal, setShowSafetyModal] = useState(true);
  const [safetySlide, setSafetySlide] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactModal, setContactModal] = useState<{
    matchId: string;
    otherName: string;
    otherPhotoUrl?: string;
  } | null>(null);

  useEffect(() => {
    // Check if user has seen safety tips
    const hasSeen = localStorage.getItem("cubadate_safety_seen");
    if (hasSeen) {
      setShowSafetyModal(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.id) {
      fetchMatches();
    }
  }, [profile?.id]);

  const fetchMatches = async () => {
    if (!profile?.id) return;
    
    try {
      const [matchesRes, blocksRes] = await Promise.all([
        supabase
          .from("matches")
          .select(`id, last_message_at, profile1_id, profile2_id`)
          .or(`profile1_id.eq.${profile.id},profile2_id.eq.${profile.id}`)
          .eq("is_active", true)
          .order("last_message_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${profile.id},blocked_id.eq.${profile.id}`),
      ]);

      if (matchesRes.error) throw matchesRes.error;
      const blockedIds = new Set<string>(
        (blocksRes.data || []).map((b: any) =>
          b.blocker_id === profile.id ? b.blocked_id : b.blocker_id
        )
      );
      const data = (matchesRes.data || []).filter((m: any) => {
        const other = m.profile1_id === profile.id ? m.profile2_id : m.profile1_id;
        return !blockedIds.has(other);
      });

      // Get the other profile for each match
      const matchesWithProfiles = await Promise.all(
        (data || []).map(async (match) => {
          const otherProfileId = match.profile1_id === profile.id ? match.profile2_id : match.profile1_id;
          
          const [profileResult, photoResult, unreadResult, unlockResult, lastMsgResult] = await Promise.all([
            supabase
              .from("profiles")
              .select("id, first_name, last_active_at")
              .eq("id", otherProfileId)
              .single(),
            supabase
              .from("profile_photos")
              .select("photo_url")
              .eq("profile_id", otherProfileId)
              .order("position")
              .limit(1)
              .maybeSingle(),
            supabase
              .from("messages")
              .select("id")
              .eq("match_id", match.id)
              .neq("sender_id", profile.id)
              .eq("is_read", false),
            supabase
              .from("conversation_unlocks")
              .select("id")
              .eq("match_id", match.id)
              .eq("unlocked_by", profile.id)
              .eq("unlock_type", "chat")
              .maybeSingle(),
            supabase
              .from("messages")
              .select("content, created_at")
              .eq("match_id", match.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          return {
            id: match.id,
            other_profile: {
              id: otherProfileId,
              first_name: profileResult.data?.first_name || "Unknown",
              photo_url: photoResult.data?.photo_url,
              last_active_at: profileResult.data?.last_active_at,
            },
            last_message_at: match.last_message_at || lastMsgResult.data?.created_at || null,
            last_message_preview: lastMsgResult.data?.content || null,
            unread_count: unreadResult.data?.length || 0,
            is_unlocked: unlockResult.data !== null || profile.is_premium === true,
          };
        })
      );

      setMatches(matchesWithProfiles);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSafetyNext = () => {
    if (safetySlide < safetySlides.length - 1) {
      setSafetySlide(safetySlide + 1);
    } else {
      localStorage.setItem("cubadate_safety_seen", "true");
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
                localStorage.setItem("cubadate_safety_seen", "true");
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
            Chat
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSafetyModal(true)}
              className="p-2 rounded-full hover:bg-muted/60 transition-colors"
              aria-label="Safety tips"
            >
              <Shield className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/referrals")}
              className="p-2 rounded-full hover:bg-muted/60 transition-colors relative"
              aria-label="Referrals"
            >
              <Smile className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-background" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-muted/40 border border-border/40">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search {matches.length} matches</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        <ScheduledCallsList />
        <MissedCallBanner />
      </div>

      <div className="flex-1 px-4">
        {loading ? (
          <div className="space-y-2 mt-4">
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
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-secondary/20 blur-2xl" />
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-xl shadow-primary/30">
                <Smile className="w-12 h-12 text-primary-foreground" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Get swiping</h2>
            <p className="text-muted-foreground max-w-xs mb-6">
              When you match with other users they'll appear here, ready to chat.
            </p>
            <button
              onClick={() => navigate("/discover")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow"
            >
              Start swiping
            </button>
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {matches.map((match) => (
              <button
                key={match.id}
                onClick={() => {
                  if (match.is_unlocked) {
                    navigate(`/chat/${match.id}`);
                  } else {
                    setContactModal({
                      matchId: match.id,
                      otherName: match.other_profile.first_name,
                      otherPhotoUrl: match.other_profile.photo_url,
                    });
                  }
                }}
                className="w-full flex items-center gap-3 p-3 bg-card/60 backdrop-blur-sm rounded-2xl border border-border/60 hover:bg-card hover:border-primary/40 transition-all active:scale-[0.99]"
              >
                <div className="relative w-14 h-14 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-2 ring-border/40">
                  {match.other_profile.photo_url ? (
                    <img
                      src={match.other_profile.photo_url}
                      alt={match.other_profile.first_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-muted-foreground text-xl font-bold">
                      {match.other_profile.first_name[0]}
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-card rounded-full">
                    <OnlineStatusIndicator
                      lastActiveAt={match.other_profile.last_active_at || null}
                      size="sm"
                    />
                  </div>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`truncate ${match.unread_count > 0 ? "font-bold text-foreground" : "font-semibold text-foreground/90"}`}>
                      {match.other_profile.first_name}
                    </h3>
                    {match.unread_count > 0 && (
                      <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary-foreground">
                          {match.unread_count > 9 ? "9+" : match.unread_count}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${match.unread_count > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground"}`}>
                    {!match.is_unlocked ? (
                      <span className="flex items-center gap-1 text-amber-500">
                        <Lock className="w-3 h-3" />
                        Subscription required
                      </span>
                    ) : match.last_message_preview
                      ? match.last_message_preview
                      : "Say something!"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contact Method Modal */}
      {contactModal && (
        <ContactMethodModal
          isOpen={true}
          onClose={() => { setContactModal(null); fetchMatches(); }}
          matchId={contactModal.matchId}
          otherName={contactModal.otherName}
          otherPhotoUrl={contactModal.otherPhotoUrl}
        />
      )}

      <BottomNav />
    </div>
  );
}
