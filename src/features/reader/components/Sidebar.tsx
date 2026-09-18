'use client';

import React, { useState, useMemo } from 'react';
import { Document, Page } from 'react-pdf';
import { ListTree, LayoutGrid, ChevronRight, Highlighter, Search, X } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import type { DocumentFulltext, ReaderDocument } from '../types/reader.types';
import AnnotationsPanel from './panel/AnnotationsPanel';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  totalPages?: number;
  onJumpToPage: (page: number, annotationId?: string) => void;
  fulltext?: DocumentFulltext | null;
  paper?: ReaderDocument | null;
  workspaceId?: string;
  attachmentId?: string;
  pdfBlobUrl?: string | null;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  annotationsCount?: number;
  onAddToNote?: (text: string, pageNumber?: number) => void;
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
  pdfBlobUrl,
  selectedIds,
  onToggleSelect,
  annotationsCount = 0,
  onAddToNote,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'outline' | 'annotations' | 'pages'>('outline');
  const [outlineFilter, setOutlineFilter] = useState('');
  const sections = fulltext?.sections || [];

  const filteredSections = useMemo(() => {
    if (!outlineFilter.trim()) return sections;
    const q = outlineFilter.toLowerCase().trim();
    return sections.filter(
      (s) =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.num && s.num.toLowerCase().includes(q))
    );
  }, [sections, outlineFilter]);

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Document navigation"
      className="w-72 h-full border-r border-border bg-background flex flex-col shrink-0 select-none z-20"
    >
      {/* Header with 3 tabs: Outline, Annotations, Thumbnails */}
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
            Annotations
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
            Thumbnails
          </button>
        </div>
      </div>

      {/* Outline Search Filter (Zotero: Filter table of contents) */}
      {activeTab === 'outline' && sections.length > 0 && (
        <div className="p-1.5 border-b border-border bg-background shrink-0">
          <div className="relative flex items-center">
            <Search className="size-3 absolute left-2 text-muted-foreground pointer-events-none" strokeWidth={1.5} />
            <input
              type="text"
              value={outlineFilter}
              onChange={(e) => setOutlineFilter(e.target.value)}
              placeholder="Filter outline..."
              className="w-full h-6.5 pl-6.5 pr-6 text-11 bg-muted/40 hover:bg-muted/70 focus:bg-background border border-border rounded text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors font-sans"
            />
            {outlineFilter && (
              <button
                type="button"
                onClick={() => setOutlineFilter('')}
                className="size-4.5 absolute right-1 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear filter"
              >
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn(
        "flex-1 min-h-0",
        activeTab === 'annotations' ? "overflow-hidden" : "overflow-y-auto p-2 thin-scrollbar"
      )}>
        {activeTab === 'outline' ? (
          filteredSections.length > 0 ? (
            <div className="space-y-0.5">
              {filteredSections.map((s, idx) => {
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
              {outlineFilter ? 'No matching headings.' : 'No outline detected in PDF.'}
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
              onAddToNote={onAddToNote}
            />
          ) : (
            <div className="p-4 text-center text-12 text-muted-foreground">
              No document loaded.
            </div>
          )
        ) : (
          /* Pages grid */
          pdfBlobUrl ? (
            <Document
              file={pdfBlobUrl}
              loading={
                <div className="p-4 text-center text-11 text-muted-foreground">
                  Loading thumbnails...
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-2 p-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  const isCurrent = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => onJumpToPage(pageNum)}
                      className={cn(
                        "flex flex-col items-center p-1 rounded-md border transition-all group cursor-pointer overflow-hidden",
                        isCurrent
                          ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                          : "border-border hover:border-foreground/40 bg-card"
                      )}
                    >
                      <div className="w-full aspect-[1/1.4] rounded-sm bg-background border border-border/60 overflow-hidden flex items-center justify-center">
                        <Page
                          pageNumber={pageNum}
                          width={100}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={
                            <div className="size-full flex items-center justify-center text-muted-foreground text-11 font-mono">
                              {pageNum}
                            </div>
                          }
                        />
                      </div>
                      <span className={cn(
                        "text-11 font-mono tabular-nums mt-1",
                        isCurrent ? "font-semibold text-primary" : "text-muted-foreground"
                      )}>
                        Page {pageNum}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Document>
          ) : (
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
          )
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
