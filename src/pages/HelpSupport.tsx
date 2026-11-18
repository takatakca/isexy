import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AdSlot } from "@/components/AdSlot";
import { Input } from "@/components/ui/input";
import {
  Search, HelpCircle, MessageCircle, BookOpen, Shield, AlertTriangle,
  CreditCard, ChevronRight, Phone, Mail, Flag, MessageSquare, LifeBuoy } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
    else if (category.action === "safety") navigate("/safety");
    else if (category.path) navigate(category.path);
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="p-2 flex flex-col items-center">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-[1.25rem] gradient-glow shadow-glow" aria-hidden>
          <LifeBuoy className="h-8 w-8 text-white" />
        </span>
        <p className="eyebrow mb-2">Help Centre · EN / FR</p>
        <h1 className="type-title text-foreground mb-2 text-center">Get help</h1>
        <p className="text-muted-foreground text-sm mb-6 text-center">How can we help you today?</p>

        {/* Search: opens the Help Centre with the results */}
        <form
          role="search"
          className="relative w-full max-w-md mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQuery.trim();
            navigate(q ? `/knowledge-base?q=${encodeURIComponent(q)}` : "/knowledge-base");
          }}
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search for help..."
            aria-label="Search the Help Centre"
            enterKeyHint="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-full bg-card"
          />
        </form>

        {/* Main Categories — Airbnb style list */}
        <div className="w-full max-w-md space-y-0 bg-card/70 rounded-2xl border border-foreground/[0.08] overflow-hidden mb-6">
          {helpCategories.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => handleAction(cat)}
              className={`w-full min-h-[4.25rem] p-4 flex items-center gap-4 hover:bg-secondary/60 transition-colors text-left ${
                i < helpCategories.length - 1 ? "border-b border-foreground/[0.07]" : ""
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30 text-primary flex-shrink-0 [&_svg]:h-5 [&_svg]:w-5">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{cat.label}</p>
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
              className="bg-card/70 border border-foreground/[0.08] rounded-2xl p-4 min-h-[5.5rem] flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-secondary/60 transition-colors"
            >
              <span className="text-accent">{link.icon}</span>
              <span className="font-semibold text-foreground text-xs text-center">{link.label}</span>
            </button>
          ))}
        </div>

        {/* Contact Info */}
        <div className="w-full max-w-md panel p-4 mb-6">
          <h3 className="eyebrow-muted mb-3">Contact Support Directly</h3>
          <div className="space-y-3">
            <a href="mailto:cubaresort.ca@gmail.com" className="flex min-h-10 items-center gap-3 text-sm text-muted-foreground hover:text-primary">
              <Mail className="w-4 h-4" />
              cubaresort.ca@gmail.com
            </a>
            <a href="tel:+14509994999" className="flex min-h-10 items-center gap-3 text-sm text-muted-foreground hover:text-primary">
              <Phone className="w-4 h-4" />
              +1 450 999 4999 (Canada)
            </a>
            <a href="tel:+5353071185" className="flex min-h-10 items-center gap-3 text-sm text-muted-foreground hover:text-primary">
              <Phone className="w-4 h-4" />
              +53 5307 1185 (Cuba)
            </a>
          </div>
        </div>

        <AdSlot placement="isexy-content-inline" className="max-w-md mb-6" />

        {/* Ticket Tracking */}
        <Button variant="outline" className="w-full max-w-md h-12 rounded-full" onClick={() => navigate("/ticket-tracking")}>
          Track My Support Tickets
        </Button>

        <div className="flex gap-6 mt-6">
          <button className="min-h-11 px-2 text-link text-sm font-medium" onClick={() => navigate("/privacy")}>Privacy</button>
          <button className="min-h-11 px-2 text-link text-sm font-medium" onClick={() => navigate("/terms")}>Terms</button>
        </div>
      </div>

      {/* Reporting Sheet */}
      <Sheet open={reportingOpen} onOpenChange={setReportingOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle className="text-xl font-bold text-left">How would you like to report?</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            <strong className="text-foreground">To report a member</strong>, open their profile or your chat with
            them, tap the menu, then <strong className="text-foreground">Report</strong>. You can block them at the
            same time; they are not told who reported them. For anything else, send us a ticket.
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
            <Button
              variant="ghost"
              onClick={() => { setReportingOpen(false); navigate("/safety-tips"); }}
              className="w-full py-5 text-base"
            >
              <Shield className="w-5 h-5 mr-2" />
              Safety tips
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AuthLayout>
  );
};

export default HelpSupport;
