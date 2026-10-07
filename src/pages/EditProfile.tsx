import { useState, useEffect, useMemo, useCallback, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DraggablePhotoUpload } from "@/components/DraggablePhotoUpload";
import { PreferenceDrawer } from "@/components/PreferenceDrawer";
import { ProfilePromptEditor } from "@/components/ProfilePromptEditor";
import { PromptAnswer } from "@/lib/profilePrompts";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, ChevronRight, Camera, User, Briefcase, GraduationCap, MapPin,
  FileText, Heart, MessageSquare, PawPrint, Wine, Cigarette,
  Dumbbell, Baby, Languages, AtSign, Eye, Sparkles, Quote, Loader2, Check,
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

type IconType = ComponentType<{ className?: string }>;

interface FormState {
  firstName: string;
  bio: string;
  jobTitle: string;
  company: string;
  school: string;
  city: string;
  lookingFor: string;
  relationshipType: string;
  languages: string[];
  zodiac: string;
  education: string;
  familyPlans: string;
  communicationStyle: string;
  loveLanguage: string;
  pets: string[];
  drinking: string;
  smoking: string;
  workout: string;
  socialMedia: string;
  prompts: PromptAnswer[];
}

const EMPTY_FORM: FormState = {
  firstName: "", bio: "", jobTitle: "", company: "", school: "", city: "",
  lookingFor: "", relationshipType: "", languages: [], zodiac: "", education: "",
  familyPlans: "", communicationStyle: "", loveLanguage: "", pets: [],
  drinking: "", smoking: "", workout: "", socialMedia: "", prompts: [],
};

type SingleKey = {
  [K in keyof FormState]: FormState[K] extends string ? K : never;
}[keyof FormState];
type MultiKey = "languages" | "pets";

interface DrawerConfig {
  key: SingleKey | MultiKey;
  label: string;
  title: string;
  icon: IconType;
  options: string[];
  multi?: boolean;
}

const LIFESTYLE_ROWS: DrawerConfig[] = [
  { key: "lookingFor", label: "Looking for", title: "Looking for", icon: Eye, options: LOOKING_FOR_OPTIONS },
  { key: "relationshipType", label: "Open to…", title: "Open to…", icon: Heart, options: RELATIONSHIP_TYPE_OPTIONS },
  { key: "languages", label: "Languages", title: "Languages I speak", icon: Languages, options: LANGUAGES_OPTIONS, multi: true },
  { key: "zodiac", label: "Zodiac", title: "Zodiac", icon: Sparkles, options: ZODIAC_OPTIONS },
  { key: "education", label: "Education level", title: "Education", icon: GraduationCap, options: EDUCATION_OPTIONS },
  { key: "familyPlans", label: "Family plans", title: "Family plans", icon: Baby, options: FAMILY_PLANS_OPTIONS },
  { key: "communicationStyle", label: "Communication style", title: "Communication style", icon: MessageSquare, options: COMMUNICATION_STYLE_OPTIONS },
  { key: "loveLanguage", label: "Love style", title: "Love style", icon: Heart, options: LOVE_LANGUAGE_OPTIONS },
  { key: "pets", label: "Pets", title: "Pets", icon: PawPrint, options: PETS_OPTIONS, multi: true },
  { key: "drinking", label: "Drinking", title: "Drinking", icon: Wine, options: DRINKING_OPTIONS },
  { key: "smoking", label: "Smoking", title: "Smoking", icon: Cigarette, options: SMOKING_OPTIONS },
  { key: "workout", label: "Workout", title: "Workout", icon: Dumbbell, options: WORKOUT_OPTIONS },
  { key: "socialMedia", label: "Social media", title: "Social media", icon: AtSign, options: SOCIAL_MEDIA_OPTIONS },
];

// Columns added in migration 20261007120000. Saved separately so a database
// that has not run the migration yet still saves everything else.
const EXTENDED_COLUMNS = ["relationship_type", "languages", "zodiac", "family_plans", "social_media"] as const;

function SectionHeader({ title, icon: Icon }: { title: string; icon?: IconType }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-8">
      {Icon && <Icon className="w-5 h-5 text-primary" />}
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  );
}

