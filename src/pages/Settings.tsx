import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthButton } from "@/components/AuthButton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  ChevronRight, Crown, Shield, LogOut, Trash2, Star, Zap, 
  EyeOff, Plane, MapPin, Globe, Users, Eye, MessageCircle, 
  Bell, Mail, Moon, Video, Link2, HelpCircle, Phone, CreditCard,
  Languages, GraduationCap, Heart, MessageSquare, PawPrint, Wine, Cigarette, Dumbbell, Baby, AtSign
} from "lucide-react";
import { BoostsModal } from "@/components/BoostsModal";
import { PreferenceDrawer } from "@/components/PreferenceDrawer";
import {
  LOOKING_FOR_OPTIONS,
  RELATIONSHIP_TYPE_OPTIONS,
  ZODIAC_OPTIONS,
  EDUCATION_OPTIONS,
  FAMILY_PLANS_OPTIONS,
  COMMUNICATION_STYLE_OPTIONS,
  LOVE_LANGUAGE_OPTIONS,
  PETS_OPTIONS,
  DRINKING_OPTIONS,
  SMOKING_OPTIONS,
  WORKOUT_OPTIONS,
  LANGUAGES_OPTIONS,
  SOCIAL_MEDIA_OPTIONS,
} from "@/lib/preferenceOptions";

