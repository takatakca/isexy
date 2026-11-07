import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sliders, X, Zap, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { normalizeGender } from "@/lib/discoverFeed";
import { toast } from "sonner";

interface DiscoverFiltersProps {
  onFiltersChange?: () => void;
  showVerifiedOnly: boolean;
  setShowVerifiedOnly: (value: boolean) => void;
}

export function DiscoverFilters({ 
  onFiltersChange, 
  showVerifiedOnly, 
  setShowVerifiedOnly 
}: DiscoverFiltersProps) {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  // Profiles store "women" / "men" (ProfileSetup), older rows "female",
  // "male" or "everyone": normalize so the switches show what is saved.
  const prefs = (profile?.interested_in ?? []).map(normalizeGender);
  const wantsEveryone = prefs.length === 0 || prefs.includes("everyone");

  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [distance, setDistance] = useState(profile?.distance_preference || 50);
  const [ageRange, setAgeRange] = useState<[number, number]>([
    profile?.age_min || 18,
    profile?.age_max || 45,
  ]);
  const [showMen, setShowMen] = useState(wantsEveryone || prefs.includes("men"));
  const [showWomen, setShowWomen] = useState(wantsEveryone || prefs.includes("women"));
  const [globalMode, setGlobalMode] = useState(false);

  // Re-read the saved values each time the sheet opens (Settings may have changed them).
  const onOpenChange = (open: boolean) => {
    if (open && profile) {
      setDistance(profile.distance_preference || 50);
      setAgeRange([profile.age_min || 18, profile.age_max || 45]);
      setShowMen(wantsEveryone || prefs.includes("men"));
      setShowWomen(wantsEveryone || prefs.includes("women"));
    }
    setIsOpen(open);
  };

  const handleApply = async () => {
    if (!profile || saving) return;
    if (!showMen && !showWomen) {
      toast.error("Pick at least one: Women or Men.");
      return;
    }

    // Keep any other saved preference (e.g. "nonbinary"); "everyone" stays
    // "everyone" while both switches are on.
    const others = prefs.filter((p) => !["men", "women", "everyone"].includes(p));
    const interestedIn = showMen && showWomen && prefs.includes("everyone")
      ? ["everyone", ...others]
      : [...(showWomen ? ["women"] : []), ...(showMen ? ["men"] : []), ...others];

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        distance_preference: distance,
        age_min: ageRange[0],
        age_max: ageRange[1],
        interested_in: interestedIn,
      })
      .eq('id', profile.id);
    setSaving(false);

    if (error) {
      toast.error("Failed to update preferences");
      return;
    }

    toast.success("Preferences updated!");
    setIsOpen(false);
    await refreshProfile?.();
    onFiltersChange?.();
  };
  
  return (
    <div className="flex items-center gap-2">
      {/* Safety Button */}
      <button 
        onClick={() => navigate("/safety-tips")}
        className="p-2 hover:bg-muted/50 rounded-full transition-colors"
        aria-label="Safety tips"
      >
        <BadgeCheck className="w-6 h-6 text-cyan-500" />
      </button>

      {/* Filters Sheet */}
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <button className="p-2 hover:bg-muted/50 rounded-full transition-colors" aria-label="Discovery settings">
            <Sliders className="w-6 h-6 text-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[320px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle className="text-xl">Discovery Settings</SheetTitle>
            <SheetDescription>
              Customize who you see on Discover
            </SheetDescription>
          </SheetHeader>
          
          <div className="py-6 space-y-8">
            {/* Verified Only Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-primary" />
                  <Label className="text-base font-medium">Verified Only</Label>
                </div>
                <Switch
                  checked={showVerifiedOnly}
                  onCheckedChange={setShowVerifiedOnly}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Only show verified profiles for safer connections
              </p>
            </div>

            {/* Distance Preference */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Maximum Distance</Label>
                <span className="text-sm text-muted-foreground">
                  {globalMode ? "Global" : `${distance} km`}
                </span>
              </div>
              <Slider
                value={[distance]}
                onValueChange={([value]) => setDistance(value)}
                max={160}
                min={2}
                step={1}
                disabled={globalMode}
                className="w-full"
              />
              <div className="flex items-center justify-between">
                <Label htmlFor="global-mode" className="text-sm text-muted-foreground">
                  Go Global
                </Label>
                <Switch
                  id="global-mode"
                  checked={globalMode}
                  onCheckedChange={setGlobalMode}
                />
              </div>
            </div>
            
            {/* Age Range */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Age Range</Label>
                <span className="text-sm text-muted-foreground">
                  {ageRange[0]} - {ageRange[1]}
                </span>
              </div>
              <Slider
                value={ageRange}
                onValueChange={(values) => setAgeRange(values as [number, number])}
                max={100}
                min={18}
                step={1}
                className="w-full"
              />
            </div>
            
            {/* Show Me */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Show Me</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-women" className="text-sm">Women</Label>
                  <Switch
                    id="show-women"
                    checked={showWomen}
                    onCheckedChange={setShowWomen}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-men" className="text-sm">Men</Label>
                  <Switch
                    id="show-men"
                    checked={showMen}
                    onCheckedChange={setShowMen}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <SheetFooter className="gap-2 sm:gap-0">
            <SheetClose asChild>
              <Button variant="outline" className="flex-1">
                Cancel
              </Button>
            </SheetClose>
            <Button onClick={handleApply} disabled={saving} className="flex-1 gradient-primary">
              {saving ? "Saving…" : "Apply"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      
      {/* Boost Button */}
      <button 
        onClick={() => navigate("/get-boosts")} 
        className="p-2 hover:bg-muted/50 rounded-full transition-colors"
        aria-label="Get Boosts"
      >
        <Zap className="w-6 h-6 text-purple-500 fill-purple-500" />
      </button>
    </div>
  );
}
