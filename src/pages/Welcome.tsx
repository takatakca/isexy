import { useState } from "react";
import { Logo } from "@/components/Logo";
import { useNavigate, Link } from "react-router-dom";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Heart, Shield, Globe, Star, ChevronRight, ChevronDown, ChevronUp,
  Menu, X,
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
  { icon: Globe, title: "Cuba & Canada", desc: "Bridge cultures, find real connection" },
  { icon: Heart, title: "Smart Matching", desc: "AI-powered compatibility scoring" },
  { icon: Star, title: "Video Dates", desc: "See who you're talking to, live" },
];

const loveStories = [
  { names: "Maria & James", location: "Havana → Toronto", quote: "We matched on ISEXY and now we're planning our wedding!" },
  { names: "Elena & Carlos", location: "Varadero → Montreal", quote: "Distance was nothing compared to what we found together." },
  { names: "Sophie & Daniel", location: "Santiago → Vancouver", quote: "ISEXY gave us something real in a world of filters." },
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
      { label: "Dating Regulations", path: "/dating-regulations" },
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

  return (
    <div className="min-h-screen bg-foreground text-primary-foreground overflow-hidden">
      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-30">
        <div className="flex items-center gap-2">
          <Logo size="sm" variant="light" showText={false} />
          <span className="text-lg font-extrabold tracking-tight">ISEXY</span>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-10 h-10 flex items-center justify-center text-primary-foreground/80 hover:text-primary-foreground transition-colors"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Full-screen Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-20 bg-foreground flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2">
                <Logo size="sm" variant="light" showText={false} />
                <span className="text-lg font-extrabold tracking-tight text-primary-foreground">ISEXY</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-primary-foreground/80 hover:text-primary-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-8">
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
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-xl text-left font-semibold text-base transition-colors ${
                      expandedSection === section.title
                        ? "bg-primary-foreground/5 text-primary"
                        : "bg-primary-foreground/[0.03] text-primary-foreground hover:bg-primary-foreground/5"
                    }`}
                  >
                    {section.title}
                    {section.expandable && (
                      expandedSection === section.title
                        ? <ChevronUp className="w-5 h-5 text-primary" />
                        : <ChevronDown className="w-5 h-5 text-primary-foreground/40" />
                    )}
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
                        <div className="pl-6 py-2 space-y-1">
                          {section.items.map((item) => (
                            <button
                              key={item.label}
                              onClick={() => { setMenuOpen(false); navigate(item.path); }}
                              className="w-full text-left px-4 py-3 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
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
            <div className="px-6 pb-8 space-y-4">
              <button
                onClick={() => { setMenuOpen(false); navigate("/auth"); }}
                className="w-full py-4 bg-primary-foreground text-foreground font-bold rounded-full text-base hover:bg-primary-foreground/90 transition-colors"
              >
                Log in
              </button>
              <div className="flex items-center justify-center gap-2 text-primary-foreground/50">
                <LanguageSelector variant="icon" className="text-primary-foreground/50 hover:text-primary-foreground" />
                <span className="text-sm">Language</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section - Full viewport, image with overlay buttons */}
      <section className="relative min-h-[100dvh] w-full flex flex-col">
        {/* Background image */}
        <img
          src="/images/hero-bg.png"
          alt="ISEXY.CA - Experience Cuba & Canada, Together"
          className="absolute inset-0 w-full h-full object-cover object-top"
          loading="eager"
        />

        {/* Gradient overlay at bottom for button legibility */}
        <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

        {/* Spacer to push content to bottom */}
        <div className="flex-1" />

        {/* CTA Buttons overlaid on image */}
        <div className="relative z-10 px-6 pb-6 max-w-md mx-auto w-full space-y-3">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            <button
              onClick={() => navigate("/signup")}
              className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-full text-base shadow-lg hover:brightness-110 transition-all active:scale-[0.98]"
            >
              Create account
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="w-full py-3.5 border-2 border-white/80 text-white font-bold rounded-full text-base hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Log in
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-white/60 text-xs font-medium">or sign in with</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/auth")}
                className="flex-1 py-3 border border-white/30 rounded-full flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
              >
                <GoogleIcon />
                <span className="text-sm font-medium text-white">Google</span>
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="flex-1 py-3 border border-white/30 rounded-full flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
              >
                <FacebookIcon />
                <span className="text-sm font-medium text-white">Facebook</span>
              </button>
              <button
                onClick={() => navigate("/phone")}
                className="flex-1 py-3 border border-white/30 rounded-full flex items-center justify-center gap-2 hover:bg-white/10 transition-colors text-white"
              >
                <PhoneIcon />
                <span className="text-sm font-medium">Phone</span>
              </button>
            </div>
          </motion.div>

          <p className="text-center text-white/40 text-[10px] leading-relaxed pt-1">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline hover:text-white/60">Terms</Link>,{" "}
            <Link to="/privacy" className="underline hover:text-white/60">Privacy Policy</Link> &{" "}
            <Link to="/cookies" className="underline hover:text-white/60">Cookies Policy</Link>.
          </p>
        </div>
      </section>

      {/* Cuban Registration Card - below hero */}
      <section className="bg-foreground px-6 py-6">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-primary-foreground/5 border border-primary/25 rounded-2xl p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">🇨🇺</span>
              <div>
                <p className="font-bold text-sm text-primary-foreground">Cuban? Sign up FREE</p>
                <p className="text-primary-foreground/50 text-xs">Get verified and start connecting</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/cuban-signup")}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:brightness-110 transition-all text-sm active:scale-[0.98]"
            >
              Cuban Registration (Free)
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16 bg-primary-foreground/[0.03]">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Why ISEXY?</h2>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl p-4"
              >
                <f.icon className="w-6 h-6 text-primary mb-2" />
                <p className="font-bold text-sm">{f.title}</p>
                <p className="text-primary-foreground/50 text-xs mt-1">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Love Stories Section */}
      <section className="px-6 py-16">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Love Stories</h2>
            <button
              onClick={() => navigate("/love-stories")}
              className="text-primary text-sm font-semibold flex items-center gap-1 hover:underline"
            >
              See all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {loveStories.map((story, i) => (
              <motion.div
                key={story.names}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl p-5 flex gap-4 items-start"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{story.names}</p>
                  <p className="text-primary-foreground/40 text-xs mb-1">{story.location}</p>
                  <p className="text-primary-foreground/70 text-sm italic">"{story.quote}"</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="px-6 py-12 bg-primary/10">
        <div className="max-w-lg mx-auto flex justify-around text-center">
          <div>
            <p className="text-3xl font-extrabold text-primary">50K+</p>
            <p className="text-primary-foreground/50 text-xs mt-1">Active Members</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-primary">12K+</p>
            <p className="text-primary-foreground/50 text-xs mt-1">Matches Made</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-primary">3K+</p>
            <p className="text-primary-foreground/50 text-xs mt-1">Love Stories</p>
          </div>
        </div>
      </section>

      {/* About / SEO Text */}
      <section className="px-6 py-12">
        <div className="max-w-lg mx-auto">
          <p className="text-primary-foreground/50 text-sm leading-relaxed mb-4">
            Looking for love, new friends, or just want to have fun? ISEXY.CA is where it happens. 
            With thousands of matches made, it's the best way to meet your next date.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-primary-foreground/10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Logo size="sm" variant="light" showText={false} />
            <span className="text-lg font-extrabold tracking-tight">ISEXY</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div className="space-y-2">
              <Link to="/faq" className="block text-primary-foreground/50 hover:text-primary-foreground">FAQ</Link>
              <Link to="/about" className="block text-primary-foreground/50 hover:text-primary-foreground">About</Link>
              <Link to="/safety" className="block text-primary-foreground/50 hover:text-primary-foreground">Safety</Link>
              <Link to="/contact-us" className="block text-primary-foreground/50 hover:text-primary-foreground">Contact</Link>
            </div>
            <div className="space-y-2">
              <Link to="/terms" className="block text-primary-foreground/50 hover:text-primary-foreground">Terms</Link>
              <Link to="/privacy" className="block text-primary-foreground/50 hover:text-primary-foreground">Privacy</Link>
              <Link to="/cookie-policy" className="block text-primary-foreground/50 hover:text-primary-foreground">Cookies</Link>
              <Link to="/consumer-health-privacy" className="block text-primary-foreground/50 hover:text-primary-foreground">Health Privacy</Link>
            </div>
          </div>
          <p className="text-primary-foreground/30 text-xs">© {new Date().getFullYear()} ISEXY.CA — All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
