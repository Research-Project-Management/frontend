'use client';

import React, { useState } from 'react';
import { ListTree, LayoutGrid, ChevronRight, Highlighter } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import type { DocumentFulltext, ReaderDocument } from '../types/reader.types';
import AnnotationsPanel from './panel/AnnotationsPanel';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  totalPages?: number;
  onJumpToPage: (page: number) => void;
  fulltext?: DocumentFulltext | null;
  paper?: ReaderDocument | null;
  workspaceId?: string;
  attachmentId?: string;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  annotationsCount?: number;
}

export function Sidebar({
  isOpen,
  onClose,
  currentPage,
  totalPages = 1,
  onJumpToPage,
  fulltext,
  paper,
  workspaceId,
  attachmentId,
  selectedIds,
  onToggleSelect,
  annotationsCount = 0,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'outline' | 'annotations' | 'pages'>('outline');
  const sections = fulltext?.sections || [];

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Document navigation"
      className="w-72 h-full border-r border-border bg-background flex flex-col shrink-0 select-none z-20"
    >
      {/* Header with 3 tabs: Outline, Annotations, Pages */}
      <div className="h-9 shrink-0 border-b border-border px-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('outline')}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-12 font-medium rounded-md transition-colors cursor-pointer",
              activeTab === 'outline'
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <ListTree className="size-3.5 shrink-0" strokeWidth={1.5} />
            Outline
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('annotations')}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-12 font-medium rounded-md transition-colors cursor-pointer",
              activeTab === 'annotations'
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Highlighter className="size-3.5 shrink-0" strokeWidth={1.5} />
            Notes
            {annotationsCount > 0 && (
              <span className="text-10 font-mono tabular-nums text-muted-foreground ml-0.5">
                ({annotationsCount})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pages')}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-12 font-medium rounded-md transition-colors cursor-pointer",
              activeTab === 'pages'
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <LayoutGrid className="size-3.5 shrink-0" strokeWidth={1.5} />
            Pages
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        "flex-1 min-h-0",
        activeTab === 'annotations' ? "overflow-hidden" : "overflow-y-auto p-2 thin-scrollbar"
      )}>
        {activeTab === 'outline' ? (
          sections.length > 0 ? (
            <div className="space-y-0.5">
              {sections.map((s, idx) => {
                const isCurrent = s.page === currentPage;
                const level = s.num ? Math.min(4, s.num.split('.').filter(Boolean).length) : 1;
                return (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => onJumpToPage(s.page || 1)}
                    className={cn(
                      "w-full flex items-start gap-1.5 px-2 py-1.5 text-left rounded-md text-12 leading-snug transition-colors cursor-pointer",
                      isCurrent
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    style={{ paddingLeft: `${Math.max(8, level * 10)}px` }}
                  >
                    <ChevronRight className="size-3 shrink-0 mt-0.5 opacity-50" strokeWidth={1.5} />
                    <span className="truncate flex-1">
                      {s.num ? `${s.num} ` : ''}{s.title}
                    </span>
                    {s.page && (
                      <span className="text-11 font-mono tabular-nums text-muted-foreground shrink-0 ml-1">
                        {s.page}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-12 text-muted-foreground">
              No outline detected in PDF.
            </div>
          )
        ) : activeTab === 'annotations' ? (
          paper ? (
            <AnnotationsPanel
              paper={paper}
              workspaceId={workspaceId || 'me'}
              attachmentId={attachmentId}
              onNavigateToPage={onJumpToPage}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
            />
          ) : (
            <div className="p-4 text-center text-12 text-muted-foreground">
              No document loaded.
            </div>
          )
        ) : (
          /* Pages grid */
          <div className="grid grid-cols-2 gap-2 p-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isCurrent = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onJumpToPage(pageNum)}
                  className={cn(
                    "flex flex-col items-center p-1.5 rounded-md border transition-colors group cursor-pointer",
                    isCurrent
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border-hover bg-card"
                  )}
                >
                  <div className="w-full aspect-[1/1.4] rounded-sm bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                    <span className="text-11 font-mono tabular-nums">{pageNum}</span>
                  </div>
                  <span className={cn(
                    "text-11 font-mono tabular-nums mt-1",
                    isCurrent ? "font-medium text-primary" : "text-muted-foreground"
                  )}>
                    Page {pageNum}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
