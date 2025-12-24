import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthButton } from "@/components/AuthButton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ChevronRight, Crown, Shield, Bell, HelpCircle, LogOut, Trash2 } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const { profile, signOut, refreshProfile } = useAuth();
  
  const [distancePreference, setDistancePreference] = useState(80);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(50);
  const [showGender, setShowGender] = useState(true);
  const [showOrientation, setShowOrientation] = useState(false);
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [notifications, setNotifications] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDistancePreference(profile.distance_preference);
      setAgeMin(profile.age_min);
      setAgeMax(profile.age_max);
      setShowGender(profile.show_gender);
      setShowOrientation(profile.show_orientation);
      setInterestedIn(profile.interested_in || []);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    
    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        distance_preference: distancePreference,
        age_min: ageMin,
        age_max: ageMax,
        show_gender: showGender,
        show_orientation: showOrientation,
        interested_in: interestedIn,
      })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved!");
      await refreshProfile();
    }
    setIsSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const genderOptions = ["Men", "Women", "Beyond Binary", "Everyone"];

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col pb-20">
        <h1 className="text-3xl font-extrabold text-foreground mb-8">Settings</h1>

        {/* Discovery Preferences */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Discovery</h2>
          
          <div className="space-y-6">
            {/* Distance */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-foreground font-medium">Maximum Distance</span>
                <span className="text-primary font-semibold">{distancePreference} km</span>
              </div>
              <Slider
                value={[distancePreference]}
                onValueChange={([val]) => setDistancePreference(val)}
                min={1}
                max={500}
                step={1}
                className="w-full"
              />
            </div>

            {/* Age Range */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-foreground font-medium">Age Range</span>
                <span className="text-primary font-semibold">{ageMin} - {ageMax}</span>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Slider
                    value={[ageMin]}
                    onValueChange={([val]) => setAgeMin(Math.min(val, ageMax - 1))}
                    min={18}
                    max={80}
                    step={1}
                  />
                </div>
                <div className="flex-1">
                  <Slider
                    value={[ageMax]}
                    onValueChange={([val]) => setAgeMax(Math.max(val, ageMin + 1))}
                    min={18}
                    max={80}
                    step={1}
                  />
                </div>
              </div>
            </div>

            {/* Interested In */}
            <div>
              <span className="text-foreground font-medium block mb-3">Show Me</span>
              <div className="grid grid-cols-2 gap-2">
                {genderOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      if (interestedIn.includes(option)) {
                        setInterestedIn(interestedIn.filter((g) => g !== option));
                      } else {
                        setInterestedIn([...interestedIn, option]);
                      }
                    }}
                    className={`py-3 px-4 rounded-xl border-2 font-medium transition-all text-sm ${
                      interestedIn.includes(option)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Privacy</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <span className="text-foreground">Show Gender on Profile</span>
              <Switch checked={showGender} onCheckedChange={setShowGender} />
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-foreground">Show Orientation on Profile</span>
              <Switch checked={showOrientation} onCheckedChange={setShowOrientation} />
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-foreground">Push Notifications</span>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
          </div>
        </section>

        {/* Premium */}
        <section className="mb-8">
          <button
            onClick={() => navigate("/premium")}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl text-white"
          >
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6" />
              <span className="font-bold">Get CubaDate Premium</span>
            </div>
            <ChevronRight className="w-5 h-5" />
          </button>
        </section>

        {/* Quick Links */}
        <section className="mb-8 space-y-2">
          <button
            onClick={() => navigate("/safety")}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Safety Tips</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <button
            onClick={() => navigate("/privacy")}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Privacy Policy</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </section>

        {/* Save Button */}
        <AuthButton variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </AuthButton>

        {/* Account Actions */}
        <div className="mt-8 space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-4 text-muted-foreground font-semibold hover:text-foreground transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
          
          <button className="w-full flex items-center justify-center gap-2 py-4 text-destructive font-semibold hover:opacity-80 transition-opacity">
            <Trash2 className="w-5 h-5" />
            Delete Account
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
