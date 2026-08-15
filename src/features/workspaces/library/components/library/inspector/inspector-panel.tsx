'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  FileCode,
  Tag,
  BookOpen,
  Paperclip,
  Bookmark,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import InfoSection from './sections/info-section';
import NotesSection from './sections/notes-section';
import TagsSection from './sections/tags-section';
import CiteSection from './sections/cite-section';
import FilesSection from './sections/files-section';
import { usePapers } from '../../../hooks/data/use-papers';
import type { Paper, Collection } from '../../../types/library.types';

interface InspectorPanelProps {
  paper: Paper | null;
  collection?: Collection | null;
  workspaceId: string;
  onClose?: () => void;
}

type TabType = 'info' | 'notes' | 'tags' | 'cite' | 'files';

export default function InspectorPanel({
  paper,
  collection,
  workspaceId,
  onClose,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const paperService = usePapers({ workspaceId });

  if (!paper) return null;

  const handleUpdatePaper = (data: Partial<Paper>) => {
    paperService.actions.updatePaper(
      {
        paperId: paper._id,
        ...data,
      },
      {
        onSuccess: () => toast.success('Paper details updated'),
        onError: () => toast.error('Failed to update details'),
      }
    );
  };

  const handleAddNote = (content: string) => {
    const currentNotes = (paper.notes || []).map((n) => ({
      _id: n._id,
      content: n.content,
    }));
    paperService.actions.updatePaper(
      {
        paperId: paper._id,
        notes: [...currentNotes, { content }] as any,
      },
      {
        onSuccess: () => toast.success('Note added'),
        onError: () => toast.error('Failed to add note'),
      }
    );
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = (paper.notes || [])
      .filter((n) => n._id !== noteId)
      .map((n) => ({ _id: n._id, content: n.content }));
    paperService.actions.updatePaper(
      {
        paperId: paper._id,
        notes: updatedNotes as any,
      },
      {
        onSuccess: () => toast.success('Note deleted'),
        onError: () => toast.error('Failed to delete note'),
      }
    );
  };

  const handleUpdateNote = (noteId: string, content: string) => {
    const updatedNotes = (paper.notes || []).map((n) =>
      n._id === noteId ? { _id: n._id, content } : { _id: n._id, content: n.content }
    );
    paperService.actions.updatePaper(
      {
        paperId: paper._id,
        notes: updatedNotes as any,
      },
      {
        onSuccess: () => toast.success('Note updated'),
        onError: () => toast.error('Failed to update note'),
      }
    );
  };

  const handleUpdateTags = (tags: string[]) => {
    paperService.actions.updatePaper(
      {
        paperId: paper._id,
        labels: tags,
      },
      {
        onSuccess: () => toast.success('Tags updated'),
        onError: () => toast.error('Failed to update tags'),
      }
    );
  };

  return (
    <aside
      aria-label="Paper details inspector"
      className="w-96 min-w-[360px] max-w-[420px] h-full border-l border-border/50 bg-background flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Header bar */}
      <div className="h-14 px-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-background/80 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="size-6 rounded flex items-center justify-center bg-primary/10 text-primary shrink-0">
            <FileText className="size-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground truncate" title={paper.title}>
            {paper.title || 'Untitled Reference'}
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Close inspector"
            aria-label="Close inspector"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Tabs navigation bar (Zotero 7 inspector tabs) */}
      <div className="flex items-center border-b border-border/40 bg-muted/20 px-2 py-1 gap-1 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'info'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="size-3.5" />
          <span>Info</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'notes'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bookmark className="size-3.5" />
          <span>Notes</span>
          {paper.notes && paper.notes.length > 0 && (
            <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
              {paper.notes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('tags')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'tags'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Tag className="size-3.5" />
          <span>Tags</span>
          {paper.labels && paper.labels.length > 0 && (
            <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
              {paper.labels.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cite')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'cite'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Share2 className="size-3.5" />
          <span>Cite</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'files'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Paperclip className="size-3.5" />
          <span>Files</span>
        </button>
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'info' && (
          <InfoSection paper={paper} onUpdatePaper={handleUpdatePaper} />
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

        {activeTab === 'cite' && (
          <CiteSection paper={paper} />
        )}

        {activeTab === 'files' && (
          <FilesSection paper={paper} />
        )}
      </div>
    </aside>
  );
}
