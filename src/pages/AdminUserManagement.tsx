import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Search, 
  Shield, 
  ShieldCheck, 
  ShieldOff,
  UserCog,
  Loader2,
  Crown,
  Users,
  Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  city: string | null;
  country: string;
  is_premium: boolean;
  subscription_tier: string | null;
  is_verified: boolean;
  is_cuban: boolean | null;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface CouponCode {
  id: string;
  code: string;
  code_type: string;
  description: string | null;
  subscription_tier: string | null;
  duration_days: number | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function AdminUserManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [couponCodes, setCouponCodes] = useState<CouponCode[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  // Coupon creation state
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    code_type: "trial" as string,
    description: "",
    subscription_tier: "platinum",
    duration_days: 30,
    max_uses: null as number | null,
  });
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  const checkAdminAndFetchData = async () => {
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
        toast.error("Admin access required");
        navigate('/');
        return;
      }

      await Promise.all([fetchUsers(), fetchCouponCodes()]);
    } catch (error) {
      console.error('Error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, first_name, city, country, is_premium, subscription_tier, is_verified, is_cuban, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (profiles) {
      setUsers(profiles);
      
      // Fetch roles for all users
      const userIds = profiles.map(p => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (roles) {
        const roleMap: Record<string, string[]> = {};
        roles.forEach(r => {
          if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
          roleMap[r.user_id].push(r.role);
        });
        setUserRoles(roleMap);
      }
    }
  };

  const fetchCouponCodes = async () => {
    const { data } = await supabase
      .from("coupon_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setCouponCodes(data);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) return;

    setUpdating(true);
    try {
      // Check if role already exists
      const existingRoles = userRoles[selectedUser.user_id] || [];
      if (existingRoles.includes(selectedRole)) {
        toast.error("User already has this role");
        return;
      }

      const roleToInsert = selectedRole as "admin" | "moderator" | "user";
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: selectedUser.user_id,
          role: roleToInsert,
        });

      if (error) throw error;

      toast.success(`${selectedRole} role assigned to ${selectedUser.first_name}`);
      setRoleDialogOpen(false);
      setSelectedUser(null);
      setSelectedRole("");
      await fetchUsers();
    } catch (error: any) {
      console.error("Error assigning role:", error);
      toast.error(error.message || "Failed to assign role");
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    setUpdating(true);
    try {
      const roleToDelete = role as "admin" | "moderator" | "user";
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", roleToDelete);

      if (error) throw error;

      toast.success(`${role} role removed`);
      await fetchUsers();
    } catch (error: any) {
      console.error("Error removing role:", error);
      toast.error(error.message || "Failed to remove role");
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateCoupon = async () => {
    if (!newCoupon.code.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    setCreatingCoupon(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("coupon_codes").insert({
        code: newCoupon.code.toUpperCase(),
        code_type: newCoupon.code_type,
        description: newCoupon.description || null,
        subscription_tier: newCoupon.subscription_tier,
        duration_days: newCoupon.code_type === "permanent" ? null : newCoupon.duration_days,
        max_uses: newCoupon.max_uses,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success("Coupon code created!");
      setCouponDialogOpen(false);
      setNewCoupon({
        code: "",
        code_type: "trial",
        description: "",
        subscription_tier: "platinum",
        duration_days: 30,
        max_uses: null,
      });
      await fetchCouponCodes();
    } catch (error: any) {
      console.error("Error creating coupon:", error);
      toast.error(error.message || "Failed to create coupon");
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleToggleCoupon = async (couponId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("coupon_codes")
        .update({ is_active: !isActive })
        .eq("id", couponId);

      if (error) throw error;

      toast.success(`Coupon ${!isActive ? "activated" : "deactivated"}`);
      await fetchCouponCodes();
    } catch (error: any) {
      toast.error(error.message || "Failed to update coupon");
    }
  };

  const filteredUsers = users.filter(user =>
    user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">User & Access Management</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <Tabs defaultValue="users">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="users" className="flex-1">
              <Users className="w-4 h-4 mr-2" />
              Users & Roles
            </TabsTrigger>
            <TabsTrigger value="coupons" className="flex-1">
              <Ticket className="w-4 h-4 mr-2" />
              VIP Codes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user roles and convert users to moderators or admins
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {filteredUsers.map((user) => {
                      const roles = userRoles[user.user_id] || [];
                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{user.first_name}</p>
                              {user.is_premium && (
                                <Crown className="w-4 h-4 text-yellow-500" />
                              )}
                              {user.is_verified && (
                                <ShieldCheck className="w-4 h-4 text-blue-500" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {user.city ? `${user.city}, ` : ""}{user.country}
                            </p>
                            <div className="flex gap-1 mt-2">
                              {roles.map((role) => (
                                <Badge
                                  key={role}
                                  variant={role === "admin" ? "default" : "secondary"}
                                  className="cursor-pointer"
                                  onClick={() => handleRemoveRole(user.user_id, role)}
                                >
                                  {role}
                                  <span className="ml-1 opacity-60">×</span>
                                </Badge>
                              ))}
                              {roles.length === 0 && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  User
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setRoleDialogOpen(true);
                            }}
                          >
                            <UserCog className="w-4 h-4 mr-2" />
                            Manage Role
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coupons">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>VIP & Coupon Codes</CardTitle>
                  <CardDescription>
                    Create and manage promotional and VIP access codes
                  </CardDescription>
                </div>
                <Button onClick={() => setCouponDialogOpen(true)}>
                  Create New Code
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {couponCodes.map((coupon) => (
                      <div
                        key={coupon.id}
                        className={`p-4 rounded-lg border ${
                          coupon.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <code className="text-lg font-mono font-bold">
                              {coupon.code}
                            </code>
                            <Badge variant={coupon.code_type === "permanent" ? "default" : "secondary"}>
                              {coupon.code_type}
                            </Badge>
                            {!coupon.is_active && (
                              <Badge variant="outline" className="text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleCoupon(coupon.id, coupon.is_active)}
                          >
                            {coupon.is_active ? (
                              <ShieldOff className="w-4 h-4" />
                            ) : (
                              <Shield className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {coupon.description || "No description"}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Tier: {coupon.subscription_tier}</span>
                          <span>
                            Duration: {coupon.duration_days ? `${coupon.duration_days} days` : "Permanent"}
                          </span>
                          <span>
                            Uses: {coupon.current_uses}{coupon.max_uses ? `/${coupon.max_uses}` : ""}
                          </span>
                          {coupon.expires_at && (
                            <span>Expires: {format(new Date(coupon.expires_at), "MMM d, yyyy")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Role Assignment Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to {selectedUser?.first_name}</DialogTitle>
            <DialogDescription>
              Select a role to assign to this user. Roles grant access to different parts of the admin panel.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Moderator - Can manage tickets and verifications
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Admin - Full access to all admin features
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole} disabled={!selectedRole || updating}>
              {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Coupon Dialog */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New VIP Code</DialogTitle>
            <DialogDescription>
              Create a promotional or VIP access code for users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Code</label>
              <Input
                placeholder="e.g., VIP2024"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Type</label>
              <Select
                value={newCoupon.code_type}
                onValueChange={(v) => setNewCoupon({ ...newCoupon, code_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial (Limited time)</SelectItem>
                  <SelectItem value="permanent">Permanent (Forever)</SelectItem>
                  <SelectItem value="vip">VIP Access</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subscription Tier</label>
              <Select
                value={newCoupon.subscription_tier}
                onValueChange={(v) => setNewCoupon({ ...newCoupon, subscription_tier: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plus">Plus</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newCoupon.code_type !== "permanent" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Duration (days)</label>
                <Input
                  type="number"
                  value={newCoupon.duration_days}
                  onChange={(e) => setNewCoupon({ ...newCoupon, duration_days: parseInt(e.target.value) || 30 })}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Max Uses (leave empty for unlimited)</label>
              <Input
                type="number"
                placeholder="Unlimited"
                value={newCoupon.max_uses || ""}
                onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input
                placeholder="e.g., 30-day free trial"
                value={newCoupon.description}
                onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCoupon} disabled={creatingCoupon}>
              {creatingCoupon ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
