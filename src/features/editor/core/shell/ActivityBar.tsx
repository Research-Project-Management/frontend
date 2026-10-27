/**
 * ActivityBar.tsx
 *
 * Canonical VS Code-Style Activity Bar (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/ActivityBar.tsx`
 *
 * Provides the narrow vertical icon strip (48px) on the far left:
 * - Controls Primary Sidebar viewlets: Files, Search, Citations, Review, Chat, AI.
 * - Bottom action: Project Settings.
 * - AI Assistant is hosted directly in the Left Primary Sidebar.
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import {
  Files,
  Search,
  BookMarked,
  MessageSquareText,
  MessageSquare,
  Bot,
  Settings,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useWorkspaceStore, type ActivityBarTab } from '../store/workspace.store';
import { editorCommandBus } from '../bus/command-bus';
import { useSettingsStore } from '../store/settings.store';
import { usePageStore } from '../store/editor.store';
import { useReviewPendingCount } from '@/features/editor/subsystems/review';

const StickyDock = dynamic(() => import('@/features/shell/components/StickyDock'), {
  ssr: false,
});

interface ActivityItem {
  id: ActivityBarTab;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const PRIMARY_ACTIVITIES: ActivityItem[] = [
  { id: 'files', label: 'File Tree', icon: Files },
  { id: 'search', label: 'Search in Project', icon: Search },
  { id: 'citations', label: 'Citations & BibTeX', icon: BookMarked },
  { id: 'review', label: 'Review & Comments', icon: MessageSquareText },
  { id: 'chat', label: 'Project Chat', icon: MessageSquare },
  { id: 'ai', label: 'AI Assistant', icon: Bot },
];

export function ActivityBar() {
  const sidebarLeftOpen = useWorkspaceStore((s) => s.sidebarLeftOpen);
  const activeSidebarTab = useWorkspaceStore((s) => s.activeSidebarTab);
  const selectActivityTab = useWorkspaceStore((s) => s.selectActivityTab);

  const toggleSettingsPanel = useSettingsStore((s) => s.toggleSettingsPanel);
  const settingsPanelOpen = useSettingsStore((s) => s.settingsPanelOpen);
  const pageId = usePageStore((s) => s.activePageId || s.currentPage?.id);
  const { totalPendingCount } = useReviewPendingCount(pageId);

  return (
    <aside
      aria-label="Activity Bar"
      className="h-full w-12 shrink-0 flex flex-col items-center justify-between border-r border-border bg-sidebar py-2.5 select-none z-30"
    >
      <TooltipProvider delayDuration={150}>
        {/* Top Section: Primary Viewlets */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {PRIMARY_ACTIVITIES.map((item) => {
            const isActive = sidebarLeftOpen && activeSidebarTab === item.id;
            const Icon = item.icon;
            const isReview = item.id === 'review';
            const showBadge = isReview && totalPendingCount > 0;
            const badgeCount = totalPendingCount;

            const handleClick = () => {
              selectActivityTab(item.id);
            };

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={item.label}
                    onClick={handleClick}
                    className={cn(
                      'group relative flex size-9 items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
                      item.id === 'ai'
                        ? isActive
                          ? 'bg-ai-subtle text-ai font-medium'
                          : 'text-ai hover:text-ai hover:bg-ai-subtle/50 font-normal'
                        : isActive
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
                    )}
                  >
                    <Icon
                      className="size-4.5 shrink-0"
                      strokeWidth={1.8}
                    />

                    {/* Unread / Pending badge */}
                    {showBadge && (
                      <span className="absolute -top-0.5 -right-0.5 flex min-w-3.5 h-3.5 px-1 items-center justify-center rounded-full text-11 font-mono font-semibold bg-primary text-primary-foreground leading-none">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom Section: Stickies + Global Settings */}
        <div className="flex flex-col items-center gap-1.5 w-full mt-auto">
          <StickyDock
            className="size-9"
            buttonClassName="size-9 text-muted-foreground hover:text-foreground"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Project settings"
                onClick={toggleSettingsPanel}
                className={cn(
                  'relative flex size-9 items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
                  settingsPanelOpen
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
                )}
              >
                <Settings className="size-4.5 shrink-0" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Project settings
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </aside>
  );
}

export default ActivityBar;
