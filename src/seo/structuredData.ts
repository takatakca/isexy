import { SITE_NAME, SITE_URL, LOGO_URL, OG_IMAGE, SUPPORT, absoluteUrl } from "@/lib/site";

/** schema.org graphs used across the site (Google rich results, AI crawlers). */

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: LOGO_URL,
  image: OG_IMAGE,
  email: SUPPORT.email,
  areaServed: [
    { "@type": "Country", name: "Canada" },
    { "@type": "Country", name: "Cuba" },
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SUPPORT.email,
      telephone: SUPPORT.phoneCanada,
      areaServed: "CA",
      availableLanguage: ["English", "French", "Spanish"],
    },
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: SUPPORT.phoneCuba,
      areaServed: "CU",
      availableLanguage: ["Spanish", "English"],
    },
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: ["en", "es", "fr"],
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/knowledge-base?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

export const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: "LifestyleApplication",
  applicationSubCategory: "Dating",
  operatingSystem: "Web, iOS, Android",
  inLanguage: ["en", "es", "fr"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", description: "Free to join; optional Plus, Gold and Platinum plans." },
  featureList: [
    "Verified profiles and Cuban identity verification",
    "Live chat translation in English, Spanish and French",
    "HD video calls and a private phone line",
    "AI dating concierge",
    "Gifts, ETECSA recharges and Cuban rewards",
  ],
  publisher: { "@id": `${SITE_URL}/#organization` },
};

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function articleSchema(article: {
  title: string;
  description: string;
  path: string;
  category: string;
  updatedAt?: string;
  createdAt?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    articleSection: article.category,
    mainEntityOfPage: absoluteUrl(article.path),
    image: OG_IMAGE,
    datePublished: article.createdAt,
    dateModified: article.updatedAt ?? article.createdAt,
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    ["How do I create an ISEXY account?", "Sign up with your email or phone number, confirm it, add at least one photo and complete your profile to start matching."],
    ["What is the minimum age for ISEXY?", "You must be at least 18 years old. Some jurisdictions require an older minimum age, which ISEXY applies."],
    ["How does matching work on ISEXY?", "When two members like each other it's a match, and you can start chatting right away — with automatic translation between English, Spanish and French."],
    ["Can I talk with someone in Cuba if we speak different languages?", "Yes. Messages are translated live between English, Spanish, French and more, so you can each write in your own language."],
    ["What subscription plans does ISEXY offer?", "ISEXY is free to join. Plus, Gold and Platinum add unlimited likes, Passport, See Who Likes You, Super Likes, Boosts and priority visibility."],
    ["How do I cancel my subscription?", "On the web go to Settings → My Subscription. On iOS or Android cancel from your App Store or Google Play subscriptions."],
    ["How does ISEXY protect me from romance scams?", "Profiles can be photo- and ID-verified, personal contact details are automatically protected in chats and calls, and every profile has Block and Report. Never send money to someone you haven't met."],
  ].map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};
