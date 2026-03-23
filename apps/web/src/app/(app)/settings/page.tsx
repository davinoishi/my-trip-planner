"use client";

import { useState } from "react";
import { Calendar, Copy, Check, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = trpc.users.getCalendarToken.useQuery();
  const reset = trpc.users.resetCalendarToken.useMutation({
    onSuccess: () => refetch(),
  });

  const calendarUrl =
    typeof window !== "undefined" && data?.token
      ? `${window.location.origin}/api/calendar/${data.token}`
      : "";

  async function handleCopy() {
    if (!calendarUrl) return;
    await navigator.clipboard.writeText(calendarUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    if (
      confirm(
        "Reset your calendar URL?\n\nAny apps currently subscribed to your calendar will stop receiving updates until you add the new URL."
      )
    ) {
      reset.mutate();
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account preferences</p>
      </div>

      {/* Calendar subscription card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-gray-900">Calendar Subscription</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Subscribe to your trips in Google Calendar, Apple Calendar, or any app that supports iCal feeds.
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* How to use */}
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-800 space-y-1">
            <p className="font-medium">How to subscribe:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
              <li>Copy the URL below</li>
              <li>In Google Calendar: Other calendars → "From URL" → paste</li>
              <li>In Apple Calendar: File → New Calendar Subscription → paste</li>
            </ol>
          </div>

          {/* URL + copy button */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Your private calendar URL
            </label>
            {isLoading ? (
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={calendarUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-shrink-0 gap-1.5"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            )}
          </div>

          {/* Reset section */}
          <div className="pt-4 border-t border-gray-100 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Reset calendar URL</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Generates a new private URL. Any existing calendar subscriptions will stop working and need to be re-added with the new URL.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={reset.isPending}
              className="flex-shrink-0 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reset.isPending ? "animate-spin" : ""}`} />
              Reset URL
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
