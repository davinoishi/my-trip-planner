"use client";

import { useState } from "react";
import {
  FileText,
  Image,
  Trash2,
  Download,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export type ApiDocument = RouterOutputs["documents"]["list"][number];

const categoryLabel: Record<string, string> = {
  boarding_pass: "Boarding Pass",
  insurance: "Insurance",
  ticket: "Ticket",
  visa: "Visa",
  passport: "Passport",
  hotel_booking: "Hotel Booking",
  car_rental: "Car Rental",
  train_ticket: "Train Ticket",
  other: "Other",
};

const categoryColor: Record<string, string> = {
  boarding_pass: "bg-blue-50 text-blue-700",
  insurance: "bg-green-50 text-green-700",
  ticket: "bg-pink-50 text-pink-700",
  visa: "bg-purple-50 text-purple-700",
  passport: "bg-orange-50 text-orange-700",
  hotel_booking: "bg-violet-50 text-violet-700",
  car_rental: "bg-amber-50 text-amber-700",
  train_ticket: "bg-teal-50 text-teal-700",
  other: "bg-gray-100 text-gray-600",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentCardProps {
  doc: ApiDocument;
  onDeleted: () => void;
}

export function DocumentCard({ doc, onDeleted }: DocumentCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const getUrl = trpc.documents.getDownloadUrl.useQuery(
    { id: doc.id },
    { enabled: false }
  );
  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: onDeleted,
  });

  const isImage = doc.mimeType.startsWith("image/");
  const FileIcon = isImage ? Image : FileText;

  async function handleDownload() {
    setDownloading(true);
    try {
      const result = await getUrl.refetch();
      if (result.data?.url) {
        window.open(result.data.url, "_blank");
      }
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${doc.originalName}"?`)) return;
    setDeleting(true);
    try {
      await deleteDoc.mutateAsync({ id: doc.id });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all">
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
        <FileIcon size={20} className="text-gray-500" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {doc.originalName}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor[doc.category] ?? categoryColor.other}`}
          >
            {categoryLabel[doc.category] ?? "Other"}
          </span>
          <span className="text-xs text-gray-400">{formatBytes(doc.fileSize)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleDownload}
          disabled={downloading}
          title="Open / Download"
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ExternalLink size={14} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
          onClick={handleDelete}
          disabled={deleting}
          title="Delete"
        >
          {deleting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
        </Button>
      </div>
    </div>
  );
}

