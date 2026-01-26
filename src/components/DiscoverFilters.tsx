import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sliders, X, Zap } from "lucide-react";
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
import { toast } from "sonner";

interface DiscoverFiltersProps {
  onFiltersChange?: () => void;
}

export function DiscoverFilters({ onFiltersChange }: DiscoverFiltersProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [distance, setDistance] = useState(profile?.distance_preference || 50);
  const [ageRange, setAgeRange] = useState<[number, number]>([
    profile?.age_min || 18,
    profile?.age_max || 45,
  ]);
  const [showMen, setShowMen] = useState(
    profile?.interested_in?.includes('male') ?? true
  );
  const [showWomen, setShowWomen] = useState(
    profile?.interested_in?.includes('female') ?? true
  );
  const [globalMode, setGlobalMode] = useState(false);
  
  const handleApply = async () => {
    if (!profile) return;
    
    const interestedIn: string[] = [];
    if (showMen) interestedIn.push('male');
    if (showWomen) interestedIn.push('female');
    
    const { error } = await supabase
      .from('profiles')
      .update({
        distance_preference: distance,
        age_min: ageRange[0],
        age_max: ageRange[1],
        interested_in: interestedIn,
      })
      .eq('id', profile.id);
    
    if (error) {
      toast.error("Failed to update preferences");
      return;
    }
    
    toast.success("Preferences updated!");
    setIsOpen(false);
    onFiltersChange?.();
  };
  
  return (
    <div className="flex items-center gap-2">
      {/* Filters Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button className="p-2">
            <Sliders className="w-6 h-6 text-muted-foreground" />
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
            <Button onClick={handleApply} className="flex-1">
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      
      {/* Boost Button */}
      <button onClick={() => navigate("/premium")} className="p-2">
        <Zap className="w-6 h-6 text-purple-500 fill-purple-500" />
      </button>
    </div>
  );
}
