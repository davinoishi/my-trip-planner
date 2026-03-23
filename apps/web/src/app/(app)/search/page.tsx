"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { format, addDays, parseISO } from "date-fns";
import { Search as SearchIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ItemTypeIcon } from "@/components/itinerary/item-type-icon";
import type { BookingType } from "@trip/shared";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { data: allTags = [] } = trpc.tags.list.useQuery();

  const hasSearch = query.trim().length > 0 || selectedTagIds.length > 0;

  const { data: results = [], isFetching } = trpc.tags.search.useQuery(
    {
      query: query.trim() || undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    },
    { enabled: hasSearch }
  );

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Search</h1>

      {/* Text search */}
      <div className="relative">
        <SearchIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={16}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or location…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Filter by Tag
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "border-indigo-400 bg-indigo-100 text-indigo-700"
                      : "border-gray-200 bg-gray-50 text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {!hasSearch && (
          <p className="text-center text-sm text-gray-400 py-8">
            Type to search or filter by tag
          </p>
        )}

        {hasSearch && isFetching && (
          <p className="text-center text-sm text-gray-400 py-8">Searching…</p>
        )}

        {hasSearch && !isFetching && results.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            No items found
          </p>
        )}

        {results.map((result) => {
          const date =
            result.tripStartDate
              ? format(addDays(parseISO(result.tripStartDate), result.dayIndex), "MMM d, yyyy")
              : null;

          return (
            <div
              key={result.itemId}
              className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              {/* Type icon */}
              <ItemTypeIcon type={result.itemType as BookingType} withBg size={16} />

              {/* Content */}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  {result.itemTitle}
                </p>

                {result.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {result.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-medium rounded-full border border-indigo-100"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Link
                    href={`/trips/${result.tripId}`}
                    className="hover:text-indigo-600 hover:underline font-medium"
                  >
                    {result.tripName}
                  </Link>
                  {date && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{date}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
