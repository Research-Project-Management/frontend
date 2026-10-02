'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  Badge,
} from "@/shared/components/ui";
import { BookOpen, FileText, Copy, Loader2, Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatCitationSnippet } from '../../utils/citation.util';
import type { BibEntry } from '@/features/editor/utils/bib-parser.util';
import { manuscriptService, type BibEntryDto } from '@/features/editor/services/manuscript.service';

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
  projectId?: string;
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
  projectId,
}: CitationPickerModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>(defaultStyle);
  const [search, setSearch] = useState('');
  const [serverItems, setServerItems] = useState<BibEntry[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  // Search backend manuscript citations if projectId is present
  useEffect(() => {
    if (!projectId || !open || search.trim().length < 2) {
      setServerItems([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        const results = await manuscriptService.citations.search(projectId, search.trim(), 20);
        if (active && Array.isArray(results)) {
          const mapped: BibEntry[] = results.map((r: BibEntryDto) => ({
            key: r.key,
            type: r.type || 'article',
            title: r.title,
            authors: r.author ? [r.author] : undefined,
            year: r.year,
            journal: r.journal,
            doi: r.doi,
          }));
          setServerItems(mapped);
        }
      } catch (err) {
        // Non-blocking fallback to local bib entries
      } finally {
        if (active) setIsSearchingServer(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, projectId, search]);

  // Merge local parsed items and backend results without duplicates
  const validItems = useMemo(() => {
    const map = new Map<string, BibEntry>();
    for (const item of items) {
      if (item.key) map.set(item.key.toLowerCase(), item);
    }
    for (const sItem of serverItems) {
      if (sItem.key && !map.has(sItem.key.toLowerCase())) {
        map.set(sItem.key.toLowerCase(), sItem);
      }
    }
    return Array.from(map.values());
  }, [items, serverItems]);

  const handleSelectItem = (entry: BibEntry) => {
    const snippet = formatCitationSnippet(entry.key, selectedStyle);
    onSelectCitation(snippet, entry.key);
    onOpenChange(false);
  };

  // Check if search query matches DOI or arXiv identifier
  const isIdentifier = useMemo(() => {
    const trimmed = search.trim();
    return (
      /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(trimmed) ||
      /^(arxiv:)?\d{4}\.\d{4,5}(v\d+)?$/i.test(trimmed)
    );
  }, [search]);

  const handleResolveIdentifier = async () => {
    if (!projectId || !search.trim()) return;
    setIsResolving(true);
    try {
      const res = await manuscriptService.citations.resolve(projectId, search.trim());
      if (res?.entry?.key) {
        toast.success(`Resolved BibTeX for ${res.entry.key}`);
        const snippet = formatCitationSnippet(res.entry.key, selectedStyle);
        onSelectCitation(snippet, res.entry.key);
        onOpenChange(false);
      } else {
        toast.error('Identifier could not be resolved');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resolve academic identifier');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Insert Citation"
        description="Search .bib file entries and insert citation snippet"
        className="max-w-2xl rounded-lg border border-border shadow-raised-300"
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-foreground shrink-0" />
            <span className="text-13 font-semibold text-foreground">Insert Citation</span>
          </div>
          {/* Style selector pills */}
          <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-md border border-border">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedStyle(opt.id)}
                className={`px-2 py-0.5 text-11 font-mono rounded-sm transition-colors cursor-pointer ${
                  selectedStyle === opt.id
                    ? 'bg-background text-foreground shadow-2xs font-medium'
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
          {isIdentifier && projectId && (
            <div className="p-2.5 mb-1 rounded-md border border-primary/20 bg-primary/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="size-4 text-primary shrink-0" />
                <span className="text-xs truncate">
                  Resolve academic identifier <strong className="font-mono text-primary">{search.trim()}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleResolveIdentifier}
                disabled={isResolving}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-primary text-primary-foreground text-xs font-medium cursor-pointer hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    <span>Resolving…</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3" />
                    <span>Resolve & Append</span>
                  </>
                )}
              </button>
            </div>
          )}

          <CommandEmpty className="py-8 text-center text-13 text-muted-foreground">
            {isSearchingServer ? 'Searching citations…' : 'No matching entries found in .bib files.'}
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(entry.key);
                        toast.success(`Copied key "${entry.key}"`);
                      }}
                      className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="Copy citation key to clipboard"
                    >
                      <Copy className="size-3" />
                    </button>
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