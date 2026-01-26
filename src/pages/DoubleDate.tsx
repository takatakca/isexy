import { useState, useEffect } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Search, Heart, X, Check, Sparkles, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DoubleDatePair {
  id: string;
  user1_id: string;
  user2_id: string;
  status: string;
  invited_at: string;
  accepted_at?: string;
  partner?: {
    first_name: string;
    photo_url?: string;
  };
}

export default function DoubleDate() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState({
    show_me_on_friend_profile: true,
    show_friends_on_profile: true,
    show_double_date_profiles: true,
  });
  const [pairs, setPairs] = useState<DoubleDatePair[]>([]);
  const [pendingInvites, setPendingInvites] = useState<DoubleDatePair[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchSettings();
      fetchPairs();
    }
  }, [profile?.id]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("double_date_settings")
      .select("*")
      .eq("profile_id", profile!.id)
      .maybeSingle();

    if (data) {
      setSettings({
        show_me_on_friend_profile: data.show_me_on_friend_profile,
        show_friends_on_profile: data.show_friends_on_profile,
        show_double_date_profiles: data.show_double_date_profiles,
      });
    }
    setLoading(false);
  };

  const fetchPairs = async () => {
    // Fetch active pairs
    const { data: activePairs } = await supabase
      .from("double_date_pairs")
      .select("*")
      .or(`user1_id.eq.${profile!.id},user2_id.eq.${profile!.id}`)
      .eq("status", "active");

    // Fetch pending invites (where I'm invited)
    const { data: pending } = await supabase
      .from("double_date_pairs")
      .select("*")
      .eq("user2_id", profile!.id)
      .eq("status", "pending");

    if (activePairs) {
      // Fetch partner info for each pair
      const pairsWithPartners = await Promise.all(
        activePairs.map(async (pair) => {
          const partnerId = pair.user1_id === profile!.id ? pair.user2_id : pair.user1_id;
          const { data: partnerData } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", partnerId)
            .single();
          
          const { data: photoData } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", partnerId)
            .eq("position", 0)
            .maybeSingle();

          return {
            ...pair,
            partner: {
              first_name: partnerData?.first_name || "Unknown",
              photo_url: photoData?.photo_url,
            },
          };
        })
      );
      setPairs(pairsWithPartners);
    }

    if (pending) {
      const pendingWithPartners = await Promise.all(
        pending.map(async (pair) => {
          const { data: partnerData } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", pair.user1_id)
            .single();
          
          const { data: photoData } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", pair.user1_id)
            .eq("position", 0)
            .maybeSingle();

          return {
            ...pair,
            partner: {
              first_name: partnerData?.first_name || "Unknown",
              photo_url: photoData?.photo_url,
            },
          };
        })
      );
      setPendingInvites(pendingWithPartners);
    }
  };

  const updateSetting = async (key: keyof typeof settings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));

    const { error } = await supabase
      .from("double_date_settings")
      .upsert({
        profile_id: profile!.id,
        ...settings,
        [key]: value,
      });

    if (error) {
      toast.error("Failed to update settings");
    }
  };

  const searchFriends = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, city")
      .ilike("first_name", `%${searchQuery}%`)
      .neq("id", profile!.id)
      .limit(10);

    if (data) {
      const resultsWithPhotos = await Promise.all(
        data.map(async (p) => {
          const { data: photoData } = await supabase
            .from("profile_photos")
            .select("photo_url")
            .eq("profile_id", p.id)
            .eq("position", 0)
            .maybeSingle();

          return { ...p, photo_url: photoData?.photo_url };
        })
      );
      setSearchResults(resultsWithPhotos);
    }
    setIsSearching(false);
  };

  const sendInvite = async (friendId: string) => {
    const { error } = await supabase.from("double_date_pairs").insert({
      user1_id: profile!.id,
      user2_id: friendId,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("You already have a pair invitation with this person");
      } else {
        toast.error("Failed to send invitation");
      }
    } else {
      toast.success("Invitation sent!");
      setInviteDialogOpen(false);
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const respondToInvite = async (pairId: string, accept: boolean) => {
    const { error } = await supabase
      .from("double_date_pairs")
      .update({
        status: accept ? "active" : "declined",
        accepted_at: accept ? new Date().toISOString() : null,
      })
      .eq("id", pairId);

    if (!error) {
      toast.success(accept ? "You're now paired up for Double Date!" : "Invitation declined");
      fetchPairs();
    }
  };

  const endPair = async (pairId: string) => {
    const { error } = await supabase
      .from("double_date_pairs")
      .update({ status: "ended" })
      .eq("id", pairId);

    if (!error) {
      toast.success("Double Date pair ended");
      fetchPairs();
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Double Date</h1>
              <p className="text-sm text-muted-foreground">Pair up with a friend and match together!</p>
            </div>
          </div>
        </div>

        {/* Active Pairs */}
        {pairs.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Your Active Pairs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pairs.map((pair) => (
                <div key={pair.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-primary">
                      <AvatarImage src={pair.partner?.photo_url} />
                      <AvatarFallback>{pair.partner?.first_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{pair.partner?.first_name}</p>
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Active Pair
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => endPair(pair.id)}>
                    End Pair
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <Card className="border-primary/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Pending Invitations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-3 bg-primary/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={invite.partner?.photo_url} />
                      <AvatarFallback>{invite.partner?.first_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{invite.partner?.first_name}</p>
                      <p className="text-xs text-muted-foreground">wants to pair up!</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0"
                      onClick={() => respondToInvite(invite.id, false)}
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 w-9 p-0 bg-primary"
                      onClick={() => respondToInvite(invite.id, true)}
                    >
                      <Check className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Invite Friend */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full py-6 text-lg rounded-full" variant="default">
              <UserPlus className="w-5 h-5 mr-2" />
              Invite a Friend
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Find a Friend to Pair Up</DialogTitle>
              <DialogDescription>Search for a friend to start your Double Date adventure!</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchFriends()}
                />
                <Button onClick={searchFriends} disabled={isSearching}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={result.photo_url} />
                        <AvatarFallback>{result.first_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{result.first_name}</p>
                        <p className="text-xs text-muted-foreground">{result.city}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => sendInvite(result.id)}>
                      Invite
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Button */}
        <Button variant="outline" className="w-full py-6 text-lg rounded-full">
          <Share2 className="w-5 h-5 mr-2" />
          Share Double Date with Friends
        </Button>

        {/* Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Settings</CardTitle>
            <CardDescription>Control how Double Date works for you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground">Show me on my friend's profile</span>
                <p className="text-xs text-muted-foreground">Your name and photo may appear on your Double Date friend's profile.</p>
              </div>
              <Switch
                checked={settings.show_me_on_friend_profile}
                onCheckedChange={(v) => updateSetting("show_me_on_friend_profile", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground">Show friends on my profile</span>
                <p className="text-xs text-muted-foreground">Your Double Date friend's name and photo may appear on your profile.</p>
              </div>
              <Switch
                checked={settings.show_friends_on_profile}
                onCheckedChange={(v) => updateSetting("show_friends_on_profile", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground">Show Double Date profiles</span>
                <p className="text-xs text-muted-foreground">When turned off, you won't see Double Date profiles in For You mode.</p>
              </div>
              <Switch
                checked={settings.show_double_date_profiles}
                onCheckedChange={(v) => updateSetting("show_double_date_profiles", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="bg-gradient-to-r from-pink-500/10 to-orange-500/10 rounded-2xl p-4 border border-primary/20">
          <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            How Double Date Works
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>1. Pair up with a friend</li>
            <li>2. Browse other friend pairs together</li>
            <li>3. When both pairs swipe right, it's a group match!</li>
            <li>4. Start a group chat and plan your double date</li>
          </ul>
        </div>
      </div>
    </AuthLayout>
  );
}
