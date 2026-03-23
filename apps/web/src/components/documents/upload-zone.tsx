"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
];

const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.webp,.heic";

interface UploadZoneProps {
  tripId: string;
  itemId?: string;
  category?: string;
  onUploaded: () => void;
}

export function UploadZone({
  tripId,
  itemId,
  category = "other",
  onUploaded,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("File type not allowed. Accepted: PDF, JPEG, PNG, WebP, HEIC");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10 MB limit");
      return;
    }

    setUploading(true);
    setProgress(`Uploading ${file.name}…`);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tripId", tripId);
      form.append("category", category);
      if (itemId) form.append("itemId", itemId);

      setProgress(`Uploading ${file.name}…`);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }

      const count: number = json.draftItems?.length ?? 0;
      if (count > 0) {
        setProgress(`Found ${count} booking item${count !== 1 ? "s" : ""} — check pending imports`);
        setTimeout(() => setProgress(null), 4000);
      }

      onUploaded();
    } catch {
      setError("Network error — please try again");
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    // Upload one file at a time for simplicity
    uploadFile(files[0]!);
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 transition-colors
          ${isDragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50"
          }
          ${uploading ? "cursor-not-allowed opacity-60" : ""}
        `}
      >
        {uploading ? (
          <>
            <Loader2 size={28} className="animate-spin text-indigo-500" />
            <p className="text-sm text-gray-500">{progress}</p>
          </>
        ) : (
          <>
            <Upload size={28} className="text-gray-400" />
            <p className="text-sm font-medium text-gray-600">
              Drop a file here, or{" "}
              <span className="text-indigo-600">click to browse</span>
            </p>
            <p className="text-xs text-gray-400">
              PDF, JPEG, PNG, WebP, HEIC · Max 10 MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
