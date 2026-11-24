/**
 * ActivityBar.tsx
 *
 * Canonical VS Code-Style Activity Bar (Block 7: UI Shell Layer).
 * Location: `features/editor/core/shell/ActivityBar.tsx`
 *
 * Provides the narrow vertical icon strip (48px) on the far left:
 * - Controls Primary Sidebar viewlets: Files, Search, Citations, Review, Chat, AI.
 * - Bottom action: Project Settings.
 * - AI Assistant is hosted directly in the Left Primary Sidebar.
 */

'use client';

import React from 'react';
import {
  Files,
  Search,
  BookMarked,
  MessageSquareText,
  Bot,
  Settings,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useWorkspaceStore, type ActivityBarTab } from '../store/workspace.store';
import { editorCommandBus } from '../bus/command-bus';
import { useSettingsStore } from '../store/settings.store';

interface ActivityItem {
  id: ActivityBarTab;
  label: string;
  tooltip: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const PRIMARY_ACTIVITIES: ActivityItem[] = [
  { id: 'files', label: 'File Tree', tooltip: 'Files', icon: Files },
  { id: 'search', label: 'Search in Project', tooltip: 'Search', icon: Search },
  { id: 'citations', label: 'Citations & BibTeX', tooltip: 'Citations', icon: BookMarked },
  { id: 'review', label: 'Review & Comments', tooltip: 'Review', icon: MessageSquareText },
  { id: 'ai', label: 'AI Assistant', tooltip: 'AI Assistant', icon: Bot },
];

export function ActivityBar() {
  const sidebarLeftOpen = useWorkspaceStore((s) => s.sidebarLeftOpen);
  const activeSidebarTab = useWorkspaceStore((s) => s.activeSidebarTab);
  const selectActivityTab = useWorkspaceStore((s) => s.selectActivityTab);

  const toggleSettingsPanel = useSettingsStore((s) => s.toggleSettingsPanel);
  const settingsPanelOpen = useSettingsStore((s) => s.settingsPanelOpen);
  const aiAssistEnabled = useSettingsStore((s) => s.aiAssistEnabled);
  const visibleActivities = aiAssistEnabled
    ? PRIMARY_ACTIVITIES
    : PRIMARY_ACTIVITIES.filter((item) => item.id !== 'ai');

  return (
    <aside
      aria-label="Activity Bar"
      className="h-full w-12 shrink-0 flex flex-col items-center justify-between border-r border-border bg-background py-2.5 select-none z-30"
    >
      {/* Top Section: Primary Viewlets */}
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Primary Viewlets"
          className="flex flex-col items-center gap-1.5 w-full"
        >
          {visibleActivities.map((item) => {
            const isActive = sidebarLeftOpen && activeSidebarTab === item.id;
            const Icon = item.icon;

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
                      'group relative flex size-9 items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
                    )}
                  >
                    <Icon
                      className="size-4.5 shrink-0"
                      strokeWidth={1.8}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6} className="text-xs">
                  {item.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom Section: Global Settings */}
        <div className="flex flex-col items-center gap-1.5 w-full mt-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Project settings"
                onClick={toggleSettingsPanel}
                className={cn(
                  'relative flex size-9 items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  settingsPanelOpen
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
                )}
              >
                <Settings className="size-4.5 shrink-0" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6} className="text-xs">
              Settings
            </TooltipContent>
          </Tooltip>
        </div>
    </aside>
  );
}

export default ActivityBar;
