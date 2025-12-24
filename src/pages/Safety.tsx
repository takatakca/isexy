import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Shield, AlertTriangle, Users, MapPin, Phone, DollarSign, 
  Heart, Eye, Lock, MessageCircle, Flag, Ban, Camera, Globe, 
  AlertCircle, Smartphone, FileText, ExternalLink, ChevronRight,
  BadgeCheck, UserX, MessageSquare, PhoneCall, Mail, HelpCircle
} from "lucide-react";

const safetyTips = [
  {
    icon: DollarSign,
    title: "Never send money or share financial information",
    description: "Never send money, whether through wire transfer, banking service, or app—even if the person claims to be in an emergency. Scammers often create elaborate stories to extract money from victims.",
  },
  {
    icon: Shield,
    title: "Protect your personal information",
    description: "Never share personal information like your social security number, home or work address, daily routine, or banking details with people you don't know well.",
  },
  {
    icon: Phone,
    title: "Stay on the platform",
    description: "Keep conversations on CubaDate while getting to know someone. Bad actors often try to move to text, messaging apps, email, or phone immediately to avoid platform oversight.",
  },
  {
    icon: AlertTriangle,
    title: "Be wary of long distance relationships",
    description: "Watch out for scammers who claim to be from your country but stuck somewhere else, especially if they ask for financial help to return home.",
  },
  {
    icon: Users,
    title: "Report suspicious behavior",
    description: "Block and report anyone that violates our terms or your personal boundaries. This includes requests for money, harassment, threats, and abusive messages.",
  },
  {
    icon: MapPin,
    title: "Meet in public places",
    description: "Meet in populated, public places—never at your home, your date's home, or any private location. If your date pressures you, end the date immediately.",
  },
  {
    icon: Eye,
    title: "Tell someone your plans",
    description: "Before meeting, tell a friend or family member where you're going, who you're meeting, and when you expect to return. Consider sharing your live location.",
  },
  {
    icon: Smartphone,
    title: "Keep your phone charged",
    description: "Make sure your phone is fully charged before going on a date. Have emergency contacts readily accessible and consider carrying a portable charger.",
  },
  {
    icon: Lock,
    title: "Use video chat first",
    description: "Before meeting in person, consider having a video call to verify they are who they say they are. Trust your instincts if something feels off.",
  },
  {
    icon: Heart,
    title: "Trust your instincts",
    description: "If something feels wrong, it probably is. Don't feel obligated to continue a date or conversation that makes you uncomfortable. Your safety comes first.",
  },
];

const reportingReasons = [
  {
    icon: UserX,
    title: "Fake Profile / Catfishing",
    description: "Report profiles using fake photos, impersonating others, or misrepresenting their identity.",
  },
  {
    icon: MessageSquare,
    title: "Harassment or Abuse",
    description: "Report any unwanted, aggressive, threatening, or abusive behavior or messages.",
  },
  {
    icon: DollarSign,
    title: "Scam or Fraud",
    description: "Report anyone asking for money, promoting schemes, or attempting financial fraud.",
  },
  {
    icon: Camera,
    title: "Inappropriate Content",
    description: "Report explicit, violent, or offensive photos or content that violates community guidelines.",
  },
  {
    icon: AlertCircle,
    title: "Underage User",
    description: "Report any user you believe to be under 18 years old using the platform.",
  },
  {
    icon: Globe,
    title: "Spam or Commercial",
    description: "Report unsolicited advertisements, promotional content, or commercial activities.",
  },
];

const emergencyResources = [
  {
    country: "United States",
    resources: [
      { name: "National Domestic Violence Hotline", phone: "1-800-799-7233", available: "24/7" },
      { name: "RAINN Sexual Assault Hotline", phone: "1-800-656-4673", available: "24/7" },
      { name: "National Suicide Prevention Lifeline", phone: "988", available: "24/7" },
      { name: "Emergency Services", phone: "911", available: "24/7" },
    ],
  },
  {
    country: "Canada",
    resources: [
      { name: "Victim Services Directory", phone: "1-866-863-0511", available: "24/7" },
      { name: "Crisis Services Canada", phone: "1-833-456-4566", available: "24/7" },
      { name: "Kids Help Phone", phone: "1-800-668-6868", available: "24/7" },
      { name: "Emergency Services", phone: "911", available: "24/7" },
    ],
  },
  {
    country: "Cuba",
    resources: [
      { name: "Línea de Ayuda FMC", phone: "7838-5700", available: "Mon-Fri" },
      { name: "Emergencias Médicas", phone: "104", available: "24/7" },
      { name: "Policía Nacional", phone: "106", available: "24/7" },
    ],
  },
  {
    country: "United Kingdom",
    resources: [
      { name: "National Domestic Abuse Helpline", phone: "0808 2000 247", available: "24/7" },
      { name: "Samaritans", phone: "116 123", available: "24/7" },
      { name: "Emergency Services", phone: "999", available: "24/7" },
    ],
  },
];

const safetyFeatures = [
  {
    icon: BadgeCheck,
    title: "Photo Verification",
    description: "Our Face Check™ technology helps confirm users are real and match their profile photos, reducing catfishing and fake profiles.",
  },
  {
    icon: Flag,
    title: "Easy Reporting",
    description: "Report concerning behavior directly from any profile or conversation. Our team reviews reports 24/7.",
  },
  {
    icon: Ban,
    title: "Block & Unmatch",
    description: "Instantly block and unmatch with anyone who makes you uncomfortable. They won't be notified.",
  },
  {
    icon: MessageCircle,
    title: "Message Filters",
    description: "Our AI-powered filters detect and hide offensive messages before you see them.",
  },
  {
    icon: Shield,
    title: "Profile Moderation",
    description: "Every profile is reviewed for compliance with our community guidelines.",
  },
  {
    icon: Lock,
    title: "Secure Messaging",
    description: "All messages are encrypted and never shared with third parties.",
  },
];

