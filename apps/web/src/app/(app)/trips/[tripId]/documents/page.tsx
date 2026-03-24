"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentCard } from "@/components/documents/document-card";
import { Select } from "@/components/ui/select";
import { FolderOpen } from "lucide-react";

const CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "boarding_pass", label: "Boarding Pass" },
  { value: "insurance", label: "Insurance" },
  { value: "ticket", label: "Ticket" },
  { value: "visa", label: "Visa" },
  { value: "passport", label: "Passport" },
  { value: "hotel_booking", label: "Hotel Booking" },
  { value: "car_rental", label: "Car Rental" },
  { value: "train_ticket", label: "Train Ticket" },
  { value: "other", label: "Other" },
];

interface DocumentsPageProps {
  params: Promise<{ tripId: string }>;
}

export default function DocumentsPage({ params }: DocumentsPageProps) {
  const { tripId } = use(params);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [filterCategory, setFilterCategory] = useState("");

  const utils = trpc.useUtils();
  const { data: docs = [], isLoading } = trpc.documents.list.useQuery({ tripId });

  function handleUploaded() {
    utils.documents.list.invalidate({ tripId });
  }

  const filtered = filterCategory
    ? docs.filter((d) => d.category === filterCategory)
    : docs;

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Upload Document</h2>
          <div className="w-44">
            <Select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
            >
              {CATEGORIES.slice(1).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <UploadZone
          tripId={tripId}
          category={uploadCategory}
          onUploaded={handleUploaded}
        />
      </div>

      {/* Document list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Documents
            {docs.length > 0 && (
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {docs.length}
              </span>
            )}
          </h2>
          {docs.length > 0 && (
            <div className="w-48">
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-gray-400">
            Loading documents…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-14 text-gray-400">
            <FolderOpen size={32} className="mb-2 text-gray-300" />
            <p className="text-sm">
              {filterCategory
                ? "No documents in this category"
                : "No documents yet — upload your first one above"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDeleted={() => utils.documents.list.invalidate({ tripId })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

