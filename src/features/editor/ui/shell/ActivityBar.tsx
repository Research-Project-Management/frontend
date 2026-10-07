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
import {
  FileText,
  ListTree,
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
import { useLayoutStore, type ActivityBarTab } from '../../store/layout.store';
import { useSettingsStore } from '../../store/settings.store';
import { useDocumentCollaborationStore } from '../../store/collaboration.store';

interface ActivityItem {
  id: ActivityBarTab;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  shortcut?: string;
}

const PRIMARY_ACTIVITIES: ActivityItem[] = [
  { id: 'files', label: 'Files Explorer', icon: FileText, shortcut: 'Ctrl+Shift+E' },
  { id: 'outline', label: 'Document Outline', icon: ListTree, shortcut: 'Ctrl+Shift+O' },
  { id: 'search', label: 'Search in Project', icon: Search, shortcut: 'Ctrl+Shift+F' },
  { id: 'citations', label: 'Citations & BibTeX', icon: BookMarked },
  { id: 'review', label: 'Review & Comments', icon: MessageSquareText },
  { id: 'chat', label: 'Team Chat', icon: MessageSquare },
  { id: 'ai', label: 'AI Research Assistant', icon: Bot },
];

export function ActivityBar() {
  const {
    sidebarLeftOpen,
    activeSidebarTab,
    selectActivityTab,
  } = useLayoutStore();

  const toggleSettingsPanel = useSettingsStore((s) => s.toggleSettingsPanel);
  const settingsPanelOpen = useSettingsStore((s) => s.settingsPanelOpen);
  const unreadChatCount = useDocumentCollaborationStore((s) => s.unreadChatCount);

  return (
    <aside
      aria-label="Activity Bar"
      className="h-full w-12 shrink-0 flex flex-col items-center justify-between border-r border-border bg-sidebar py-2.5 select-none z-30"
    >
      <TooltipProvider delayDuration={150}>
        {/* Top Section: Primary Viewlets (Including AI Assistant) */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {PRIMARY_ACTIVITIES.map((item) => {
            const isActive = sidebarLeftOpen && activeSidebarTab === item.id;
            const Icon = item.icon;
            const isChat = item.id === 'chat';
            const showBadge = isChat && unreadChatCount > 0;

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={item.label}
                    onClick={() => selectActivityTab(item.id)}
                    className={cn(
                      'group relative flex size-9 items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      isActive
                        ? 'bg-sidebar-accent text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-hover'
                    )}
                  >
                    {/* Active left indicator bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
                    )}
                    <Icon className="size-4.5 shrink-0" strokeWidth={1.8} />

                    {/* Unread badge */}
                    {showBadge && (
                      <span className="absolute -top-0.5 -right-0.5 flex min-w-3.5 h-3.5 px-1 items-center justify-center rounded-full text-[10px] font-mono font-semibold bg-primary text-primary-foreground">
                        {unreadChatCount > 99 ? '99+' : unreadChatCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {item.shortcut}
                    </span>
                  )}
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
                aria-label="Project Settings"
                onClick={toggleSettingsPanel}
                className={cn(
                  'flex size-9 items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                  settingsPanelOpen
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-hover'
                )}
              >
                <Settings className="size-4.5 shrink-0" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span>Settings</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </aside>
  );
}

export default ActivityBar;