export default function Safety() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Safety Center</h1>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 py-8 text-center bg-gradient-to-b from-primary/10 to-background">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">Your Safety Matters</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Meeting new people is exciting, but safety should always come first. We're committed to creating a secure environment for everyone on CubaDate.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-6">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/help-support")}
            className="flex items-center gap-3 p-4 bg-primary text-primary-foreground rounded-xl"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="font-medium text-sm">Get Help Now</span>
          </button>
          <button
            onClick={() => navigate("/community-guidelines")}
            className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl"
          >
            <FileText className="w-5 h-5 text-foreground" />
            <span className="font-medium text-sm text-foreground">Guidelines</span>
          </button>
        </div>
      </div>

      {/* Safety Features */}
      <div className="px-4 py-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Built-In Safety Features</h3>
        <div className="grid grid-cols-1 gap-3">
          {safetyFeatures.map((feature, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Tips */}
      <div className="px-4 py-6 bg-muted/30">
        <h3 className="text-lg font-bold text-foreground mb-2">Dating Safety Tips</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Follow these guidelines to stay safe while using CubaDate
        </p>
        <div className="space-y-3">
          {safetyTips.map((tip, index) => (
            <div
              key={index}
              className="p-4 bg-card rounded-xl border border-border"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <tip.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">{tip.title}</h4>
                  <p className="text-sm text-muted-foreground">{tip.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How to Report */}
      <div className="px-4 py-6">
        <h3 className="text-lg font-bold text-foreground mb-2">Reporting Guidelines</h3>
        <p className="text-sm text-muted-foreground mb-4">
          If you encounter concerning behavior, report it immediately. Here's what you can report:
        </p>
        
        <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
          <div className="p-4 bg-amber-500/10 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h4 className="font-semibold text-foreground">How to Report</h4>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>1. Go to the user's profile or open your conversation</li>
              <li>2. Tap the three dots (•••) in the top right corner</li>
              <li>3. Select "Report" and choose the reason</li>
              <li>4. Provide any additional details (optional)</li>
              <li>5. Submit your report</li>
            </ol>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {reportingReasons.map((reason, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border"
            >
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <reason.icon className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{reason.title}</h4>
                <p className="text-sm text-muted-foreground">{reason.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-primary/10 rounded-xl">
          <p className="text-sm text-foreground">
            <strong>Note:</strong> All reports are reviewed by our Trust & Safety team within 24 hours. You'll remain anonymous—reported users won't know who reported them.
          </p>
        </div>
      </div>

      {/* LGBTQ+ Safety */}
      <div className="px-4 py-6 bg-muted/30">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 via-yellow-500 to-blue-500 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">LGBTQ+ Safety</h3>
            <p className="text-sm text-muted-foreground">Important information for our LGBTQ+ community</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            We recognize that LGBTQ+ individuals face unique challenges, especially in regions where discrimination or criminalization exists.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Globe className="w-4 h-4 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Traveler Alert:</strong> When traveling to a new location, CubaDate may show a warning if local laws could affect you based on your orientation.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Profile Visibility:</strong> You can choose to hide your profile from straight-identifying users for added privacy.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Research First:</strong> Review local laws and available protections before traveling to a new destination.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Resources */}
      <div className="px-4 py-6">
        <h3 className="text-lg font-bold text-foreground mb-2">Emergency Resources</h3>
        <p className="text-sm text-muted-foreground mb-4">
          If you're in immediate danger, contact local emergency services. Here are some helpful resources:
        </p>

        <div className="space-y-4">
          {emergencyResources.map((country, index) => (
            <div key={index} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-3 bg-muted/50 border-b border-border">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  {country.country}
                </h4>
              </div>
              <div className="divide-y divide-border">
                {country.resources.map((resource, rIndex) => (
                  <div key={rIndex} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{resource.name}</p>
                      <p className="text-xs text-muted-foreground">{resource.available}</p>
                    </div>
                    <a
                      href={`tel:${resource.phone.replace(/[^0-9]/g, '')}`}
                      className="flex items-center gap-1 text-primary font-medium text-sm"
                    >
                      <PhoneCall className="w-4 h-4" />
                      {resource.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-destructive/10 rounded-xl border border-destructive/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">In Immediate Danger?</h4>
              <p className="text-sm text-muted-foreground">
                If you are in immediate danger, please contact your local emergency services immediately. Your safety is the top priority.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact CubaDate */}
      <div className="px-4 py-6 bg-muted/30">
        <h3 className="text-lg font-bold text-foreground mb-4">Contact Our Safety Team</h3>
        <div className="space-y-3">
          <button
            onClick={() => navigate("/help-support")}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Help & Support</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => window.location.href = 'mailto:safety@cubadate.com'}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Email Safety Team</span>
            </div>
            <ExternalLink className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Footer Links */}
      <div className="px-4 py-8 text-center border-t border-border">
        <p className="text-sm text-muted-foreground mb-4">
          Learn more about how we keep you safe
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate("/community-guidelines")}
            className="text-sm text-primary font-medium"
          >
            Community Guidelines
          </button>
          <button
            onClick={() => navigate("/privacy")}
            className="text-sm text-primary font-medium"
          >
            Privacy Policy
          </button>
          <button
            onClick={() => navigate("/terms")}
            className="text-sm text-primary font-medium"
          >
            Terms of Service
          </button>
        </div>
      </div>
    </div>
  );
}
