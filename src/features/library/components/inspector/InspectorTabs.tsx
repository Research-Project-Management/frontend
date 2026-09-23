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
    { id: 'info', label: 'Details', icon: Info },
    { id: 'abstract', label: 'Abstract', icon: AlignLeft },
    { id: 'files', label: 'Files', icon: Paperclip, badge: attachmentCount },
    { id: 'notes', label: 'Notes', icon: StickyNote, badge: noteCount },
    { id: 'collections', label: 'Organize', icon: FolderTree },
    { id: 'tags', label: 'Tags', icon: Tag },
    { id: 'relations', label: 'Related', icon: Network },
    { id: 'cite', label: 'Citation', icon: Quote },
  ];

  return (
    <aside
      aria-label="Inspector panel bar"
      className={cn(
        'w-10 shrink-0 h-full border-l border-border bg-background flex flex-col items-center select-none z-20',
        className,
      )}
    >
      {/* Top: Toggle Panel Button Container - EXACTLY h-11 matching LibraryTopbar */}
      <div className="h-11 w-full flex items-center justify-center shrink-0 relative">
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

        {/* Inset divider line separating toggle button from section icons without touching borders */}
        <div className="absolute bottom-0 left-2 right-2 h-px bg-border" />
      </div>

      {/* Middle: Vertical Section Icons with Tooltips */}
      <div className="flex flex-col items-center gap-1 w-full pt-1.5 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;

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
                  className="relative size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors cursor-pointer text-foreground hover:bg-muted"
                  aria-label={tab.label}
                >
                  <Icon className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-foreground" />
                  )}
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

