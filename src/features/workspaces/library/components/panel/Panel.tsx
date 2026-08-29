'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  FileText,
  Paperclip,
  Bookmark,
  Tag,
  Share2,
  Quote,
  AlignLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import InfoSection from './sections/InfoSection';
import AbstractSection from './sections/AbstractSection';
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
import type { Paper, Collection } from '../../types/library.types';

interface InspectorPanelProps {
  paper: Paper | null;
  collection?: Collection | null;
  workspaceId: string;
  onClose?: () => void;
}

type TabType = 'info' | 'abstract' | 'notes' | 'tags' | 'files' | 'relations' | 'cite';

const TABS: {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'info', label: 'Info', icon: FileText },
  { id: 'abstract', label: 'Abstract', icon: AlignLeft },
  { id: 'notes', label: 'Notes', icon: Bookmark },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'files', label: 'Files', icon: Paperclip },
  { id: 'relations', label: 'Related', icon: Share2 },
  { id: 'cite', label: 'Cite', icon: Quote },
];

function InspectorTitleInput({
  title,
  onSave,
}: {
  title: string;
  onSave: (val: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [draft, adjustHeight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      adjustHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [adjustHeight]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) {
      onSave(trimmed);
    } else if (!trimmed && title) {
      setDraft(title);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      aria-label="Reference title"
      rows={1}
      onChange={(e) => {
        setDraft(e.target.value);
        adjustHeight();
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          commit();
          textareaRef.current?.blur();
        } else if (e.key === 'Escape') {
          setDraft(title);
          textareaRef.current?.blur();
        }
      }}
      className="w-full bg-transparent text-sm font-medium text-foreground tracking-tight leading-snug hover:bg-muted/30 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none resize-none overflow-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none break-words [overflow-wrap:anywhere] whitespace-pre-wrap select-text font-sans antialiased"
    />
  );
}

export default function InspectorPanel({
  paper,
  collection,
  workspaceId,
  onClose,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const paperService = usePapers({ workspaceId });

  const { inspectorWidth, setInspectorWidth } = useLibrarySidebarStore();
  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  if (!paper) return null;

  const paperId = paper.id;

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
    if (!paperId) return;
    const existingNotes = normalizeNotes(paper.notes).map((n: any) => n.content);
    paperService.actions.updatePaper(
      {
        paperId,
        notes: [...existingNotes, content] as any,
      },
      {
        onSuccess: () => toast.success('Note added'),
        onError: () => toast.error('Failed to add note'),
      }
    );
  };

  const handleDeleteNote = (noteId: string) => {
    if (!paperId) return;
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
    if (!paperId) return;
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
        onSuccess: () => toast.success('Tags updated'),
        onError: () => toast.error('Failed to update tags'),
      }
    );
  };

  // Keyboard navigation across tabs
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== index) {
      setActiveTab(TABS[nextIndex].id);
      tabButtonRefs.current[nextIndex]?.focus();
    }
  };

  const notesCount = paper.notes?.length || 0;
  const tagsCount = (paper.labels?.length || 0) + (paper.keywords?.length || 0);
  const supplementaryCount = (paper.attachments || []).filter((att: any) => {
    if (att.isPrimary || att.type === 'primary') return false;
    if (
      paper.fileUrl &&
      att.url &&
      (att.url === paper.fileUrl ||
        att.url.endsWith(paper.fileUrl) ||
        paper.fileUrl.endsWith(att.url))
    ) {
      return false;
    }
    if (paper.filename && att.filename && att.filename === paper.filename) {
      return false;
    }
    return true;
  }).length;
  const filesCount = (paper.fileUrl ? 1 : 0) + supplementaryCount;

  return (
    <aside
      aria-label="Paper details inspector"
      style={{
        width: `${inspectorWidth}px`,
        minWidth: '320px',
        maxWidth: '720px',
      }}
      className={cn(
        "relative h-full max-w-[100vw] sm:max-w-none border-l border-border/40 bg-background flex flex-col shrink-0 select-none overflow-hidden font-sans antialiased",
        isDragging && "select-none"
      )}
    >
      {/* Resizable drag handle on left edge with WAI-ARIA separator semantics & double-click reset */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={inspectorWidth}
        aria-valuemin={320}
        aria-valuemax={720}
        aria-label="Resize inspector panel (double-click to reset width)"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setInspectorWidth(380)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setInspectorWidth(Math.min(720, inspectorWidth + 20));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setInspectorWidth(Math.max(320, inspectorWidth - 20));
          }
        }}
        className={cn(
          "group absolute top-0 left-0 w-2 -ml-1 h-full cursor-col-resize z-30 select-none flex items-center justify-center transition-colors focus-visible:outline-none",
          isDragging ? "bg-primary/20" : "hover:bg-primary/10"
        )}
      >
        {/* Subtle grab handle bar indicator */}
        <div
          className={cn(
            "w-0.5 h-8 rounded-full transition-colors",
            isDragging
              ? "bg-primary"
              : "bg-transparent group-hover:bg-muted-foreground/40 group-focus-visible:bg-primary"
          )}
        />
      </div>

      {/* Header bar */}
      <header className="min-h-10 py-1 px-2.5 border-b border-border/50 flex items-start justify-between shrink-0 bg-transparent gap-2">
        <div className="flex-1 min-w-0 pt-0.5">
          <InspectorTitleInput
            title={paper.title || ''}
            onSave={(newTitle) => handleUpdatePaper({ title: newTitle })}
          />
        </div>

        <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
          {onClose && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label="Close inspector"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-[11px] py-1 px-2">
                  Close inspector
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </header>

      {/* WAI-ARIA Standard Segment Tabs (Info, Notes, Tags, Files, Related, Cite) */}
      <div
        role="tablist"
        aria-label="Inspector tabs"
        className="flex items-center border-b border-border/40 bg-transparent px-2 py-1 gap-1 shrink-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count =
            tab.id === 'notes'
              ? notesCount
              : tab.id === 'tags'
              ? tagsCount
              : tab.id === 'files'
              ? filesCount
              : 0;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabButtonRefs.current[idx] = el;
              }}
              role="tab"
              id={`inspector-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`inspector-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={cn(
                'relative flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                isActive
                  ? 'bg-muted text-foreground font-semibold border border-border/40 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <Icon className={cn("size-3.5 shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} aria-hidden="true" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-muted-foreground/15 text-xs font-mono font-medium tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* WAI-ARIA Standard Tab Panel Body */}
      <div
        role="tabpanel"
        id={`inspector-panel-${activeTab}`}
        aria-labelledby={`inspector-tab-${activeTab}`}
        tabIndex={0}
        className="flex-1 overflow-y-auto min-w-0 p-2 focus-visible:outline-none"
      >
        {activeTab === 'info' && (
          <InfoSection paper={paper} onUpdatePaper={handleUpdatePaper} />
        )}
        {activeTab === 'abstract' && (
          <AbstractSection paper={paper} onUpdatePaper={handleUpdatePaper} />
        )}
        {activeTab === 'notes' && (
          <NotesSection
            paper={paper}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            onUpdateNote={handleUpdateNote}
          />
        )}
        {activeTab === 'tags' && (
          <TagsSection paper={paper} onUpdateTags={handleUpdateTags} />
        )}
        {activeTab === 'files' && (
          <FilesSection paper={paper} />
        )}
        {activeTab === 'relations' && (
          <RelatedSection paper={paper} workspaceId={workspaceId} />
        )}
        {activeTab === 'cite' && (
          <CiteSection paper={paper} workspaceId={workspaceId} />
        )}
      </div>
    </aside>
  );
}
