import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

const countryCodes = [
  { code: "+1", country: "CA", flag: "🇨🇦" },
  { code: "+53", country: "CU", flag: "🇨🇺" },
  { code: "+1", country: "US", flag: "🇺🇸" },
];

export default function PhoneAuth() {
  const navigate = useNavigate();
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const handleSubmit = () => {
    // Phone OTP provider is not yet wired up. Inform the user instead of
    // navigating to a verification screen that cannot verify the code.
    toast.info("Phone login is coming soon. Please use email sign-in for now.");
    navigate("/auth");
  };

  const isValid = phoneNumber.length >= 10;

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-extrabold text-foreground">
            Can we get your number?
          </h1>
        </div>

        {/* Phone input */}
        <div className="flex items-end gap-4 mb-4">
          {/* Country code picker */}
          <button
            onClick={() => setShowCountryPicker(!showCountryPicker)}
            className="flex items-center gap-1 pb-3 border-b-2 border-muted text-foreground font-semibold"
          >
            <span>{selectedCountry.flag}</span>
            <span>{selectedCountry.country} {selectedCountry.code}</span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Phone number input */}
          <div className="flex-1">
            <AuthInput
              type="tel"
              placeholder="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
              maxLength={10}
            />
          </div>
        </div>

        {/* Country picker dropdown */}
        {showCountryPicker && (
          <div className="bg-card border border-border rounded-xl shadow-medium mb-4 overflow-hidden animate-fade-in">
            {countryCodes.map((country) => (
              <button
                key={`${country.country}-${country.code}`}
                onClick={() => {
                  setSelectedCountry(country);
                  setShowCountryPicker(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
              >
                <span className="text-xl">{country.flag}</span>
                <span className="font-medium">{country.country}</span>
                <span className="text-muted-foreground">{country.code}</span>
              </button>
            ))}
          </div>
        )}

        {/* Info text */}
        <p className="text-muted-foreground text-sm mb-4">
          Phone sign-in is coming soon. For now, please use email to sign in or create your account.
        </p>
        <p className="text-muted-foreground text-sm mb-8">
          <button onClick={() => navigate("/auth")} className="text-foreground underline font-semibold">
            Use email instead
          </button>
        </p>

        {/* Submit button */}
        <AuthButton
          variant={isValid ? "primary" : "secondary"}
          onClick={handleSubmit}
          disabled={!isValid}
        >
          Next
        </AuthButton>
      </div>
    </AuthLayout>
  );
}
