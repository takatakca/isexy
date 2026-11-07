import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ChipSelector } from "@/components/ChipSelector";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Wine, Cigarette, Dumbbell, PawPrint, MessageSquare,
  Heart, GraduationCap, MapPin, Shield, Users, Lightbulb
} from "lucide-react";
import { track } from "@/lib/analytics";
import { openConsentSettings } from "@/lib/consent";
import { goBack } from "@/lib/navigation";
import {
  MIN_BIO_LENGTH, PLACEHOLDER_BIRTH_DATE, SHOW_ME_LABELS, isAdult, isProfileComplete,
  showMeFrom, toggleShowMe, type ShowMe,
} from "@/lib/profileStatus";

const TOTAL_STEPS = 10;

const drinkingOptions = ["Not for me", "Sober", "Sober curious", "On special occasions", "Socially on weekends", "Most Nights"];
const smokingOptions = ["Social smoker", "Smoker when drinking", "Non-smoker", "Smoker", "Trying to quit"];
const workoutOptions = ["Everyday", "Often", "Sometimes", "Never"];
const petOptions = ["Dog", "Cat", "Bird", "Fish", "Reptile", "Other", "No pets"];
const communicationOptions = ["Big time texter", "Phone caller", "Video chatter", "Bad texter", "Better in person"];
const loveLanguageOptions = ["Deep conversations", "Quality time", "Shared activities", "Helping each other out", "Humour and banter"];
const educationOptions = ["High School", "In College", "Bachelors", "In Grad School", "Masters", "PhD"];
const interestCategories = {
  "🎨 Creativity": ["Freelancing", "Photography", "Choir", "Cosplay", "Content Creation", "Vintage fashion", "Investing", "Singing", "Poetry", "Sneakers", "Language Exchange", "Writing", "Literature", "NFTs", "Tattoos", "Painting", "Upcycling", "Entrepreneurship", "Acapella", "Musical Instrument", "Musical Writing", "Dancing", "Art", "Real Estate"],
  "🎮 Entertainment": ["Gaming", "Movies", "Netflix", "Anime", "K-Pop", "Comedy", "Reading", "Podcasts", "Theater", "Concerts"],
  "🏃 Sports & Fitness": ["Running", "Yoga", "Gym", "Swimming", "Hiking", "Cycling", "Tennis", "Basketball", "Football", "Surfing"],
  "🍕 Food & Drink": ["Coffee", "Cooking", "Wine", "Cocktails", "Foodie", "Brunch", "Vegan", "Baking"],
  "✈️ Travel": ["Adventure", "Backpacking", "Beaches", "Road trips", "Camping", "City breaks", "Cultural travel"],
};

