import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Lightbulb, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAX_CHARS = 500;

const bioTips = [
  "Great bios are short and concise. Share your interests, values, and what you are looking for.",
  "Mention your hobbies and what makes you unique.",
  "A touch of humor can go a long way!",
];

export default function EditBio() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [bio, setBio] = useState("");
  const [currentTip, setCurrentTip] = useState(0);
  const [saving, setSaving] = useState(false);

  const charsRemaining = MAX_CHARS - bio.length;
  const isOverLimit = charsRemaining < 0;

  useEffect(() => {
    if (profile?.bio) {
      setBio(profile.bio);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!isOverLimit && profile?.id) {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({ bio: bio.trim() })
        .eq("id", profile.id);
      
      setSaving(false);
      if (error) {
        toast.error("Failed to save bio");
      } else {
        toast.success("Bio updated!");
        navigate(-1);
      }
    } else if (!isOverLimit) {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">{bio ? "Edit bio" : "Add bio"}</h1>
        <button
          onClick={handleSave}
          disabled={isOverLimit || saving}
          className="p-2 disabled:opacity-50"
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
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Enjoy movies, travel, and good food. Hoping to share experiences together."
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[100px] text-base"
              maxLength={MAX_CHARS + 50}
            />
          </div>
          
          {/* Character count */}
          <div className="flex justify-end mt-2">
            <span className={`text-sm ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {bio.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        {/* Bio tip */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground rounded-full">
              <Lightbulb className="w-4 h-4 text-background" />
              <span className="text-sm font-semibold text-background">Bio tip</span>
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
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentTip ? "bg-foreground" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
