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
} from "@/shared/components/ui";
import { BookOpen, FileText } from 'lucide-react';
import { formatCitationSnippet } from '../../utils/citation.util';
import type { BibEntry } from '@/features/editor/utils/bib-parser.util';

export type CitationStyle =
  | 'latex-cite'
  | 'latex-citep'
  | 'latex-citet'
  | 'markdown-bracket'
  | 'markdown-inline';

interface CitationPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BibEntry[];
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

  const validItems = useMemo(() => items, [items]);

  const handleSelectItem = (entry: BibEntry) => {
    const snippet = formatCitationSnippet(entry.key, selectedStyle);
    onSelectCitation(snippet, entry.key);
    onOpenChange(false);
  };

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Insert Citation"
        description="Search .bib file entries and insert citation snippet"
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
                className={`px-2 py-0.5 text-11 font-mono rounded-md transition-colors ${
                  selectedStyle === opt.id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
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
            No matching entries found in .bib files.
          </CommandEmpty>

          <CommandGroup heading={`Project Bibliography (${validItems.length})`}>
            {validItems.map((entry) => {
              const authorSummary = entry.authors?.join(', ') || '';
              const yearStr = entry.year ? ` (${entry.year})` : '';
              const venue = entry.journal || entry.booktitle || '';

              return (
                <CommandItem
                  key={entry.key}
                  value={`${entry.key} ${entry.title || ''} ${authorSummary} ${entry.year || ''}`}
                  onSelect={() => handleSelectItem(entry)}
                  className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-md cursor-pointer data-[selected=true]:bg-muted transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-13 font-medium truncate leading-snug text-foreground">
                        {entry.title || entry.key}
                      </p>
                      <p className="text-11 text-muted-foreground truncate">
                        {authorSummary}{yearStr}
                        {venue && <span> · {venue}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="font-mono text-11 px-1.5 py-0 border-border bg-muted text-foreground"
                    >
                      {entry.key}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="font-mono text-10 px-1.5 py-0 border-border bg-muted/50 text-muted-foreground"
                    >
                      {entry.type}
                    </Badge>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}