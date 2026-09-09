'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  BookMarked,
  Search as SearchIcon,
  Copy,
  Check,
  Plus,
  AlertCircle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { usePageStore } from '@/features/editor/store/page.store';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useEditorCitations } from '@/features/editor/hooks/use-editor-citations';
import { generateCitationKey } from '@/features/workspaces/library/utils/bibtex.util';
import type { CatalogItem } from '@/features/workspaces/library/types/library.types';

interface CitationTabProps {
  onClose?: () => void;
}

export default function CitationTab({ onClose }: CitationTabProps) {
  const params = useParams<{ workspaceId?: string }>();
  const workspaceId = params?.workspaceId || '';
  const { getEditorContent, editorRef } = usePageStore();

  const [content, setContent] = useState<string>('');
  const [libraryQuery, setLibraryQuery] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync content from editor
  const refreshContent = useCallback(() => {
    const current = getEditorContent.current?.() ?? '';
    setContent(current);
  }, [getEditorContent]);

  useEffect(() => {
    refreshContent();
    const timer = setInterval(refreshContent, 2000);
    return () => clearInterval(timer);
  }, [refreshContent]);

  const {
    citedItems,
    missingKeys,
    libraryItems,
    isLoading,
    getAuthorSummary,
  } = useEditorCitations({
    workspaceId,
    content,
    enabled: Boolean(workspaceId),
  });

  const filteredLibrary = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return libraryItems;
    return libraryItems.filter((item: CatalogItem) => {
      const key = (item.citationKey || '').toLowerCase();
      const title = (item.title || '').toLowerCase();
      const authors = (item.authors || []).join(' ').toLowerCase();
      const year = String(item.year || '');
      return key.includes(q) || title.includes(q) || authors.includes(q) || year.includes(q);
    });
  }, [libraryItems, libraryQuery]);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(`\\cite{${key}}`);
    setCopiedKey(key);
    toast.success(`Copied \\cite{${key}} to clipboard`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleInsertKey = (key: string) => {
    const ed = editorRef.current;
    if (ed) {
      const sel = ed.getSelection();
      if (sel) {
        ed.executeEdits('citation-tab', [
          {
            range: sel,
            text: `\\cite{${key}}`,
            forceMoveMarkers: true,
          },
        ]);
        ed.focus();
        toast.success(`Inserted \\cite{${key}}`);
        refreshContent();
        return;
      }
    }
    // Fallback: emit event
    EditorEventBus.emit('flux:insert-citation', { bibKey: key });
    toast.success(`Inserted \\cite{${key}}`);
  };

  const openPickerModal = () => {
    EditorEventBus.emit('flux:open-citation-picker');
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground select-none">
      {/* Tab Header */}
      <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-muted/30">
        <div className="flex items-center gap-2">
          <BookMarked className="size-4 text-primary" />
          <span className="text-13 font-semibold text-foreground">Citations</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openPickerModal}
            className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Insert citation from library"
          >
            <Plus className="size-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Close panel"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {/* Section 1: Cited in Document */}
        <div className="p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-11 font-medium text-muted-foreground">
              Cited in Document ({citedItems.length + missingKeys.length})
            </span>
          </div>

          {citedItems.length === 0 && missingKeys.length === 0 ? (
            <div className="py-4 text-center rounded-md border border-dashed border-border p-3 text-11 text-muted-foreground">
              No citations found in this document yet. Type{' '}
              <code className="bg-muted px-1 py-0.5 rounded-sm font-mono text-foreground">\cite&#123;...&#125;</code>{' '}
              in editor or click + to insert.
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Successfully matched cited items */}
              {citedItems.map((item: CatalogItem) => {
                const key = item.citationKey || generateCitationKey(item);
                const isCopied = copiedKey === key;
                const authorYear = getAuthorSummary(item);

                return (
                  <div
                    key={item.id || key}
                    className="group p-2 rounded-md border border-border bg-card hover:bg-muted transition-colors space-y-1"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="text-12 font-medium text-foreground line-clamp-1 leading-snug flex-1">
                        {item.title || 'Untitled Item'}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-10 font-mono shrink-0 px-1 py-0 bg-muted text-foreground border-border"
                      >
                        {key}
                      </Badge>
                    </div>

                    <p className="text-11 text-muted-foreground truncate">
                      {authorYear} {item.year ? `(${item.year})` : ''}
                    </p>

                    <div className="pt-1 flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleCopyKey(key)}
                        className="h-6 px-1.5 flex items-center gap-1 rounded-md text-11 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Copy cite command"
                      >
                        {isCopied ? <Check className="size-3 text-emerald-500 shrink-0" /> : <Copy className="size-3 shrink-0" />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertKey(key)}
                        className="h-6 px-1.5 flex items-center gap-1 rounded-md text-11 bg-muted hover:bg-muted text-foreground transition-colors"
                        title="Insert \cite{key} at cursor"
                      >
                        <Plus className="size-3 shrink-0" />
                        <span>Insert</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Missing keys in document */}
              {missingKeys.map((mKey: string) => (
                <div
                  key={mKey}
                  className="p-2 rounded-md border border-border bg-muted space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertCircle className="size-3.5 text-destructive shrink-0" />
                      <span className="text-11 font-mono font-medium text-destructive truncate">
                        {mKey}
                      </span>
                    </div>
                    <Badge variant="destructive" className="text-9 px-1 py-0 font-medium">
                      Missing
                    </Badge>
                  </div>
                  <p className="text-10 text-muted-foreground">
                    This key is cited in your document but not found in your Workspace Library.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Workspace Library Browser */}
        <div className="p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-11 font-medium text-muted-foreground">
              Workspace Library ({libraryItems.length})
            </span>
          </div>

          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none shrink-0" />
            <Input
              type="text"
              placeholder="Search library papers..."
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              className="h-8 pl-8 pr-2 text-11 rounded-md border-border"
            />
          </div>

          {isLoading ? (
            <div className="py-6 text-center text-11 text-muted-foreground">
              Loading workspace library...
            </div>
          ) : filteredLibrary.length === 0 ? (
            <div className="py-6 text-center text-11 text-muted-foreground">
              {libraryQuery ? 'No matching papers found.' : 'Your workspace library is empty.'}
            </div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto pr-0.5">
              {filteredLibrary.map((item: CatalogItem) => {
                const key = item.citationKey || generateCitationKey(item);
                const authorYear = getAuthorSummary(item);

                return (
                  <div
                    key={item.id || key}
                    className="group flex items-start justify-between gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-12 font-medium text-foreground truncate leading-snug">
                        {item.title || 'Untitled Item'}
                      </p>
                      <p className="text-10 text-muted-foreground truncate">
                        <span className="font-mono text-primary font-medium">{key}</span>
                        {authorYear && <span> · {authorYear}</span>}
                        {item.year && <span> ({item.year})</span>}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInsertKey(key)}
                      className="shrink-0 size-7 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title={`Insert \\cite{${key}}`}
                    >
                      <Plus className="size-3.5 shrink-0" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
