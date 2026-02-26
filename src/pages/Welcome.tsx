import { useState } from "react";
import { Logo } from "@/components/Logo";
import { AuthButton } from "@/components/AuthButton";
import { useNavigate, Link } from "react-router-dom";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Heart, Shield, Globe, Star, ChevronRight, ChevronDown, ChevronUp,
  Menu, X, Flame, Sparkles, Video, Crown, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Social icons
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

// Menu sections like Tinder's hamburger
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
      <nav className="flex items-center justify-between px-6 py-4 relative z-30">
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

      {/* Full-screen Mobile Menu — Tinder style */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-20 bg-foreground flex flex-col"
          >
            {/* Menu Header */}
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

            {/* Menu Sections */}
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

                  {/* Expanded items */}
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

            {/* Bottom of menu */}
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

      {/* Hero Section */}
      <section className="relative px-6 pt-12 pb-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-0 w-[300px] h-[300px] rounded-full bg-primary/10 blur-[80px] pointer-events-none" />

        <div className="max-w-lg mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10"
          >
            <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.1] mb-4 tracking-tight">
              Swipe Right<span className="text-primary">™</span>
            </h1>
            <p className="text-primary-foreground/70 text-lg max-w-sm mx-auto">
              Where Cuba meets the world. Find love, build connections, cross borders.
            </p>
          </motion.div>

          {/* Create Account + Login */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-3 mb-6"
          >
            <button
              onClick={() => navigate("/signup")}
              className="w-full py-4 bg-primary-foreground text-foreground font-bold rounded-full text-base hover:bg-primary-foreground/90 transition-colors"
            >
              Create account
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="w-full py-4 border border-primary-foreground/30 text-primary-foreground font-bold rounded-full text-base hover:bg-primary-foreground/5 transition-colors"
            >
              Log in
            </button>
          </motion.div>

          {/* Or sign in with */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-3 mb-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-px bg-primary-foreground/10" />
              <span className="text-primary-foreground/40 text-xs">or sign in with</span>
              <div className="flex-1 h-px bg-primary-foreground/10" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/auth")}
                className="flex-1 py-3 border border-primary-foreground/20 rounded-full flex items-center justify-center gap-2 hover:bg-primary-foreground/5 transition-colors"
              >
                <GoogleIcon />
                <span className="text-sm font-medium">Google</span>
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="flex-1 py-3 border border-primary-foreground/20 rounded-full flex items-center justify-center gap-2 hover:bg-primary-foreground/5 transition-colors"
              >
                <FacebookIcon />
                <span className="text-sm font-medium">Facebook</span>
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="flex-1 py-3 border border-primary-foreground/20 rounded-full flex items-center justify-center gap-2 hover:bg-primary-foreground/5 transition-colors"
              >
                <PhoneIcon />
                <span className="text-sm font-medium">Phone</span>
              </button>
            </div>
          </motion.div>

          {/* Cuban Registration CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-primary/10 border border-primary/20 rounded-2xl p-5 mb-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🇨🇺</span>
              <div>
                <p className="font-bold text-sm">Cuban? Sign up FREE</p>
                <p className="text-primary-foreground/60 text-xs">Get verified and start connecting</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/cuban-signup")}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors text-sm"
            >
              Cuban Registration (Free)
            </button>
          </motion.div>

          {/* Terms */}
          <p className="text-center text-primary-foreground/40 text-xs leading-relaxed">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline hover:text-primary-foreground/60">Terms</Link>,{" "}
            <Link to="/privacy" className="underline hover:text-primary-foreground/60">Privacy Policy</Link> &{" "}
            <Link to="/cookies" className="underline hover:text-primary-foreground/60">Cookies Policy</Link>.
          </p>
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

      {/* About / SEO Text Section — like Tinder's bottom text */}
      <section className="px-6 py-12">
        <div className="max-w-lg mx-auto">
          <p className="text-primary-foreground/50 text-sm leading-relaxed mb-4">
            Looking for love, new friends, or just want to have fun? ISEXY.CA is where it happens. 
            With thousands of matches made, it's the best way to meet your next date. Whether you're 
            straight, part of the LGBTQIA+ community, or looking for something specific — ISEXY 
            connects you with real, verified people across Cuba and Canada.
          </p>
          <p className="text-primary-foreground/50 text-sm leading-relaxed">
            ISEXY isn't just another dating app — it's a platform built for genuine connections. 
            With video dates, smart matching, and verified profiles, you'll find exactly what 
            you're looking for. Swipe right, match, chat, and meet. It's that simple.
          </p>
        </div>
      </section>

      {/* Footer — Tinder-style multi-column */}
      <footer className="px-6 py-10 border-t border-primary-foreground/10">
        <div className="max-w-lg mx-auto">
          {/* Footer columns */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-sm mb-3">Legal</h3>
              <div className="space-y-2">
                <Link to="/privacy" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">Privacy</Link>
                <Link to="/consumer-health-privacy" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">Consumer Health Privacy</Link>
                <Link to="/terms" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">Terms of Use</Link>
                <Link to="/cookie-policy" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">Cookie Policy</Link>
                <Link to="/licenses" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">Intellectual Property</Link>
                <Link to="/dating-regulations" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">Accessibility</Link>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-3">Resources</h3>
              <div className="space-y-2">
                <Link to="/faq" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">FAQ</Link>
                <Link to="/love-stories" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">Love Stories</Link>
                <Link to="/about" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">About</Link>
                <Link to="/contact-us" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">Contact</Link>
                <Link to="/redeem-code" className="block text-primary-foreground/50 text-xs hover:text-primary-foreground/80">Promo Code</Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-primary-foreground/10 pt-6">
            <div className="flex flex-wrap justify-center gap-3 mb-4 text-primary-foreground/40 text-xs">
              <Link to="/faq" className="hover:text-primary-foreground/70">FAQ</Link>
              <span>/</span>
              <Link to="/safety-tips" className="hover:text-primary-foreground/70">Safety Tips</Link>
              <span>/</span>
              <Link to="/terms" className="hover:text-primary-foreground/70">Terms of Use</Link>
              <span>/</span>
              <Link to="/cookie-policy" className="hover:text-primary-foreground/70">Cookie Policy</Link>
              <span>/</span>
              <Link to="/privacy" className="hover:text-primary-foreground/70">Privacy Settings</Link>
            </div>
            <p className="text-center text-primary-foreground/30 text-xs">
              © {new Date().getFullYear()} ISEXY.CA — All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
