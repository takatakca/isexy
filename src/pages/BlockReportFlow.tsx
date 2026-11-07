import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
import { blockMember, blockReportErrorText, reportMember, type ReportReason } from "@/lib/blocks";
import { goBack } from "@/lib/navigation";

type ReasonOption = {
  id: ReportReason;
  icon: React.ReactNode;
  title: string;
  description: string;
};

const reportReasons: ReasonOption[] = [
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
  const location = useLocation();
  const { userId } = useParams();
  const { profile } = useAuth();
  /** Where to go once the member is blocked (a chat with them would no longer open). */
  const returnTo = (location.state as { returnTo?: string; source?: string } | null)?.returnTo;
  const source = (location.state as { source?: string } | null)?.source;

  const [step, setStep] = useState<"choice" | "report-reason" | "report-details" | "complete">("choice");
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [blockUser, setBlockUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const isSelf = !!profile && profile.id === userId;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase.from("profiles").select("first_name").eq("id", userId).maybeSingle().then(({ data }) => {
      if (alive && data?.first_name) setName(data.first_name);
    });
    return () => { alive = false; };
  }, [userId]);

  const leave = () => {
    if (returnTo) navigate(returnTo, { replace: true });
    else goBack(navigate, "/discover");
  };

  const handleBlock = async () => {
    if (!profile || !userId || isSelf) return;

    setIsSubmitting(true);
    try {
      await blockMember(profile.id, userId);
      toast.success(name ? `${name} is blocked` : "Member blocked");
      leave();
    } catch (err) {
      console.error("Block failed:", err);
      toast.error(blockReportErrorText(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReport = async () => {
    if (!profile || !userId || !selectedReason || isSelf) return;

    setIsSubmitting(true);
    try {
      const result = await reportMember(profile.id, {
        reportedId: userId,
        reason: selectedReason,
        details,
        block: blockUser,
        source,
      });
      setBlocked(result.blocked);
      setDuplicate(result.duplicate);
      setStep("complete");
    } catch (err) {
      console.error("Report failed:", err);
      toast.error(blockReportErrorText(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "complete") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="px-4 py-4">
          <button onClick={() => (blocked ? navigate(returnTo ?? "/discover", { replace: true }) : goBack(navigate, "/discover"))} className="p-2 -ml-2" aria-label="Close">
            <X className="w-6 h-6 text-foreground" />
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Report Submitted</h1>
          <p className="text-muted-foreground mb-8">
            {duplicate
              ? "You had already reported this member: we added these details to your report. Thank you for helping keep ISEXY safe."
              : "Thank you for helping keep ISEXY safe. Our safety team reviews every report; the member is not told who reported them."}
          </p>

          {blocked && (
            <div className="bg-muted/50 rounded-xl p-4 w-full mb-6">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-destructive" />
                <span className="text-foreground font-medium">{name ? `${name} is blocked` : "Member blocked"}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                You won't see each other on ISEXY and they can't message or call you. Unblock anytime in Settings › Block Contacts.
              </p>
            </div>
          )}

          <Button
            onClick={() => navigate(blocked && returnTo ? returnTo : "/discover", { replace: true })}
            className="w-full gradient-primary py-6"
          >
            {blocked && returnTo === "/matches" ? "Back to messages" : "Back to Discover"}
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
              placeholder="What happened? Dates, messages or anything that helps our team look into it."
              maxLength={2000}
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
              <span className="font-medium text-foreground">Also block {name ?? "this member"}</span>
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
            disabled={isSubmitting || isSelf}
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
          <button onClick={() => goBack(navigate, "/discover")} className="p-2 -ml-2" aria-label="Back">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{name ? `Block or report ${name}` : "Block or report"}</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {isSelf && (
          <p className="text-sm text-muted-foreground">This is your own profile.</p>
        )}
        {/* Block Option */}
        <button
          onClick={handleBlock}
          disabled={isSubmitting || isSelf}
          className="w-full flex items-start gap-4 p-5 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Ban className="w-6 h-6 text-foreground" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-foreground text-lg">Block</h3>
            <p className="text-muted-foreground text-sm">
              You won't see each other on ISEXY and they can't message or call you. They aren't told. Unblock anytime in Settings › Block Contacts.
            </p>
          </div>
        </button>

        {/* Report Option */}
        <button
          onClick={() => setStep("report-reason")}
          disabled={isSelf}
          className="w-full flex items-start gap-4 p-5 bg-card rounded-xl border border-border hover:border-destructive/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <Flag className="w-6 h-6 text-destructive" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-foreground text-lg">Report</h3>
            <p className="text-muted-foreground text-sm">
              Tell our safety team about fake profiles, scams, harassment or anyone under 18. Reports are confidential.
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
