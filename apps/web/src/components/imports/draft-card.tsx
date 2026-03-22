"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2, AlertTriangle, Mail } from "lucide-react";
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

export function DraftCard({ item, onApproved, onRejected }: DraftCardProps) {
  const [busy, setBusy] = useState(false);
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

  const details = item.details as Record<string, string> | null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      {/* Source indicator */}
      <Mail size={14} className="mt-0.5 shrink-0 text-amber-500" />

      {/* Type icon */}
      <ItemTypeIcon type={item.type} size={14} withBg />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <ConfidenceBadge score={item.confidenceScore} />
          {item.startTime && (
            <span className="text-xs text-gray-500">{item.startTime}</span>
          )}
          {details?.confirmationNumber && (
            <span className="text-xs text-gray-500">
              Conf: {details.confirmationNumber}
            </span>
          )}
        </div>
        {item.confidenceScore !== null && item.confidenceScore < 0.7 && (
          <p className="mt-1 text-xs text-amber-700">
            Low confidence — review details before approving.
          </p>
        )}
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
  );
}
