import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Lightbulb, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MIN_BIO_LENGTH } from "@/lib/profileStatus";
import { goBack } from "@/lib/navigation";

const MAX_CHARS = 500;

const bioTips = [
  "Great bios are short and concise. Share your interests, values, and what you are looking for.",
  "Mention your hobbies and what makes you unique.",
  "A touch of humor can go a long way!",
];

export default function EditBio() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState("");
  const [currentTip, setCurrentTip] = useState(0);
  const [saving, setSaving] = useState(false);

  const charsRemaining = MAX_CHARS - bio.length;
  const isOverLimit = charsRemaining < 0;
  const isTooShort = bio.trim().length < MIN_BIO_LENGTH;

  // Seed once from the saved bio; later profile refreshes must not wipe what is being typed.
  const profileId = profile?.id;
  useEffect(() => {
    if (profile?.bio) {
      setBio(profile.bio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const handleSave = async () => {
    if (isOverLimit || !profile?.id) return;
    if (isTooShort) {
      toast.error(`Write at least ${MIN_BIO_LENGTH} characters about yourself`);
      return;
    }
    if (bio.trim() === (profile.bio ?? "").trim()) {
      goBack(navigate, "/profile");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bio.trim() })
      .eq("id", profile.id);

    if (error) {
      setSaving(false);
      toast.error("Failed to save bio");
      return;
    }
    // Edit profile and the profile score read the bio from here.
    await refreshProfile();
    setSaving(false);
    toast.success("Bio updated!");
    goBack(navigate, "/profile");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={() => goBack(navigate, "/profile")} className="p-2" aria-label="Go back">
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">{bio ? "Edit bio" : "Add bio"}</h1>
        <button
          onClick={handleSave}
          disabled={isOverLimit || saving}
          className="p-2 disabled:opacity-50"
          aria-label="Save bio"
        >
          {saving ? (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="w-6 h-6 text-primary" />
          )}
        </button>
      </div>

      {/* Bio input */}
      <div className="p-4">
        <div className="relative border border-border rounded-xl p-4 focus-within:border-primary transition-colors">
          <div className="flex items-start gap-3">
            <Pencil className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
            <textarea
              aria-label="About me"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Into movies, travel and good food. Always up for a good conversation."
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[100px] text-base"
              maxLength={MAX_CHARS + 50}
            />
          </div>
          
          {/* Character count */}
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-sm text-muted-foreground">
              {isTooShort ? `At least ${MIN_BIO_LENGTH} characters` : ""}
            </span>
            <span className={`text-sm ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {bio.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        {/* Bio tip */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
              <Lightbulb className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Bio tip</span>
            </div>
          </div>
          
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {bioTips[currentTip]}
            </p>
          </div>
          
          {/* Tip navigation dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {bioTips.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentTip(idx)}
                aria-label={`Bio tip ${idx + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentTip ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
