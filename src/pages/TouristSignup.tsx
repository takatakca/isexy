import { useState, useEffect } from "react";
import { TakatakSignIn } from "@/components/TakatakSignIn";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ChipSelector } from "@/components/ChipSelector";
import { LanguageSelector } from "@/components/LanguageSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Wine, Cigarette, Dumbbell, PawPrint, MessageSquare, 
  Heart, GraduationCap, MapPin, Shield, Mail, CheckCircle
} from "lucide-react";

const TOTAL_STEPS = 10;


const drinkingOptions = ["Not for me", "Sober", "Sober curious", "On special occasions", "Socially on weekends", "Most Nights"];
const smokingOptions = ["Social smoker", "Smoker when drinking", "Non-smoker", "Smoker", "Trying to quit"];
const workoutOptions = ["Everyday", "Often", "Sometimes", "Never"];
const petOptions = ["Dog", "Cat", "Bird", "Fish", "Reptile", "Other", "No pets"];
const communicationOptions = ["Big time texter", "Phone caller", "Video chatter", "Bad texter", "Better in person"];
const loveLanguageOptions = ["Deep conversations", "Quality time", "Shared activities", "Helping each other out", "Humour and banter"];
const educationOptions = ["High School", "In College", "Bachelors", "In Grad School", "Masters", "PhD"];
const interestCategories = {
  "🎨 Creativity": ["Photography", "Art", "Writing", "Music", "Dancing", "Painting"],
  "🎮 Entertainment": ["Gaming", "Movies", "Netflix", "Anime", "Reading", "Podcasts"],
  "🏃 Sports & Fitness": ["Running", "Yoga", "Gym", "Swimming", "Hiking", "Cycling"],
  "🍕 Food & Drink": ["Coffee", "Cooking", "Wine", "Cocktails", "Foodie", "Brunch"],
  "✈️ Travel": ["Adventure", "Backpacking", "Beaches", "Road trips", "Camping", "Cultural travel"],
};

