'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  FileText,
  Bookmark,
  Share2,
  BookOpen,
  Tag,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import InfoSection from './sections/InfoSection';
import NotesSection from './sections/NotesSection';
import CiteSection from './sections/CiteSection';
import FilesSection from './sections/FilesSection';
import TagsSection from './sections/TagsSection';
import { usePapers } from '../../hooks/data/use-papers';
import { useLibrarySidebarStore } from '../../store/sidebar.store';
import { getLibraryEntityId, normalizeNotes } from '../../utils/library.util';
import { cn } from '@/shared/lib/utils';
import type { Paper, Collection } from '../../types/library.types';

interface InspectorPanelProps {
  paper: Paper | null;
  collection?: Collection | null;
  workspaceId: string;
  onClose?: () => void;
}

type TabType = 'info' | 'notes' | 'tags' | 'files' | 'cite';

const TABS: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'info', label: 'Details', icon: FileText },
  { id: 'notes', label: 'Notes', icon: Bookmark },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'files', label: 'Files', icon: Paperclip },
  { id: 'cite', label: 'Cite', icon: Share2 },
];

export default function InspectorPanel({
  paper,
  collection,
  workspaceId,
  onClose,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const paperService = usePapers({ workspaceId });
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams();

  const { inspectorWidth, setInspectorWidth } = useLibrarySidebarStore();

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
      setInspectorWidth(startWidthRef.current + deltaX);
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

  const paperId = getLibraryEntityId(paper);

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

  const notesCount = paper.notes?.length || 0;
  const tagsCount = (paper.labels?.length || 0) + (paper.keywords?.length || 0);
  const filesCount = paper.fileUrl ? 1 : 0;

  return (
    <aside
      aria-label="Paper details inspector"
      style={{
        width: `${inspectorWidth}px`,
        minWidth: '320px',
        maxWidth: '680px',
      }}
      className="relative h-full border-l border-border/50 bg-background flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Resizable drag handle on left edge */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 transition-colors z-30 select-none",
          isDragging && "bg-primary/50"
        )}
      />

      {/* Header bar */}
      <div className="h-14 px-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileText className="size-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate" title={paper.title}>
            {paper.title || 'Untitled Reference'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => paperId && router.push(`/${workspaceUrl}/library/papers/${paperId}`)}
            className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Open in Reader"
            aria-label="Open in Reader"
          >
            <BookOpen className="size-4 text-foreground" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close inspector"
              aria-label="Close inspector"
            >
              <X className="size-4 text-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs navigation bar */}
      <div className="flex items-center border-b border-border/30 bg-muted/20 px-2 py-1 gap-1 shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
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
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap',
                isActive
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-foreground/70 hover:text-foreground hover:bg-muted/40'
              )}
            >
              <Icon className="size-3.5 text-foreground" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-mono tabular-nums px-1 rounded-full',
                    isActive ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'info' && (
          <InfoSection
            key={paperId}
            paper={paper}
            onUpdatePaper={handleUpdatePaper}
            onUpdateTags={handleUpdateTags}
          />
        )}

        {activeTab === 'notes' && (
          <NotesSection
            key={paperId}
            paper={paper}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            onUpdateNote={handleUpdateNote}
          />
        )}

        {activeTab === 'tags' && (
          <TagsSection
            key={paperId}
            paper={paper}
            onUpdateTags={handleUpdateTags}
          />
        )}

        {activeTab === 'files' && (
          <FilesSection
            key={paperId}
            paper={paper}
          />
        )}

        {activeTab === 'cite' && (
          <CiteSection key={paperId} paper={paper} />
        )}
      </div>
    </aside>
  );
}
