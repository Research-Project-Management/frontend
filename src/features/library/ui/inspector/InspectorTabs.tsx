'use client';

import React from 'react';
import {
  Info,
  AlignLeft,
  Paperclip,
  StickyNote,
  FolderTree,
  Tag,
  Network,
  Quote,
  PanelRight,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import type { InspectorSectionId } from '@/features/library/core/store/library-ui.store';

export type InspectorTabKey = InspectorSectionId;

/**
 * Inspector Levels counted from bottom icon to top icon:
 * Level 1: 'cite' (1 bar/tab: Citation)
 * Level 2: 'relations' (2 bars/tabs: Related, Citation)
 * Level 3: 'tags' (3 bars/tabs: Tags, Related, Citation)
 * Level 4: 'collections' (4 bars/tabs: Collections, Tags, Related, Citation)
 * Level 5: 'notes' (5 bars/tabs: Notes, Collections, Tags, Related, Citation)
 * Level 6: 'files' (6 bars/tabs: Attachments, Notes, Collections, Tags, Related, Citation)
 * Level 7: 'abstract' (7 bars/tabs: Abstract, Attachments, Notes, Collections, Tags, Related, Citation)
 * Level 8: 'info' (8 bars/tabs: Details, Abstract, Attachments, Notes, Collections, Tags, Related, Citation)
 */
export const INSPECTOR_LEVELS_FROM_BOTTOM: InspectorSectionId[] = [
  'cite',
  'relations',
  'tags',
  'collections',
  'notes',
  'files',
  'abstract',
  'info',
];

export const INSPECTOR_LEVELS = INSPECTOR_LEVELS_FROM_BOTTOM;

export const SECTION_TO_LEVEL: Record<InspectorSectionId, number> = {
  cite: 1,
  relations: 2,
  tags: 3,
  collections: 4,
  notes: 5,
  files: 6,
  abstract: 7,
  info: 8,
};

export const LEVEL_TO_SECTION: Record<number, InspectorSectionId> = {
  1: 'cite',
  2: 'relations',
  3: 'tags',
  4: 'collections',
  5: 'notes',
  6: 'files',
  7: 'abstract',
  8: 'info',
};

interface TabItem {
  id: InspectorTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  badge?: number;
}

export interface InspectorTabsProps {
  activeTab: InspectorSectionId;
  onTabChange: (tab: InspectorSectionId) => void;
  attachmentCount?: number;
  noteCount?: number;
  tagsCount?: number;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
  hideRailToggle?: boolean;
  className?: string;
}

/**
 * Vertical Icon Panel Bar
 * Replaces the horizontal tabs with a dedicated vertical bar adhering to Flux workspace specs.
 * Supports level selection: Level 1 (bottom citation) to Level 8 (top info).
 */
export function InspectorTabs({
  activeTab,
  onTabChange,
  attachmentCount = 0,
  noteCount = 0,
  tagsCount = 0,
  isInspectorOpen = true,
  onToggleInspector,
  hideRailToggle,
  className,
}: InspectorTabsProps) {
  const tabs: TabItem[] = [
    { id: 'info', label: 'Details', icon: Info },
    { id: 'abstract', label: 'Abstract', icon: AlignLeft },
    { id: 'files', label: 'Attachments', icon: Paperclip, badge: attachmentCount },
    { id: 'notes', label: 'Notes', icon: StickyNote, badge: noteCount },
    { id: 'collections', label: 'Collections', icon: FolderTree },
    { id: 'tags', label: 'Tags', icon: Tag, badge: tagsCount },
    { id: 'relations', label: 'Related', icon: Network },
    { id: 'cite', label: 'Citation', icon: Quote },
  ];

  return (
    <aside
      aria-label="Inspector panel bar"
      className={cn(
        'w-10 shrink-0 h-full min-h-full self-stretch border-l border-border bg-background flex flex-col items-center select-none z-20',
        className,
      )}
    >
      {/* Top: Toggle Panel Button Container - EXACTLY h-11 with border-b matching LibraryTopbar and InspectorHeader */}
      {!hideRailToggle && (
        <div className="h-11 w-full flex items-center justify-center shrink-0 border-b border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleInspector}
                className="size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-foreground hover:bg-muted cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden"
                aria-label={isInspectorOpen ? 'Collapse inspector' : 'Expand inspector'}
              >
                <PanelRight className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={6}>
              {isInspectorOpen ? 'Collapse inspector' : 'Expand inspector'}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Middle: Vertical Section Icons with Tooltips */}
      <div className={cn("flex flex-col items-center gap-1 w-full px-1", hideRailToggle ? "pt-2" : "pt-1.5")}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = isInspectorOpen && activeTab === tab.id;

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (!isInspectorOpen) {
                      onToggleInspector?.();
                    }
                    onTabChange(tab.id);
                  }}
                  className={cn(
                    'relative size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary transition-all cursor-pointer before:absolute before:-inset-1.5 md:before:hidden',
                    isSelected
                      ? 'bg-muted text-foreground font-semibold ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                  aria-label={tab.label}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={6} className="text-11">
                <div className="flex items-center gap-1.5 font-medium">
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="text-10 px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {tab.badge}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Clean bottom spacer */}
      <div className="flex-1" />
    </aside>
  );
}

export default InspectorTabs;
