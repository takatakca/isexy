import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Search, X, Info, HelpCircle, MessageCircle, BookOpen } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LiveChatWidget } from "@/components/LiveChatWidget";

const HelpSupport = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [reportingOpen, setReportingOpen] = useState(false);

  const categories = [
    { name: "A Guide To CubaDate", color: "bg-primary", path: "/faq" },
    { name: "Troubleshooting", color: "bg-orange-500", path: "/faq" },
    { name: "Security & Privacy", color: "bg-orange-400", path: "/safety" },
    { name: "Safety & Reporting", color: "bg-rose-600", action: "reporting" },
  ];

  const handleCategoryClick = (category: typeof categories[0]) => {
    if (category.action === "reporting") {
      setReportingOpen(true);
    } else if (category.path) {
      navigate(category.path);
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="p-4 flex flex-col items-center">
        <Logo size="lg" showText={false} variant="dark" />
        
        <h1 className="text-3xl font-bold text-foreground mb-6 text-center">
          Hi. How can we help?
        </h1>

        <div className="relative w-full max-w-md mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="w-full space-y-0">
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => handleCategoryClick(category)}
              className={`w-full p-6 ${category.color} text-white text-lg font-semibold text-center`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Quick Links */}
        <div className="w-full mt-6 grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate("/knowledge-base")}
            className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
          >
            <BookOpen className="w-8 h-8 text-primary" />
            <span className="font-medium text-foreground text-sm">Knowledge Base</span>
          </button>
          <button
            onClick={() => navigate("/faq")}
            className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
          >
            <HelpCircle className="w-8 h-8 text-primary" />
            <span className="font-medium text-foreground text-sm">FAQ</span>
          </button>
          <button
            onClick={() => navigate("/contact-us")}
            className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
          >
            <MessageCircle className="w-8 h-8 text-primary" />
            <span className="font-medium text-foreground text-sm">Contact Us</span>
          </button>
        </div>

        <div className="flex gap-6 mt-8">
          <button className="text-primary text-sm" onClick={() => navigate("/privacy")}>Privacy</button>
          <button className="text-muted-foreground text-sm flex items-center gap-1">
            English (US)
            <span>▼</span>
          </button>
        </div>
      </div>

      <Sheet open={reportingOpen} onOpenChange={setReportingOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <button
              onClick={() => setReportingOpen(false)}
              className="absolute left-4 top-4"
            >
              <X className="h-6 w-6 text-muted-foreground" />
            </button>
            <SheetTitle className="text-2xl font-bold text-left mt-4">
              Select reporting option:
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <p className="text-muted-foreground text-sm">
              Reports about abuse or spam shouldn't be submitted here.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <Button 
              onClick={() => {
                setReportingOpen(false);
                navigate("/contact-us");
              }}
              className="w-full bg-foreground text-background hover:bg-foreground/90 py-6 text-lg"
            >
              Report a problem
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setReportingOpen(false);
                navigate("/contact-us");
              }}
              className="w-full py-6 text-lg"
            >
              Leave feedback
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <LiveChatWidget />
    </AuthLayout>
  );
};

export default HelpSupport;
