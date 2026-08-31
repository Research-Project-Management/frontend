'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileText,
  Paperclip,
  StickyNote,
  Tag,
  Share2,
  Quote,
  AlignLeft,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  Library,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import InfoSection from './sections/InfoSection';
import AbstractSection from './sections/AbstractSection';
import CollectionsSection from './sections/CollectionsSection';
import NotesSection from './sections/NotesSection';
import TagsSection from './sections/TagsSection';
import CiteSection from './sections/CiteSection';
import FilesSection from './sections/FilesSection';
import RelatedSection from './sections/RelatedSection';
import { usePapers } from '../../hooks/library/use-papers';
import { useLibrarySidebarStore } from '../../store/sidebar.store';
import { normalizeNotes } from '../../utils/library.util';
import { cn } from '@/shared/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { Paper, Collection } from '../../types/library.types';

interface InspectorPanelProps {
  paper: Paper | null;
  collection?: Collection | null;
  workspaceId: string;
  onClose?: () => void;
}

type SectionId = 'info' | 'abstract' | 'collections' | 'files' | 'notes' | 'tags' | 'relations' | 'cite';

interface SectionDefinition {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hasQuickAdd?: boolean;
}

function InspectorPaneIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M14 3v18" />
      <path d="M17 7.5h2.5" />
      <path d="M17 12h2.5" />
      <path d="M17 16.5h2.5" />
    </svg>
  );
}

const SECTIONS_CONFIG: SectionDefinition[] = [
  { id: 'info', label: 'Info', icon: FileText },
  { id: 'abstract', label: 'Abstract', icon: AlignLeft },
  { id: 'collections', label: 'Libraries & Collections', icon: Library },
  { id: 'files', label: 'Attachments', icon: Paperclip },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'relations', label: 'Related', icon: Share2 },
  { id: 'cite', label: 'Citations', icon: Quote },
];

const DEFAULT_VISIBLE_SECTIONS: Record<SectionId, boolean> = {
  info: true,
  abstract: true,
  collections: true,
  files: true,
  notes: true,
  tags: true,
  relations: true,
  cite: true,
};

const DEFAULT_COLLAPSED_SECTIONS: Record<SectionId, boolean> = {
  info: false,
  abstract: true,
  collections: true,
  files: true,
  notes: true,
  tags: true,
  relations: true,
  cite: true,
};

function InspectorTitleInput({
  title,
  onSave,
}: {
  title: string;
  onSave: (val: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) {
      onSave(trimmed);
    } else if (!trimmed && title) {
      setDraft(title);
    }
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      aria-label="Reference title"
      title={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          inputRef.current?.blur();
        } else if (e.key === 'Escape') {
          setDraft(title);
          inputRef.current?.blur();
        }
      }}
      className="w-full h-8 bg-transparent text-sm font-semibold text-foreground tracking-tight hover:bg-muted/30 focus:bg-background px-2 rounded border border-transparent focus:border-border/60 transition-colors outline-none truncate focus-visible:ring-1 focus-visible:ring-ring select-text font-sans antialiased"
    />
  );
}

