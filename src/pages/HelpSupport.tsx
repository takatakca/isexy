import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Search, X, Info } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const HelpSupport = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [reportingOpen, setReportingOpen] = useState(false);

  const categories = [
    { name: "A Guide To CubaDate", color: "bg-primary" },
    { name: "Troubleshooting", color: "bg-orange-500" },
    { name: "Security & Privacy", color: "bg-orange-400" },
    { name: "Safety & Reporting", color: "bg-rose-600" },
  ];

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
              onClick={() => category.name === "Safety & Reporting" && setReportingOpen(true)}
              className={`w-full p-6 ${category.color} text-white text-lg font-semibold text-center`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="flex gap-6 mt-8">
          <button className="text-primary text-sm">Privacy</button>
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
            <Button className="w-full bg-foreground text-background hover:bg-foreground/90 py-6 text-lg">
              Report a problem
            </Button>
            <Button
              variant="outline"
              className="w-full py-6 text-lg"
            >
              Leave feedback
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AuthLayout>
  );
};

export default HelpSupport;
