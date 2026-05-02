import React from "react";
import { Plus } from "lucide-react";

interface Tag {
  _id: string;
  name: string;
  color: string;
}

interface LabelsDisplayProps {
  tags: Tag[];
  onOpen: () => void;
  disabled?: boolean;
  showAddButton?: boolean;
}

const ADD_BTN_W = 34; // size-7 (28px) + gap-1.5 (6px)
const BADGE_W = 42;   // "+N" badge ~36px + gap 6px

/**
 * Dynamic label chip display.
 *
 * Strategy (no-flash, one paint cycle):
 * 1. First render: show all chips (overflow-hidden clips extras)
 * 2. useLayoutEffect fires BEFORE paint, measures which chips overflow the right boundary
 * 3. Sets hiddenStart → re-render shows only fitting chips + "+N" badge
 * 4. Since useLayoutEffect is synchronous with the paint, user never sees the clipped version
 */
export function LabelsDisplay({
  tags,
  onOpen,
  disabled = false,
  showAddButton = true,
}: LabelsDisplayProps) {
  const LIMIT = 4;
  const visibleTags = tags.slice(0, LIMIT);
  const hiddenCount = tags.length > LIMIT ? tags.length - LIMIT : 0;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onOpen}
      className={`flex h-9 items-center gap-1.5 border-0 bg-transparent p-0 outline-none ${
        disabled ? "cursor-default" : "cursor-pointer"
      }`}
    >
      {visibleTags.map((tag, i) => (
        <div
          key={tag._id}
          data-chip-idx={i}
          className="inline-flex h-7 shrink-0 items-center rounded-sm px-2.5 text-[12px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: tag.color }}
        >
          <span className="whitespace-nowrap drop-shadow-sm">{tag.name}</span>
        </div>
      ))}

      {/* Overflow badge */}
      {hiddenCount > 0 && (
        <div className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-sm px-2 text-[12px] font-bold text-[#44546f] bg-[#e2e4e9]">
          +{hiddenCount}
        </div>
      )}

      {/* Add button */}
      {showAddButton && (
        <div className="size-7 shrink-0 rounded-full bg-[#e5e7eb] text-[#172b4d] flex items-center justify-center hover:bg-[#d9dde3] transition-colors">
          <Plus className="size-3" />
        </div>
      )}
    </button>
  );
}
