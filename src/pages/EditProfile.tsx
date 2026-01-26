import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { DraggablePhotoUpload } from "@/components/DraggablePhotoUpload";
import { PreferenceDrawer } from "@/components/PreferenceDrawer";
import { ProfilePromptEditor } from "@/components/ProfilePromptEditor";
import { PromptAnswer } from "@/lib/profilePrompts";
import { toast } from "sonner";
import { 
  ChevronRight, Camera, User, Briefcase, GraduationCap, MapPin, 
  FileText, Heart, MessageSquare, PawPrint, Wine, Cigarette, 
  Dumbbell, Baby, Languages, AtSign, Eye, Sparkles, Quote
} from "lucide-react";
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

interface Photo {
  id?: string;
  url: string;
  position: number;
}

export default function EditProfile() {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  
  // Photos
  const [photos, setPhotos] = useState<Photo[]>([]);
  
  // Basic info
  const [firstName, setFirstName] = useState("");
  const [bio, setBio] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [school, setSchool] = useState("");
  const [city, setCity] = useState("");
  
  // Preferences
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
  const [prompts, setPrompts] = useState<PromptAnswer[]>([]);
  
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setBio(profile.bio || "");
      setJobTitle(profile.job_title || "");
      setCompany(profile.company || "");
      setSchool(profile.school || "");
      setCity(profile.city || "");
      setLookingFor(profile.looking_for || "");
      setEducation(profile.education || "");
      setCommunicationStyle(profile.communication_style || "");
      setLoveLanguage(profile.love_language || "");
      setPets(profile.pets || []);
      setDrinking(profile.drinking || "");
      setSmoking(profile.smoking || "");
      setWorkout(profile.workout || "");
      
      // Load prompts from profile
      if (profile.prompts) {
        try {
          const parsedPrompts = typeof profile.prompts === 'string' 
            ? JSON.parse(profile.prompts) 
            : profile.prompts;
          if (Array.isArray(parsedPrompts)) {
            setPrompts(parsedPrompts);
          }
        } catch (e) {
          console.error('Failed to parse prompts:', e);
        }
      }
      
      fetchPhotos();
    }
  }, [profile]);

  const fetchPhotos = async () => {
    if (!profile?.id) return;
    
    const { data } = await supabase
      .from("profile_photos")
      .select("id, photo_url, position")
      .eq("profile_id", profile.id)
      .order("position");
    
    if (data) {
      setPhotos(data.map(p => ({ id: p.id, url: p.photo_url, position: p.position })));
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    
    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        bio,
        job_title: jobTitle,
        company,
        school,
        city,
        looking_for: lookingFor,
        education,
        communication_style: communicationStyle,
        love_language: loveLanguage,
        pets,
        drinking,
        smoking,
        workout,
        prompts: JSON.parse(JSON.stringify(prompts)),
      })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile saved!");
      await refreshProfile();
      navigate(-1);
    }
    setIsSaving(false);
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <h2 className="text-lg font-bold text-foreground mb-3 mt-6">{title}</h2>
  );

  const InputRow = ({ 
    icon: Icon, 
    label, 
    value, 
    onChange,
    placeholder 
  }: { 
    icon?: any; 
    label: string; 
    value: string; 
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none text-lg"
      />
    </div>
  );

  const PreferenceRow = ({ 
    icon: Icon, 
    label, 
    value, 
    onClick,
  }: { 
    icon?: any; 
    label: string; 
    value?: string | string[]; 
    onClick: () => void;
  }) => {
    const displayValue = Array.isArray(value) 
      ? value.length > 0 ? `${value.length} selected` : "Add"
      : value || "Add";
    
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
          <span className="text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className={value && (Array.isArray(value) ? value.length > 0 : true) ? "text-foreground" : ""}>
            {displayValue}
          </span>
          <ChevronRight className="w-5 h-5" />
        </div>
      </button>
    );
  };

  return (
    <AuthLayout showBack variant="white" onSave={handleSave} isSaving={isSaving}>
      <div className="flex-1 flex flex-col pb-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Edit Profile</h1>

        {/* Photo Upload Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Photos</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Add up to 6 photos. Drag to reorder. Your first photo is your main profile picture.
          </p>
          <DraggablePhotoUpload
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={6}
            userId={user?.id}
            profileId={profile?.id}
          />
        </section>

        {/* Basic Info Section */}
        <SectionHeader title="About You" />
        <div className="space-y-3">
          <InputRow
            icon={User}
            label="Display Name"
            value={firstName}
            onChange={setFirstName}
            placeholder="Your first name"
          />
          
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <label className="text-sm font-medium text-muted-foreground">About Me</label>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              rows={4}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {bio.length}/500
            </p>
          </div>
        </div>

        {/* Work & Education */}
        <SectionHeader title="Work & Education" />
        <div className="space-y-3">
          <InputRow
            icon={Briefcase}
            label="Job Title"
            value={jobTitle}
            onChange={setJobTitle}
            placeholder="What do you do?"
          />
          <InputRow
            icon={Briefcase}
            label="Company"
            value={company}
            onChange={setCompany}
            placeholder="Where do you work?"
          />
          <InputRow
            icon={GraduationCap}
            label="School"
            value={school}
            onChange={setSchool}
            placeholder="Where did you study?"
          />
        </div>

        {/* Location */}
        <SectionHeader title="Location" />
        <InputRow
          icon={MapPin}
          label="City"
          value={city}
          onChange={setCity}
          placeholder="Where do you live?"
        />

        {/* Lifestyle */}
        <SectionHeader title="Lifestyle" />
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          <PreferenceRow icon={Eye} label="Looking for" value={lookingFor} onClick={() => setActiveDrawer("lookingFor")} />
          <PreferenceRow icon={Heart} label="Open to..." value={relationshipType} onClick={() => setActiveDrawer("relationshipType")} />
          <PreferenceRow icon={Languages} label="Languages" value={languages} onClick={() => setActiveDrawer("languages")} />
          <PreferenceRow icon={Sparkles} label="Zodiac" value={zodiac} onClick={() => setActiveDrawer("zodiac")} />
          <PreferenceRow icon={GraduationCap} label="Education level" value={education} onClick={() => setActiveDrawer("education")} />
          <PreferenceRow icon={Baby} label="Family Plans" value={familyPlans} onClick={() => setActiveDrawer("familyPlans")} />
          <PreferenceRow icon={MessageSquare} label="Communication Style" value={communicationStyle} onClick={() => setActiveDrawer("communicationStyle")} />
          <PreferenceRow icon={Heart} label="Love Style" value={loveLanguage} onClick={() => setActiveDrawer("loveLanguage")} />
          <PreferenceRow icon={PawPrint} label="Pets" value={pets} onClick={() => setActiveDrawer("pets")} />
          <PreferenceRow icon={Wine} label="Drinking" value={drinking} onClick={() => setActiveDrawer("drinking")} />
          <PreferenceRow icon={Cigarette} label="Smoking" value={smoking} onClick={() => setActiveDrawer("smoking")} />
          <PreferenceRow icon={Dumbbell} label="Workout" value={workout} onClick={() => setActiveDrawer("workout")} />
          <PreferenceRow icon={AtSign} label="Social Media" value={socialMedia} onClick={() => setActiveDrawer("socialMedia")} />
        </div>

        {/* Profile Prompts */}
        <SectionHeader title="Prompts" />
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-3">
            <Quote className="w-5 h-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Add prompts to help start conversations
            </p>
          </div>
          <ProfilePromptEditor
            prompts={prompts}
            onChange={setPrompts}
            maxPrompts={3}
          />
        </div>

        {/* Interests Link */}
        <section className="mt-6">
          <button
            onClick={() => navigate("/interests")}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-foreground font-medium">Edit Interests</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </section>
      </div>

      {/* Preference Drawers */}
      <PreferenceDrawer
        isOpen={activeDrawer === "lookingFor"}
        onClose={() => setActiveDrawer(null)}
        title="Looking for"
        options={LOOKING_FOR_OPTIONS}
        selected={lookingFor}
        onSelect={(val: string) => setLookingFor(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "relationshipType"}
        onClose={() => setActiveDrawer(null)}
        title="Open to..."
        options={RELATIONSHIP_TYPE_OPTIONS}
        selected={relationshipType}
        onSelect={(val: string) => setRelationshipType(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "languages"}
        onClose={() => setActiveDrawer(null)}
        title="Languages"
        options={LANGUAGES_OPTIONS}
        selected={languages}
        onSelect={(val: string[]) => setLanguages(val)}
        multiSelect
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "zodiac"}
        onClose={() => setActiveDrawer(null)}
        title="Zodiac"
        options={ZODIAC_OPTIONS}
        selected={zodiac}
        onSelect={(val: string) => setZodiac(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "education"}
        onClose={() => setActiveDrawer(null)}
        title="Education"
        options={EDUCATION_OPTIONS}
        selected={education}
        onSelect={(val: string) => setEducation(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "familyPlans"}
        onClose={() => setActiveDrawer(null)}
        title="Family Plans"
        options={FAMILY_PLANS_OPTIONS}
        selected={familyPlans}
        onSelect={(val: string) => setFamilyPlans(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "communicationStyle"}
        onClose={() => setActiveDrawer(null)}
        title="Communication Style"
        options={COMMUNICATION_STYLE_OPTIONS}
        selected={communicationStyle}
        onSelect={(val: string) => setCommunicationStyle(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "loveLanguage"}
        onClose={() => setActiveDrawer(null)}
        title="Love Style"
        options={LOVE_LANGUAGE_OPTIONS}
        selected={loveLanguage}
        onSelect={(val: string) => setLoveLanguage(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "pets"}
        onClose={() => setActiveDrawer(null)}
        title="Pets"
        options={PETS_OPTIONS}
        selected={pets}
        onSelect={(val: string[]) => setPets(val)}
        multiSelect
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "drinking"}
        onClose={() => setActiveDrawer(null)}
        title="Drinking"
        options={DRINKING_OPTIONS}
        selected={drinking}
        onSelect={(val: string) => setDrinking(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "smoking"}
        onClose={() => setActiveDrawer(null)}
        title="Smoking"
        options={SMOKING_OPTIONS}
        selected={smoking}
        onSelect={(val: string) => setSmoking(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "workout"}
        onClose={() => setActiveDrawer(null)}
        title="Workout"
        options={WORKOUT_OPTIONS}
        selected={workout}
        onSelect={(val: string) => setWorkout(val)}
      />
      <PreferenceDrawer
        isOpen={activeDrawer === "socialMedia"}
        onClose={() => setActiveDrawer(null)}
        title="Social Media"
        options={SOCIAL_MEDIA_OPTIONS}
        selected={socialMedia}
        onSelect={(val: string) => setSocialMedia(val)}
      />
    </AuthLayout>
  );
}
