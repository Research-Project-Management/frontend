'use client';

import React from 'react';
import {
  Info,
  AlignLeft,
  Paperclip,
  Quote,
  StickyNote,
  FolderTree,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { InspectorSectionId } from '../../store';

export type InspectorTabKey = 'info' | 'abstract' | 'files' | 'cite' | 'notes' | 'collections';

interface TabItem {
  id: InspectorTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface InspectorTabsProps {
  activeTab: InspectorSectionId;
  onTabChange: (tab: InspectorSectionId) => void;
  attachmentCount?: number;
  noteCount?: number;
}

export function InspectorTabs({
  activeTab,
  onTabChange,
  attachmentCount = 0,
  noteCount = 0,
}: InspectorTabsProps) {
  const tabs: TabItem[] = [
    { id: 'info', label: 'Details', icon: Info },
    { id: 'abstract', label: 'Abstract', icon: AlignLeft },
    { id: 'files', label: 'Files', icon: Paperclip, badge: attachmentCount },
    { id: 'cite', label: 'Cite', icon: Quote },
    { id: 'notes', label: 'Notes', icon: StickyNote, badge: noteCount },
    { id: 'collections', label: 'Organize', icon: FolderTree },
  ];

  return (
    <div className="flex items-center border-b border-border/60 bg-muted/10 px-2 overflow-x-auto no-scrollbar shrink-0 select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors outline-none cursor-pointer',
              isActive
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/60'
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-mono',
                  isActive
                    ? 'bg-primary/15 text-primary font-bold'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
