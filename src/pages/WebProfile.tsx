import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { MatchCelebration } from "@/components/MatchCelebration";
import { Seo } from "@/components/Seo";
import {
  ArrowLeft, BadgeCheck, Briefcase, Copy, ExternalLink, Flag, GraduationCap, Heart,
  Loader2, Lock, MapPin, MessageCircle, Share2, Star, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useChatOpener } from "@/hooks/useChatOpener";
import { ageFrom } from "@/lib/discoverFeed";
import { findMatchId, performSwipe, type SwipeAction } from "@/lib/likes";
import { copyLink, shareLink, shareUrl } from "@/lib/share";

/**
 * /web-profile          → the member's own profile link (copy, share, preview)
 * /web-profile/:userId  → a member's profile. Profiles are visible to signed-in
 *                          members only (RLS), so a visitor gets a sign-in prompt.
 */
export default function WebProfile() {
  const { userId } = useParams<{ userId: string }>();
  return userId ? <MemberProfile id={userId} /> : <ManageWebProfile />;
}

const profilePath = (id: string) => `/web-profile/${id}`;

function ManageWebProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <AuthLayout showBack variant="gray">
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="Loading" /></div>
      </AuthLayout>
    );
  }

  if (!user || !profile) {
    return (
      <AuthLayout showBack variant="gray">
        <div className="text-center py-12 space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Web Profile</h1>
          <p className="text-muted-foreground">Sign in to get a link to your ISEXY profile.</p>
          <Button onClick={() => navigate("/auth", { state: { from: location.pathname } })}>Sign in</Button>
        </div>
      </AuthLayout>
    );
  }

  const path = profilePath(profile.id);
  const link = shareUrl(path);
  const share = () => shareLink({
    title: `${profile.first_name} on ISEXY`,
    text: `Say hi to me on ISEXY`,
    url: path,
  });

  return (
    <AuthLayout showBack variant="gray">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Web Profile</h1>
          <p className="text-muted-foreground mt-1">Share a link to your profile with friends</p>
        </div>

        {/* Profile Link */}
        <div className="bg-card rounded-xl p-4 space-y-4">
          <h2 className="font-semibold text-foreground">Your Profile Link</h2>
          <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {link.replace(/^https?:\/\//, "")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => copyLink(path)}
              aria-label="Copy link"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => copyLink(path)}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="outline" className="flex-1" onClick={share}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Who can see it */}
        <div className="bg-card rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Who can open it</h2>
          <p className="text-sm text-muted-foreground">
            Only signed-in ISEXY members (18+) can see your profile from this link. Anyone else is asked to sign in first.
            Your profile is never shown to search engines.
          </p>
          <h2 className="font-semibold text-foreground pt-2">What's visible</h2>
          <ul className="text-sm text-muted-foreground space-y-2">
            {["Your first name and age", "Your photos", "Your bio and interests", "Your city, work and school if you added them"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Your exact location and contact information are never shared.
          </p>
        </div>

        {/* Preview Button */}
        <Button variant="outline" className="w-full" onClick={() => navigate(path)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Preview Web Profile
        </Button>
      </div>
    </AuthLayout>
  );
}

interface MemberData {
  id: string;
  first_name: string;
  birth_date: string;
  bio: string | null;
  city: string | null;
  job_title: string | null;
  company: string | null;
  school: string | null;
  is_verified: boolean | null;
  interests: string[] | null;
  photos: string[];
}

type Relation =
  | { kind: "none" }
  | { kind: "liked" | "passed" }
  | { kind: "matched"; matchId: string };

function MemberProfile({ id }: { id: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile: me, loading: authLoading } = useAuth();
  const { openChat, contactModal } = useChatOpener();
  const [member, setMember] = useState<MemberData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [relation, setRelation] = useState<Relation>({ kind: "none" });
  const [photo, setPhoto] = useState(0);
  const [acting, setActing] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const meId = me?.id;
  const isMe = meId === id;
  const signedIn = !!user;

  useEffect(() => {
    if (authLoading || !signedIn) return;
    let alive = true;
    (async () => {
      setState("loading");
      try {
        const [{ data: p, error }, { data: photos }, blocked, mine] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, first_name, birth_date, bio, city, job_title, company, school, is_verified, interests")
            .eq("id", id)
            .maybeSingle(),
          supabase.from("profile_photos").select("photo_url, position").eq("profile_id", id).order("position"),
          meId ? supabase.from("blocks").select("id").eq("blocker_id", meId).eq("blocked_id", id).maybeSingle() : Promise.resolve({ data: null }),
          meId && meId !== id ? supabase.from("swipes").select("action").eq("swiper_id", meId).eq("swiped_id", id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        if (error) throw error;
        if (!alive) return;
        if (!p || blocked.data) {
          setState("missing");
          return;
        }
        setMember({ ...p, photos: (photos ?? []).map((ph) => ph.photo_url) });
        const action = (mine.data as { action?: string } | null)?.action;
        if (action && meId) {
          const matchId = action === "pass" ? null : await findMatchId(meId, id);
          if (alive) setRelation(matchId ? { kind: "matched", matchId } : { kind: action === "pass" ? "passed" : "liked" });
        }
        setState("ready");
      } catch (e) {
        console.error("Web profile failed:", e);
        if (alive) setState("error");
      }
    })();
    return () => { alive = false; };
  }, [id, signedIn, authLoading, meId]);

  const share = () => shareLink({
    title: member ? `${member.first_name} on ISEXY` : "A member on ISEXY",
    text: member ? `Meet ${member.first_name} on ISEXY` : "Meet new people on ISEXY",
    url: profilePath(id),
  });

  const act = async (action: SwipeAction) => {
    if (!me || !member || acting) return;
    setActing(true);
    const outcome = await performSwipe(me, member.id, action);
    setActing(false);
    switch (outcome.status) {
      case "ok":
        if (outcome.matchId) {
          setRelation({ kind: "matched", matchId: outcome.matchId });
          setCelebrate(outcome.matchId);
        } else {
          setRelation({ kind: action === "pass" ? "passed" : "liked" });
          if (action !== "pass") toast.success(`You liked ${member.first_name}`);
        }
        return;
      case "no_likes":
        toast.error("You're out of likes for now.", { action: { label: "Go Premium", onClick: () => navigate("/premium") } });
        return;
      case "no_super_likes":
        navigate("/get-super-likes");
        return;
      case "rate_limited":
        toast.error(`Daily swipe limit reached — back in ${outcome.cooldownHours}h.`);
        return;
      default:
        toast.error("Couldn't save that. Please try again.");
    }
  };

  const header = (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(user ? "/discover" : "/"))}
        className="p-2 -ml-2"
        aria-label="Go back"
      >
        <ArrowLeft className="w-6 h-6 text-foreground" />
      </button>
      <h1 className="text-lg font-bold text-foreground truncate">{member ? member.first_name : "Profile"}</h1>
      <button onClick={share} className="p-2 -mr-2" aria-label="Share this profile">
        <Share2 className="w-5 h-5 text-foreground" />
      </button>
    </header>
  );

  const seo = <Seo title={member ? `${member.first_name} on ISEXY` : "A member on ISEXY"} description="Meet new people and make friends on ISEXY, a social network for adults (18+) in Canada." path={profilePath(id)} noindex />;

  if (authLoading || (user && state === "loading")) {
    return (
      <div className="min-h-screen bg-background">
        {seo}
        {header}
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading profile" /></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        {seo}
        {header}
        <div className="max-w-sm mx-auto text-center px-6 py-16 space-y-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Lock className="w-9 h-9 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Sign in to see this profile</h2>
          <p className="text-muted-foreground">
            Profiles on ISEXY are for members only. ISEXY is a Canadian social network for adults (18+) to meet new people and make friends.
          </p>
          <Button className="w-full" onClick={() => navigate("/auth", { state: { from: location.pathname } })}>Sign in or join</Button>
          <Button variant="outline" className="w-full" onClick={share}><Share2 className="w-4 h-4 mr-2" />Share</Button>
        </div>
      </div>
    );
  }

  if (state !== "ready" || !member) {
    return (
      <div className="min-h-screen bg-background">
        {seo}
        {header}
        <div className="max-w-sm mx-auto text-center px-6 py-16 space-y-4" role="alert">
          <h2 className="text-2xl font-bold text-foreground">
            {state === "error" ? "We couldn't load this profile" : "This profile isn't available"}
          </h2>
          <p className="text-muted-foreground">
            {state === "error" ? "Check your connection and try again." : "The member may have paused or closed their account."}
          </p>
          <Button onClick={() => (state === "error" ? window.location.reload() : navigate("/discover"))}>
            {state === "error" ? "Try again" : "Go to Discover"}
          </Button>
        </div>
      </div>
    );
  }

  const age = ageFrom(member.birth_date);

  return (
    <div className="min-h-screen bg-background pb-40">
      {seo}
      {header}

      {celebrate && (
        <MatchCelebration
          isOpen
          onClose={() => setCelebrate(null)}
          onChatNow={() => {
            const matchId = celebrate;
            setCelebrate(null);
            openChat({ matchId, otherName: member.first_name, otherPhotoUrl: member.photos[0] });
          }}
          matchName={member.first_name}
          matchPhotoUrl={member.photos[0]}
        />
      )}
      {contactModal}

      <div className="max-w-lg mx-auto">
        {/* Photos */}
        <div className="relative w-full aspect-[3/4] bg-muted">
          {member.photos[photo] ? (
            <img src={member.photos[photo]} alt={`${member.first_name}, ${age}`} className="w-full h-full object-cover" decoding="async" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl font-bold text-muted-foreground">{member.first_name[0]}</span>
            </div>
          )}
          {member.photos.length > 1 && (
            <>
              <div className="absolute top-2 left-2 right-2 flex gap-1">
                {member.photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhoto(i)}
                    className={`h-1 flex-1 rounded-full ${i === photo ? "bg-white" : "bg-white/40"}`}
                    aria-label={`Photo ${i + 1} of ${member.photos.length}`}
                  />
                ))}
              </div>
              <div className="absolute inset-x-0 top-4 bottom-16 flex">
                <button className="flex-1" onClick={() => setPhoto((p) => Math.max(0, p - 1))} aria-label="Previous photo" />
                <button className="flex-1" onClick={() => setPhoto((p) => Math.min(member.photos.length - 1, p + 1))} aria-label="Next photo" />
              </div>
            </>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Info */}
        <div className="px-4 -mt-10 relative z-10 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold text-foreground">{member.first_name}, {age}</h2>
            {member.is_verified && <BadgeCheck className="w-7 h-7 text-cyan-400" aria-label="Verified" />}
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            {member.city && <p className="flex items-center gap-1"><MapPin className="w-4 h-4" />{member.city}</p>}
            {(member.job_title || member.company) && (
              <p className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{member.job_title}{member.company && ` at ${member.company}`}</p>
            )}
            {member.school && <p className="flex items-center gap-1"><GraduationCap className="w-4 h-4" />{member.school}</p>}
          </div>

          {member.bio && (
            <div>
              <h3 className="font-semibold text-foreground mb-1">About</h3>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{member.bio}</p>
            </div>
          )}

          {member.interests && member.interests.length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {member.interests.map((interest) => (
                  <span key={interest} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button variant="outline" onClick={share}><Share2 className="w-4 h-4 mr-2" />Share profile</Button>
            {isMe ? (
              <Button variant="outline" onClick={() => navigate("/edit-profile")}>Edit my profile</Button>
            ) : (
              <button onClick={() => navigate(`/block-report/${member.id}`)} className="text-sm text-muted-foreground flex items-center justify-center gap-1 py-2">
                <Flag className="w-4 h-4" /> Report or block {member.first_name}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isMe && me && (
        <div className="fixed bottom-6 inset-x-0 flex items-center justify-center gap-4 z-20 px-4">
          {relation.kind === "matched" ? (
            <Button
              className="rounded-full px-8 py-6 text-base gradient-primary text-white"
              onClick={() => openChat({ matchId: relation.matchId, otherName: member.first_name, otherPhotoUrl: member.photos[0] })}
            >
              <MessageCircle className="w-5 h-5 mr-2" /> Chat with {member.first_name}
            </Button>
          ) : relation.kind === "liked" ? (
            <p className="px-5 py-3 rounded-full bg-card border border-border text-sm text-foreground shadow-lg">You liked {member.first_name}</p>
          ) : relation.kind === "passed" ? (
            <p className="px-5 py-3 rounded-full bg-card border border-border text-sm text-muted-foreground shadow-lg">You passed on {member.first_name}</p>
          ) : (
            <>
              <button
                onClick={() => act("pass")}
                disabled={acting}
                className="w-16 h-16 rounded-full bg-card shadow-lg flex items-center justify-center border border-border disabled:opacity-60 active:scale-90 transition-transform"
                aria-label="Pass"
              >
                <X className="w-8 h-8 text-rose-500" />
              </button>
              <button
                onClick={() => act("super_like")}
                disabled={acting}
                className="w-12 h-12 rounded-full bg-card shadow-lg flex items-center justify-center border border-border disabled:opacity-60 active:scale-90 transition-transform"
                aria-label="Super Like"
              >
                <Star className="w-5 h-5 text-cyan-400 fill-cyan-400" />
              </button>
              <button
                onClick={() => act("like")}
                disabled={acting}
                className="w-16 h-16 rounded-full bg-card shadow-lg flex items-center justify-center border border-border disabled:opacity-60 active:scale-90 transition-transform"
                aria-label="Like"
              >
                {acting ? <Loader2 className="w-7 h-7 animate-spin text-primary" /> : <Heart className="w-8 h-8 text-green-500 fill-green-500" />}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