const genderOptions = ["Woman", "Man", "More"];

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user, profile, photoCount, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const userId = user?.id ?? null;
  // Checked once on arrival: a returning member with a complete profile goes to Discover.
  const [wasComplete] = useState(() => isProfileComplete(profile, photoCount));

  // Form state
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [interestedIn, setInterestedIn] = useState<ShowMe[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [drinking, setDrinking] = useState("");
  const [smoking, setSmoking] = useState("");
  const [workout, setWorkout] = useState("");
  const [pets, setPets] = useState<string[]>([]);
  const [communication, setCommunication] = useState("");
  const [loveLanguage, setLoveLanguage] = useState("");
  const [education, setEducation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // Start from what the member already saved (an unfinished signup, a profile
  // created by the Cuban or tourist flow, or one that lost its bio or photos).
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!profile || seededFor.current === profile.id) return;
    seededFor.current = profile.id;
    setName(profile.first_name ?? "");
    if (profile.birth_date && profile.birth_date !== PLACEHOLDER_BIRTH_DATE) setBirthdate(profile.birth_date);
    const savedGender = genderOptions.find((g) => g.toLowerCase() === profile.gender?.toLowerCase());
    if (savedGender) setGender(savedGender);
    setInterestedIn(showMeFrom(profile.interested_in));
    setBio(profile.bio ?? "");
    setDrinking(profile.drinking ?? "");
    setSmoking(profile.smoking ?? "");
    setWorkout(profile.workout ?? "");
    setPets(profile.pets ?? []);
    setCommunication(profile.communication_style ?? "");
    setLoveLanguage(profile.love_language ?? "");
    setEducation(profile.education ?? "");
    setInterests(profile.interests ?? []);
    supabase
      .from("profile_photos")
      .select("photo_url")
      .eq("profile_id", profile.id)
      .order("position")
      .then(({ data }) => {
        if (data && data.length > 0) setPhotos(data.map((p) => p.photo_url));
      });
  }, [profile]);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't available on this device. You can still continue.");
      setStep(10);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // About 1 km precision: enough for distances, never an exact address.
        setCoords({
          latitude: Math.round(position.coords.latitude * 100) / 100,
          longitude: Math.round(position.coords.longitude * 100) / 100,
        });
        setLocating(false);
        toast.success("Location enabled!");
        setStep(10);
      },
      () => {
        setLocating(false);
        toast.error("We couldn't get your location. You can turn it on later in your browser settings.");
        setStep(10);
      },
      { timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  };

  const handleComplete = async () => {
    if (!userId) {
      toast.error("Please sign in first");
      navigate("/auth");
      return;
    }

    const firstName = name.trim();
    const about = bio.trim();

    // 18+ enforcement (frontend check; backend hardening can be added later)
    if (birthdate && !isAdult(birthdate)) {
      toast.error("You must be 18 or older to use this app.");
      setStep(2);
      return;
    }

    // Collect any missing required fields and show a single clear message
    const missing: string[] = [];
    if (firstName.length < 2) missing.push("name");
    if (!birthdate) missing.push("birth date");
    if (!gender) missing.push("gender");
    if (interestedIn.length === 0) missing.push("who you'd like to meet");
    if (about.length < MIN_BIO_LENGTH) missing.push(`bio (min ${MIN_BIO_LENGTH} characters)`);
    if (photos.length < 1) missing.push("at least 1 profile photo");

    if (missing.length > 0) {
      toast.error(`Please complete: ${missing.join(", ")}.`);
      // Jump to the first relevant step
      if (firstName.length < 2) setStep(1);
      else if (!birthdate) setStep(2);
      else if (!gender || interestedIn.length === 0) setStep(3);
      else if (photos.length < 1) setStep(4);
      else if (about.length < MIN_BIO_LENGTH) setStep(5);
      return;
    }

    setLoading(true);
    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const baseFields = {
        first_name: firstName,
        birth_date: birthdate,
        gender: gender.toLowerCase(),
        interested_in: interestedIn,
        bio: about,
        drinking,
        smoking,
        workout,
        pets,
        communication_style: communication,
        love_language: loveLanguage,
        education,
        interests,
        privacy_accepted: true,
        ...(coords ? { ...coords, location_enabled: true } : {}),
      };

      let profileId: string;

      if (existingProfile) {
        const { data: updatedProfile, error: updateError } = await supabase
          .from("profiles")
          .update(baseFields)
          .eq("user_id", userId)
          .select("id")
          .single();
        if (updateError) throw updateError;
        profileId = updatedProfile.id;
      } else {
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({ user_id: userId, ...baseFields })
          .select("id")
          .single();
        if (insertError) {
          // A row exists that this member can't read: the profile is paused or suspended.
          if (insertError.code === "23505") {
            throw new Error("This account already has a profile that isn't active. Please contact support.");
          }
          throw insertError;
        }
        profileId = newProfile.id;
      }

      // Save photos in their new order. New rows go in before removed ones are
      // taken out, so a failed save never leaves the profile without photos.
      const { data: savedPhotos, error: savedPhotosError } = await supabase
        .from("profile_photos")
        .select("id, photo_url, position")
        .eq("profile_id", profileId);
      if (savedPhotosError) throw savedPhotosError;
      const saved = savedPhotos ?? [];
      const newPhotos = photos
        .map((url, index) => ({ profile_id: profileId, photo_url: url, position: index }))
        .filter((p) => !saved.some((row) => row.photo_url === p.photo_url));
      if (newPhotos.length > 0) {
        const { error: photosError } = await supabase.from("profile_photos").insert(newPhotos);
        if (photosError) throw photosError;
      }
      for (const row of saved) {
        const index = photos.indexOf(row.photo_url);
        if (index === row.position) continue;
        const { error: photoError } = index === -1
          ? await supabase.from("profile_photos").delete().eq("id", row.id)
          : await supabase.from("profile_photos").update({ position: index }).eq("id", row.id);
        if (photoError) throw photoError;
      }

      await refreshProfile();
      track("profile_completed");
      toast.success("Profile created successfully!");
      navigate("/discover");
    } catch (error) {
      console.error("Profile creation error:", error);
      toast.error((error as { message?: string })?.message || "Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return name.trim().length >= 2;
      case 2: return !!birthdate && isAdult(birthdate);
      case 3: return !!gender && interestedIn.length > 0;
      case 4: return photos.length >= 1;
      case 5: return bio.trim().length >= MIN_BIO_LENGTH;
      case 6: return true; // Lifestyle is optional
      case 7: return true; // Personality is optional  
      case 8: return interests.length >= 3;
      case 9: return true; // Location
      case 10: return true; // Privacy
      default: return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-extrabold text-foreground mb-8">
              What's your first name?
            </h1>
            <AuthInput
              placeholder="First name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p className="text-muted-foreground text-sm mt-4 mb-8">
              This is how it'll appear on your profile.
            </p>
          </div>
        );

      case 2:
        return (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-extrabold text-foreground mb-8">
              When's your birthday?
            </h1>
            <AuthInput
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
            />
            {birthdate && !isAdult(birthdate) ? (
              <p role="alert" className="text-destructive text-sm mt-4 mb-8">You must be 18 or older to use ISEXY.</p>
            ) : (
              <p className="text-muted-foreground text-sm mt-4 mb-8">
                Your age will be shown on your profile.
              </p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-extrabold text-foreground mb-6">
              What's your gender?
            </h1>
            <div className="space-y-3 mb-8">
              {genderOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setGender(option)}
                  className={`w-full py-4 px-6 rounded-full border-2 font-semibold transition-all ${
                    gender === option
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-muted-foreground"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <h2 className="text-xl font-bold text-foreground mb-4">
              Show me
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {(["women", "men", "everyone"] as const).map((value) => {
                const selected = interestedIn.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setInterestedIn(toggleShowMe(interestedIn, value))}
                    className={`px-4 py-2 rounded-full border-2 font-medium text-sm transition-all ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {SHOW_ME_LABELS[value]}
                  </button>
                );
              })}
            </div>
            <p className="text-muted-foreground text-sm mb-4">Pick at least one. You can change this later.</p>
          </div>
        );

      case 4:
        return (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              Add your recent pics
            </h1>
            <p className="text-muted-foreground mb-6">
              Upload at least 1 photo to continue. Add more to make your profile stand out — your first photo will be your main pic.
            </p>
            <PhotoUpload
              photos={photos}
              onPhotosChange={setPhotos}
              userId={userId || undefined}
            />
          </div>
        );

      case 5:
        return (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              Share more about yourself
            </h1>
            <p className="text-muted-foreground mb-6">
              Write a bio and a prompt to help your profile stand out and start conversations.
            </p>
            
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-4">
                <label htmlFor="setup-bio" className="block font-semibold mb-2">About me</label>
                <textarea
                  id="setup-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Introduce yourself to make a strong impression..."
                  className="w-full bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground min-h-[80px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bio.trim().length < MIN_BIO_LENGTH ? `At least ${MIN_BIO_LENGTH} characters` : `${bio.length}/500`}
                </p>
              </div>

              <div className="bg-primary/10 rounded-xl p-4 flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  Adding a short intro about you could lead to{" "}
                  <span className="text-primary font-semibold">more conversations</span>
                </p>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              Let's talk lifestyle habits, {name}
            </h1>
            <p className="text-muted-foreground mb-6">
              Do their habits match yours? You go first.
            </p>
            
            <div className="space-y-6 pb-4">
              <ChipSelector
                icon={<Wine className="w-5 h-5" />}
                title="How often do you drink?"
                options={drinkingOptions}
                selected={drinking}
                onChange={(v) => setDrinking(v as string)}
              />
              
              <div className="border-t border-border" />
              
              <ChipSelector
                icon={<Cigarette className="w-5 h-5" />}
                title="How often do you smoke?"
                options={smokingOptions}
                selected={smoking}
                onChange={(v) => setSmoking(v as string)}
              />
              
              <div className="border-t border-border" />
              
              <ChipSelector
                icon={<Dumbbell className="w-5 h-5" />}
                title="Do you workout?"
                options={workoutOptions}
                selected={workout}
                onChange={(v) => setWorkout(v as string)}
              />
              
              <div className="border-t border-border" />
              
              <ChipSelector
                icon={<PawPrint className="w-5 h-5" />}
                title="Do you have any pets?"
                options={petOptions}
                selected={pets}
                onChange={(v) => setPets(v as string[])}
                multiple
              />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              What else makes you–you?
            </h1>
            <p className="text-muted-foreground mb-6">
              Don't hold back. Authenticity attracts authenticity.
            </p>
            
            <div className="space-y-6 pb-4">
              <ChipSelector
                icon={<MessageSquare className="w-5 h-5" />}
                title="What is your communication style?"
                options={communicationOptions}
                selected={communication}
                onChange={(v) => setCommunication(v as string)}
              />
              
              <div className="border-t border-border" />
              
              <ChipSelector
                icon={<Heart className="w-5 h-5" />}
                title="What's your friendship style?"
                options={loveLanguageOptions}
                selected={loveLanguage}
                onChange={(v) => setLoveLanguage(v as string)}
              />
              
              <div className="border-t border-border" />
              
              <ChipSelector
                icon={<GraduationCap className="w-5 h-5" />}
                title="What is your education level?"
                options={educationOptions}
                selected={education}
                onChange={(v) => setEducation(v as string)}
              />
            </div>
          </div>
        );

      case 8:
        return (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              What are you into?
            </h1>
            <p className="text-muted-foreground mb-6">
              Add up to 10 interests to your profile to help you find people who share your interests.
            </p>
            
            <div className="space-y-6 pb-4">
              {Object.entries(interestCategories).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold mb-3">{category}</h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((interest) => {
                      const isSelected = interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setInterests(interests.filter((i) => i !== interest));
                            } else if (interests.length < 10) {
                              setInterests([...interests, interest]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 9:
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-40 h-40 bg-muted rounded-full flex items-center justify-center mb-8">
              <MapPin className="w-16 h-16 text-muted-foreground" />
            </div>
            
            <h1 className="text-3xl font-extrabold text-foreground mb-4">
              So, are you from around here?
            </h1>
            <p className="text-muted-foreground mb-8 max-w-xs">
              Set your location to see who's in your neighbourhood or beyond. Other members only see an approximate distance, never where you are.
            </p>

            <AuthButton
              variant="dark"
              onClick={requestLocation}
              disabled={locating}
            >
              {locating ? "Finding you..." : "Allow"}
            </AuthButton>

            <button
              onClick={() => setStep(10)}
              disabled={locating}
              className="mt-4 text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              Not now
            </button>
          </div>
        );

      case 10:
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-40 h-40 bg-muted rounded-full flex items-center justify-center mb-8">
              <Shield className="w-16 h-16 text-muted-foreground" />
            </div>
            
            <h1 className="text-3xl font-extrabold text-foreground mb-4">
              We Value Your Privacy
            </h1>
            <p className="text-muted-foreground mb-8 max-w-sm">
              We use tools to measure the audience and use of our app, personalize ads, enhance our own marketing operations, enable social features, and better understand how ISEXY services are used as a whole.
            </p>
            
            <AuthButton
              variant="dark"
              onClick={handleComplete}
              disabled={loading}
            >
              {loading ? "Creating profile..." : "I accept"}
            </AuthButton>
            
            <button
              onClick={openConsentSettings}
              className="mt-4 w-full py-3 border border-border text-foreground rounded-full font-semibold hover:bg-muted transition-colors"
            >
              Personalize
            </button>
          </div>
        );
    }
  };

  const handleNext = () => {
    if (step === 10) {
      handleComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    if (step < 10) {
      setStep((s) => s + 1);
    }
  };

  if (wasComplete) return <Navigate to="/discover" replace />;

  return (
    <AuthLayout
      showBack
      variant="white"
      onBack={() => step > 1 ? setStep(s => s - 1) : goBack(navigate, "/")}
    >
      {/* Skip button for optional steps */}
      {[6, 7].includes(step) && (
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-muted-foreground font-semibold hover:text-foreground transition-colors"
        >
          Skip
        </button>
      )}

      {/* Progress indicator */}
      <div className="flex gap-1 mb-6">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {renderStep()}

      {/* Next button (hidden on location/privacy steps) */}
      {![9, 10].includes(step) && (
        <div className="mt-auto pt-4">
          <AuthButton
            variant={canProceed() ? "primary" : "secondary"}
            onClick={handleNext}
            disabled={!canProceed()}
          >
            Next {step === 8 ? `${interests.length}/10` : ""}
          </AuthButton>
        </div>
      )}
    </AuthLayout>
  );
}
