import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import {
  Search, HelpCircle, MessageCircle, BookOpen, Shield, AlertTriangle,
  CreditCard, ChevronRight, Phone, Mail, Flag, MessageSquare
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const HelpSupport = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [reportingOpen, setReportingOpen] = useState(false);

  const helpCategories = [
    { icon: <HelpCircle className="w-6 h-6" />, label: "Visit the Help Centre", description: "Browse FAQs and guides", path: "/faq" },
    { icon: <Shield className="w-6 h-6" />, label: "Get help with a safety issue", description: "Report abuse, harassment, or threats", action: "safety" },
    { icon: <Flag className="w-6 h-6" />, label: "Report a concern", description: "Fake profiles, scams, inappropriate content", action: "reporting" },
    { icon: <MessageSquare className="w-6 h-6" />, label: "Give us feedback", description: "Help us improve ISEXY", path: "/contact-us" },
  ];

  const quickLinks = [
    { icon: <BookOpen className="w-5 h-5" />, label: "Knowledge Base", path: "/knowledge-base" },
    { icon: <CreditCard className="w-5 h-5" />, label: "Billing Help", path: "/manage-payment-account" },
    { icon: <MessageCircle className="w-5 h-5" />, label: "Contact Us", path: "/contact-us" },
    { icon: <Shield className="w-5 h-5" />, label: "Safety Center", path: "/safety" },
  ];

  const handleAction = (category: typeof helpCategories[0]) => {
    if (category.action === "reporting") setReportingOpen(true);
    else if (category.action === "safety") {
      // Open the AI chat with safety pre-selected
      setReportingOpen(false);
      navigate("/safety");
    }
    else if (category.path) navigate(category.path);
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="p-4 flex flex-col items-center">
        <Logo size="lg" showText={false} variant="dark" />

        <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Get help</h1>
        <p className="text-muted-foreground text-sm mb-6 text-center">How can we help you today?</p>

        {/* Search */}
        <div className="relative w-full max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Main Categories — Airbnb style list */}
        <div className="w-full max-w-md space-y-0 bg-card rounded-xl border border-border overflow-hidden mb-6">
          {helpCategories.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => handleAction(cat)}
              className={`w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left ${
                i < helpCategories.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-primary flex-shrink-0">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{cat.label}</p>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Quick Links Grid */}
        <div className="w-full max-w-md grid grid-cols-2 gap-3 mb-6">
          {quickLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => navigate(link.path)}
              className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
            >
              <span className="text-primary">{link.icon}</span>
              <span className="font-medium text-foreground text-xs text-center">{link.label}</span>
            </button>
          ))}
        </div>

        {/* Contact Info */}
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-foreground text-sm mb-3">Contact Support Directly</h3>
          <div className="space-y-3">
            <a href="mailto:cubaresort.ca@gmail.com" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary">
              <Mail className="w-4 h-4" />
              cubaresort.ca@gmail.com
            </a>
            <a href="tel:+14509994999" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary">
              <Phone className="w-4 h-4" />
              +1 450 999 4999 (Canada)
            </a>
            <a href="tel:+5353071185" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary">
              <Phone className="w-4 h-4" />
              +53 5307 1185 (Cuba)
            </a>
          </div>
        </div>

        {/* Ticket Tracking */}
        <Button variant="outline" className="w-full max-w-md" onClick={() => navigate("/ticket-tracking")}>
          Track My Support Tickets
        </Button>

        <div className="flex gap-6 mt-6">
          <button className="text-primary text-sm" onClick={() => navigate("/privacy")}>Privacy</button>
          <button className="text-primary text-sm" onClick={() => navigate("/terms")}>Terms</button>
        </div>
      </div>

      {/* Reporting Sheet */}
      <Sheet open={reportingOpen} onOpenChange={setReportingOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle className="text-xl font-bold text-left">How would you like to report?</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Choose the best option so we can get you the right help.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => { setReportingOpen(false); navigate("/contact-us"); }}
              className="w-full py-5 text-base"
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              Report a problem
            </Button>
            <Button
              variant="outline"
              onClick={() => { setReportingOpen(false); navigate("/contact-us"); }}
              className="w-full py-5 text-base"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Leave feedback
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AuthLayout>
  );
};

export default HelpSupport;
