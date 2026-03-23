"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2, AlertTriangle, Mail, ChevronDown, ChevronUp } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
import { trpc } from "@/lib/trpc";
import { ItemTypeIcon } from "@/components/itinerary/item-type-icon";
import { Button } from "@/components/ui/button";

export type DraftItem = RouterOutputs["imports"]["listDrafts"][number];

interface DraftCardProps {
  item: DraftItem;
  onApproved: () => void;
  onRejected: () => void;
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "text-green-700 bg-green-50"
      : pct >= 60
      ? "text-yellow-700 bg-yellow-50"
      : "text-red-700 bg-red-50";
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct < 80 && <AlertTriangle size={11} />}
      {pct}% confidence
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-28 shrink-0 text-gray-400">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}

function FlightDetails({ details }: { details: Record<string, unknown> }) {
  const legs = (details.legs ?? details.segments ?? details.flights) as Record<string, string>[] | undefined;

  if (legs?.length) {
    return (
      <div className="mt-2 space-y-2">
        {legs.map((leg, i) => {
          const date = leg.departureDate ?? leg.date ?? "";
          const route = leg.departureAirport && leg.arrivalAirport
            ? `${leg.departureAirport} → ${leg.arrivalAirport}`
            : "";
          const times = leg.departureTime && leg.arrivalTime
            ? `${leg.departureTime} – ${leg.arrivalTime}`
            : leg.departureTime ?? "";
          return (
            <div key={i} className="rounded border border-amber-200 bg-white px-3 py-2 space-y-0.5">
              <div className="text-xs font-medium text-gray-800">
                {[leg.airline ?? leg.carrier, leg.flightNumber].filter(Boolean).join(" ")}
                {route && <span className="ml-2 text-gray-500">{route}</span>}
              </div>
              <div className="text-xs text-gray-500">{[date, times, leg.aircraft, leg.cabinClass].filter(Boolean).join(" · ")}</div>
            </div>
          );
        })}
        <DetailRow label="Confirmation" value={details.confirmationNumber as string} />
        <DetailRow label="Passenger" value={details.passengerName as string} />
        <DetailRow label="Ticket #" value={details.ticketNumber as string} />
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-0.5">
      <DetailRow label="Flight" value={[details.airline, details.flightNumber].filter(Boolean).join(" ") || undefined} />
      <DetailRow label="Route" value={details.departureAirport && details.arrivalAirport ? `${details.departureAirport} → ${details.arrivalAirport}` : undefined} />
      <DetailRow label="Times" value={details.departureTime && details.arrivalTime ? `${details.departureTime} – ${details.arrivalTime}` : undefined} />
      <DetailRow label="Confirmation" value={details.confirmationNumber as string} />
      <DetailRow label="Cabin" value={details.cabinClass as string} />
      <DetailRow label="Seat" value={details.seat as string} />
    </div>
  );
}

function DetailsPanel({ item }: { item: DraftItem }) {
  const d = (item.details ?? {}) as Record<string, unknown>;

  if (item.type === "flight") return <FlightDetails details={d} />;

  // Generic key-value display for other types
  const skip = new Set(["legs", "segments", "flights"]);
  const entries = Object.entries(d).filter(([k, v]) => !skip.has(k) && v != null && v !== "");
  if (!entries.length) return null;
  return (
    <div className="mt-2 space-y-0.5">
      {entries.map(([k, v]) => (
        <DetailRow key={k} label={k} value={String(v)} />
      ))}
    </div>
  );
}

export function DraftCard({ item, onApproved, onRejected }: DraftCardProps) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const approve = trpc.imports.approveDraft.useMutation({ onSuccess: onApproved });
  const reject = trpc.imports.rejectDraft.useMutation({ onSuccess: onRejected });

  async function handleApprove() {
    setBusy(true);
    try { await approve.mutateAsync({ itemId: item.id }); }
    finally { setBusy(false); }
  }

  async function handleReject() {
    setBusy(true);
    try { await reject.mutateAsync({ itemId: item.id }); }
    finally { setBusy(false); }
  }

  const details = item.details as Record<string, unknown> | null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Source indicator */}
        <Mail size={14} className="mt-0.5 shrink-0 text-amber-500" />

        {/* Type icon */}
        <ItemTypeIcon type={item.type} size={14} withBg />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <button
            className="w-full text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            <div className="flex items-center gap-1">
              <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
              {expanded ? <ChevronUp size={12} className="shrink-0 text-gray-400" /> : <ChevronDown size={12} className="shrink-0 text-gray-400" />}
            </div>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ConfidenceBadge score={item.confidenceScore} />
            {item.startTime && (
              <span className="text-xs text-gray-500">{item.startTime}</span>
            )}
            {(details?.confirmationNumber as string | undefined) && (
              <span className="text-xs text-gray-500">
                Conf: {details!.confirmationNumber as string}
              </span>
            )}
          </div>
          {item.confidenceScore !== null && item.confidenceScore < 0.7 && (
            <p className="mt-1 text-xs text-amber-700">
              Low confidence — review details before approving.
            </p>
          )}
          {expanded && <DetailsPanel item={item} />}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
            onClick={handleApprove}
            disabled={busy}
            title="Approve"
          >
            {busy && approve.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle size={14} />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
            onClick={handleReject}
            disabled={busy}
            title="Reject"
          >
            {busy && reject.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <XCircle size={14} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
