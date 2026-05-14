import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const BASE = "https://isexy.lovable.app";

type Meta = {
  title: string;
  description: string;
  type?: "website" | "article";
  jsonLd?: object | object[];
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I create an ISEXY account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sign up using your phone number or email, verify your identity, add photos, and complete your profile to start matching.",
      },
    },
    {
      "@type": "Question",
      name: "What are the age requirements for ISEXY?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You must be at least 18 years old to use ISEXY. In some jurisdictions the minimum age may be higher as required by local law.",
      },
    },
    {
      "@type": "Question",
      name: "How does matching work on ISEXY?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When two users both like each other's profiles, it's a match. You can then start a conversation in Messages.",
      },
    },
    {
      "@type": "Question",
      name: "What subscription plans does ISEXY offer?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Plus, Gold, and Platinum tiers unlock features like unlimited likes, See Who Likes You, Top Picks, weekly Super Likes, and Priority Likes.",
      },
    },
    {
      "@type": "Question",
      name: "How do I cancel my subscription?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cancel through Apple ID Subscriptions on iOS, Google Play Subscriptions on Android, or Settings > My Subscription on the web.",
      },
    },
  ],
};

const META: Record<string, Meta> = {
  "/": {
    title: "ISEXY — Canadian & Cuban Dating App",
    description: "Verified profiles and voice-first matching between Canadians and Cuban singles. Join ISEXY today.",
  },
  "/about": {
    title: "About ISEXY — Our Story & Mission",
    description: "Learn how ISEXY connects Canadians with Cuban singles through verified profiles and voice-first dating.",
  },
  "/news": {
    title: "ISEXY News — Updates & Announcements",
    description: "Latest product updates, feature launches, and community news from ISEXY.",
  },
  "/love-stories": {
    title: "Love Stories — Real Couples on ISEXY",
    description: "Real stories from Canadian and Cuban couples who met on ISEXY.",
  },
  "/faq": {
    title: "FAQ — ISEXY Help & Common Questions",
    description: "Answers to common questions about accounts, matching, subscriptions, safety, and verification on ISEXY.",
    jsonLd: faqJsonLd,
  },
  "/help-support": {
    title: "Help & Support — ISEXY",
    description: "Get help with your ISEXY account, billing, matching, and safety.",
  },
  "/contact-us": {
    title: "Contact ISEXY Support",
    description: "Reach the ISEXY support team. We respond to questions about safety, billing, and accounts.",
  },
  "/knowledge-base": {
    title: "Knowledge Base — ISEXY",
    description: "Self-serve articles covering ISEXY features, troubleshooting, and best practices.",
  },
  "/safety": {
    title: "Safety at ISEXY — Verified Profiles & Reporting",
    description: "How ISEXY keeps Canadian and Cuban daters safe with verification, reporting, and moderation.",
  },
  "/safety-tips": {
    title: "Dating Safety Tips — ISEXY",
    description: "Practical safety tips for online dating, meeting in person, and protecting your privacy.",
  },
  "/community-guidelines": {
    title: "Community Guidelines — ISEXY",
    description: "Rules of conduct that keep ISEXY respectful, safe, and welcoming for all members.",
  },
  "/house-rules": {
    title: "House Rules — ISEXY",
    description: "Behaviour expectations for using ISEXY responsibly.",
  },
  "/dating-regulations": {
    title: "Dating Regulations — ISEXY",
    description: "Legal context and regulatory information for cross-border dating between Canada and Cuba.",
  },
  "/privacy": {
    title: "Privacy Policy — ISEXY",
    description: "How ISEXY collects, uses, and protects your personal information.",
  },
  "/terms": {
    title: "Terms of Service — ISEXY",
    description: "The terms and conditions that govern your use of ISEXY.",
  },
  "/cookie-policy": {
    title: "Cookie Policy — ISEXY",
    description: "How ISEXY uses cookies and similar technologies.",
  },
  "/consumer-health-privacy": {
    title: "Consumer Health Privacy — ISEXY",
    description: "How ISEXY protects consumer health data in compliance with applicable laws.",
  },
  "/licenses": {
    title: "Open Source Licenses — ISEXY",
    description: "Open source attributions and licenses used in ISEXY.",
  },
  "/compare-plans": {
    title: "Compare Plans — ISEXY Plus, Gold & Platinum",
    description: "Compare ISEXY Plus, Gold, and Platinum subscription tiers and pick the right plan for you.",
  },
  "/tourist-signup": {
    title: "Tourist Signup — Join ISEXY",
    description: "Sign up as a Canadian or international member and start matching with Cuban singles on ISEXY.",
  },
  "/cuban-signup": {
    title: "Cuban Signup — Join ISEXY",
    description: "Sign up as a Cuban member on ISEXY and connect with Canadian singles looking for meaningful relationships.",
  },
  "/signup": {
    title: "Sign Up — ISEXY",
    description: "Create your free ISEXY account and start matching today.",
  },
  "/auth": {
    title: "Sign In — ISEXY",
    description: "Sign in to your ISEXY account.",
  },
  "/referrals": {
    title: "Referrals — Invite Friends to ISEXY",
    description: "Earn rewards by inviting friends to join ISEXY.",
  },
  "/team-cubadate": {
    title: "Team — ISEXY",
    description: "The people behind ISEXY.",
  },
  "/qa-events": {
    title: "Live Q&A Events — ISEXY",
    description: "Join live Q&A events with the ISEXY community.",
  },
};

const DEFAULT_META: Meta = {
  title: "ISEXY — Canadian & Cuban Dating App",
  description: "Verified profiles and voice-first matching between Canadians and Cuban singles.",
};

export function RouteSeo() {
  const { pathname } = useLocation();
  const meta = META[pathname] ?? DEFAULT_META;
  const url = `${BASE}${pathname === "/" ? "/" : pathname}`;
  const schemas = Array.isArray(meta.jsonLd) ? meta.jsonLd : meta.jsonLd ? [meta.jsonLd] : [];

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={meta.type ?? "website"} />
      <meta property="og:site_name" content="ISEXY" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
}