export default function TouristSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state - collect info first
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
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
  const [country, setCountry] = useState("");

  // Takatak Auth first: photo uploads (step 4) need a signed-in member.
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [completing, setCompleting] = useState(false);

  const genderOptions = ["Woman", "Man", "More"];

  const handleComplete = async () => {
    if (!user) return;
    setCompleting(true);
    try {
      // profiles.id is set to the auth user id by the database (Takatak identity).
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          first_name: name,
          birth_date: birthdate,
          gender: gender.toLowerCase(),
          country: country || "Tourist",
          bio,
          drinking,
          smoking,
          workout,
          pets,
          communication_style: communication,
          love_language: loveLanguage,
          education,
          interests,
          is_cuban: false,
          privacy_accepted: true,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      if (photos.length > 0) {
        const photoInserts = photos.map((url, index) => ({
          profile_id: profile.id,
          photo_url: url,
          position: index,
        }));
        await supabase.from("profile_photos").insert(photoInserts);
      }

      await refreshProfile();
      toast.success("Welcome to ISEXY! 🎉");
      navigate("/discover");
    } catch (error) {
      console.error("Profile creation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create profile");
    } finally {
      setCompleting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return name.length >= 2;
      case 2: return !!birthdate;
      case 3: return !!gender;
      case 4: return photos.length >= 2;
      case 5: return true; // Bio optional
      case 6: return true; // Lifestyle optional
      case 7: return true; // Personality optional
      case 8: return interests.length >= 3;
      case 9: return true; // Location
      case 10: return true; // Review & finish
      default: return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex-1 flex flex-col">
            <div className="flex justify-end mb-4">
              <LanguageSelector variant="icon" />
            </div>
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
            <div className="flex justify-end mb-4">
              <LanguageSelector variant="icon" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-8">
              When's your birthday?
            </h1>
            <AuthInput
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
            />
            <p className="text-muted-foreground text-sm mt-4 mb-8">
              Your age will be shown on your profile.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="flex-1 flex flex-col">
            <div className="flex justify-end mb-4">
              <LanguageSelector variant="icon" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-8">
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
          </div>
        );

      case 4:
        return (
          <div className="flex-1 flex flex-col">
            <div className="flex justify-end mb-4">
              <LanguageSelector variant="icon" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              Add your photos
            </h1>
            <p className="text-muted-foreground mb-6">
              Upload at least 2 photos to continue.
            </p>
            <PhotoUpload
              photos={photos}
              onPhotosChange={setPhotos}
            />
          </div>
        );

      case 5:
        return (
          <div className="flex-1 flex flex-col">
            <div className="flex justify-end mb-4">
              <LanguageSelector variant="icon" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              About you
            </h1>
            <p className="text-muted-foreground mb-6">
              Tell us a bit about yourself.
            </p>
            <div className="bg-muted/30 rounded-xl p-4">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a bit about yourself..."
                className="w-full bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground min-h-[120px]"
                maxLength={500}
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex justify-end mb-4">
              <LanguageSelector variant="icon" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-6">
              Lifestyle habits
            </h1>
            <div className="space-y-6 pb-4">
              <ChipSelector icon={<Wine className="w-5 h-5" />} title="Drinking?" options={drinkingOptions} selected={drinking} onChange={(v) => setDrinking(v as string)} />
              <div className="border-t border-border" />
              <ChipSelector icon={<Cigarette className="w-5 h-5" />} title="Smoking?" options={smokingOptions} selected={smoking} onChange={(v) => setSmoking(v as string)} />
              <div className="border-t border-border" />
              <ChipSelector icon={<Dumbbell className="w-5 h-5" />} title="Workout?" options={workoutOptions} selected={workout} onChange={(v) => setWorkout(v as string)} />
              <div className="border-t border-border" />
              <ChipSelector icon={<PawPrint className="w-5 h-5" />} title="Pets?" options={petOptions} selected={pets} onChange={(v) => setPets(v as string[])} multiple />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex justify-end mb-4">
              <LanguageSelector variant="icon" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-6">
              Personality
            </h1>
            <div className="space-y-6 pb-4">
              <ChipSelector icon={<MessageSquare className="w-5 h-5" />} title="Communication style?" options={communicationOptions} selected={communication} onChange={(v) => setCommunication(v as string)} />
              <div className="border-t border-border" />
              <ChipSelector icon={<Heart className="w-5 h-5" />} title="Friendship style?" options={loveLanguageOptions} selected={loveLanguage} onChange={(v) => setLoveLanguage(v as string)} />
              <div className="border-t border-border" />
              <ChipSelector icon={<GraduationCap className="w-5 h-5" />} title="Education?" options={educationOptions} selected={education} onChange={(v) => setEducation(v as string)} />
            </div>
          </div>
        );

      case 8:
        return (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex justify-end mb-4">
              <LanguageSelector variant="icon" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              Your interests
            </h1>
            <p className="text-muted-foreground mb-6">Select at least 3</p>
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
            <div className="flex justify-end w-full mb-4">
              <LanguageSelector variant="icon" />
            </div>
            <div className="w-40 h-40 bg-muted rounded-full flex items-center justify-center mb-8">
              <MapPin className="w-16 h-16 text-muted-foreground" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-4">
              Where are you from?
            </h1>
            <AuthInput
              placeholder="Your country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="max-w-xs mx-auto"
            />
            <p className="text-muted-foreground mt-4 mb-8 max-w-xs">
              Help us find Cuban matches near you or willing to connect internationally.
            </p>
          </div>
        );

      case 10:
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="flex justify-end w-full mb-4">
              <LanguageSelector variant="icon" />
            </div>
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Mail className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-2">You're all set, {name}</h1>
            <p className="text-muted-foreground mb-8 max-w-sm">
              Your profile is ready. Tap below to start meeting people in Cuba.
            </p>
            <AuthButton variant="primary" onClick={handleComplete} disabled={completing} className="w-full max-w-xs">
              {completing ? "Creating your profile..." : "Create my profile"}
            </AuthButton>
          </div>
        );
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate(-1);
    }
  };

  if (!authLoading && !user) {
    return (
      <AuthLayout showBack onBack={() => navigate(-1)} variant="white">
        <h1 className="text-3xl font-extrabold text-foreground mb-2">Visiting Cuba?</h1>
        <p className="text-muted-foreground mb-6">
          Start with your TAKATAK account, then build your ISEXY profile in a few taps.
        </p>
        <TakatakSignIn intent="signup" redirectPath="/tourist-signup" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      showBack 
      onBack={handleBack}
      variant="white"
    >
      {renderStep()}

      {step < 10 && (
        <div className="mt-auto pt-4">
          <AuthButton
            variant="dark"
            onClick={handleNext}
            disabled={!canProceed()}
          >
            Continue
          </AuthButton>
        </div>
      )}
    </AuthLayout>
  );
}
