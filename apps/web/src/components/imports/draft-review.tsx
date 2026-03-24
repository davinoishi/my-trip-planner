"use client";

import { useState } from "react";
import { Mail, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DraftCard } from "./draft-card";
import { Button } from "@/components/ui/button";

interface DraftReviewProps {
  tripId: string;
}

export function DraftReview({ tripId }: DraftReviewProps) {
  const utils = trpc.useUtils();
  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const { data: drafts = [], isLoading } = trpc.imports.listDrafts.useQuery(
    { tripId },
    { refetchOnWindowFocus: false }
  );

  function invalidate() {
    utils.imports.listDrafts.invalidate({ tripId });
    utils.itineraryItems.list.invalidate({ tripId });
  }

  async function handlePoll() {
    setPolling(true);
    setPollResult(null);
    try {
      const res = await fetch("/api/import/poll", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setPollResult(`Error: ${json.error ?? "Unknown error"}`);
      } else {
        const { summary } = json;
        const parts = [`Fetched ${summary.fetched} emails`];
        if (summary.matched > 0) parts.push(`${summary.matched} matched`);
        if (summary.created > 0) parts.push(`${summary.created} new trip${summary.created !== 1 ? "s" : ""} created`);
        if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
        if (summary.failed > 0) parts.push(`${summary.failed} failed (check API key)`);
        const msg = parts.join(" · ");
        setPollResult(msg);
        invalidate();
      }
    } catch {
      setPollResult("Network error — check IMAP settings");
    } finally {
      setPolling(false);
    }
  }

  // Don't render the section at all if there are no drafts and no poll result
  const hasDrafts = drafts.length > 0;
  const showSection = hasDrafts || pollResult;

  return (
    <div className="space-y-2">
      {/* Import trigger button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasDrafts && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-amber-700"
            >
              <Mail size={15} />
              {drafts.length} pending import{drafts.length !== 1 ? "s" : ""}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePoll}
          disabled={polling}
          className="gap-1.5 text-xs"
        >
          {polling ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Mail size={13} />
          )}
          {polling ? "Checking Gmail…" : "Import from Gmail"}
        </Button>
      </div>

      {/* Poll result message */}
      {pollResult && (
        <p className={`text-xs ${pollResult.startsWith("Error") ? "text-red-500" : "text-gray-500"}`}>
          {pollResult}
        </p>
      )}

      {/* Draft list */}
      {showSection && expanded && hasDrafts && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs text-amber-600 font-medium">
            Review these imported bookings and approve or reject each one.
          </p>
          {isLoading ? (
            <p className="text-xs text-gray-400">Loading drafts…</p>
          ) : (
            drafts.map((draft) => (
              <DraftCard
                key={draft.id}
                item={draft}
                onApproved={invalidate}
                onRejected={invalidate}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

