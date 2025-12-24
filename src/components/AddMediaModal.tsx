import { X, Image, Sparkles, ChevronRight } from "lucide-react";

interface AddMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoSelector: () => void;
  onUploadFromLibrary: () => void;
}

export function AddMediaModal({
  isOpen,
  onClose,
  onPhotoSelector,
  onUploadFromLibrary,
}: AddMediaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={onClose} className="p-2">
          <X className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Add media</h1>
        <div className="w-10" />
      </div>

      {/* Options */}
      <div className="flex-1 p-4 space-y-3">
        {/* Photo Selector */}
        <button
          onClick={onPhotoSelector}
          className="w-full flex items-center gap-4 p-4 bg-muted rounded-2xl hover:bg-muted/80 transition-colors"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-foreground">Photo Selector</p>
            <p className="text-sm text-muted-foreground">
              Use AI to find photos for your profile quickly.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Upload from library */}
        <button
          onClick={onUploadFromLibrary}
          className="w-full flex items-center gap-4 p-4 bg-muted rounded-2xl hover:bg-muted/80 transition-colors"
        >
          <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center">
            <Image className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-foreground">Upload from library</p>
            <p className="text-sm text-muted-foreground">
              Add photos and use prompts to say more.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
