import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, ChevronDown, HelpCircle, Heart, CreditCard, Shield, 
  User, Settings, MessageCircle, Camera, Lock, Globe, Zap,
  Star, Ban, Eye, Bell, Smartphone, Mail, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  faqs: FAQItem[];
}

const faqCategories: FAQCategory[] = [
  {
    id: "getting-started",
    icon: Heart,
    title: "Getting Started",
    description: "New to CubaDate? Start here",
    faqs: [
      {
        question: "How do I create a CubaDate account?",
        answer: "Download the CubaDate app from the App Store or Google Play, then sign up using your phone number or email address. You'll need to verify your identity, add photos, and complete your profile to start matching with other users.",
      },
      {
        question: "What are the age requirements?",
        answer: "You must be at least 18 years old to use CubaDate. In some jurisdictions, the minimum age may be higher as required by local law. We verify age during the registration process.",
      },
      {
        question: "How does matching work on CubaDate?",
        answer: "When you and another user both swipe right (like) on each other's profiles, it's a match! You can then start a conversation in your Messages. Our algorithm also suggests potential matches based on your preferences and behavior.",
      },
      {
        question: "What makes a good profile?",
        answer: "A great profile includes multiple clear photos (including at least one of your face), a compelling bio, and completed profile sections. Be authentic, specific about your interests, and let your personality shine through.",
      },
      {
        question: "How do I verify my profile?",
        answer: "Go to your profile settings and tap 'Verify Profile.' You'll be asked to take a selfie mimicking a specific pose. Our Face Check™ technology will compare it to your profile photos to confirm you're real.",
      },
      {
        question: "Can I use CubaDate without a phone number?",
        answer: "Yes! You can sign up with your email address instead. However, phone verification adds an extra layer of security and may unlock additional features.",
      },
    ],
  },
  {
    id: "subscriptions",
    icon: CreditCard,
    title: "Subscriptions & Payments",
    description: "Premium plans and billing",
    faqs: [
      {
        question: "What subscription plans are available?",
        answer: "CubaDate offers three premium tiers: CubaDate Plus (unlimited likes, rewinds, 1 boost/month), CubaDate Gold (Plus features + See Who Likes You, Top Picks, weekly Super Likes), and CubaDate Platinum (Gold features + Priority Likes, Message Before Matching, Profile Controls).",
      },
      {
        question: "How do I cancel my subscription?",
        answer: "If you subscribed through iOS, go to Settings > Apple ID > Subscriptions. For Android, go to Google Play > Subscriptions. For web subscriptions, go to Settings > My Subscription > Manage Subscription in the app.",
      },
      {
        question: "Will I get a refund if I cancel?",
        answer: "Generally, subscriptions are non-refundable. However, you'll continue to have access to premium features until your current billing period ends. California residents have special cancellation rights within 3 business days of purchase.",
      },
      {
        question: "What payment methods do you accept?",
        answer: "We accept all major credit and debit cards, Apple Pay, Google Pay, and PayPal. Payment methods vary by platform (iOS, Android, Web).",
      },
      {
        question: "How do I change my payment method?",
        answer: "Payment methods are managed through your app store (iOS/Android) or through your account settings if you subscribed on the web. Go to Settings > Manage Payment Account to update.",
      },
      {
        question: "What are Boosts and Super Likes?",
        answer: "Boosts put your profile at the top of the stack for 30 minutes, increasing visibility. Super Likes (the blue star) let someone know you're especially interested—profiles with Super Likes are 3x more likely to match.",
      },
      {
        question: "Do unused Boosts and Super Likes carry over?",
        answer: "Monthly allocations reset each billing cycle and don't carry over. Purchased à la carte items may have expiration dates—check the terms at time of purchase.",
      },
    ],
  },
  {
    id: "safety",
    icon: Shield,
    title: "Safety & Privacy",
    description: "Staying safe on CubaDate",
    faqs: [
      {
        question: "How does CubaDate protect my privacy?",
        answer: "We use industry-standard encryption to protect your data. You control what information appears on your profile, and we never share your personal information with other users without your consent. Review our Privacy Policy for complete details.",
      },
      {
        question: "How do I report someone?",
        answer: "Open the user's profile, tap the three dots (•••) in the top right corner, and select 'Report.' Choose the reason and provide details. Reports are reviewed by our Trust & Safety team within 24 hours.",
      },
      {
        question: "How do I block someone?",
        answer: "Open the user's profile or conversation, tap the three dots (•••), and select 'Block.' They won't be able to see your profile or contact you, and they won't be notified that you blocked them.",
      },
      {
        question: "What happens when I report someone?",
        answer: "Our Trust & Safety team reviews all reports within 24 hours. Depending on the severity, actions may include warnings, temporary suspension, or permanent bans. You'll remain anonymous—reported users don't know who reported them.",
      },
      {
        question: "How do I verify if someone is real?",
        answer: "Look for the blue verified badge on profiles—it indicates the user has completed Face Check™ verification. You can also request a video chat before meeting in person.",
      },
      {
        question: "Can I control who sees my profile?",
        answer: "Yes! Premium subscribers can control visibility settings. You can hide your profile from certain users, make yourself visible only to people you've liked, or hide your distance and age.",
      },
      {
        question: "What should I do if I feel unsafe?",
        answer: "If you're in immediate danger, contact local emergency services. You can also reach our Safety Team through the app's Help & Support section. Block and report any users who make you feel unsafe.",
      },
    ],
  },
  {
    id: "account",
    icon: User,
    title: "Account Management",
    description: "Managing your profile and settings",
    faqs: [
      {
        question: "How do I edit my profile?",
        answer: "Tap your profile icon, then tap 'Edit Profile.' You can update your photos, bio, interests, and other details. Changes are saved automatically.",
      },
      {
        question: "How do I change my location?",
        answer: "CubaDate uses your device's GPS to determine your location. Free users can only match with people nearby. Premium subscribers can use Passport to change their location to anywhere in the world.",
      },
      {
        question: "How do I delete my account?",
        answer: "Go to Settings > Delete Account. You'll be asked to confirm your decision. Deleting your account removes your profile, matches, and messages permanently. This cannot be undone.",
      },
      {
        question: "Can I recover a deleted account?",
        answer: "No, deleted accounts cannot be recovered. All data, matches, and messages are permanently removed. If you want to use CubaDate again, you'll need to create a new account.",
      },
      {
        question: "How do I change my phone number or email?",
        answer: "Go to Settings > Account Settings to update your phone number or email. You may need to verify the new information before the change takes effect.",
      },
      {
        question: "Why was my account banned?",
        answer: "Accounts may be banned for violating our Terms of Service or Community Guidelines. Common reasons include fake profiles, harassment, spam, or inappropriate content. You can appeal by contacting support.",
      },
      {
        question: "How do I pause my account instead of deleting it?",
        answer: "Go to Settings > Discovery Settings and turn off 'Show Me on CubaDate.' This hides your profile while preserving your matches and messages. Turn it back on when you're ready to date again.",
      },
    ],
  },
  {
    id: "features",
    icon: Zap,
    title: "Features & Matching",
    description: "How CubaDate features work",
    faqs: [
      {
        question: "What is Passport?",
        answer: "Passport is a premium feature that lets you match with people anywhere in the world. Perfect for planning trips or connecting with people in a new city before you move.",
      },
      {
        question: "What are Top Picks?",
        answer: "Top Picks are curated daily recommendations of highly compatible profiles based on your preferences and behavior. Gold and Platinum subscribers get access to expanded Top Picks.",
      },
      {
        question: "How do I undo a swipe?",
        answer: "If you accidentally swiped left, use the Rewind feature (yellow arrow) to go back to the previous profile. Rewinds are available for premium subscribers.",
      },
      {
        question: "What is Swipe Surge?",
        answer: "Swipe Surge activates when activity in your area spikes (up to 15x normal). During a Surge, you'll appear higher in the stack and have up to 250% more matches.",
      },
      {
        question: "How does the algorithm decide who I see?",
        answer: "Our algorithm considers your preferences, location, activity level, and past behavior. Being active, having a complete profile, and engaging authentically all improve your visibility.",
      },
      {
        question: "Why am I not getting matches?",
        answer: "Try improving your profile: add more photos (especially clear face shots), write a compelling bio, and be active on the app. Consider expanding your age and distance preferences.",
      },
      {
        question: "What are Vibes?",
        answer: "Vibes are interactive prompts you can add to your profile to showcase your personality. They're great conversation starters and help you stand out.",
      },
    ],
  },
  {
    id: "photos",
    icon: Camera,
    title: "Photos & Media",
    description: "Profile photos and verification",
    faqs: [
      {
        question: "How many photos can I add?",
        answer: "You can add up to 9 photos to your profile. We recommend using all slots and including a variety of photos that show your face, interests, and personality.",
      },
      {
        question: "What photos should I avoid?",
        answer: "Avoid group photos as your main picture, blurry or heavily filtered images, photos without your face visible, explicit content, and photos with ex-partners or children.",
      },
      {
        question: "Why was my photo rejected?",
        answer: "Photos may be rejected if they contain nudity, explicit content, violence, minors (unless accompanied by an adult), or violate our Community Guidelines. Only photos of you are allowed.",
      },
      {
        question: "How do I add a Smart Photo?",
        answer: "Smart Photos automatically tests your photos to find which one gets the most right swipes, then orders your photos accordingly. Enable it in your profile settings.",
      },
      {
        question: "Can I add videos to my profile?",
        answer: "Yes! You can add short video loops (up to 15 seconds) to your profile. Videos are a great way to show your personality and stand out.",
      },
      {
        question: "How does Face Check™ verification work?",
        answer: "When you verify, you'll take a series of selfies mimicking different poses. Our AI compares these to your profile photos to confirm you're real. Verified profiles get a blue badge.",
      },
    ],
  },
  {
    id: "messaging",
    icon: MessageCircle,
    title: "Messaging & Matches",
    description: "Communicating with matches",
    faqs: [
      {
        question: "How do I start a conversation?",
        answer: "Once you've matched with someone, go to your Messages and tap on their conversation. Send a personalized message that references something from their profile.",
      },
      {
        question: "Why can't I send messages?",
        answer: "You can only message users you've matched with (unless you have Platinum's Message Before Matching feature). If you're matched but can't message, check your internet connection.",
      },
      {
        question: "Can I unsend a message?",
        answer: "Currently, you cannot unsend messages. Think before you send! If you've sent something inappropriate, the other person can report it.",
      },
      {
        question: "How do I know if someone read my message?",
        answer: "Premium subscribers can see read receipts that show when a match has read their message. This feature can be enabled in your settings.",
      },
      {
        question: "Why did my match disappear?",
        answer: "A match may disappear if they unmatched you, deleted their account, or were banned from the platform. Unfortunately, you cannot see which reason applies.",
      },
      {
        question: "Can I video chat with matches?",
        answer: "Yes! Use the video icon in your conversation to start a video call with your match. Both users must opt in to the call for it to connect.",
      },
    ],
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notifications & Settings",
    description: "Managing your preferences",
    faqs: [
      {
        question: "How do I manage push notifications?",
        answer: "Go to Settings > Push Notifications to customize which notifications you receive. You can toggle notifications for new matches, messages, likes, and more.",
      },
      {
        question: "How do I change my discovery preferences?",
        answer: "Go to Settings > Discovery Settings to adjust your age range, distance, and gender preferences. Changes take effect immediately.",
      },
      {
        question: "How do I enable/disable Dark Mode?",
        answer: "Go to Settings > Dark Mode. You can choose between Light, Dark, or System Default (which follows your device settings).",
      },
      {
        question: "How do I manage email notifications?",
        answer: "Go to Settings > Email Settings to control which emails you receive from CubaDate, including new matches, messages, and promotional emails.",
      },
      {
        question: "How do I hide my active status?",
        answer: "Go to Settings > Active Status and toggle it off. Other users won't see when you were last active, but you also won't see their status.",
      },
      {
        question: "Can I temporarily hide my profile?",
        answer: "Yes! Go to Settings > Discovery Settings and turn off 'Show Me on CubaDate.' Your profile will be hidden but your matches and messages are preserved.",
      },
    ],
  },
  {
    id: "technical",
    icon: Smartphone,
    title: "Technical Issues",
    description: "Troubleshooting common problems",
    faqs: [
      {
        question: "The app keeps crashing. What should I do?",
        answer: "Try these steps: 1) Update to the latest version, 2) Restart your device, 3) Clear the app cache (Android), 4) Reinstall the app. If issues persist, contact support.",
      },
      {
        question: "I'm not receiving matches or messages.",
        answer: "Check your internet connection, ensure notifications are enabled, verify your discovery preferences are set correctly, and make sure your profile is visible (not paused).",
      },
      {
        question: "Photos aren't uploading. How do I fix this?",
        answer: "Ensure you have a stable internet connection and that CubaDate has permission to access your photos. Try a smaller file size or a different image format.",
      },
      {
        question: "Location services aren't working.",
        answer: "Go to your device settings and ensure CubaDate has permission to access your location. Select 'Always' or 'While Using' for best results.",
      },
      {
        question: "I can't log in to my account.",
        answer: "First, try resetting your password. If you're still having trouble, ensure you're using the correct phone number or email. Contact support if issues persist.",
      },
      {
        question: "The app is slow or laggy.",
        answer: "Close other apps running in the background, ensure you have a stable internet connection, and try restarting the app. Update to the latest version for optimal performance.",
      },
    ],
  },
];

