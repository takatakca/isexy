import { useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Heart, Shield, Globe, Star, ChevronRight, ChevronDown, ChevronUp,
  Menu, X, Flame,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FacebookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const features = [
  { icon: Shield, title: "Verified Profiles", desc: "ID-verified members for your safety" },
  { icon: Globe, title: "Canada & Cuba", desc: "Chat with live translation in English, French and Spanish" },
  { icon: Heart, title: "Swipe & Match", desc: "When you both swipe right, start chatting" },
  { icon: Star, title: "Calls & Video", desc: "Phone and webcam video calls, right in the app" },
];

const loveStories = [
  { names: "1. Create your profile", location: "Adults 18+ only", quote: "Add a photo, a short bio and your interests, then verify your profile." },
  { names: "2. Swipe to find people", location: "Mutual matches", quote: "Swipe right on people you'd like to talk to. When it's mutual, you can chat." },
  { names: "3. Talk and make friends", location: "Chat, calls & video", quote: "Chat with live translation, then call or video call when you're both ready." },
];

interface MenuSection {
  title: string;
  expandable: boolean;
  items?: { label: string; path: string }[];
  path?: string;
}

const menuSections: MenuSection[] = [
  {
    title: "Products",
    expandable: true,
    items: [
      { label: "Discover Features", path: "/explore" },
      { label: "Premium Features", path: "/premium" },
      { label: "ISEXY Plus®", path: "/compare-plans" },
      { label: "ISEXY Gold™", path: "/compare-plans" },
      { label: "ISEXY Platinum™", path: "/compare-plans" },
    ],
  },
  { title: "Learn More", expandable: false, path: "/about" },
  {
    title: "Safety",
    expandable: true,
    items: [
      { label: "Community Guidelines", path: "/community-guidelines" },
      { label: "Safety Tips", path: "/safety-tips" },
      { label: "Safety Center", path: "/safety" },
      { label: "Online Safety & Regulations", path: "/regulations" },
    ],
  },
  { title: "Support", expandable: false, path: "/help-support" },
  { title: "Download", expandable: false, path: "/signup" },
];

export default function Welcome() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (title: string) => {
    setExpandedSection(prev => (prev === title ? null : title));
  };

  // Returning members (signed in, e.g. opening the installed app) go straight to
  // Discover; ProtectedRoute sends anyone without a complete profile to setup.
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/discover" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav aria-label="Site" className="absolute top-0 left-0 right-0 z-30" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <BrandMark />
          <div className="flex items-center gap-1">
            <LanguageSelector variant="icon" className="h-11 w-11 rounded-full" />
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="w-11 h-11 flex items-center justify-center rounded-full text-foreground/90 hover:bg-secondary transition-colors"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Full-screen Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 brand-ambient flex flex-col"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
              <BrandMark />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="w-11 h-11 flex items-center justify-center rounded-full text-foreground/90 hover:bg-secondary"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-8 mx-auto w-full max-w-lg">
              {menuSections.map((section) => (
                <div key={section.title} className="mb-2">
                  <button
                    onClick={() => {
                      if (section.expandable) {
                        toggleSection(section.title);
                      } else if (section.path) {
                        setMenuOpen(false);
                        navigate(section.path);
                      }
                    }}
                    aria-expanded={section.expandable ? expandedSection === section.title : undefined}
                    className={`w-full flex items-center justify-between px-4 min-h-14 rounded-2xl text-left font-display font-bold text-base transition-colors ${
                      expandedSection === section.title
                        ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                        : "bg-card/60 text-foreground hover:bg-secondary"
                    }`}
                  >
                    {section.title}
                    {section.expandable ? (
                      expandedSection === section.title
                        ? <ChevronUp className="w-5 h-5 text-primary" />
                        : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {section.expandable && expandedSection === section.title && section.items && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-4 py-2 space-y-1">
                          {section.items.map((item) => (
                            <button
                              key={item.label}
                              onClick={() => { setMenuOpen(false); navigate(item.path); }}
                              className="w-full text-left px-4 min-h-11 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
            <div className="px-6 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4 mx-auto w-full max-w-lg">
              <button
                onClick={() => { setMenuOpen(false); navigate("/auth"); }}
                className="cta-primary w-full"
              >
                Log in
              </button>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <LanguageSelector variant="icon" className="text-muted-foreground hover:text-foreground" />
                <span className="text-sm">Language</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <section className="relative brand-ambient">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(hsl(var(--muted-foreground)/0.25)_1px,transparent_1.5px)] [background-size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden />
        <div className="relative mx-auto grid min-h-[100dvh] max-w-6xl items-center gap-10 px-6 pb-10 pt-24 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-xl"
          >
            <p className="eyebrow">Social network · 18+ · Canada</p>
            <h1 className="type-display mt-4 text-foreground">
              Meet new people &amp; <span className="text-gradient">make friends</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Verified profiles, swipes to find people to talk with, chat with live translation in English and French, then phone and video calls when you're both ready.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button onClick={() => navigate("/signup")} className="cta-primary w-full">
                Create account
              </button>
              <button onClick={() => navigate("/auth")} className="cta-secondary w-full">
                Log in
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-foreground/10" />
                <span className="eyebrow-muted">or sign in with</span>
                <div className="flex-1 h-px bg-foreground/10" />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => navigate("/auth")}
                  className="min-h-12 rounded-2xl border border-foreground/10 bg-card/70 flex items-center justify-center gap-2 hover:border-primary/50 hover:bg-secondary transition-colors"
                >
                  <GoogleIcon />
                  <span className="text-sm font-medium text-foreground">Google</span>
                </button>
                <button
                  onClick={() => navigate("/auth")}
                  className="min-h-12 rounded-2xl border border-foreground/10 bg-card/70 flex items-center justify-center gap-2 hover:border-primary/50 hover:bg-secondary transition-colors"
                >
                  <FacebookIcon />
                  <span className="text-sm font-medium text-foreground">Facebook</span>
                </button>
                <button
                  onClick={() => navigate("/phone")}
                  className="min-h-12 rounded-2xl border border-foreground/10 bg-card/70 flex items-center justify-center gap-2 hover:border-primary/50 hover:bg-secondary transition-colors text-foreground"
                >
                  <PhoneIcon />
                  <span className="text-sm font-medium">Phone</span>
                </button>
              </div>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              By continuing you agree to our{" "}
              <Link to="/terms" className="text-link underline">Terms</Link>,{" "}
              <Link to="/privacy" className="text-link underline">Privacy Policy</Link> &{" "}
              <Link to="/cookies" className="text-link underline">Cookies Policy</Link>.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto w-full max-w-[22rem]"
          >
            <PhonePreview />
          </motion.div>
        </div>
      </section>

      {/* Cuban Registration Card */}
      <section className="px-6 pb-4 sm:px-8">
        <div className="mx-auto max-w-md lg:max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="panel flex flex-col gap-4 p-5 lg:flex-row lg:items-center"
          >
            <div className="flex flex-1 items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-xl" aria-hidden>🇨🇺</span>
              <div>
                <p className="font-display font-bold text-foreground">Cuban? Sign up FREE</p>
                <p className="text-muted-foreground text-sm">Get verified and start connecting</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/cuban-signup")}
              className="min-h-11 rounded-full border border-primary/50 px-5 font-semibold text-sm text-foreground hover:bg-primary/15 transition-colors active:scale-[0.98]"
            >
              Cuban Registration (Free)
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow text-center">Why members stay</p>
          <h2 className="type-title mt-3 text-center">Why ISEXY?</h2>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="panel p-4 sm:p-5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
                  <f.icon className="w-5 h-5 text-primary" />
                </span>
                <p className="mt-4 font-display font-bold text-sm sm:text-base">{f.title}</p>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="px-6 pb-16 sm:px-8 sm:pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Three steps</p>
              <h2 className="type-title mt-3">How ISEXY works</h2>
            </div>
            <button
              onClick={() => navigate("/community-stories")}
              className="min-h-11 text-link text-sm font-semibold flex items-center gap-1 hover:underline"
            >
              Community Stories <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3 md:gap-4">
            {loveStories.map((story, i) => (
              <motion.div
                key={story.names}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="panel p-5 flex gap-4 items-start md:flex-col"
              >
                <span className="font-display text-3xl font-extrabold leading-none text-gradient">0{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold">{story.names.replace(/^\d\.\s*/, "")}</p>
                  <p className="eyebrow-muted mt-1.5 mb-2">{story.location}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{story.quote}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="px-6 sm:px-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-accent/10 px-6 py-10">
          <div className="flex justify-around gap-4 text-center">
            <div>
              <p className="font-display text-3xl sm:text-4xl font-extrabold text-foreground">18+</p>
              <p className="eyebrow-muted mt-2">Adults only</p>
            </div>
            <div>
              <p className="font-display text-3xl sm:text-4xl font-extrabold text-gradient">EN · FR</p>
              <p className="eyebrow-muted mt-2">Live translation</p>
            </div>
            <div>
              <p className="font-display text-3xl sm:text-4xl font-extrabold text-foreground">Free</p>
              <p className="eyebrow-muted mt-2">To join</p>
            </div>
          </div>
        </div>
      </section>

      {/* About / SEO Text */}
      <section className="px-6 py-12 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-muted-foreground text-sm leading-relaxed text-center">
            ISEXY.CA is a social network for adults (18+) in Canada. Create a verified profile, swipe to find
            people to talk with, chat with live translation, and make new friends through phone and video calls.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-glow shadow-glow" aria-hidden>
        <Flame className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
      </span>
      <span className="font-display text-lg font-extrabold tracking-[0.08em]">ISEXY</span>
    </div>
  );
}

/** Product preview: a miniature of the Discover card, drawn with the app's own tokens (no photo of a real person). */
function PhonePreview() {
  return (
    <div className="relative" aria-hidden>
      <div className="absolute -inset-8 rounded-[3rem] bg-primary/25 blur-3xl" />
      <div className="relative rounded-[2.5rem] border border-foreground/10 bg-card/80 p-3 shadow-[0_40px_120px_-40px_hsl(var(--primary)/0.8)] backdrop-blur">
        <div className="relative aspect-[3/4.4] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[hsl(204_55%_55%)] via-[hsl(214_60%_32%)] to-[hsl(223_68%_10%)]">
          <div className="absolute left-1/2 top-[22%] h-28 w-28 -translate-x-1/2 rounded-full bg-white/25" />
          <div className="absolute inset-x-6 bottom-0 top-[52%] rounded-t-[999px] bg-white/20" />
          <div className="absolute inset-x-0 top-3 flex gap-1 px-4">
            <span className="h-1 flex-1 rounded-full bg-white/90" />
            <span className="h-1 flex-1 rounded-full bg-white/35" />
            <span className="h-1 flex-1 rounded-full bg-white/35" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-16 text-white">
            <p className="font-display text-2xl font-extrabold">Camille <span className="font-sans text-xl font-normal opacity-90">29</span></p>
            <p className="mt-1 text-sm text-white/80">Montréal · Coffee, live music, long walks</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Coffee", "Hiking", "Live music"].map((t) => (
                <span key={t} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium backdrop-blur">{t}</span>
              ))}
            </div>
          </div>
          <span className="absolute right-4 top-8 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-foreground">Verified</span>
        </div>
        <div className="flex items-center justify-center gap-4 py-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10 bg-background"><X className="h-6 w-6 text-foreground" /></span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/10 bg-background"><Star className="h-5 w-5 text-accent fill-accent" /></span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full gradient-primary shadow-button"><Heart className="h-6 w-6 text-white fill-white" /></span>
        </div>
      </div>
      <div className="absolute -left-4 top-[38%] hidden rounded-2xl border border-foreground/10 bg-card/90 px-4 py-3 shadow-medium backdrop-blur sm:block">
        <p className="eyebrow">Live translation</p>
        <p className="mt-1.5 text-sm text-foreground">“On se voit au Festival?”</p>
        <p className="text-xs text-muted-foreground">See you at the festival?</p>
      </div>
    </div>
  );
}
