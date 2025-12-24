import { useState, useRef } from "react";
import { Paperclip, X, FileText, Image, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileUploadProps {
  onFilesUploaded: (urls: string[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedTypes?: string;
}

interface UploadedFile {
  name: string;
  url: string;
  type: string;
}

export const FileUpload = ({
  onFilesUploaded,
  maxFiles = 5,
  maxSizeMB = 10,
  acceptedTypes = "image/*,.pdf,.doc,.docx,.txt"
}: FileUploadProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
    if (type === "application/pdf") return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedFiles.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${maxSizeMB}MB limit`);
        continue;
      }

      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const ext = file.name.split('.').pop();
        const fileName = `${timestamp}-${randomStr}.${ext}`;

        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from("ticket-attachments")
          .upload(fileName, file);

        if (error) {
          console.error("Upload error:", error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("ticket-attachments")
          .getPublicUrl(data.path);

        newFiles.push({
          name: file.name,
          url: urlData.publicUrl,
          type: file.type
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newFiles.length > 0) {
      const allFiles = [...uploadedFiles, ...newFiles];
      setUploadedFiles(allFiles);
      onFilesUploaded(allFiles.map(f => f.url));
      toast.success(`${newFiles.length} file(s) uploaded`);
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onFilesUploaded(newFiles.map(f => f.url));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading || uploadedFiles.length >= maxFiles}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || uploadedFiles.length >= maxFiles}
          className="gap-2"
        >
          <Paperclip className="w-4 h-4" />
          {isUploading ? "Uploading..." : "Attach Files"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Max {maxFiles} files, {maxSizeMB}MB each
        </span>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg group"
            >
              {getFileIcon(file.type)}
              <span className="text-sm text-foreground max-w-[150px] truncate">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
