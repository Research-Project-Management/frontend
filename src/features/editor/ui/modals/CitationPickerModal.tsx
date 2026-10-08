'use client';

/**
 * CitationPickerModal.tsx
 *
 * Fast Overleaf-Parity Citation Inserter Modal (Ctrl+Shift+K / Cmd+Shift+K).
 * Location: `features/editor/ui/modals/CitationPickerModal.tsx`
 *
 * Architecture & Features:
 * - Instant diacritic-insensitive fuzzy search matching Vietnamese and international authors, titles, years, and keys.
 * - Displays unified references across project .bib files and the Workspace Digital Library.
 * - Allows switching insertion style: \cite{key}, \citep{key}, \citet{key}, \autocite{key}, or [@key].
 * - Overleaf Parity Auto-Sync: When inserting a reference from the Digital Library that is not yet in the project's
 *   .bib file, automatically appends the BibTeX entry to references.bib so LaTeX compilers (pdflatex, latexmk)
 *   can compile cleanly without undefined citation warnings.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookText, Library, Check, Sparkles, Edit2 } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/shared/components/ui/command';
import { cn } from '@/shared/lib/utils';
import { usePageStore } from '@/features/editor/store';
import { filesQuery } from '@/features/editor/ui/hooks/use-core';
import { useEditorCitations } from '@/features/editor/ui/hooks/use-citation';
import { latexSymbolsIndex, type BibEntry } from '@/features/editor/domain/latex/latex-symbols-index';
import {
  formatShortAuthor,
  formatItemToBibtex,
  formatBibEntryToBibtex,
} from '@/features/editor/domain/citation/citation-formatter';
import {
  getActiveEditorEngine,
  editorCommandBus,
} from '@/features/editor/coordinators/command-bus';
import { workspaceCoordinator } from '@/features/editor/coordinators/workspace.coordinator';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';

export type CitationStyleMacro = 'cite' | 'citep' | 'citet' | 'autocite' | 'markdown';

interface CitationPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

export default function CitationPickerModal({
  open,
  onOpenChange,
  initialQuery = '',
}: CitationPickerModalProps) {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const storeProjectId = usePageStore((s) => s.projectId);

  const rootId = currentPage?.id || params?.pageId || '';
  const projectId =
    params?.projectId ||
    storeProjectId ||
    (typeof currentPage?.projectId === 'string' ? currentPage.projectId : currentPage?.projectId?.id) ||
    '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedStyle, setSelectedStyle] = useState<CitationStyleMacro>('cite');

  // Load project files to identify .bib files
  const { data: projectFiles = [] } = useQuery({
    ...filesQuery(rootId),
    enabled: Boolean(rootId) && open,
  });

  // Load workspace library items
  const { libraryItems } = useEditorCitations({
    projectId,
    enabled: open,
  });

  // Filter citations using Vietnamese diacritic-insensitive fuzzy search from latexSymbolsIndex
  const matchingCitations = useMemo(() => {
    return latexSymbolsIndex.getCitations(searchQuery);
  }, [searchQuery, libraryItems, open]);

  // Split into project .bib vs workspace library
  const { projectBibCitations, libraryCitations } = useMemo(() => {
    const bib: BibEntry[] = [];
    const lib: BibEntry[] = [];

    for (const c of matchingCitations) {
      if (c.sourceFile === 'workspace-library') {
        lib.push(c);
      } else {
        bib.push(c);
      }
    }

    return { projectBibCitations: bib, libraryCitations: lib };
  }, [matchingCitations]);

  /**
   * Appends a missing BibTeX entry to references.bib or the primary project .bib file (Overleaf parity)
   */
  const ensureBibtexInProject = useCallback(
    async (entry: BibEntry) => {
      if (!projectId) return;

      const bibFiles = (projectFiles as any[]).filter((f) => {
        const title = (f.title || f.name || '').toLowerCase();
        return title.endsWith('.bib');
      });

      const primaryBib = bibFiles[0];

      // Generate clean BibTeX code
      let bibCode = '';
      const matchedLibItem = libraryItems.find(
        (it) => (it.citationKey || it.id)?.toLowerCase() === entry.key.toLowerCase()
      );

      if (matchedLibItem) {
        bibCode = formatItemToBibtex(matchedLibItem);
      } else {
        bibCode = formatBibEntryToBibtex(entry as any);
      }

      if (!bibCode) return;

      if (primaryBib) {
        const currentContent = primaryBib.content || '';
        // If key already present in file, no need to duplicate
        if (new RegExp(`@\\w+\\s*\\{\\s*${entry.key}\\s*,`, 'i').test(currentContent)) {
          return;
        }

        const newContent = currentContent ? `${currentContent.trim()}\n\n${bibCode}\n` : `${bibCode}\n`;
        sessionCoordinator.notifyContentChange(primaryBib.id, newContent);
        toast.success(`Đã tự động thêm @${entry.key} vào ${primaryBib.title || 'references.bib'}`);
      } else {
        // Create references.bib if project does not have any .bib file yet
        await workspaceCoordinator.createFile({
          name: 'references.bib',
          content: `${bibCode}\n`,
          openAfterCreate: false,
        });
        toast.success(`Đã khởi tạo references.bib và thêm @${entry.key}`);
      }
    },
    [projectId, projectFiles, libraryItems]
  );

  /**
   * Inserts the chosen citation macro into the editor and ensures .bib parity
   */
  const handleSelectCitation = useCallback(
    async (entry: BibEntry) => {
      const key = entry.key;
      let snippet = `\\cite{${key}}`;

      switch (selectedStyle) {
        case 'citep':
          snippet = `\\citep{${key}}`;
          break;
        case 'citet':
          snippet = `\\citet{${key}}`;
          break;
        case 'autocite':
          snippet = `\\autocite{${key}}`;
          break;
        case 'markdown':
          snippet = `[@${key}]`;
          break;
        case 'cite':
        default:
          snippet = `\\cite{${key}}`;
          break;
      }

      // 1. Insert into active editor
      const engine = getActiveEditorEngine();
      if (engine) {
        engine.insertText(snippet);
        engine.focus();
      } else {
        editorCommandBus.dispatch({ type: 'editor:insert-text', text: snippet });
        editorCommandBus.dispatch({ type: 'editor:focus' });
      }

      toast.success(`Đã chèn ${snippet}`);

      // 2. Overleaf Parity: If citation came from digital library, sync into project .bib
      if (entry.sourceFile === 'workspace-library') {
        void ensureBibtexInProject(entry);
      }

      onOpenChange(false);
    },
    [selectedStyle, ensureBibtexInProject, onOpenChange]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Insert Citation"
      description="Tìm kiếm và chèn trích dẫn tài liệu tham khảo theo chuẩn Overleaf"
      className="max-w-2xl"
    >
      {/* Search Input */}
      <CommandInput
        placeholder="Tìm theo tên tác giả tiếng Việt, tiêu đề, năm hoặc citekey..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />

      {/* Style Selector Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 text-xs select-none">
        <span className="text-muted-foreground font-medium flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" />
          <span>Kiểu trích dẫn:</span>
        </span>
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'cite', label: '\\cite' },
              { id: 'citep', label: '\\citep' },
              { id: 'citet', label: '\\citet' },
              { id: 'autocite', label: '\\autocite' },
              { id: 'markdown', label: '[@key]' },
            ] as const
          ).map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setSelectedStyle(style.id)}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer',
                selectedStyle === style.id
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Citation List */}
      <CommandList className="max-h-96 p-1.5">
        <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">
          Không tìm thấy tài liệu trích dẫn nào phù hợp với từ khóa.
        </CommandEmpty>

        {/* Group 1: Project .bib Files */}
        {projectBibCitations.length > 0 && (
          <CommandGroup heading={`Tệp trong dự án (.bib) — ${projectBibCitations.length}`}>
            {projectBibCitations.map((entry) => (
              <CitationItemRow
                key={entry.key}
                entry={entry}
                onSelect={() => handleSelectCitation(entry)}
                onRename={() => {
                  onOpenChange(false);
                  editorCommandBus.dispatch({
                    type: 'dialog:open',
                    dialog: 'rename-symbol',
                    payload: { type: 'citation', oldKey: entry.key },
                  });
                }}
              />
            ))}
          </CommandGroup>
        )}

        {/* Group 2: Workspace Digital Library */}
        {libraryCitations.length > 0 && (
          <CommandGroup heading={`Thư viện số Workspace — ${libraryCitations.length}`}>
            {libraryCitations.map((entry) => (
              <CitationItemRow
                key={entry.key}
                entry={entry}
                isLibrary
                onSelect={() => handleSelectCitation(entry)}
                onRename={() => {
                  onOpenChange(false);
                  editorCommandBus.dispatch({
                    type: 'dialog:open',
                    dialog: 'rename-symbol',
                    payload: { type: 'citation', oldKey: entry.key },
                  });
                }}
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function CitationItemRow({
  entry,
  isLibrary = false,
  onSelect,
  onRename,
}: {
  entry: BibEntry;
  isLibrary?: boolean;
  onSelect: () => void;
  onRename?: () => void;
}) {
  const authorStr = formatShortAuthor(entry.author);
  const typeStr = (entry.type || 'article').toUpperCase();

  return (
    <CommandItem
      value={`${entry.key} ${entry.title} ${entry.author || ''} ${entry.year || ''}`}
      onSelect={onSelect}
      onClick={onSelect}
      className="flex items-start justify-between p-2.5 text-xs rounded-md cursor-pointer hover:bg-accent/60 gap-3"
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <div className="mt-0.5 shrink-0 text-muted-foreground">
          {isLibrary ? <Library className="size-4 text-primary" /> : <BookText className="size-4 text-foreground/80" />}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.2 rounded">
              @{entry.key}
            </span>
            {entry.isRetracted && (
              <span className="text-[10px] font-bold text-destructive bg-destructive/15 border border-destructive/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                🚨 Thu hồi
              </span>
            )}
            <span className="text-[10px] uppercase font-semibold text-muted-foreground border border-border px-1 rounded">
              {typeStr}
            </span>
            {entry.year && (
              <span className="text-[11px] text-muted-foreground">
                ({entry.year})
              </span>
            )}
            {authorStr && (
              <span className="text-[11px] font-medium text-foreground/90 truncate max-w-[200px]">
                {authorStr}
              </span>
            )}
          </div>
          <div className="font-medium text-foreground line-clamp-1 leading-snug">
            {entry.title || 'Tài liệu không tên'}
          </div>
          {entry.journal && (
            <div className="text-[11px] text-muted-foreground italic truncate">
              {entry.journal}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2 self-center">
        {onRename && (
          <button
            type="button"
            title="Đổi tên khóa trích dẫn trong dự án (Refactor)"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRename();
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
          >
            <Edit2 className="size-3" />
          </button>
        )}
        <span className="text-[10px] text-muted-foreground/80 font-mono hidden sm:inline">
          Enter để chèn
        </span>
      </div>
    </CommandItem>
  );
}