function TextRow({
  icon: Icon, label, value, onChange, placeholder, maxLength = 80, error,
}: {
  icon?: IconType;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  error?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className={`bg-card border rounded-xl p-4 transition-colors focus-within:border-primary ${error ? "border-destructive" : "border-border"}`}>
      <label htmlFor={id} className="flex items-center gap-3 mb-2 text-sm font-medium text-muted-foreground">
        {Icon && <Icon className="w-5 h-5" />}
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none text-lg"
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function PreferenceRow({
  icon: Icon, label, value, onClick,
}: {
  icon?: IconType;
  label: string;
  value?: string | string[];
  onClick: () => void;
}) {
  const hasValue = Array.isArray(value) ? value.length > 0 : !!value;
  const displayValue = Array.isArray(value)
    ? value.length === 0 ? "Add" : value.length <= 2 ? value.join(", ") : `${value.length} selected`
    : value || "Add";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
    >
      <span className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="w-5 h-5 text-muted-foreground shrink-0" />}
        <span className="text-foreground">{label}</span>
      </span>
      <span className="flex items-center gap-2 text-muted-foreground min-w-0">
        <span className={`truncate max-w-[140px] ${hasValue ? "text-foreground font-medium" : ""}`}>{displayValue}</span>
        <ChevronRight className="w-5 h-5 shrink-0" />
      </span>
    </button>
  );
}

function formFromProfile(profile: NonNullable<ReturnType<typeof useAuth>["profile"]>): FormState {
  let prompts: PromptAnswer[] = [];
  if (profile.prompts) {
    try {
      const parsed = typeof profile.prompts === "string" ? JSON.parse(profile.prompts) : profile.prompts;
      if (Array.isArray(parsed)) prompts = parsed;
    } catch {
      prompts = [];
    }
  }
  return {
    firstName: profile.first_name || "",
    bio: profile.bio || "",
    jobTitle: profile.job_title || "",
    company: profile.company || "",
    school: profile.school || "",
    city: profile.city || "",
    lookingFor: profile.looking_for || "",
    relationshipType: profile.relationship_type || "",
    languages: profile.languages || [],
    zodiac: profile.zodiac || "",
    education: profile.education || "",
    familyPlans: profile.family_plans || "",
    communicationStyle: profile.communication_style || "",
    loveLanguage: profile.love_language || "",
    pets: profile.pets || [],
    drinking: profile.drinking || "",
    smoking: profile.smoking || "",
    workout: profile.workout || "",
    socialMedia: profile.social_media || "",
    prompts,
  };
}

