import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { Camera, Plus } from "lucide-react";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const genderOptions = ["Woman", "Man", "More"];

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
            <div className="mt-auto">
              <AuthButton
                variant={name.length >= 2 ? "primary" : "secondary"}
                onClick={() => setStep(2)}
                disabled={name.length < 2}
              >
                Next
              </AuthButton>
            </div>
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
            <div className="mt-auto">
              <AuthButton
                variant={birthdate ? "primary" : "secondary"}
                onClick={() => setStep(3)}
                disabled={!birthdate}
              >
                Next
              </AuthButton>
            </div>
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
            <div className="mt-auto">
              <AuthButton
                variant={gender ? "primary" : "secondary"}
                onClick={() => setStep(4)}
                disabled={!gender}
              >
                Next
              </AuthButton>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              Add your best photos
            </h1>
            <p className="text-muted-foreground mb-8">
              Add at least 2 photos to continue
            </p>

            {/* Photo grid */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <button
                  key={index}
                  className={`aspect-[3/4] rounded-xl border-2 border-dashed flex items-center justify-center transition-all ${
                    photos[index]
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  {photos[index] ? (
                    <img src={photos[index]} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : index === 0 ? (
                    <Camera className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <Plus className="w-8 h-8 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-auto">
              <AuthButton
                variant="primary"
                onClick={() => navigate("/discover")}
              >
                Continue
              </AuthButton>
            </div>
          </div>
        );
    }
  };

  return (
    <AuthLayout showBack variant="white">
      {/* Progress indicator */}
      <div className="flex gap-1 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {renderStep()}
    </AuthLayout>
  );
}
