"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Check, Loader2 } from "lucide-react";

type SaveState = "idle" | "saving" | "saved";

export default function TripNotesPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const utils = trpc.useUtils();

  const { data: trip, isLoading } = trpc.trips.getById.useQuery({ id: tripId });

  const [text, setText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateTrip = trpc.trips.update.useMutation({
    onMutate: () => setSaveState("saving"),
    onSuccess: () => {
      setSaveState("saved");
      utils.trips.getById.invalidate({ id: tripId });
      setTimeout(() => setSaveState("idle"), 2000);
    },
    onError: () => setSaveState("idle"),
  });

  // Seed textarea once trip data arrives
  useEffect(() => {
    if (trip && !initialized.current) {
      setText(trip.notes ?? "");
      initialized.current = true;
    }
  }, [trip]);

  const save = useCallback((value: string) => {
    updateTrip.mutate({ id: tripId, data: { notes: value } });
  }, [tripId, updateTrip]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    setSaveState("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(value), 1000);
  }

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const isReadOnly = trip?.isSharedToMe && !trip?.canWrite;

  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Notes</h2>
          <p className="text-sm text-gray-500">
            Freeform notes for this trip — ideas, reminders, packing thoughts, anything.
          </p>
        </div>

        {/* Save indicator */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-[70px] justify-end">
          {saveState === "saving" && (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving…</span>
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check className="w-3 h-3 text-green-500" />
              <span className="text-green-600">Saved</span>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      ) : (
        <textarea
          value={text}
          onChange={handleChange}
          readOnly={isReadOnly}
          placeholder={isReadOnly ? "No notes added." : "Start typing your notes…"}
          className="w-full min-h-[500px] rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y leading-relaxed shadow-sm"
        />
      )}

      {isReadOnly && (
        <p className="text-xs text-gray-400">You have read-only access to this trip.</p>
      )}
    </div>
  );
}
