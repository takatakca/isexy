import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

const TOTAL_STEPS = 10;

const drinkingOptions = ["Not for me", "Sober", "Sober curious", "On special occasions", "Socially on weekends", "Most Nights"];
const smokingOptions = ["Social smoker", "Smoker when drinking", "Non-smoker", "Smoker", "Trying to quit"];
const workoutOptions = ["Everyday", "Often", "Sometimes", "Never"];
const petOptions = ["Dog", "Cat", "Bird", "Fish", "Reptile", "Other", "No pets"];
const communicationOptions = ["Big time texter", "Phone caller", "Video chatter", "Bad texter", "Better in person"];
const loveLanguageOptions = ["Thoughtful gestures", "Presents", "Touch", "Compliments", "Time together"];
const educationOptions = ["High School", "In College", "Bachelors", "In Grad School", "Masters", "PhD"];
const interestCategories = {
  "🎨 Creativity": ["Freelancing", "Photography", "Choir", "Cosplay", "Content Creation", "Vintage fashion", "Investing", "Singing", "Poetry", "Sneakers", "Language Exchange", "Writing", "Literature", "NFTs", "Tattoos", "Painting", "Upcycling", "Entrepreneurship", "Acapella", "Musical Instrument", "Musical Writing", "Dancing", "Art", "Real Estate"],
  "🎮 Entertainment": ["Gaming", "Movies", "Netflix", "Anime", "K-Pop", "Comedy", "Reading", "Podcasts", "Theater", "Concerts"],
  "🏃 Sports & Fitness": ["Running", "Yoga", "Gym", "Swimming", "Hiking", "Cycling", "Tennis", "Basketball", "Football", "Surfing"],
  "🍕 Food & Drink": ["Coffee", "Cooking", "Wine", "Cocktails", "Foodie", "Brunch", "Vegan", "Baking"],
  "✈️ Travel": ["Adventure", "Backpacking", "Beaches", "Road trips", "Camping", "City breaks", "Cultural travel"],
};

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const genderOptions = ["Woman", "Man", "More"];

  const handleComplete = async () => {
    if (!userId) {
      toast.error("Please sign in first");
      navigate("/auth");
      return;
    }

    setLoading(true);
    try {
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      let profileId: string;

      if (existingProfile) {
        // Update existing profile
        const { data: updatedProfile, error: updateError } = await supabase
          .from("profiles")
          .update({
            first_name: name,
            birth_date: birthdate,
            gender: gender.toLowerCase(),
            bio,
            drinking,
            smoking,
            workout,
            pets,
            communication_style: communication,
            love_language: loveLanguage,
            education,
            interests,
            privacy_accepted: true,
            country: "Cuba",
          })
          .eq("user_id", userId)
          .select()
          .single();

        if (updateError) throw updateError;
        profileId = updatedProfile.id;
      } else {
        // Create new profile
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({
            user_id: userId,
            first_name: name,
            birth_date: birthdate,
            gender: gender.toLowerCase(),
            bio,
            drinking,
            smoking,
            workout,
            pets,
            communication_style: communication,
            love_language: loveLanguage,
            education,
            interests,
            privacy_accepted: true,
            country: "Cuba",
          })
          .select()
          .single();

        if (insertError) throw insertError;
        profileId = newProfile.id;
      }

      // Save photos to profile_photos table
      if (photos.length > 0) {
        // Delete existing photos first
        await supabase
          .from("profile_photos")
          .delete()
          .eq("profile_id", profileId);

        const photoInserts = photos.map((url, index) => ({
          profile_id: profileId,
          photo_url: url,
          position: index,
        }));

        const { error: photosError } = await supabase
          .from("profile_photos")
          .insert(photoInserts);

        if (photosError) throw photosError;
      }

      toast.success("Profile created successfully!");
      navigate("/discover");
    } catch (error: any) {
      console.error("Profile creation error:", error);
      toast.error(error.message || "Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return name.length >= 2;
      case 2: return !!birthdate;
      case 3: return !!gender;
      case 4: return photos.length >= 2;
      case 5: return true; // Bio is optional
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
              This is how it'll appear on your profile. Can't change it later.
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
            <p className="text-muted-foreground text-sm mt-4 mb-8">
              Your age will be shown on your profile.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="flex-1 flex flex-col">
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
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              Add your recent pics
            </h1>
            <p className="text-muted-foreground mb-6">
              Upload 2 photos to start. Add 4 or more to make your profile stand out.
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
              Write a bio and a prompt to help your profile stand out and spark conversations.
            </p>
            
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">About me</span>
                  <button className="w-8 h-8 bg-foreground text-background rounded-full flex items-center justify-center">
                    <span className="text-xl">+</span>
                  </button>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Introduce yourself to make a strong impression..."
                  className="w-full bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground min-h-[80px]"
                  maxLength={500}
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  Adding a short intro about you could lead to{" "}
                  <span className="text-primary font-semibold">25% more matches</span>
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
                title="How do you receive love?"
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
              Add up to 10 interests to your profile to help you find people who share what you love.
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
              Set your location to see who's in your neighborhood or beyond. You won't be able to match with people otherwise.
            </p>
            
            <AuthButton
              variant="dark"
              onClick={() => {
                // In a real app, request geolocation
                toast.success("Location enabled!");
                setStep(10);
              }}
            >
              Allow
            </AuthButton>
            
            <button
              onClick={() => setStep(10)}
              className="mt-4 text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              How is my location used?
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
              We use tools to measure the audience and use of our app, personalize ads, enhance our own marketing operations, enable social features, and better understand how CubaDate services are used as a whole.
            </p>
            
            <AuthButton
              variant="dark"
              onClick={handleComplete}
              disabled={loading}
            >
              {loading ? "Creating profile..." : "I accept"}
            </AuthButton>
            
            <button
              onClick={() => navigate("/settings")}
              className="mt-4 w-full py-3 bg-foreground text-background rounded-full font-semibold hover:bg-foreground/90 transition-colors"
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

  return (
    <AuthLayout 
      showBack 
      variant="white" 
      onBack={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}
    >
      {/* Skip button for optional steps */}
      {[5, 6, 7].includes(step) && (
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
