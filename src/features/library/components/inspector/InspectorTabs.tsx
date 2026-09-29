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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { InspectorSectionId } from '../../store';

export type InspectorTabKey = InspectorSectionId;

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
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
  className?: string;
}

/**
 * Vertical Icon Panel Bar
 * Replaces the horizontal tabs with a dedicated vertical bar adhering to Flux workspace specs.
 */
export function InspectorTabs({
  activeTab,
  onTabChange,
  attachmentCount = 0,
  noteCount = 0,
  isInspectorOpen = true,
  onToggleInspector,
  className,
}: InspectorTabsProps) {
  const tabs: TabItem[] = [
    { id: 'info', label: 'Details (Level 8 - 8 bars)', icon: Info },
    { id: 'abstract', label: 'Abstract (Level 7 - 7 bars)', icon: AlignLeft },
    { id: 'files', label: 'Attachments (Level 6 - 6 bars)', icon: Paperclip, badge: attachmentCount },
    { id: 'notes', label: 'Notes (Level 5 - 5 bars)', icon: StickyNote, badge: noteCount },
    { id: 'collections', label: 'Collections (Level 4 - 4 bars)', icon: FolderTree },
    { id: 'tags', label: 'Tags (Level 3 - 3 bars)', icon: Tag },
    { id: 'relations', label: 'Related (Level 2 - 2 bars)', icon: Network },
    { id: 'cite', label: 'Citation (Level 1 - 1 bar)', icon: Quote },
  ];

  return (
    <aside
      aria-label="Inspector panel bar"
      className={cn(
        'w-10 shrink-0 h-full border-l border-border bg-background flex flex-col items-center select-none z-20',
        className,
      )}
    >
      {/* Top: Toggle Panel Button Container - EXACTLY h-11 with border-b matching LibraryTopbar and InspectorHeader */}
      <div className="h-11 w-full flex items-center justify-center shrink-0 border-b border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleInspector}
              className="size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-foreground hover:bg-muted cursor-pointer"
              aria-label={isInspectorOpen ? 'Collapse inspector' : 'Expand inspector'}
            >
              <PanelRight className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={6} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-xs">
            {isInspectorOpen ? 'Collapse inspector' : 'Expand inspector'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Middle: Vertical Section Icons with Tooltips */}
      <div className="flex flex-col items-center gap-1 w-full pt-1.5 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isInspectorOpen && activeTab === tab.id;

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
                    'relative size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors cursor-pointer text-foreground',
                    isActive
                      ? 'bg-muted font-medium shadow-2xs'
                      : 'hover:bg-muted/60',
                  )}
                  aria-label={tab.label}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                sideOffset={6}
                className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground"
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 ? ` (${tab.badge})` : ''}
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

