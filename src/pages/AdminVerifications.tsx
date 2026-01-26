import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  Phone,
  CreditCard,
  Video,
  Mic,
  Eye,
  User,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Verification {
  id: string;
  profile_id: string;
  whatsapp_number: string;
  whatsapp_verified: boolean;
  carnet_id: string;
  carnet_verified: boolean;
  carnet_front_url: string | null;
  carnet_back_url: string | null;
  video_verified: boolean;
  video_url: string | null;
  audio_verified: boolean;
  audio_url: string | null;
  verification_status: string;
  rejection_reason: string | null;
  submitted_at: string;
  verified_at: string | null;
  profile?: {
    first_name: string;
    city: string | null;
    country: string;
  };
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function AdminVerifications() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        navigate('/');
        return;
      }

      await fetchVerifications();
    } catch (error) {
      console.error('Error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchVerifications = async () => {
    const { data, error } = await supabase
      .from("cuban_verifications" as any)
      .select(`
        *,
        profile:profiles!cuban_verifications_profile_id_fkey(first_name, city, country)
      `)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching verifications:", error);
    } else {
      setVerifications((data as any) || []);
    }
  };

  const handleApprove = async (verification: Verification) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("cuban_verifications" as any)
        .update({
          verification_status: "approved",
          verified_at: new Date().toISOString(),
          carnet_verified: true,
        } as any)
        .eq("id", verification.id);

      if (error) throw error;

      // Update profile is_verified
      await supabase
        .from("profiles")
        .update({ is_verified: true } as any)
        .eq("id", verification.profile_id);

      toast.success("Verification approved!");
      await fetchVerifications();
      setSelectedVerification(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to approve");
    }
    setProcessing(false);
  };

  const handleReject = async (verification: Verification) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("cuban_verifications" as any)
        .update({
          verification_status: "rejected",
          rejection_reason: rejectionReason,
        } as any)
        .eq("id", verification.id);

      if (error) throw error;

      toast.success("Verification rejected");
      await fetchVerifications();
      setSelectedVerification(null);
      setRejectionReason("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject");
    }
    setProcessing(false);
  };

  const filteredVerifications = verifications.filter((v) => {
    if (filter === "all") return true;
    return v.verification_status === filter;
  });

  const counts = {
    pending: verifications.filter((v) => v.verification_status === "pending").length,
    approved: verifications.filter((v) => v.verification_status === "approved").length,
    rejected: verifications.filter((v) => v.verification_status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Cuban Verifications</h1>
          <Button variant="ghost" size="icon" onClick={fetchVerifications} className="ml-auto">
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="cursor-pointer" onClick={() => setFilter("pending")}>
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{counts.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setFilter("approved")}>
            <CardContent className="p-4 text-center">
              <Check className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{counts.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setFilter("rejected")}>
            <CardContent className="p-4 text-center">
              <X className="h-6 w-6 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{counts.rejected}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1">Pending</TabsTrigger>
            <TabsTrigger value="approved" className="flex-1">Approved</TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1">Rejected</TabsTrigger>
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Verifications List */}
        <div className="space-y-3">
          {filteredVerifications.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No verifications found
              </CardContent>
            </Card>
          ) : (
            filteredVerifications.map((verification) => (
              <Card
                key={verification.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedVerification(verification)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">
                          {verification.profile?.first_name || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {verification.profile?.city}, {verification.profile?.country}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(verification.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge className={statusColors[verification.verification_status]}>
                      {verification.verification_status}
                    </Badge>
                  </div>

                  {/* Verification Steps */}
                  <div className="flex gap-2 mt-3">
                    <Badge variant={verification.whatsapp_verified ? "default" : "outline"} className="gap-1">
                      <Phone className="h-3 w-3" />
                      WhatsApp
                    </Badge>
                    <Badge variant={verification.carnet_front_url ? "default" : "outline"} className="gap-1">
                      <CreditCard className="h-3 w-3" />
                      Carnet
                    </Badge>
                    <Badge variant={verification.video_url ? "default" : "outline"} className="gap-1">
                      <Video className="h-3 w-3" />
                      Video
                    </Badge>
                    <Badge variant={verification.audio_url ? "default" : "outline"} className="gap-1">
                      <Mic className="h-3 w-3" />
                      Audio
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedVerification && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {selectedVerification.profile?.first_name || "Verification Details"}
                </DialogTitle>
                <DialogDescription>
                  Review and approve/reject this Cuban verification
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge className={statusColors[selectedVerification.verification_status]}>
                    {selectedVerification.verification_status}
                  </Badge>
                </div>

                {/* WhatsApp */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4" />
                    <span className="font-medium">WhatsApp</span>
                    {selectedVerification.whatsapp_verified && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedVerification.whatsapp_number}</p>
                </div>

                {/* Carnet ID */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="font-medium">Carnet ID</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{selectedVerification.carnet_id}</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {selectedVerification.carnet_front_url ? (
                      <a
                        href={selectedVerification.carnet_front_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-background rounded border hover:bg-accent transition"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="text-sm">Front</span>
                      </a>
                    ) : (
                      <div className="p-2 bg-background rounded border text-sm text-muted-foreground">
                        No front image
                      </div>
                    )}
                    {selectedVerification.carnet_back_url ? (
                      <a
                        href={selectedVerification.carnet_back_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-background rounded border hover:bg-accent transition"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="text-sm">Back</span>
                      </a>
                    ) : (
                      <div className="p-2 bg-background rounded border text-sm text-muted-foreground">
                        No back image
                      </div>
                    )}
                  </div>
                </div>

                {/* Video */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Video className="h-4 w-4" />
                    <span className="font-medium">Video Verification</span>
                    {selectedVerification.video_verified && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {selectedVerification.video_url ? (
                    <video
                      src={selectedVerification.video_url}
                      controls
                      className="w-full rounded-lg"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No video uploaded</p>
                  )}
                </div>

                {/* Audio */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="h-4 w-4" />
                    <span className="font-medium">Audio Verification</span>
                    {selectedVerification.audio_verified && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {selectedVerification.audio_url ? (
                    <audio
                      src={selectedVerification.audio_url}
                      controls
                      className="w-full"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No audio uploaded</p>
                  )}
                </div>

                {/* Rejection Reason (if rejected) */}
                {selectedVerification.verification_status === "rejected" && selectedVerification.rejection_reason && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="font-medium text-red-800 dark:text-red-200">Rejection Reason</p>
                    <p className="text-sm text-red-700 dark:text-red-300">{selectedVerification.rejection_reason}</p>
                  </div>
                )}

                {/* Actions */}
                {selectedVerification.verification_status === "pending" && (
                  <div className="space-y-3 pt-4 border-t">
                    <Textarea
                      placeholder="Rejection reason (required for rejection)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="min-h-20"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(selectedVerification)}
                        disabled={processing}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(selectedVerification)}
                        disabled={processing || !rejectionReason.trim()}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
