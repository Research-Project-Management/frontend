'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  FileText,
  AlignLeft,
  Paperclip,
  Bookmark,
  Tag,
  Share2,
  Quote,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
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

export default function InspectorPanel({
  paper,
  collection,
  workspaceId,
  onClose,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [copied, setCopied] = useState(false);
  const paperService = usePapers({ workspaceId });
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams();

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
        onSuccess: () => toast.success('Paper details updated'),
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

  const handleCopyCitationKey = () => {
    if (paper.citationKey) {
      navigator.clipboard.writeText(`\\cite{${paper.citationKey}}`);
      setCopied(true);
      toast.success(`Copied \\cite{${paper.citationKey}}`);
      setTimeout(() => setCopied(false), 2000);
    } else if (paper.title) {
      navigator.clipboard.writeText(paper.title);
      setCopied(true);
      toast.success('Copied title');
      setTimeout(() => setCopied(false), 2000);
    }
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
  const filesCount = paper.fileUrl ? 1 + (paper.attachments?.length || 0) : (paper.attachments?.length || 0);

  return (
    <aside
      aria-label="Paper details inspector"
      style={{
        width: `${inspectorWidth}px`,
        minWidth: '320px',
        maxWidth: '720px',
      }}
      className="relative h-full max-w-[100vw] sm:max-w-none border-l border-border/40 bg-background flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Resizable drag handle on left edge with WAI-ARIA separator semantics */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={inspectorWidth}
        aria-valuemin={320}
        aria-valuemax={720}
        aria-label="Resize inspector panel"
        tabIndex={0}
        onMouseDown={handleMouseDown}
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
          "absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none transition-colors z-30 select-none",
          isDragging && "bg-primary/50"
        )}
      />

      {/* Header bar */}
      <header className="h-12 px-3.5 border-b border-border/40 flex items-center justify-between shrink-0 bg-transparent gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2
            className="text-sm font-semibold text-foreground tracking-tight truncate select-text leading-tight"
            title={paper.title}
          >
            {paper.title || 'Untitled Reference'}
          </h2>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={handleCopyCitationKey}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            title={paper.citationKey ? `Copy \\cite{${paper.citationKey}}` : 'Copy title'}
            aria-label={paper.citationKey ? `Copy citation key ${paper.citationKey}` : 'Copy paper title'}
          >
            {copied ? <Check className="size-3.5 text-foreground" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          </button>

          <button
            onClick={() => paperId && router.push(`/${workspaceUrl}/library/papers/${paperId}`)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            title="Open in Reader"
            aria-label="Open in Reader"
          >
            <BookOpen className="size-3.5" aria-hidden="true" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              title="Close inspector"
              aria-label="Close inspector"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* WAI-ARIA Standard Segment Tabs (Info, Notes, Tags, Files, Related, Cite) */}
      <div
        role="tablist"
        aria-label="Inspector tabs"
        className="flex items-center border-b border-border/40 bg-transparent px-3 py-1.5 gap-1 shrink-0 overflow-x-auto scrollbar-none"
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
                'relative flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                isActive
                  ? 'bg-muted text-foreground font-semibold border border-border/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full',
                    isActive ? 'bg-background text-foreground font-semibold border border-border/30' : 'bg-muted/60 text-muted-foreground'
                  )}
                >
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
        className="flex-1 overflow-y-auto min-w-0 p-3 focus-visible:outline-none"
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
