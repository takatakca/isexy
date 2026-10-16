import { useState, useRef, useCallback } from "react";
import { Plus, X, Loader2, GripVertical, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Photo {
  id?: string;
  url: string;
  position: number;
}

interface DraggablePhotoUploadProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  maxPhotos?: number;
  userId?: string;
  profileId?: string;
}

export function DraggablePhotoUpload({ 
  photos, 
  onPhotosChange, 
  maxPhotos = 6, 
  userId,
  profileId 
}: DraggablePhotoUploadProps) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileSelect = async (index: number, file: File) => {
    if (!userId || !profileId) {
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
        .from("isexy-profile-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("isexy-profile-photos")
        .getPublicUrl(fileName);

      // Save to profile_photos table
      const { data: photoRecord, error: dbError } = await supabase
        .from("profile_photos")
        .insert({
          profile_id: profileId,
          photo_url: publicUrl,
          position: photos.length,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const newPhotos = [...photos, { id: photoRecord.id, url: publicUrl, position: photos.length }];
      onPhotosChange(newPhotos);
      
      toast.success("Photo uploaded!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error((error as { message?: string })?.message || "Failed to upload photo");
    } finally {
      setUploading(null);
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    // A profile needs at least one photo to stay visible (and to pass the profile check).
    if (photos.length <= 1) {
      toast.error("Keep at least one photo. Add a new one first, then remove this one.");
      return;
    }

    try {
      if (photo.id) {
        const { error } = await supabase
          .from("profile_photos")
          .delete()
          .eq("id", photo.id);

        if (error) throw error;
      }

      // The file itself: only ever one of the member's own uploads ({userId}/...).
      const path = photo.url.split("/isexy-profile-photos/")[1]?.split("?")[0];
      if (path && userId && path.startsWith(`${userId}/`)) {
        const { error: storageError } = await supabase.storage.from("isexy-profile-photos").remove([decodeURIComponent(path)]);
        if (storageError) console.warn("Photo file not removed:", storageError.message);
      }

      const newPhotos = photos.filter((_, i) => i !== index).map((p, i) => ({ ...p, position: i }));
      onPhotosChange(newPhotos);

      // Update positions in database
      await updatePhotoPositions(newPhotos);

      toast.success("Photo removed");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Failed to remove photo");
    }
  };

  const updatePhotoPositions = async (updatedPhotos: Photo[]) => {
    let failed = false;
    for (const photo of updatedPhotos) {
      if (photo.id) {
        const { error } = await supabase
          .from("profile_photos")
          .update({ position: photo.position })
          .eq("id", photo.id);
        if (error) failed = true;
      }
    }
    if (failed) toast.error("Couldn't save the new photo order. Please try again.");
    return !failed;
  };

  /** Tap-friendly reordering (drag and drop does not work on touch screens). */
  const handleMakeMain = async (index: number) => {
    if (index === 0) return;
    const newPhotos = [photos[index], ...photos.filter((_, i) => i !== index)].map((p, i) => ({ ...p, position: i }));
    onPhotosChange(newPhotos);
    if (await updatePhotoPositions(newPhotos)) toast.success("Main photo updated");
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newPhotos = [...photos];
    const [draggedPhoto] = newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(dropIndex, 0, draggedPhoto);
    
    // Update positions
    const updatedPhotos = newPhotos.map((p, i) => ({ ...p, position: i }));
    onPhotosChange(updatedPhotos);
    
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Sync to database
    if (await updatePhotoPositions(updatedPhotos)) toast.success("Photos reordered");
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const slots = Array.from({ length: maxPhotos });

  return (
    <div className="grid grid-cols-3 gap-3">
      {slots.map((_, index) => {
        const photo = photos[index];
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div key={index} className="relative">
            <input
              ref={(el) => (fileInputRefs.current[index] = el)}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Clear the input so picking the same file again still triggers a change.
                e.target.value = "";
                if (file) handleFileSelect(index, file);
              }}
            />

            {photo ? (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`aspect-[3/4] w-full rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all relative group ${
                  isDragging ? "opacity-50 scale-95" : ""
                } ${isDragOver ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                <img
                  src={photo.url}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                
                {/* Drag handle overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <GripVertical className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                {/* Position badge */}
                {index === 0 ? (
                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
                    Main
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleMakeMain(index)}
                    className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded hover:bg-black/80"
                    aria-label={`Make photo ${index + 1} your main photo`}
                  >
                    <Star className="w-3 h-3" />
                    Main
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRefs.current[photos.length]?.click()}
                className="aspect-[3/4] w-full rounded-xl border-2 border-dashed border-muted hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-all"
                disabled={uploading !== null}
              >
                {uploading === index ? (
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                ) : (
                  <div className="w-full h-full bg-muted/30 flex items-center justify-center" />
                )}
              </button>
            )}

            {/* Add/Remove button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (photo) {
                  handleRemovePhoto(index);
                } else {
                  fileInputRefs.current[photos.length]?.click();
                }
              }}
              aria-label={photo ? `Remove photo ${index + 1}` : "Add a photo"}
              className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors ${
                photo
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {photo ? (
                <X className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