export default function InspectorPanel({
  paper,
  collection,
  workspaceId,
  onClose,
}: InspectorPanelProps) {
  const paperService = usePapers({ workspaceId });

  const {
    inspectorWidth,
    setInspectorWidth,
    isInspectorOpen,
    setIsInspectorOpen,
    toggleInspector,
  } = useLibrarySidebarStore();

  const [activeSectionId, setActiveSectionId] = useState<SectionId>('info');
  const [visibleSections, setVisibleSections] = useState<Record<SectionId, boolean>>(DEFAULT_VISIBLE_SECTIONS);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(DEFAULT_COLLAPSED_SECTIONS);
  const [addingSection, setAddingSection] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isProgrammaticScrollRef = useRef(false);

  // Resizing state
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(inspectorWidth);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = inspectorWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [inspectorWidth]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startXRef.current - e.clientX;
      const clamped = Math.max(320, Math.min(720, startWidthRef.current + deltaX));
      setInspectorWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, setInspectorWidth]);

  // Ensure Info section is ALWAYS opened by default whenever a paper is selected
  useEffect(() => {
    if (paper?.id) {
      setCollapsedSections((prev) => ({
        ...prev,
        info: false,
      }));
      setActiveSectionId('info');
    }
  }, [paper?.id]);

  // ScrollSpy listener
  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    let closestSection: SectionId = 'info';

    for (const sec of SECTIONS_CONFIG) {
      if (!visibleSections[sec.id]) continue;
      const el = sectionRefs.current[sec.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerTop <= 60) {
          closestSection = sec.id;
        }
      }
    }

    setActiveSectionId(closestSection);
  }, [visibleSections]);

  const isSectionOpen = (sectionId: SectionId) => {
    return collapsedSections[sectionId] === false;
  };

  const handleToggleSectionVisibility = (sectionId: SectionId) => {
    if (!isInspectorOpen) {
      setIsInspectorOpen(true);
    }
    setCollapsedSections((prev) => {
      const currentIsOpen = prev[sectionId] === false;
      return {
        ...prev,
        [sectionId]: currentIsOpen ? true : false,
      };
    });

    setTimeout(() => {
      const el = sectionRefs.current[sectionId];
      if (el && scrollContainerRef.current) {
        isProgrammaticScrollRef.current = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 400);
      }
    }, 50);
  };

  const handleJumpToSection = (sectionId: SectionId) => {
    if (!isInspectorOpen) {
      setIsInspectorOpen(true);
    }
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: false }));
    setActiveSectionId(sectionId);

    setTimeout(() => {
      const el = sectionRefs.current[sectionId];
      if (el && scrollContainerRef.current) {
        isProgrammaticScrollRef.current = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 400);
      }
    }, 50);
  };

  const toggleSection = (sectionId: SectionId, itemCount: number = 1) => {
    // If section has 0 items and is not in adding mode, clicking arrow/header does nothing
    if (itemCount === 0 && addingSection !== sectionId) {
      return;
    }
    setCollapsedSections((prev) => {
      const currentIsOpen = prev[sectionId] === false;
      return {
        ...prev,
        [sectionId]: currentIsOpen ? true : false,
      };
    });
  };

  const handleQuickAdd = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: false }));
    setAddingSection(sectionId);
    handleJumpToSection(sectionId as SectionId);
  };

  const paperId = paper?.id;

  const handleUpdatePaper = (data: Partial<Paper>) => {
    if (!paperId) return;
    paperService.actions.updatePaper(
      {
        paperId,
        ...data,
      },
      {
        onError: () => toast.error('Failed to update details'),
      }
    );
  };

  const handleAddNote = (content: string) => {
    if (!paperId || !paper) return;
    const existingNotes = normalizeNotes(paper.notes).map((n: any) => n.content);
    paperService.actions.updatePaper(
      {
        paperId,
        notes: [...existingNotes, content] as any,
      },
      {
        onSuccess: () => {
          toast.success('Note added');
          setAddingSection(null);
        },
        onError: () => toast.error('Failed to add note'),
      }
    );
  };

  const handleDeleteNote = (noteId: string) => {
    if (!paperId || !paper) return;
    const normalized = normalizeNotes(paper.notes);
    const updated = normalized.filter((n: any) => n.id !== noteId).map((n: any) => n.content);
    paperService.actions.updatePaper(
      {
        paperId,
        notes: updated as any,
      },
      {
        onSuccess: () => toast.success('Note deleted'),
        onError: () => toast.error('Failed to delete note'),
      }
    );
  };

  const handleUpdateNote = (noteId: string, content: string) => {
    if (!paperId || !paper) return;
    const normalized = normalizeNotes(paper.notes);
    const updated = normalized.map((n: any) => (n.id === noteId ? content : n.content));
    paperService.actions.updatePaper(
      {
        paperId,
        notes: updated as any,
      },
      {
        onSuccess: () => toast.success('Note updated'),
        onError: () => toast.error('Failed to update note'),
      }
    );
  };

  const handleUpdateTags = (tags: string[]) => {
    if (!paperId) return;
    paperService.actions.updatePaper(
      {
        paperId,
        labels: tags,
      },
      {
        onSuccess: () => {
          toast.success('Tags updated');
          setAddingSection(null);
        },
        onError: () => toast.error('Failed to update tags'),
      }
    );
  };

  const notesCount = paper?.notes?.length || 0;
  const tagsCount = (paper?.labels?.length || 0) + (paper?.keywords?.length || 0) + ((paper as any)?.tags?.length || 0);
  const supplementaryCount = (paper?.attachments || []).filter((att: any) => {
    if (att.isPrimary || att.type === 'primary') return false;
    if (
      paper?.fileUrl &&
      att.url &&
      (att.url === paper.fileUrl ||
        att.url.endsWith(paper.fileUrl) ||
        paper.fileUrl.endsWith(att.url))
    ) {
      return false;
    }
    if (paper?.filename && att.filename && att.filename === paper.filename) {
      return false;
    }
    return true;
  }).length;
  const filesCount = (paper?.fileUrl ? 1 : 0) + supplementaryCount;
  const relationsCount = ((paper as any)?.relations?.length || (paper as any)?.relatedPapers?.length || 0);
  const collectionsCount = paper?.collectionId ? 1 : 0;
  const abstractText = (paper?.abstract || (paper as any)?.abstractNote || '').trim();

  const isPanelExpanded = isInspectorOpen && Boolean(paper);

  const RAIL_WIDTH = 44;

  return (
    <aside
      aria-label="Paper details inspector"
      style={{
        width: isPanelExpanded ? `${inspectorWidth + RAIL_WIDTH}px` : `${RAIL_WIDTH}px`,
        minWidth: isPanelExpanded ? `${260 + RAIL_WIDTH}px` : `${RAIL_WIDTH}px`,
        maxWidth: isPanelExpanded ? `${560 + RAIL_WIDTH}px` : `${RAIL_WIDTH}px`,
      }}
      className={cn(
        "relative h-full border-l border-border/50 bg-transparent flex flex-row shrink-0 select-none font-sans antialiased",
        isDragging && "select-none"
      )}
    >
      {/* Resizable drag handle on left edge with WAI-ARIA separator semantics & double-click reset */}
      {isPanelExpanded && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={inspectorWidth}
          aria-valuemin={260}
          aria-valuemax={560}
          aria-label="Resize inspector panel (double-click to reset width)"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setInspectorWidth(300)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setInspectorWidth(Math.min(560, inspectorWidth + 20));
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setInspectorWidth(Math.max(260, inspectorWidth - 20));
            }
          }}
          className={cn(
            "group absolute top-0 -left-1 w-2 h-full cursor-col-resize z-30 select-none flex items-center justify-center transition-colors focus-visible:outline-none",
            isDragging ? "bg-primary/20" : "hover:bg-primary/10"
          )}
        >
          <div
            className={cn(
              "w-0.5 h-8 rounded-full transition-colors",
              isDragging
                ? "bg-primary"
                : "bg-transparent group-hover:bg-muted-foreground/40 group-focus-visible:bg-primary"
            )}
          />
        </div>
      )}

      {/* Main Continuous Scroll Accordion Pane */}
      {isPanelExpanded && paper && (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
          {/* Top Title Header - Exactly h-11 aligned with Topbar and Right Rail */}
          <header className="h-11 px-2.5 border-b border-border/50 flex items-center justify-between shrink-0 bg-background">
            <div className="flex-1 min-w-0">
              <InspectorTitleInput
                title={paper.title || ''}
                onSave={(newTitle) => handleUpdatePaper({ title: newTitle })}
              />
            </div>
          </header>

              {/* Continuous Scrollable Section Accordion Body */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                tabIndex={0}
                className="flex-1 overflow-y-auto min-w-0 focus-visible:outline-none scroll-smooth thin-scrollbar bg-background"
              >
                {/* 1. Info Section (OPEN by default) */}
                {visibleSections['info'] && (
                  <div
                    ref={(el) => {
                      sectionRefs.current['info'] = el;
                    }}
                    id="inspector-section-info"
                    className="scroll-mt-1 bg-background"
                  >
                    <div
                      onClick={() => toggleSection('info')}
                      className="flex items-center justify-between px-3.5 py-2 min-h-[34px] hover:bg-muted/60 transition-colors cursor-pointer select-none group bg-background"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-foreground shrink-0" />
                        <span className="text-xs font-medium tracking-tight text-foreground">
                          Info
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-foreground transition-transform duration-200 shrink-0",
                          isSectionOpen('info') && "rotate-180"
                        )}
                      />
                    </div>
                    {isSectionOpen('info') && (
                      <div className="px-3.5 py-2.5 bg-background">
                        <InfoSection paper={paper} onUpdatePaper={handleUpdatePaper} />
                      </div>
                    )}
                  </div>
                )}

                {/* Inset Divider Line */}
                <div className="mx-3.5 border-t border-border/50" />

                {/* 2. Abstract Section (CLOSED by default) */}
                {visibleSections['abstract'] && (
                  <div
                    ref={(el) => {
                      sectionRefs.current['abstract'] = el;
                    }}
                    id="inspector-section-abstract"
                    className="scroll-mt-1 bg-background"
                  >
                    <div
                      onClick={() => toggleSection('abstract')}
                      className="flex items-center justify-between px-3.5 py-2 min-h-[34px] hover:bg-muted/60 transition-colors cursor-pointer select-none group bg-background"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        <AlignLeft className="size-4 text-foreground shrink-0" />
                        <span className="text-xs font-medium tracking-tight text-foreground shrink-0">
                          Abstract
                        </span>
                        {!isSectionOpen('abstract') && abstractText && (
                          <span className="text-xs text-muted-foreground truncate font-normal ml-1">
                            {abstractText}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-foreground transition-transform duration-200 shrink-0",
                          isSectionOpen('abstract') && "rotate-180"
                        )}
                      />
                    </div>
                    {isSectionOpen('abstract') && (
                      <div className="px-3.5 py-2.5 bg-background">
                        <AbstractSection paper={paper} onUpdatePaper={handleUpdatePaper} hideHeader />
                      </div>
                    )}
                  </div>
                )}

                {/* Inset Divider Line */}
                <div className="mx-3.5 border-t border-border/50" />

                {/* 3. Attachments Section (CLOSED by default) */}
                {visibleSections['files'] && (
                  <div
                    ref={(el) => {
                      sectionRefs.current['files'] = el;
                    }}
                    id="inspector-section-files"
                    className="scroll-mt-1 bg-background"
                  >
                    <div
                      onClick={() => toggleSection('files', filesCount)}
                      className={cn(
                        "flex items-center justify-between px-3.5 py-2 min-h-[34px] hover:bg-muted/60 transition-colors select-none group bg-background",
                        filesCount > 0 ? "cursor-pointer" : "cursor-default"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip className="size-4 text-foreground shrink-0" />
                        <span className="text-xs font-medium tracking-tight text-foreground">
                          {filesCount} {filesCount === 1 ? 'Attachment' : 'Attachments'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="size-5.5 rounded flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                              aria-label="Add attachment options"
                            >
                              <Plus className="size-3.5 text-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 p-1 bg-popover text-popover-foreground border border-border/80 shadow-md rounded-lg text-xs font-normal z-50">
                            <DropdownMenuItem
                              onClick={() => {
                                setCollapsedSections((prev) => ({ ...prev, files: false }));
                                toast.info('File attachment option');
                              }}
                              className="px-3 py-2 cursor-pointer rounded-md hover:bg-muted font-normal text-xs text-foreground"
                            >
                              File
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCollapsedSections((prev) => ({ ...prev, files: false }));
                                toast.info('Link file option');
                              }}
                              className="px-3 py-2 cursor-pointer rounded-md hover:bg-muted font-normal text-xs text-foreground"
                            >
                              Linked File
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCollapsedSections((prev) => ({ ...prev, files: false }));
                                toast.info('Add web link option');
                              }}
                              className="px-3 py-2 cursor-pointer rounded-md hover:bg-muted font-normal text-xs text-foreground"
                            >
                              Web Link
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronDown
                          onClick={() => toggleSection('files', filesCount)}
                          className={cn(
                            "size-3.5 text-foreground transition-transform duration-200 cursor-pointer shrink-0",
                            isSectionOpen('files') && "rotate-180"
                          )}
                        />
                      </div>
                    </div>
                    {isSectionOpen('files') && (
                      <div className="px-3.5 py-2.5 bg-background">
                        <FilesSection paper={paper} hideHeader />
                      </div>
                    )}
                  </div>
                )}

                {/* Inset Divider Line */}
                <div className="mx-3.5 border-t border-border/50" />

                {/* 4. Notes Section (CLOSED by default) */}
                {visibleSections['notes'] && (
                  <div
                    ref={(el) => {
                      sectionRefs.current['notes'] = el;
                    }}
                    id="inspector-section-notes"
                    className="scroll-mt-1 bg-background"
                  >
                    <div
                      onClick={() => toggleSection('notes', notesCount)}
                      className={cn(
                        "flex items-center justify-between px-3.5 py-2 min-h-[34px] hover:bg-muted/60 transition-colors select-none group bg-background",
                        notesCount > 0 || addingSection === 'notes' ? "cursor-pointer" : "cursor-default"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <StickyNote className="size-4 text-foreground shrink-0" />
                        <span className="text-xs font-medium tracking-tight text-foreground">
                          {notesCount} {notesCount === 1 ? 'Note' : 'Notes'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleQuickAdd('notes', e)}
                          className="size-5.5 rounded flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                          aria-label="Add note"
                        >
                          <Plus className="size-3.5 text-foreground" />
                        </button>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-foreground transition-transform duration-200 shrink-0",
                            isSectionOpen('notes') && "rotate-180"
                          )}
                        />
                      </div>
                    </div>
                    {isSectionOpen('notes') && (
                      <div className="px-3.5 py-2.5 bg-background">
                        <NotesSection
                          paper={paper}
                          onAddNote={handleAddNote}
                          onUpdateNote={handleUpdateNote}
                          onDeleteNote={handleDeleteNote}
                          forceAdding={addingSection === 'notes'}
                          hideHeader
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Inset Divider Line */}
                <div className="mx-3.5 border-t border-border/50" />

                {/* 5. Collections Section (CLOSED by default) */}
                {visibleSections['collections'] && (
                  <div
                    ref={(el) => {
                      sectionRefs.current['collections'] = el;
                    }}
                    id="inspector-section-collections"
                    className="scroll-mt-1 bg-background"
                  >
                    <div
                      onClick={() => toggleSection('collections', collectionsCount)}
                      className={cn(
                        "flex items-center justify-between px-3.5 py-2 min-h-[34px] hover:bg-muted/60 transition-colors select-none group bg-background",
                        collectionsCount > 0 ? "cursor-pointer" : "cursor-default"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Library className="size-4 text-foreground shrink-0" />
                        <span className="text-xs font-medium tracking-tight text-foreground">
                          Libraries and Collections
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleQuickAdd('collections', e)}
                          className="size-5.5 rounded flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                          aria-label="Add to collection"
                        >
                          <Plus className="size-3.5 text-foreground" />
                        </button>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-foreground transition-transform duration-200 shrink-0",
                            isSectionOpen('collections') && "rotate-180"
                          )}
                        />
                      </div>
                    </div>
                    {isSectionOpen('collections') && (
                      <div className="px-3.5 py-2.5 bg-background">
                        <CollectionsSection
                          paper={paper}
                          workspaceId={workspaceId}
                          hideHeader
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Inset Divider Line */}
                <div className="mx-3.5 border-t border-border/50" />

                {/* 6. Tags Section (CLOSED by default) */}
                {visibleSections['tags'] && (
                  <div
                    ref={(el) => {
                      sectionRefs.current['tags'] = el;
                    }}
                    id="inspector-section-tags"
                    className="scroll-mt-1 bg-background"
                  >
                    <div
                      onClick={() => toggleSection('tags', tagsCount)}
                      className={cn(
                        "flex items-center justify-between px-3.5 py-2 min-h-[34px] hover:bg-muted/60 transition-colors select-none group bg-background",
                        tagsCount > 0 || addingSection === 'tags' ? "cursor-pointer" : "cursor-default"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="size-4 text-foreground shrink-0" />
                        <span className="text-xs font-medium tracking-tight text-foreground">
                          {tagsCount} {tagsCount === 1 ? 'Tag' : 'Tags'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleQuickAdd('tags', e)}
                          className="size-5.5 rounded flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                          aria-label="Add tag"
                        >
                          <Plus className="size-3.5 text-foreground" />
                        </button>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-foreground transition-transform duration-200 shrink-0",
                            isSectionOpen('tags') && "rotate-180"
                          )}
                        />
                      </div>
                    </div>
                    {isSectionOpen('tags') && (
                      <div className="px-3.5 py-2.5 bg-background">
                        <TagsSection
                          paper={paper}
                          onUpdateTags={handleUpdateTags}
                          forceAdding={addingSection === 'tags'}
                          hideHeader
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Inset Divider Line */}
                <div className="mx-3.5 border-t border-border/50" />

                {/* 7. Related Items Section (CLOSED by default) */}
                {visibleSections['relations'] && (
                  <div
                    ref={(el) => {
                      sectionRefs.current['relations'] = el;
                    }}
                    id="inspector-section-relations"
                    className="scroll-mt-1 bg-background"
                  >
                    <div
                      onClick={() => toggleSection('relations', relationsCount)}
                      className={cn(
                        "flex items-center justify-between px-3.5 py-2 min-h-[34px] hover:bg-muted/60 transition-colors select-none group bg-background",
                        relationsCount > 0 || addingSection === 'relations' ? "cursor-pointer" : "cursor-default"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Share2 className="size-4 text-foreground shrink-0" />
                        <span className="text-xs font-medium tracking-tight text-foreground">
                          {relationsCount} Related
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleQuickAdd('relations', e)}
                          className="size-5.5 rounded flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                          aria-label="Add related paper"
                        >
                          <Plus className="size-3.5 text-foreground" />
                        </button>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-foreground transition-transform duration-200 shrink-0",
                            isSectionOpen('relations') && "rotate-180"
                          )}
                        />
                      </div>
                    </div>
                    {isSectionOpen('relations') && (
                      <div className="px-3.5 py-2.5 bg-background">
                        <RelatedSection
                          paper={paper}
                          workspaceId={workspaceId}
                          forceAdding={addingSection === 'relations'}
                          hideHeader
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Inset Divider Line */}
                <div className="mx-3.5 border-t border-border/50" />

                {/* 8. Cite Section (CLOSED by default) */}
                {visibleSections['cite'] && (
                  <div
                    ref={(el) => {
                      sectionRefs.current['cite'] = el;
                    }}
                    id="inspector-section-cite"
                    className="scroll-mt-1 bg-background"
                  >
                    <div
                      onClick={() => toggleSection('cite')}
                      className="flex items-center justify-between px-3.5 py-2 min-h-[34px] hover:bg-muted/60 transition-colors cursor-pointer select-none group bg-background"
                    >
                      <div className="flex items-center gap-2">
                        <Quote className="size-4 text-foreground shrink-0" />
                        <span className="text-xs font-medium tracking-tight text-foreground">
                          Citations
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-foreground transition-transform duration-200 shrink-0",
                          isSectionOpen('cite') && "rotate-180"
                        )}
                      />
                    </div>
                    {isSectionOpen('cite') && (
                      <div className="px-3.5 py-2.5 bg-background">
                        <CiteSection paper={paper} workspaceId={workspaceId} />
                      </div>
                    )}
                  </div>
                )}
              </div>
        </div>
      )}

      {/* Vertical Tab Strip on Right Edge - Integrated into page container */}
      <div
        role="tablist"
        aria-label="Inspector sections"
        className="w-10 shrink-0 border-l border-border/50 flex flex-col items-center bg-background select-none h-full"
      >
        {/* Top Toggle Button Header - Exactly h-11 (44px) aligned with Topbar & Paper Title header */}
        <div className="h-11 w-full flex items-center justify-center relative shrink-0">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (isInspectorOpen && onClose && paper) {
                      toggleInspector();
                    } else {
                      toggleInspector();
                    }
                  }}
                  className="size-8 rounded-md flex items-center justify-center text-foreground bg-transparent hover:bg-transparent cursor-pointer focus-visible:outline-none"
                  aria-label={isInspectorOpen ? "Collapse inspector" : "Expand inspector"}
                >
                  <InspectorPaneIcon className="size-4 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs py-1 px-2 font-medium">
                {isInspectorOpen ? "Collapse inspector" : "Expand inspector"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Inset separator line: exactly at bottom edge of h-11, aligning with topbar horizontal line */}
          <div className="absolute bottom-0 w-5 h-px bg-border/60" />
        </div>

        {/* Section Icons (Jump / Navigate directly to Section) */}
        <div className="flex-1 w-full flex flex-col items-center py-3 gap-3.5 overflow-y-auto thin-scrollbar">
          {SECTIONS_CONFIG.map((sec) => {
            const Icon = sec.icon;
            const tooltipLabel = sec.label;

            return (
              <TooltipProvider key={sec.id} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      role="tab"
                      id={`inspector-tab-${sec.id}`}
                      tabIndex={0}
                      onClick={() => handleJumpToSection(sec.id)}
                      className="size-8 rounded-md flex items-center justify-center relative cursor-pointer outline-none text-foreground shadow-none bg-transparent hover:bg-transparent"
                      aria-label={tooltipLabel}
                    >
                      <Icon className="size-4 text-foreground" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs py-1 px-2 font-medium">
                    {tooltipLabel}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
