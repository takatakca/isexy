import { useState, useRef } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  userId?: string;
}

export function PhotoUpload({ photos, onPhotosChange, maxPhotos = 6, userId }: PhotoUploadProps) {
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileSelect = async (index: number, file: File) => {
    if (!userId) {
      toast.error("Please sign in to upload photos");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(index);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}-${index}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(fileName);

      const newPhotos = [...photos];
      newPhotos[index] = publicUrl;
      onPhotosChange(newPhotos.filter(Boolean));
      
      toast.success("Photo uploaded!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload photo");
    } finally {
      setUploading(null);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: maxPhotos }).map((_, index) => (
        <div key={index} className="relative">
          <input
            ref={(el) => (fileInputRefs.current[index] = el)}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(index, file);
            }}
          />
          
          <button
            type="button"
            onClick={() => fileInputRefs.current[index]?.click()}
            className={`aspect-[3/4] w-full rounded-xl border-2 border-dashed flex items-center justify-center transition-all overflow-hidden ${
              photos[index]
                ? "border-transparent"
                : "border-muted hover:border-primary hover:bg-primary/5"
            }`}
            disabled={uploading === index}
          >
            {uploading === index ? (
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            ) : photos[index] ? (
              <img
                src={photos[index]}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted/30 flex items-center justify-center" />
            )}
          </button>

          {/* Add/Remove button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (photos[index]) {
                handleRemovePhoto(index);
              } else {
                fileInputRefs.current[index]?.click();
              }
            }}
            className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors ${
              photos[index]
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-background text-background hover:bg-background/90"
            }`}
          >
            {photos[index] ? (
              <X className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