export default function EditProfile() {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initial, setInitial] = useState<FormState>(EMPTY_FORM);
  const [activeDrawer, setActiveDrawer] = useState<DrawerConfig | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [nameError, setNameError] = useState("");

  const profileId = profile?.id;

  useEffect(() => {
    if (!profile) return;
    const next = formFromProfile(profile);
    setForm(next);
    setInitial(next);
    // Only re-seed when a different profile loads, not on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    supabase
      .from("profile_photos")
      .select("id, photo_url, position")
      .eq("profile_id", profileId)
      .order("position")
      .then(({ data }) => {
        if (!cancelled && data) {
          setPhotos(data.map((p) => ({ id: p.id, url: p.photo_url, position: p.position })));
        }
      });
    return () => { cancelled = true; };
  }, [profileId]);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "firstName") setNameError("");
  }, []);

  const strength = useMemo(() => {
    const checks = [
      photos.length >= 1, photos.length >= 3, photos.length >= 6,
      form.bio.trim().length >= 40, !!form.jobTitle, !!form.school, !!form.city,
      !!form.lookingFor, form.languages.length > 0, form.prompts.length >= 1,
      form.prompts.length >= 3, !!form.zodiac, !!form.communicationStyle, !!form.loveLanguage,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form, photos.length]);

  const handleSave = async () => {
    if (!profile) return;
    const firstName = form.firstName.trim();
    if (!firstName) {
      setNameError("Your name is required");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSaving(true);
    const core = {
      first_name: firstName,
      bio: form.bio.trim(),
      job_title: form.jobTitle.trim(),
      company: form.company.trim(),
      school: form.school.trim(),
      city: form.city.trim(),
      looking_for: form.lookingFor,
      education: form.education,
      communication_style: form.communicationStyle,
      love_language: form.loveLanguage,
      pets: form.pets,
      drinking: form.drinking,
      smoking: form.smoking,
      workout: form.workout,
      prompts: JSON.parse(JSON.stringify(form.prompts)),
    };
    const extended = {
      relationship_type: form.relationshipType || null,
      languages: form.languages,
      zodiac: form.zodiac || null,
      family_plans: form.familyPlans || null,
      social_media: form.socialMedia || null,
    };

    const { error } = await supabase.from("profiles").update(core).eq("id", profile.id);
    if (error) {
      setIsSaving(false);
      toast.error("Couldn't save your profile. Please try again.");
      return;
    }

    const { error: extError } = await supabase.from("profiles").update(extended).eq("id", profile.id);
    if (extError) {
      console.warn("Extended profile fields not saved:", extError.message, EXTENDED_COLUMNS);
      toast.warning("Profile saved. Some lifestyle details will be available shortly.");
    } else {
      toast.success("Profile saved");
    }

    await refreshProfile();
    setInitial(form);
    setIsSaving(false);
    navigate(-1);
  };

  const handleBack = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(-1);
  };

  const drawerValue = activeDrawer ? form[activeDrawer.key] : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
          <button onClick={handleBack} className="p-2 -ml-2 text-foreground hover:opacity-70" aria-label="Go back">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-bold text-foreground">Edit profile</h1>
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="min-w-[72px] px-4 py-2 bg-primary text-primary-foreground rounded-full font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-1"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : isDirty ? "Save" : <><Check className="w-4 h-4" />Saved</>}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-16 pt-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-pink-500/10 border border-primary/20 p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground">Profile strength</p>
            <p className="text-sm font-bold text-primary">{strength}%</p>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-pink-500 transition-all duration-500" style={{ width: `${strength}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {strength < 100
              ? "Complete profiles with 6 photos and 3 prompts get far more matches."
              : "Your profile is complete — you're ready to shine."}
          </p>
        </div>

        <SectionHeader title="Photos" icon={Camera} />
        <p className="text-sm text-muted-foreground mb-4">
          Add up to 6 photos. Drag to reorder — your first photo is your main picture. Photos save instantly.
        </p>
        <DraggablePhotoUpload
          photos={photos}
          onPhotosChange={setPhotos}
          maxPhotos={6}
          userId={user?.id}
          profileId={profile?.id}
        />

        <SectionHeader title="About you" icon={User} />
        <div className="space-y-3">
          <TextRow icon={User} label="Display name" value={form.firstName} onChange={(v) => set("firstName", v)} placeholder="Your first name" maxLength={40} error={nameError} />
          <div className="bg-card border border-border rounded-xl p-4 focus-within:border-primary transition-colors">
            <label htmlFor="field-bio" className="flex items-center gap-3 mb-2 text-sm font-medium text-muted-foreground">
              <FileText className="w-5 h-5" />
              About me
            </label>
            <textarea
              id="field-bio"
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="Tell others about yourself…"
              rows={4}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{form.bio.length}/500</p>
          </div>
        </div>

        <SectionHeader title="Work & education" icon={Briefcase} />
        <div className="space-y-3">
          <TextRow icon={Briefcase} label="Job title" value={form.jobTitle} onChange={(v) => set("jobTitle", v)} placeholder="What do you do?" />
          <TextRow icon={Briefcase} label="Company" value={form.company} onChange={(v) => set("company", v)} placeholder="Where do you work?" />
          <TextRow icon={GraduationCap} label="School" value={form.school} onChange={(v) => set("school", v)} placeholder="Where did you study?" />
        </div>

        <SectionHeader title="Location" icon={MapPin} />
        <TextRow icon={MapPin} label="City" value={form.city} onChange={(v) => set("city", v)} placeholder="Montréal, La Habana, Toronto…" />

        <SectionHeader title="Lifestyle" icon={Heart} />
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {LIFESTYLE_ROWS.map((row) => (
            <PreferenceRow key={row.key} icon={row.icon} label={row.label} value={form[row.key]} onClick={() => setActiveDrawer(row)} />
          ))}
        </div>

        <SectionHeader title="Prompts" icon={Quote} />
        <p className="text-sm text-muted-foreground mb-3">Prompts give matches an easy way to start a conversation.</p>
        <ProfilePromptEditor prompts={form.prompts} onChange={(p) => set("prompts", p)} maxPrompts={3} />

        <button
          onClick={() => navigate("/interests")}
          className="mt-8 w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
        >
          <span className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-foreground font-medium">Edit interests</span>
          </span>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </main>

      {activeDrawer && (
        activeDrawer.multi ? (
          <PreferenceDrawer
            isOpen
            onClose={() => setActiveDrawer(null)}
            title={activeDrawer.title}
            options={activeDrawer.options}
            selected={drawerValue}
            onSelect={(val: string[]) => set(activeDrawer.key as MultiKey, val)}
            multiSelect
          />
        ) : (
          <PreferenceDrawer
            isOpen
            onClose={() => setActiveDrawer(null)}
            title={activeDrawer.title}
            options={activeDrawer.options}
            selected={drawerValue}
            onSelect={(val: string) => set(activeDrawer.key as SingleKey, val)}
          />
        )
      )}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved edits to your profile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(-1)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
