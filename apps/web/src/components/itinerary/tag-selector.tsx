"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagSelectorProps {
  selected: string[]; // tag IDs currently selected
  onChange: (ids: string[]) => void;
  availableTags: { id: string; name: string }[];
  onCreateTag: (name: string) => Promise<{ id: string; name: string }>;
}

export function TagSelector({
  selected,
  onChange,
  availableTags,
  onCreateTag,
}: TagSelectorProps) {
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const selectedSet = new Set(selected);

  function removeTag(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  function toggleTag(id: string) {
    if (selectedSet.has(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  async function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const name = inputValue.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const tag = await onCreateTag(name);
      if (!selectedSet.has(tag.id)) {
        onChange([...selected, tag.id]);
      }
      setInputValue("");
    } finally {
      setIsCreating(false);
    }
  }

  const selectedTags = availableTags.filter((t) => selectedSet.has(t.id));
  const unselectedTags = availableTags.filter((t) => !selectedSet.has(t.id));

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Tags</label>

      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="text-indigo-500 hover:text-indigo-700 transition-colors"
                aria-label={`Remove ${tag.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Available (unselected) tags */}
      {unselectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unselectedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className="inline-block rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Create new tag input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isCreating}
        placeholder="Type a new tag and press Enter…"
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
      />
    </div>
  );
}