export default function FAQ() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("getting-started");
  const [openQuestions, setOpenQuestions] = useState<Record<string, boolean>>({});

  const toggleQuestion = (question: string) => {
    setOpenQuestions((prev) => ({
      ...prev,
      [question]: !prev[question],
    }));
  };

  const currentCategory = faqCategories.find((cat) => cat.id === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">FAQ</h1>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 py-8 text-center bg-gradient-to-b from-primary/10 to-background">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">How can we help?</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Find answers to commonly asked questions about CubaDate
        </p>
      </div>

      {/* Category Selector */}
      <div className="px-4 py-4 border-b border-border overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {faqCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                activeCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <category.icon className="w-4 h-4" />
              {category.title}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ Content */}
      <div className="px-4 py-6">
        {currentCategory && (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-foreground">{currentCategory.title}</h3>
              <p className="text-sm text-muted-foreground">{currentCategory.description}</p>
            </div>

            <div className="space-y-3">
              {currentCategory.faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() => toggleQuestion(`${activeCategory}-${index}`)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <span className="font-medium text-foreground pr-4">{faq.question}</span>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 text-muted-foreground shrink-0 transition-transform",
                        openQuestions[`${activeCategory}-${index}`] && "rotate-180"
                      )}
                    />
                  </button>
                  {openQuestions[`${activeCategory}-${index}`] && (
                    <div className="px-4 pb-4 pt-0">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* All Categories Overview */}
      <div className="px-4 py-6 bg-muted/30">
        <h3 className="text-lg font-bold text-foreground mb-4">Browse All Categories</h3>
        <div className="grid grid-cols-2 gap-3">
          {faqCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                setActiveCategory(category.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={cn(
                "p-4 rounded-xl border text-left transition-colors",
                activeCategory === category.id
                  ? "bg-primary/10 border-primary"
                  : "bg-card border-border hover:bg-muted"
              )}
            >
              <category.icon className={cn(
                "w-6 h-6 mb-2",
                activeCategory === category.id ? "text-primary" : "text-muted-foreground"
              )} />
              <h4 className="font-medium text-foreground text-sm">{category.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{category.faqs.length} questions</p>
            </button>
          ))}
        </div>
      </div>

      {/* Still Need Help */}
      <div className="px-4 py-6">
        <div className="bg-gradient-to-r from-primary to-rose-500 rounded-2xl p-6 text-center">
          <HelpCircle className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold text-primary-foreground mb-2">
            Still need help?
          </h3>
          <p className="text-primary-foreground/80 mb-4">
            Our support team is here to assist you
          </p>
          <button
            onClick={() => navigate("/help-support")}
            className="px-6 py-3 bg-white text-primary rounded-full font-bold"
          >
            Contact Support
          </button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="px-4 py-6 border-t border-border">
        <h3 className="text-lg font-bold text-foreground mb-4">Quick Links</h3>
        <div className="space-y-2">
          <button
            onClick={() => navigate("/safety")}
            className="w-full flex items-center justify-between p-3 bg-card rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-foreground">Safety Center</span>
            </div>
            <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
          </button>
          <button
            onClick={() => navigate("/community-guidelines")}
            className="w-full flex items-center justify-between p-3 bg-card rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-foreground">Community Guidelines</span>
            </div>
            <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
          </button>
          <button
            onClick={() => navigate("/privacy")}
            className="w-full flex items-center justify-between p-3 bg-card rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary" />
              <span className="text-foreground">Privacy Policy</span>
            </div>
            <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
          </button>
          <button
            onClick={() => navigate("/terms")}
            className="w-full flex items-center justify-between p-3 bg-card rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-foreground">Terms of Service</span>
            </div>
            <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
