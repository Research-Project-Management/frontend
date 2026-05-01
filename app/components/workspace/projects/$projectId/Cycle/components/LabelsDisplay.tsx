import React, { useLayoutEffect, useRef, useState } from "react";
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
  // null = not yet measured (show all); number = first hidden index
  const [hiddenStart, setHiddenStart] = useState<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    // Re-measure whenever tags or showAddButton change
    setHiddenStart(null); // reset → triggers render with all chips

    const raf = requestAnimationFrame(() => {
      const btn = buttonRef.current;
      if (!btn) return;

      const containerRight = btn.getBoundingClientRect().right;
      if (containerRight === 0) return;

      // Right boundary: reserve space for badge + add button
      const reserve = (showAddButton ? ADD_BTN_W : 0) + BADGE_W;
      const threshold = containerRight - reserve;

      const chipEls = btn.querySelectorAll<HTMLElement>("[data-chip-idx]");
      let firstHidden: number | null = null;

      chipEls.forEach((chip) => {
        if (firstHidden !== null) return;
        const chipRight = chip.getBoundingClientRect().right;
        if (chipRight > threshold) {
          firstHidden = parseInt(chip.getAttribute("data-chip-idx") ?? "0", 10);
        }
      });

      setHiddenStart(firstHidden); // null = all fit; number = first overflow index
    });

    return () => cancelAnimationFrame(raf);
  }, [tags, showAddButton]);

  // While hiddenStart is null, show everything (clipped by overflow-hidden)
  // so the measurement DOM is present. After measurement, show only the fitting ones.
  const isMeasuring = hiddenStart === null;
  const visibleTags = isMeasuring ? tags : tags.slice(0, hiddenStart ?? tags.length);
  const hiddenCount = isMeasuring ? 0 : tags.length - (hiddenStart ?? tags.length);

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={onOpen}
      className={`flex h-9 w-full min-w-0 items-center gap-1.5 overflow-hidden border-0 bg-transparent p-0 outline-none ${
        disabled ? "cursor-default" : "cursor-pointer"
      }`}
    >
      {visibleTags.map((tag, i) => (
        <div
          key={tag._id}
          data-chip-idx={i}
          className="inline-flex h-7 shrink-0 items-center rounded px-2.5 text-[12px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: tag.color }}
        >
          <span className="whitespace-nowrap drop-shadow-sm">{tag.name}</span>
        </div>
      ))}

      {/* Overflow badge — hidden during measurement pass */}
      {!isMeasuring && hiddenCount > 0 && (
        <div className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded px-2 text-[12px] font-bold text-[#44546f] bg-[#e2e4e9]">
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
