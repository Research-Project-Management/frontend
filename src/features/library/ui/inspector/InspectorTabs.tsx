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
import {
  type InspectorTabKey,
  INSPECTOR_LEVELS,
} from './inspector-levels.constants';

export {
  type InspectorTabKey,
  INSPECTOR_LEVELS,
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
                    'relative size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary transition-all cursor-pointer before:absolute before:-inset-1.5 md:before:hidden',
                    isActive
                      ? 'bg-muted text-foreground font-semibold ring-1 ring-border shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                  aria-label={tab.label}
                  aria-current={isActive ? 'true' : undefined}
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
