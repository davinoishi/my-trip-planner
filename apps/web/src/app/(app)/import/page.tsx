"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mail, Upload, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImportResult =
  | { type: "gmail"; trips: { id: string; name: string; created: boolean }[]; summary: Record<string, number> }
  | { type: "upload"; tripId: string; tripName: string | null; tripCreated: boolean; itemCount: number; fileName: string };

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [gmailBusy, setGmailBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Gmail import ─────────────────────────────────────────────────────────────
  async function handleGmailImport() {
    setGmailBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/import/poll", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        // If the error is about missing Gmail access, redirect to the connect flow
        const msg: string = json.error ?? "";
        if (msg.includes("refresh token") || msg.includes("Gmail access")) {
          window.location.href = "/api/auth/connect-gmail";
          return;
        }
        setError(msg || "Gmail import failed");
        return;
      }
      const { summary, trips } = json;

      if (trips.length === 1) {
        // Single trip — go straight there
        router.push(`/trips/${trips[0].id}`);
      } else if (trips.length > 1) {
        setResult({ type: "gmail", trips, summary });
      } else {
        setResult({ type: "gmail", trips: [], summary });
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setGmailBusy(false);
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    const ACCEPTED = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"]);
    if (!ACCEPTED.has(file.type)) {
      setError("File type not allowed. Accepted: PDF, JPEG, PNG, WebP, HEIC");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10 MB limit");
      return;
    }

    setUploadBusy(true);
    setError(null);
    setResult(null);
    setUploadProgress(`Uploading ${file.name}…`);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", "other");
      // No tripId — route will find or create one

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }

      const { tripId, tripName, tripCreated, draftItems } = json;

      if (tripId) {
        router.push(`/trips/${tripId}`);
      } else {
        setResult({ type: "upload", tripId, tripName, tripCreated, itemCount: draftItems?.length ?? 0, fileName: file.name });
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setUploadBusy(false);
      setUploadProgress(null);
    }
  }

  const busy = gmailBusy || uploadBusy;

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Booking</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import from Gmail or upload a document. The app will match to an existing trip or create a new one automatically.
        </p>
      </div>

      {/* Gmail */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="text-blue-600" size={20} />
          <h2 className="font-semibold text-gray-900">Import from Gmail</h2>
        </div>
        <p className="text-sm text-gray-500">
          Scans your inbox for booking confirmation emails and extracts travel details.
          Gmail access is requested only when you use this feature.
        </p>
        <Button onClick={handleGmailImport} disabled={busy} className="w-full gap-2">
          {gmailBusy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
          {gmailBusy ? "Scanning inbox…" : "Scan Gmail inbox"}
        </Button>
      </div>

      {/* File upload */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="text-blue-600" size={20} />
          <h2 className="font-semibold text-gray-900">Upload a Document</h2>
        </div>
        <p className="text-sm text-gray-500">
          Upload a PDF or image of a booking confirmation, itinerary, or ticket.
        </p>
        <div
          onClick={() => !busy && fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors
            ${busy ? "cursor-not-allowed opacity-60 border-gray-200" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/40"}`}
        >
          {uploadBusy ? (
            <>
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <p className="text-sm text-gray-500">{uploadProgress}</p>
            </>
          ) : (
            <>
              <Upload size={24} className="text-gray-400" />
              <p className="text-sm font-medium text-gray-600">
                Drop a file here, or <span className="text-blue-600">click to browse</span>
              </p>
              <p className="text-xs text-gray-400">PDF, JPEG, PNG, WebP, HEIC · Max 10 MB</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Gmail multi-trip result */}
      {result?.type === "gmail" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle size={16} />
            <span className="font-medium">Import complete</span>
          </div>
          {result.trips.length === 0 ? (
            <p className="text-sm text-gray-500">No new booking emails found.</p>
          ) : (
            <ul className="space-y-2">
              {result.trips.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => router.push(`/trips/${t.id}`)}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.created ? "New trip created" : "Added to existing trip"}</p>
                    </div>
                    <span className="text-xs text-blue-600">View trip →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
