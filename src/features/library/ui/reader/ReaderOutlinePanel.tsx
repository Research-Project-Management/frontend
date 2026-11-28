'use client';

import React from 'react';
import { ListTree, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import type { FlattenedOutlineSection } from '@/features/library/domain/reader/search-outline';

export interface OutlineNodeItemProps {
  section: FlattenedOutlineSection;
  isCurrent: boolean;
  isCollapsed: boolean;
  isSearchingOutline: boolean;
  showChevronSlot?: boolean;
  onToggleCollapse: (sectionId: string, e: React.MouseEvent) => void;
  onSelect: (section: FlattenedOutlineSection) => void;
}

export const OutlineNodeItem = React.memo(function OutlineNodeItem({
  section,
  isCurrent,
  isCollapsed,
  isSearchingOutline,
  showChevronSlot = true,
  onToggleCollapse,
  onSelect,
}: OutlineNodeItemProps) {
  const level = section.level ?? 1;
  const indentPx = (level - 1) * 12 + (showChevronSlot ? 4 : 8);

  return (
    <div
      className={cn(
        "w-full flex items-center gap-1 pr-1.5 py-1 text-left rounded-md text-12 leading-snug transition-colors group",
        isCurrent
          ? "bg-muted text-foreground font-medium"
          : "text-foreground/85 hover:bg-muted/70 hover:text-foreground font-normal",
      )}
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {showChevronSlot && (
        section.hasChildren && !isSearchingOutline ? (
          <button
            type="button"
            onClick={(e) => onToggleCollapse(section.id, e)}
            aria-label={
              isCollapsed ? `Expand ${section.title}` : `Collapse ${section.title}`
            }
            aria-expanded={!isCollapsed}
            className="size-3.5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-background/80 shrink-0 cursor-pointer transition-colors"
          >
            <ChevronRight
              className={cn(
                "size-3 shrink-0 transition-transform duration-150",
                !isCollapsed && "rotate-90",
              )}
              strokeWidth={1.5}
            />
          </button>
        ) : (
          <span className="size-3.5 shrink-0" aria-hidden="true" />
        )
      )}
      <button
        type="button"
        onClick={() => onSelect(section)}
        className="flex-1 min-w-0 flex items-center text-left cursor-pointer outline-none py-0.5"
      >
        <span className="truncate flex-1">
          {section.num ? `${section.num} ` : ""}
          {section.title}
        </span>
      </button>
    </div>
  );
});

export interface OutlineTreeViewProps {
  filteredSections: FlattenedOutlineSection[];
  activeOutlineSectionId: string | null;
  collapsedOutlineIds: ReadonlySet<string>;
  outlineFilter: string;
  onToggleCollapse: (sectionId: string, e: React.MouseEvent) => void;
  onSelectSection: (section: FlattenedOutlineSection) => void;
}

export function OutlineTreeView({
  filteredSections,
  activeOutlineSectionId,
  collapsedOutlineIds,
  outlineFilter,
  onToggleCollapse,
  onSelectSection,
}: OutlineTreeViewProps) {
  if (filteredSections.length > 0) {
    const isSearchingOutline = Boolean(outlineFilter.trim());
    const showChevronSlot =
      !isSearchingOutline && filteredSections.some((s) => s.hasChildren);
    return (
      <div className="space-y-0.5 p-1">
        {filteredSections.map((s, idx) => (
          <OutlineNodeItem
            key={s.id || idx}
            section={s}
            isCurrent={s.id === activeOutlineSectionId}
            isCollapsed={collapsedOutlineIds.has(s.id)}
            isSearchingOutline={isSearchingOutline}
            showChevronSlot={showChevronSlot}
            onToggleCollapse={onToggleCollapse}
            onSelect={onSelectSection}
          />
        ))}
      </div>
    );
  }

  if (outlineFilter) {
    return (
      <PlaneEmptyState
        variant="search"
        title="No matching headings"
        description={`No headings match "${outlineFilter}".`}
        isCompact
      />
    );
  }

  return (
    <PlaneEmptyState
      variant="document"
      title="No document outline"
      description="This PDF does not contain an embedded outline or table of contents."
      isCompact
    />
  );
}