export default function Settings() {
  const navigate = useNavigate();
  const { profile, signOut, refreshProfile } = useAuth();
  
  const [distancePreference, setDistancePreference] = useState(80);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(50);
  const [showGender, setShowGender] = useState(true);
  const [showOrientation, setShowOrientation] = useState(false);
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // New settings states
  const [isGlobal, setIsGlobal] = useState(false);
  const [showFurtherAway, setShowFurtherAway] = useState(true);
  const [showOutOfAge, setShowOutOfAge] = useState(true);
  const [enableDiscovery, setEnableDiscovery] = useState(true);
  const [controlWhoYouSee, setControlWhoYouSee] = useState("balanced");
  const [visibility, setVisibility] = useState("standard");
  const [photoVerifiedChat, setPhotoVerifiedChat] = useState(false);
  const [sendReadReceipts, setSendReadReceipts] = useState(true);
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">("km");
  const [minPhotos, setMinPhotos] = useState(1);
  const [requireBio, setRequireBio] = useState(false);
  
  const [boostsModalOpen, setBoostsModalOpen] = useState(false);

  // Preference states
  const [lookingFor, setLookingFor] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [zodiac, setZodiac] = useState("");
  const [education, setEducation] = useState("");
  const [familyPlans, setFamilyPlans] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState("");
  const [loveLanguage, setLoveLanguage] = useState("");
  const [pets, setPets] = useState<string[]>([]);
  const [drinking, setDrinking] = useState("");
  const [smoking, setSmoking] = useState("");
  const [workout, setWorkout] = useState("");
  const [socialMedia, setSocialMedia] = useState("");

  // Drawer states
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDistancePreference(profile.distance_preference || 80);
      setAgeMin(profile.age_min || 18);
      setAgeMax(profile.age_max || 50);
      setShowGender(profile.show_gender ?? true);
      setShowOrientation(profile.show_orientation ?? false);
      setInterestedIn(profile.interested_in || []);
      setLookingFor(profile.looking_for || "");
      setEducation(profile.education || "");
      setCommunicationStyle(profile.communication_style || "");
      setLoveLanguage(profile.love_language || "");
      setPets(profile.pets || []);
      setDrinking(profile.drinking || "");
      setSmoking(profile.smoking || "");
      setWorkout(profile.workout || "");
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
        looking_for: lookingFor,
        education,
        communication_style: communicationStyle,
        love_language: loveLanguage,
        pets,
        drinking,
        smoking,
        workout,
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

  const SettingCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-card border border-border rounded-xl ${className}`}>
      {children}
    </div>
  );

  const SettingRow = ({ 
    icon: Icon, 
    label, 
    value, 
    onClick,
    iconColor = "text-muted-foreground"
  }: { 
    icon?: any; 
    label: string; 
    value?: string; 
    onClick?: () => void;
    iconColor?: string;
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />}
        <span className="text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        {value && <span>{value}</span>}
        <ChevronRight className="w-5 h-5" />
      </div>
    </button>
  );

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col pb-20">
        <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

        {/* Premium Tier Upsells */}
        <section className="mb-6 space-y-3">
          <SettingCard>
            <button 
              onClick={() => navigate("/premium")} 
              className="w-full p-4 text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-xl font-bold">🔥 CubaDate</span>
                <span className="bg-gradient-to-r from-slate-600 to-slate-800 text-white text-xs px-2 py-0.5 rounded font-bold">PLATINUM</span>
              </div>
              <p className="text-sm text-muted-foreground">Priority Likes, See who Likes you & More</p>
            </button>
          </SettingCard>

          <SettingCard>
            <button 
              onClick={() => navigate("/premium")} 
              className="w-full p-4 text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-xl font-bold">🔥 CubaDate</span>
                <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs px-2 py-0.5 rounded font-bold">GOLD</span>
              </div>
              <p className="text-sm text-muted-foreground">See who Likes You & More!</p>
            </button>
          </SettingCard>

          <SettingCard>
            <button 
              onClick={() => navigate("/premium")} 
              className="w-full p-4 text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-xl font-bold">🔥 CubaDate</span>
                <span className="text-primary text-lg font-bold">+</span>
              </div>
              <p className="text-sm text-muted-foreground">Unlimited Likes & More!</p>
            </button>
          </SettingCard>
        </section>

        {/* Feature Buttons Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <SettingCard className="p-4">
            <button 
              onClick={() => navigate("/get-super-likes")}
              className="w-full flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Star className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-sm font-medium text-blue-500">Get Super Likes</span>
            </button>
          </SettingCard>

          <SettingCard className="p-4">
            <button 
              onClick={() => setBoostsModalOpen(true)}
              className="w-full flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-500" />
              </div>
              <span className="text-sm font-medium text-purple-500">Get Boosts</span>
            </button>
          </SettingCard>

          <SettingCard className="p-4">
            <button className="w-full flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <EyeOff className="w-6 h-6 text-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">Go Incognito</span>
            </button>
          </SettingCard>

          <SettingCard className="p-4">
            <button className="w-full flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                <Plane className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-primary">Passport™ Mode</span>
            </button>
          </SettingCard>
        </div>

        {/* Account Settings */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Account Settings</h2>
          <SettingCard>
            <SettingRow
              icon={Phone}
              label="Phone Number"
              value={profile?.city ? "Verified" : "Add"}
            />
          </SettingCard>
        </section>

        {/* Discovery Settings */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Discovery Settings</h2>
          
          <SettingCard className="divide-y divide-border">
            {/* Location */}
            <div className="p-4">
              <div className="flex items-center gap-3 mb-1">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Location</p>
                  <p className="text-foreground">{profile?.city || "Montreal"}, {profile?.country || "Canada"}</p>
                </div>
              </div>
              <button className="text-primary text-sm font-medium mt-1">Add a new location</button>
            </div>
            <p className="px-4 pb-3 text-sm text-muted-foreground">
              Change locations to find matches anywhere.
            </p>

            {/* Global */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Global</span>
              </div>
              <Switch checked={isGlobal} onCheckedChange={setIsGlobal} />
            </div>
            <p className="px-4 pb-3 text-sm text-muted-foreground">
              Going global will allow you to see people nearby and from around the world.
            </p>

            {/* Maximum Distance */}
            <div className="p-4">
              <div className="flex justify-between mb-2">
                <span className="font-medium text-foreground">Maximum Distance</span>
                <span className="text-foreground">{distancePreference}{distanceUnit}.</span>
              </div>
              <Slider
                value={[distancePreference]}
                onValueChange={([val]) => setDistancePreference(val)}
                min={1}
                max={500}
                step={1}
                className="my-4"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">Show people further away if I run out of profiles to see</span>
                <Switch checked={showFurtherAway} onCheckedChange={setShowFurtherAway} />
              </div>
            </div>

            {/* Interested In */}
            <SettingRow
              icon={Users}
              label="Interested In"
              value={interestedIn.length > 0 ? interestedIn.join(", ") : "Women"}
              onClick={() => {}}
            />

            {/* Age Range */}
            <div className="p-4">
              <div className="flex justify-between mb-2">
                <span className="font-medium text-foreground">Age Range</span>
                <span className="text-foreground">{ageMin} - {ageMax}</span>
              </div>
              <div className="flex items-center gap-4 my-4">
                <Slider
                  value={[ageMin, ageMax]}
                  onValueChange={([min, max]) => {
                    setAgeMin(min);
                    setAgeMax(max);
                  }}
                  min={18}
                  max={80}
                  step={1}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">Show people slightly out of my preferred range if I run out of profiles to see</span>
                <Switch checked={showOutOfAge} onCheckedChange={setShowOutOfAge} />
              </div>
            </div>
          </SettingCard>
        </section>

        {/* Premium Preferences Upsell */}
        <section className="mb-6">
          <SettingCard className="p-4 bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200">
            <h3 className="text-xl font-bold text-foreground mb-2">Unlock more Preferences...</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Want more personalization? Set your Premium Preferences to see profiles that match your vibe, without missing out on others.
            </p>
            <button 
              onClick={() => navigate("/premium")}
              className="px-6 py-2 bg-amber-100 border border-amber-300 rounded-full font-semibold text-amber-800"
            >
              Unlock
            </button>
          </SettingCard>
        </section>

        {/* Premium Preferences */}
        <section className="mb-6">
          <SettingCard className="divide-y divide-border">
            {/* Min Photos */}
            <div className="p-4">
              <div className="flex justify-between mb-2">
                <span className="font-medium text-foreground">Minimum Number of Photos</span>
                <span className="text-foreground">{minPhotos}</span>
              </div>
              <Slider
                value={[minPhotos]}
                onValueChange={([val]) => setMinPhotos(val)}
                min={1}
                max={9}
                step={1}
              />
            </div>

            {/* Has a bio */}
            <div className="p-4 flex items-center justify-between">
              <span className="text-foreground">Has a bio</span>
              <Switch checked={requireBio} onCheckedChange={setRequireBio} />
            </div>

            {/* Preference rows */}
            <SettingRow label="Interests" value={profile?.interests?.length ? `${profile.interests.length} selected` : "Select"} onClick={() => navigate("/interests")} />
            <SettingRow icon={Eye} label="Looking for" value={lookingFor || "Select"} onClick={() => setActiveDrawer("lookingFor")} iconColor="text-muted-foreground" />
            <SettingRow icon={Heart} label="Open to..." value={relationshipType || "Select"} onClick={() => setActiveDrawer("relationshipType")} iconColor="text-muted-foreground" />
            <SettingRow icon={Languages} label="Add languages" value={languages.length ? `${languages.length} selected` : "Select"} onClick={() => setActiveDrawer("languages")} iconColor="text-muted-foreground" />
            <SettingRow label="Zodiac" value={zodiac || "Select"} onClick={() => setActiveDrawer("zodiac")} />
            <SettingRow icon={GraduationCap} label="Education" value={education || "Select"} onClick={() => setActiveDrawer("education")} iconColor="text-muted-foreground" />
            <SettingRow icon={Baby} label="Family Plans" value={familyPlans || "Select"} onClick={() => setActiveDrawer("familyPlans")} iconColor="text-muted-foreground" />
            <SettingRow icon={MessageSquare} label="Communication Style" value={communicationStyle || "Select"} onClick={() => setActiveDrawer("communicationStyle")} iconColor="text-muted-foreground" />
            <SettingRow icon={Heart} label="Love Style" value={loveLanguage || "Select"} onClick={() => setActiveDrawer("loveLanguage")} iconColor="text-muted-foreground" />
            <SettingRow icon={PawPrint} label="Pets" value={pets.length ? `${pets.length} selected` : "Select"} onClick={() => setActiveDrawer("pets")} iconColor="text-muted-foreground" />
            <SettingRow icon={Wine} label="Drinking" value={drinking || "Select"} onClick={() => setActiveDrawer("drinking")} iconColor="text-muted-foreground" />
            <SettingRow icon={Cigarette} label="Smoking" value={smoking || "Select"} onClick={() => setActiveDrawer("smoking")} iconColor="text-muted-foreground" />
            <SettingRow icon={Dumbbell} label="Workout" value={workout || "Select"} onClick={() => setActiveDrawer("workout")} iconColor="text-muted-foreground" />
            <SettingRow icon={AtSign} label="Social Media" value={socialMedia || "Select"} onClick={() => setActiveDrawer("socialMedia")} iconColor="text-muted-foreground" />
          </SettingCard>
        </section>

        {/* Control Who You See */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">Control Who You See</h2>
            <span className="text-xs bg-primary text-white px-2 py-0.5 rounded font-bold">Plus™</span>
          </div>
          <SettingCard className="divide-y divide-border">
            <button
              onClick={() => setControlWhoYouSee("balanced")}
              className="w-full p-4 text-left flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-foreground">Balanced Recommendations</p>
                <p className="text-sm text-muted-foreground">See the most relevant people to you (default setting)</p>
              </div>
              {controlWhoYouSee === "balanced" && <div className="text-primary">✓</div>}
            </button>
            <button
              onClick={() => setControlWhoYouSee("recent")}
              className="w-full p-4 text-left flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-foreground">Recently Active</p>
                <p className="text-sm text-muted-foreground">See the most recently active people first</p>
              </div>
              {controlWhoYouSee === "recent" && <div className="text-primary">✓</div>}
            </button>
          </SettingCard>
        </section>

        {/* Control My Visibility */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Control My Visibility</h2>
          <SettingCard className="divide-y divide-border">
            <button
              onClick={() => setVisibility("standard")}
              className="w-full p-4 text-left flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-foreground">Standard</p>
                <p className="text-sm text-muted-foreground">You will be discoverable in the card stack</p>
              </div>
              {visibility === "standard" && <div className="text-primary">✓</div>}
            </button>
            <button
              onClick={() => setVisibility("incognito")}
              className="w-full p-4 text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">Incognito</p>
                    <span className="text-xs bg-primary text-white px-2 py-0.5 rounded font-bold">Plus™</span>
                  </div>
                  <p className="text-sm text-muted-foreground">You will be discoverable only by people you Like</p>
                </div>
              </div>
              {visibility === "incognito" && <div className="text-primary">✓</div>}
            </button>
          </SettingCard>
        </section>

        {/* Enable Discovery */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Enable Discovery</h2>
          <SettingCard className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Enable Discovery</span>
              <Switch checked={enableDiscovery} onCheckedChange={setEnableDiscovery} />
            </div>
          </SettingCard>
          <p className="text-sm text-muted-foreground mt-2 px-1">
            When turned off, your profile will be hidden from the card stack and Discovery will be disabled. People you have already Liked may still see and match with you.
          </p>
        </section>

        {/* Control Who Messages You */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Control Who Messages You</h2>
          <SettingCard className="p-4">
            <div className="mb-2">
              <span className="text-xs bg-primary text-white px-2 py-0.5 rounded font-bold">Must be verified</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground mb-1">Photo Verified Chat</p>
                <p className="text-sm text-muted-foreground">
                  Photo Verified members can enable this to only receive messages from other Photo Verified profiles.
                </p>
              </div>
              <Switch checked={photoVerifiedChat} onCheckedChange={setPhotoVerifiedChat} />
            </div>
          </SettingCard>
        </section>

        {/* Read Receipts */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Read Receipts</h2>
          <SettingCard className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Send Read Receipts</span>
              <Switch checked={sendReadReceipts} onCheckedChange={setSendReadReceipts} />
            </div>
          </SettingCard>
          <p className="text-sm text-muted-foreground mt-2 px-1">
            Turning this off will prevent any matches from activating read receipts in your conversation from this moment forward.
          </p>
        </section>

        {/* Block Contacts */}
        <section className="mb-6">
          <SettingCard>
            <SettingRow label="Block Contacts" />
          </SettingCard>
        </section>

        {/* Appearance */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Appearance</h2>
          <SettingCard>
            <SettingRow icon={Moon} label="Use System Setting" iconColor="text-muted-foreground" />
          </SettingCard>
        </section>

        {/* Data Usage */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Data Usage</h2>
          <SettingCard>
            <SettingRow icon={Video} label="Autoplay Videos" iconColor="text-muted-foreground" />
          </SettingCard>
        </section>

        {/* Apply for Student Mode */}
        <section className="mb-6">
          <SettingCard>
            <button className="w-full p-4 text-center">
              <span className="text-primary font-semibold">Apply for Student Mode</span>
            </button>
          </SettingCard>
        </section>

        {/* Web Profile */}
        <section className="mb-6">
          <SettingCard className="p-4">
            <p className="font-semibold text-foreground mb-1">Web Profile</p>
            <p className="text-sm text-muted-foreground mb-3">
              Create a username. Share your username. Have people all over the world match with you right on CubaDate.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Username</span>
              <button className="flex items-center gap-1 text-muted-foreground">
                Claim Yours <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </SettingCard>
        </section>

        {/* Feature Settings */}
        <section className="mb-6 space-y-3">
          {["Q&A Events", "Matchmaker", "Top Picks", "Double Date", "Swipe Surge™"].map((feature) => (
            <SettingCard key={feature}>
              <div className="p-4">
                <p className="font-semibold text-foreground mb-1">Manage {feature}</p>
                <SettingRow label="Settings" />
              </div>
            </SettingCard>
          ))}
        </section>

        {/* Active Status */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Active Status</h2>
          <SettingCard>
            <div className="p-4">
              <p className="font-semibold text-foreground mb-1">Manage Active Status</p>
              <SettingRow label="Settings" />
            </div>
          </SettingCard>
        </section>

        {/* Connections */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Connections</h2>
          <SettingCard>
            <SettingRow label="Friends in Common" />
          </SettingCard>
          <p className="text-sm text-muted-foreground mt-2 px-1">
            See how many mutuals you share with a potential match.
          </p>
        </section>

        {/* App Settings */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">App Settings</h2>
          <SettingCard className="divide-y divide-border">
            <div className="p-4">
              <p className="font-semibold text-foreground mb-3">Notifications</p>
              <div className="space-y-3 pl-2">
                <p className="text-foreground">Email</p>
                <p className="text-foreground">Push Notifications</p>
                <p className="text-foreground">Team CubaDate</p>
              </div>
            </div>
          </SettingCard>
        </section>

        {/* Distance Unit */}
        <section className="mb-6">
          <SettingCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-foreground">Show Distances in</span>
              <span className="text-foreground">{distanceUnit === "km" ? "Km." : "Mi."}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDistanceUnit("km")}
                className={`flex-1 py-3 rounded-full font-bold transition-colors ${
                  distanceUnit === "km" 
                    ? "bg-primary text-white" 
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Km.
              </button>
              <button
                onClick={() => setDistanceUnit("mi")}
                className={`flex-1 py-3 rounded-full font-bold transition-colors ${
                  distanceUnit === "mi" 
                    ? "bg-primary text-white" 
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Mi.
              </button>
            </div>
          </SettingCard>
        </section>

        {/* Payment Account */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Payment Account</h2>
          <SettingCard className="divide-y divide-border">
            <SettingRow icon={CreditCard} label="Manage Payment Account" iconColor="text-muted-foreground" />
            <SettingRow label="Manage Google Play Account" />
            <SettingRow label="Restore Purchase" />
          </SettingCard>
        </section>

        {/* Contact Us */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Contact Us</h2>
          <SettingCard className="divide-y divide-border">
            <SettingRow label="Help & Support" />
            <SettingRow label="Report a problem" />
          </SettingCard>
        </section>

        {/* Community */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Community</h2>
          <SettingCard className="divide-y divide-border">
            <SettingRow label="Community Guidelines" onClick={() => navigate("/house-rules")} />
            <SettingRow label="Safety Tips" onClick={() => navigate("/safety")} />
            <SettingRow label="Safety Center" />
          </SettingCard>
        </section>

        {/* Share */}
        <section className="mb-6">
          <SettingCard>
            <SettingRow label="Share CubaDate" />
          </SettingCard>
        </section>

        {/* Privacy */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Privacy</h2>
          <SettingCard className="divide-y divide-border">
            <SettingRow label="Cookie Policy" />
            <SettingRow label="Privacy Policy" onClick={() => navigate("/privacy")} />
            <SettingRow label="Privacy Preferences" />
          </SettingCard>
        </section>

        {/* Legal */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Legal</h2>
          <SettingCard className="divide-y divide-border">
            <SettingRow label="Licenses" />
            <SettingRow label="Terms of Service" onClick={() => navigate("/terms")} />
          </SettingCard>
        </section>

        {/* Save Button */}
        <AuthButton variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </AuthButton>

        {/* Logout */}
        <section className="mt-6">
          <SettingCard>
            <button
              onClick={handleSignOut}
              className="w-full p-4 text-center font-semibold text-foreground"
            >
              Logout
            </button>
          </SettingCard>
        </section>

        {/* App Logo & Version */}
        <div className="flex flex-col items-center py-8">
          <div className="text-4xl mb-2">🔥</div>
          <p className="text-sm text-muted-foreground">Version 1.0.0</p>
        </div>

        {/* Delete Account */}
        <section className="mb-8">
          <SettingCard>
            <button className="w-full p-4 text-center font-semibold text-foreground">
              Delete Account
            </button>
          </SettingCard>
        </section>
      </div>

      <BoostsModal 
        isOpen={boostsModalOpen} 
        onClose={() => setBoostsModalOpen(false)} 
        boostsRemaining={profile?.boosts_remaining || 0}
        primetimeBoostsRemaining={0}
        onGetMoreBoosts={() => navigate("/premium")}
      />

      {/* Preference Drawers */}
      <PreferenceDrawer
        isOpen={activeDrawer === "lookingFor"}
        onClose={() => setActiveDrawer(null)}
        title="Looking for"
        options={LOOKING_FOR_OPTIONS}
        selected={lookingFor}
        onSelect={(val) => setLookingFor(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "relationshipType"}
        onClose={() => setActiveDrawer(null)}
        title="Relationship Type"
        options={RELATIONSHIP_TYPE_OPTIONS}
        selected={relationshipType}
        onSelect={(val) => setRelationshipType(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "languages"}
        onClose={() => setActiveDrawer(null)}
        title="Languages I Know"
        options={LANGUAGES_OPTIONS}
        selected={languages}
        onSelect={(val) => setLanguages(val as string[])}
        multiple
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "zodiac"}
        onClose={() => setActiveDrawer(null)}
        title="Zodiac"
        options={ZODIAC_OPTIONS}
        selected={zodiac}
        onSelect={(val) => setZodiac(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "education"}
        onClose={() => setActiveDrawer(null)}
        title="Education"
        options={EDUCATION_OPTIONS}
        selected={education}
        onSelect={(val) => setEducation(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "familyPlans"}
        onClose={() => setActiveDrawer(null)}
        title="Family Plans"
        options={FAMILY_PLANS_OPTIONS}
        selected={familyPlans}
        onSelect={(val) => setFamilyPlans(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "communicationStyle"}
        onClose={() => setActiveDrawer(null)}
        title="Communication Style"
        options={COMMUNICATION_STYLE_OPTIONS}
        selected={communicationStyle}
        onSelect={(val) => setCommunicationStyle(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "loveLanguage"}
        onClose={() => setActiveDrawer(null)}
        title="Love Style"
        options={LOVE_LANGUAGE_OPTIONS}
        selected={loveLanguage}
        onSelect={(val) => setLoveLanguage(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "pets"}
        onClose={() => setActiveDrawer(null)}
        title="Pets"
        options={PETS_OPTIONS}
        selected={pets}
        onSelect={(val) => setPets(val as string[])}
        multiple
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "drinking"}
        onClose={() => setActiveDrawer(null)}
        title="Drinking"
        options={DRINKING_OPTIONS}
        selected={drinking}
        onSelect={(val) => setDrinking(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "smoking"}
        onClose={() => setActiveDrawer(null)}
        title="Smoking"
        options={SMOKING_OPTIONS}
        selected={smoking}
        onSelect={(val) => setSmoking(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "workout"}
        onClose={() => setActiveDrawer(null)}
        title="Workout"
        options={WORKOUT_OPTIONS}
        selected={workout}
        onSelect={(val) => setWorkout(val as string)}
      />

      <PreferenceDrawer
        isOpen={activeDrawer === "socialMedia"}
        onClose={() => setActiveDrawer(null)}
        title="Social Media"
        options={SOCIAL_MEDIA_OPTIONS}
        selected={socialMedia}
        onSelect={(val) => setSocialMedia(val as string)}
      />
    </AuthLayout>
  );
}
