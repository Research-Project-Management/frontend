'use client';

import React, { useState, useMemo } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  Badge,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/shared/components/ui";
import { BookOpen, FileText, AlertTriangle } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import type { Item } from '@/features/library/types/library.types';
import { formatCitationSnippet, formatItemAuthorSummary } from '../../utils/citation.util';
import { generateCitationKey } from '@/features/library/utils/bibtex.util';

export type CitationStyle =
  | 'latex-cite'
  | 'latex-citep'
  | 'latex-citet'
  | 'markdown-bracket'
  | 'markdown-inline';

interface CitationPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
  onSelectCitation: (snippet: string, citeKey: string) => void;
  defaultStyle?: CitationStyle;
}

const STYLE_OPTIONS: { id: CitationStyle; label: string; preview: string }[] = [
  { id: 'latex-cite', label: '\\cite', preview: '\\cite{key}' },
  { id: 'latex-citep', label: '\\citep', preview: '\\citep{key}' },
  { id: 'latex-citet', label: '\\citet', preview: '\\citet{key}' },
  { id: 'markdown-bracket', label: 'Pandoc', preview: '[@key]' },
];

export default function CitationPickerModal({
  open,
  onOpenChange,
  items,
  onSelectCitation,
  defaultStyle = 'latex-cite',
}: CitationPickerModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>(defaultStyle);
  const [search, setSearch] = useState('');

  const validItems = useMemo(() => {
    return items.map((item) => {
      const key = item.citationKey || generateCitationKey(item);
      return {
        ...item,
        resolvedCitationKey: key,
      };
    });
  }, [items]);

  const [interceptedItem, setInterceptedItem] = useState<(Item & { resolvedCitationKey: string }) | null>(null);

  const confirmInsert = (resolvedKey: string) => {
    const snippet = formatCitationSnippet(resolvedKey, selectedStyle);
    onSelectCitation(snippet, resolvedKey);
    setInterceptedItem(null);
    onOpenChange(false);
  };

  const handleSelectItem = (item: Item & { resolvedCitationKey: string }) => {
    if (item.isRetracted) {
      setInterceptedItem(item);
      return;
    }
    confirmInsert(item.resolvedCitationKey);
  };

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Insert Citation"
        description="Search library items and insert citation snippet"
        className="max-w-2xl rounded-lg border border-border "
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border bg-muted">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-foreground shrink-0" />
            <span className="text-13 font-semibold text-foreground">Insert Citation</span>
          </div>
          {/* Style selector pills */}
          <div className="flex items-center gap-1 bg-background p-0.5 rounded-md border border-border">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedStyle(opt.id)}
                className={cn(
                  'px-2 py-0.5 text-11 font-mono rounded-md transition-colors',
                  selectedStyle === opt.id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                title={opt.preview}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <CommandInput
          placeholder="Search by title, author, year, or citation key..."
          value={search}
          onValueChange={setSearch}
          className="h-11 text-13"
        />

        <CommandList className="max-h-80 overflow-y-auto p-1">
          <CommandEmpty className="py-8 text-center text-13 text-muted-foreground">
            No matching papers found in your library.
          </CommandEmpty>

          <CommandGroup heading={`Workspace Library (${validItems.length})`}>
            {validItems.map((item) => {
              const authorSummary = formatItemAuthorSummary(item);
              const yearStr = item.year ? ` (${item.year})` : '';

              return (
                <CommandItem
                  key={item.id || item.resolvedCitationKey}
                  value={`${item.resolvedCitationKey} ${item.title || ''} ${item.authors?.join(' ') || ''} ${item.year || ''}`}
                  onSelect={() => handleSelectItem(item)}
                  className={cn(
                    'flex items-start justify-between gap-3 px-3 py-2.5 rounded-md cursor-pointer data-[selected=true]:bg-muted transition-colors',
                    item.isRetracted && 'border-l-2 border-destructive pl-2.5',
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {item.isRetracted ? (
                      <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className={cn(
                        'text-13 font-medium truncate leading-snug',
                        item.isRetracted ? 'text-destructive font-semibold' : 'text-foreground',
                      )}>
                        {item.title || 'Untitled Item'}
                      </p>
                      <p className="text-11 text-muted-foreground truncate">
                        {authorSummary}{yearStr}
                        {item.journal && <span> · {item.journal}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {item.isRetracted && (
                      <Badge
                        variant="destructive"
                        className="font-mono text-10 px-1.5 py-0 bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20 gap-1 flex items-center"
                      >
                        <AlertTriangle className="size-3 shrink-0" />
                        <span>RETRACTED</span>
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="font-mono text-11 px-1.5 py-0 border-border bg-muted text-foreground"
                    >
                      {item.resolvedCitationKey}
                    </Badge>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Retraction Warning Interception Confirmation Modal */}
      <AlertDialog
        open={Boolean(interceptedItem)}
        onOpenChange={(openVal) => {
          if (!openVal) setInterceptedItem(null);
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive font-semibold text-15">
              <AlertTriangle className="size-5 shrink-0" />
              <span>Warning: Retracted Publication Cited</span>
            </div>
            <AlertDialogDescription className="text-13 space-y-3 pt-2 text-foreground/90">
              <p>
                The paper <strong className="text-foreground font-semibold">"{interceptedItem?.title || 'Untitled'}"</strong> has been officially flagged as <span className="text-destructive font-semibold uppercase">{interceptedItem?.retractionNature || 'retracted'}</span>.
              </p>

              {interceptedItem?.retractionDetails?.reason && (
                <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-12 text-destructive">
                  <strong>Stated Reason:</strong> {interceptedItem.retractionDetails.reason}
                </div>
              )}

              {interceptedItem?.retractionDetails?.noticeUrl && (
                <p className="text-12 text-muted-foreground">
                  Official Notice:{' '}
                  <a
                    href={interceptedItem.retractionDetails.noticeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-primary hover:text-primary/80"
                  >
                    View Publisher Statement
                  </a>
                </p>
              )}

              <p className="text-12 text-muted-foreground">
                Citing retracted research without explicit discussion of its flaws can undermine the scientific integrity of your manuscript. Are you sure you wish to insert this citation?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel onClick={() => setInterceptedItem(null)}>
              Cancel (Recommended)
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (interceptedItem) {
                  confirmInsert(interceptedItem.resolvedCitationKey);
                }
              }}
            >
              Insert Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
