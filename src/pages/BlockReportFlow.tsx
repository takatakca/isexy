import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, Ban, Flag, AlertTriangle, UserX, DollarSign, 
  Camera, MessageSquare, AlertCircle, Globe, Shield, Check,
  ChevronRight, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ReportReason = {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

const reportReasons: ReportReason[] = [
  {
    id: "fake",
    icon: <UserX className="w-5 h-5" />,
    title: "Fake Profile / Catfishing",
    description: "Using fake photos or impersonating someone",
  },
  {
    id: "harassment",
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Harassment or Abuse",
    description: "Unwanted, aggressive, or threatening behavior",
  },
  {
    id: "scam",
    icon: <DollarSign className="w-5 h-5" />,
    title: "Scam or Fraud",
    description: "Asking for money or promoting schemes",
  },
  {
    id: "inappropriate",
    icon: <Camera className="w-5 h-5" />,
    title: "Inappropriate Content",
    description: "Explicit, violent, or offensive photos",
  },
  {
    id: "underage",
    icon: <AlertCircle className="w-5 h-5" />,
    title: "Underage User",
    description: "User appears to be under 18 years old",
  },
  {
    id: "spam",
    icon: <Globe className="w-5 h-5" />,
    title: "Spam or Commercial",
    description: "Unsolicited ads or promotional content",
  },
  {
    id: "other",
    icon: <AlertTriangle className="w-5 h-5" />,
    title: "Other",
    description: "Something else not listed above",
  },
];

export default function BlockReportFlow() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { profile } = useAuth();
  
  const [step, setStep] = useState<"choice" | "report-reason" | "report-details" | "complete">("choice");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [blockUser, setBlockUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBlock = async () => {
    if (!profile || !userId) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("blocks")
        .insert({
          blocker_id: profile.id,
          blocked_id: userId,
        });

      if (error) throw error;
      toast.success("User blocked successfully");
      navigate(-1);
    } catch (err) {
      toast.error("Failed to block user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReport = async () => {
    if (!profile || !userId || !selectedReason) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("reports")
        .insert({
          reporter_id: profile.id,
          reported_id: userId,
          reason: selectedReason,
          description: details || null,
        });

      if (error) throw error;

      if (blockUser) {
        await supabase.from("blocks").insert({
          blocker_id: profile.id,
          blocked_id: userId,
        });
      }

      setStep("complete");
    } catch (err) {
      toast.error("Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "complete") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <X className="w-6 h-6 text-foreground" />
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Report Submitted</h1>
          <p className="text-muted-foreground mb-8">
            Thank you for helping keep CubaDate safe. Our team will review your report within 24 hours.
          </p>
          
          {blockUser && (
            <div className="bg-muted/50 rounded-xl p-4 w-full mb-6">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-destructive" />
                <span className="text-foreground font-medium">User has been blocked</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                They won't be able to see or contact you.
              </p>
            </div>
          )}

          <Button 
            onClick={() => navigate("/discover")} 
            className="w-full gradient-primary py-6"
          >
            Continue Swiping
          </Button>
        </div>
      </div>
    );
  }

  if (step === "report-details") {
    const reason = reportReasons.find(r => r.id === selectedReason);
    
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep("report-reason")} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Provide Details</h1>
          </div>
        </header>

        <div className="px-4 py-6">
          {/* Selected Reason */}
          <div className="bg-destructive/10 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
                {reason?.icon}
              </div>
              <div>
                <p className="font-semibold text-foreground">{reason?.title}</p>
                <p className="text-sm text-muted-foreground">{reason?.description}</p>
              </div>
            </div>
          </div>

          {/* Details Input */}
          <div className="mb-6">
            <label className="block text-foreground font-medium mb-2">
              Additional Details (Optional)
            </label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please provide any additional information that might help us investigate..."
              className="min-h-[120px]"
            />
          </div>

          {/* Block Option */}
          <button
            onClick={() => setBlockUser(!blockUser)}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border mb-6"
          >
            <div className="flex items-center gap-3">
              <Ban className="w-5 h-5 text-destructive" />
              <span className="font-medium text-foreground">Also block this user</span>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
              blockUser ? "border-primary bg-primary" : "border-muted-foreground"
            }`}>
              {blockUser && <Check className="w-4 h-4 text-white" />}
            </div>
          </button>

          {/* Info */}
          <div className="bg-muted/50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Your report is confidential. The reported user won't know who reported them.
              </p>
            </div>
          </div>

          <Button
            onClick={handleReport}
            disabled={isSubmitting}
            className="w-full py-6 bg-destructive hover:bg-destructive/90"
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "report-reason") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep("choice")} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Why are you reporting?</h1>
          </div>
        </header>

        <div className="px-4 py-6">
          <p className="text-muted-foreground mb-4">
            Select the reason that best describes the issue
          </p>

          <div className="space-y-3">
            {reportReasons.map((reason) => (
              <button
                key={reason.id}
                onClick={() => {
                  setSelectedReason(reason.id);
                  setStep("report-details");
                }}
                className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:border-destructive/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                    {reason.icon}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{reason.title}</p>
                    <p className="text-sm text-muted-foreground">{reason.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Initial Choice Screen
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">What would you like to do?</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Block Option */}
        <button
          onClick={handleBlock}
          disabled={isSubmitting}
          className="w-full flex items-start gap-4 p-5 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Ban className="w-6 h-6 text-foreground" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-foreground text-lg">Block</h3>
            <p className="text-muted-foreground text-sm">
              They won't be able to see your profile or contact you. You can unblock them anytime in settings.
            </p>
          </div>
        </button>

        {/* Report Option */}
        <button
          onClick={() => setStep("report-reason")}
          className="w-full flex items-start gap-4 p-5 bg-card rounded-xl border border-border hover:border-destructive/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <Flag className="w-6 h-6 text-destructive" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-foreground text-lg">Report</h3>
            <p className="text-muted-foreground text-sm">
              Report concerning behavior to our safety team. All reports are confidential and reviewed within 24 hours.
            </p>
          </div>
        </button>

        {/* Info */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground mb-1">In immediate danger?</p>
              <p className="text-sm text-muted-foreground">
                If you're in immediate danger, please contact your local emergency services. 
                <button 
                  onClick={() => navigate("/safety")} 
                  className="text-primary font-medium ml-1"
                >
                  View emergency resources
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
