import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Search, Shield, AlertTriangle, Ban, Eye, 
  Clock, CheckCircle, XCircle, User, MessageSquare, 
  Calendar, Filter, RefreshCw, ChevronRight, Trash2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface ContentViolation {
  id: string;
  profile_id: string;
  message_id: string | null;
  violation_type: string;
  detected_content: string;
  action_taken: string | null;
  created_at: string;
  profile?: {
    first_name: string;
    user_id: string;
  };
}

interface UserWarning {
  id: string;
  profile_id: string;
  warning_type: string;
  warning_level: number;
  ban_until: string | null;
  is_permanent_ban: boolean | null;
  evidence: string | null;
  issued_by: string | null;
  created_at: string;
  profile?: {
    first_name: string;
    user_id: string;
  };
}

interface BannedUser {
  profile_id: string;
  first_name: string;
  warning_count: number;
  is_permanent: boolean;
  ban_until: string | null;
  last_violation: string;
}

export default function AdminModeration() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<ContentViolation[]>([]);
  const [warnings, setWarnings] = useState<UserWarning[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedViolation, setSelectedViolation] = useState<ContentViolation | null>(null);
  const [selectedWarning, setSelectedWarning] = useState<UserWarning | null>(null);
  const [confirmUnbanUser, setConfirmUnbanUser] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalViolations: 0,
    activeWarnings: 0,
    permanentBans: 0,
    tempBans: 0,
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Access denied. Please log in.");
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdminRole = roles?.some(r => r.role === "admin" || r.role === "moderator");
      
      if (!hasAdminRole) {
        toast.error("Admin access required");
        navigate("/settings");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/settings");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchViolations(),
      fetchWarnings(),
      fetchBannedUsers(),
    ]);
    setLoading(false);
  };

  const fetchViolations = async () => {
    const { data, error } = await supabase
      .from("content_violations")
      .select(`
        *,
        profile:profiles!content_violations_profile_id_fkey(first_name, user_id)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching violations:", error);
      return;
    }

    setViolations(data || []);
    setStats(prev => ({ ...prev, totalViolations: data?.length || 0 }));
  };

  const fetchWarnings = async () => {
    const { data, error } = await supabase
      .from("user_warnings")
      .select(`
        *,
        profile:profiles!user_warnings_profile_id_fkey(first_name, user_id)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching warnings:", error);
      return;
    }

    setWarnings(data || []);
    
    // Calculate stats
    const permanentBans = data?.filter(w => w.is_permanent_ban).length || 0;
    const tempBans = data?.filter(w => w.ban_until && !w.is_permanent_ban && new Date(w.ban_until) > new Date()).length || 0;
    
    setStats(prev => ({ 
      ...prev, 
      activeWarnings: data?.length || 0,
      permanentBans,
      tempBans,
    }));
  };

  const fetchBannedUsers = async () => {
    // Get users with active bans
    const { data, error } = await supabase
      .from("user_warnings")
      .select(`
        profile_id,
        ban_until,
        is_permanent_ban,
        created_at,
        profile:profiles!user_warnings_profile_id_fkey(first_name)
      `)
      .or("is_permanent_ban.eq.true,ban_until.gt.now()")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching banned users:", error);
      return;
    }

    // Group by profile_id and count warnings
    const userMap = new Map<string, BannedUser>();
    
    for (const warning of (data || [])) {
      if (!userMap.has(warning.profile_id)) {
        userMap.set(warning.profile_id, {
          profile_id: warning.profile_id,
          first_name: (warning.profile as any)?.first_name || "Unknown",
          warning_count: 1,
          is_permanent: warning.is_permanent_ban || false,
          ban_until: warning.ban_until,
          last_violation: warning.created_at,
        });
      } else {
        const existing = userMap.get(warning.profile_id)!;
        existing.warning_count++;
        if (warning.is_permanent_ban) existing.is_permanent = true;
      }
    }

    setBannedUsers(Array.from(userMap.values()));
  };

  const handleUnbanUser = async (profileId: string) => {
    try {
      // Clear all active bans for this user
      const { error } = await supabase
        .from("user_warnings")
        .update({ 
          ban_until: null, 
          is_permanent_ban: false 
        })
        .eq("profile_id", profileId);

      if (error) throw error;

      toast.success("User unbanned successfully");
      setConfirmUnbanUser(null);
      fetchData();
    } catch (error) {
      console.error("Error unbanning user:", error);
      toast.error("Failed to unban user");
    }
  };

  const handleIssueBan = async (profileId: string, duration: "24h" | "7d" | "permanent") => {
    try {
      let banUntil: Date | null = null;
      let isPermanent = false;

      if (duration === "24h") {
        banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      } else if (duration === "7d") {
        banUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      } else {
        isPermanent = true;
      }

      const { error } = await supabase.from("user_warnings").insert({
        profile_id: profileId,
        warning_type: "manual_ban",
        warning_level: isPermanent ? 3 : (duration === "7d" ? 2 : 1),
        ban_until: banUntil?.toISOString(),
        is_permanent_ban: isPermanent,
        issued_by: profile?.id,
      });

      if (error) throw error;

      toast.success(`User banned for ${duration}`);
      fetchData();
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Failed to ban user");
    }
  };

  const getViolationTypeLabel = (type: string) => {
    switch (type) {
      case "phone_number": return "Phone Number";
      case "email": return "Email Address";
      case "address": return "Physical Address";
      case "social_media": return "Social Media";
      case "payment_info": return "Payment Info";
      default: return type;
    }
  };

  const getViolationTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      phone_number: "bg-red-500/20 text-red-400 border-red-500/30",
      email: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      address: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      social_media: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      payment_info: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    return colors[type] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const filteredViolations = violations.filter(v => {
    if (typeFilter !== "all" && v.violation_type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        v.detected_content.toLowerCase().includes(query) ||
        v.profile?.first_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/admin")} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Content Moderation</h1>
            <p className="text-sm text-muted-foreground">Manage violations, warnings & bans</p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalViolations}</p>
                <p className="text-xs text-muted-foreground">Total Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.activeWarnings}</p>
                <p className="text-xs text-muted-foreground">Warnings Issued</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.tempBans}</p>
                <p className="text-xs text-muted-foreground">Temp Bans</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.permanentBans}</p>
                <p className="text-xs text-muted-foreground">Permanent Bans</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="violations" className="px-4">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="warnings">Warnings</TabsTrigger>
          <TabsTrigger value="bans">Active Bans</TabsTrigger>
        </TabsList>

        {/* Violations Tab */}
        <TabsContent value="violations">
          {/* Filters */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search violations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="phone_number">Phone Number</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="address">Address</SelectItem>
                <SelectItem value="social_media">Social Media</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Violations Table */}
          <Card className="bg-card border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Detected Content</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredViolations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No violations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredViolations.map((violation) => (
                    <TableRow key={violation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium">
                            {violation.profile?.first_name || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getViolationTypeBadge(violation.violation_type)} border`}>
                          {getViolationTypeLabel(violation.violation_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                          {violation.detected_content}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(violation.created_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedViolation(violation)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Warnings Tab */}
        <TabsContent value="warnings">
          <Card className="bg-card border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Warning Level</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ban Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : warnings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No warnings found
                    </TableCell>
                  </TableRow>
                ) : (
                  warnings.map((warning) => (
                    <TableRow key={warning.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium">
                            {warning.profile?.first_name || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${
                          warning.warning_level === 1 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                          warning.warning_level === 2 ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                          "bg-red-500/20 text-red-400 border-red-500/30"
                        } border`}>
                          Level {warning.warning_level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {warning.warning_type.replace("_", " ")}
                      </TableCell>
                      <TableCell>
                        {warning.is_permanent_ban ? (
                          <Badge className="bg-red-600/30 text-red-400 border-red-500/50 border">
                            <Ban className="w-3 h-3 mr-1" />
                            Permanent
                          </Badge>
                        ) : warning.ban_until && new Date(warning.ban_until) > new Date() ? (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 border">
                            <Clock className="w-3 h-3 mr-1" />
                            Until {format(new Date(warning.ban_until), "MMM d")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Expired</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(warning.created_at), "MMM d, h:mm a")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Active Bans Tab */}
        <TabsContent value="bans">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Currently Banned Users</CardTitle>
            </CardHeader>
            <CardContent>
              {bannedUsers.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground">
                  No active bans
                </p>
              ) : (
                <div className="space-y-3">
                  {bannedUsers.map((user) => (
                    <div 
                      key={user.profile_id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <Ban className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.first_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.warning_count} warning(s) • 
                            {user.is_permanent ? " Permanent ban" : ` Banned until ${format(new Date(user.ban_until!), "MMM d, h:mm a")}`}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setConfirmUnbanUser(user.profile_id)}
                        className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                      >
                        Unban
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Violation Details Dialog */}
      <Dialog open={!!selectedViolation} onOpenChange={() => setSelectedViolation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Violation Details</DialogTitle>
          </DialogHeader>
          {selectedViolation && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">User</label>
                <p className="font-medium">{selectedViolation.profile?.first_name || "Unknown"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Violation Type</label>
                <Badge className={`${getViolationTypeBadge(selectedViolation.violation_type)} border ml-2`}>
                  {getViolationTypeLabel(selectedViolation.violation_type)}
                </Badge>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Detected Content</label>
                <code className="block mt-1 p-3 bg-muted rounded-lg text-sm break-all">
                  {selectedViolation.detected_content}
                </code>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Date</label>
                <p>{format(new Date(selectedViolation.created_at), "MMMM d, yyyy 'at' h:mm a")}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Action Taken</label>
                <p>{selectedViolation.action_taken || "Warning issued"}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedViolation(null)}>
              Close
            </Button>
            {selectedViolation && (
              <Select 
                onValueChange={(value) => {
                  handleIssueBan(selectedViolation.profile_id, value as "24h" | "7d" | "permanent");
                  setSelectedViolation(null);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Issue Ban" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24 Hour Ban</SelectItem>
                  <SelectItem value="7d">7 Day Ban</SelectItem>
                  <SelectItem value="permanent">Permanent Ban</SelectItem>
                </SelectContent>
              </Select>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Unban Dialog */}
      <Dialog open={!!confirmUnbanUser} onOpenChange={() => setConfirmUnbanUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Unban</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to unban this user? They will immediately regain access to messaging.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmUnbanUser(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => confirmUnbanUser && handleUnbanUser(confirmUnbanUser)}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm Unban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
