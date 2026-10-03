'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  Input,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui';
import {
  Search,
  X,
  FileText,
  Copy,
  Loader2,
  Sparkles,
  Plus,
  SearchX,
  ChevronDown,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [serverItems, setServerItems] = useState<BibEntry[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => STYLE_OPTIONS.find((opt) => opt.id === selectedStyle) || STYLE_OPTIONS[0],
    [selectedStyle],
  );

  // Reset states when modal is opened
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
      setServerItems([]);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

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
      } catch {
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

  // Client-side filtering across fields
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return validItems;
    return validItems.filter((entry) => {
      const keyMatch = entry.key?.toLowerCase().includes(query);
      const titleMatch = entry.title?.toLowerCase().includes(query);
      const authorMatch = entry.authors?.some((a) => a.toLowerCase().includes(query));
      const yearMatch = entry.year?.toString().includes(query);
      const venueMatch =
        entry.journal?.toLowerCase().includes(query) ||
        entry.booktitle?.toLowerCase().includes(query);
      return Boolean(keyMatch || titleMatch || authorMatch || yearMatch || venueMatch);
    });
  }, [validItems, search]);

  // Check if search query matches DOI or arXiv identifier
  const isIdentifier = useMemo(() => {
    const trimmed = search.trim();
    return (
      /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(trimmed) ||
      /^(arxiv:)?\d{4}\.\d{4,5}(v\d+)?$/i.test(trimmed)
    );
  }, [search]);

  const handleSelectItem = (entry: BibEntry) => {
    const snippet = formatCitationSnippet(entry.key, selectedStyle);
    onSelectCitation(snippet, entry.key);
    onOpenChange(false);
  };

  const scrollToIndex = (index: number) => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${index}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = Math.min(prev + 1, Math.max(filteredItems.length - 1, 0));
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = Math.max(prev - 1, 0);
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      if (filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelectItem(filteredItems[selectedIndex]);
      }
    }
  };

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve academic identifier';
      toast.error(message);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl p-0 gap-0 overflow-hidden rounded-xl border border-border shadow-raised-400 bg-background"
      >
        {/* ── Modal Header (Không có line, chỉ chứa text Citation và icon X) ── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 bg-background">
          <DialogTitle className="text-13 font-semibold text-foreground tracking-tight">
            Citation
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Đóng"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>

        {/* ── Search Input & Dropdown Menu (Độ rộng vừa phải, text đen) ── */}
        <div className="flex items-center gap-2 px-5 pb-3">
          <div className="relative w-72 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search citations..."
              className="pl-9 pr-8 h-9 text-xs bg-background border-border/80 text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary shadow-2xs rounded-md"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedIndex(0);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Menu cho kiểu trích dẫn (Text màu đen/foreground, không có tiêu đề thừa) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-9 px-3 flex items-center gap-1.5 rounded-md border border-border/80 bg-background hover:bg-muted text-xs font-mono text-foreground shadow-2xs transition-colors shrink-0 cursor-pointer"
                title="Chọn kiểu trích dẫn"
              >
                <span className="font-medium text-foreground">{selectedOption.label}</span>
                <ChevronDown className="size-3.5 text-muted-foreground opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 p-1">
              {STYLE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.id}
                  onClick={() => setSelectedStyle(opt.id)}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-1.5 text-xs font-mono rounded-md cursor-pointer text-foreground',
                    selectedStyle === opt.id && 'bg-muted font-medium text-foreground',
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-foreground">{opt.label}</span>
                    <span className="text-10 text-muted-foreground font-sans">{opt.preview}</span>
                  </div>
                  {selectedStyle === opt.id && (
                    <Check className="size-3.5 text-foreground shrink-0 ml-2" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── DOI / arXiv Resolver Banner ── */}
        {isIdentifier && projectId && (
          <div className="mx-5 mb-2.5 p-2.5 rounded-md border border-primary/20 bg-primary/5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="size-4 text-primary shrink-0" />
              <span className="text-xs truncate text-foreground">
                Resolve academic identifier <strong className="font-mono">{search.trim()}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleResolveIdentifier}
              disabled={isResolving}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-primary text-primary-foreground text-xs font-medium cursor-pointer hover:bg-primary-hover disabled:opacity-50 transition-colors shrink-0 shadow-2xs"
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

        {/* ── Citation Entries List (Không có footer ở dưới) ── */}
        <div
          ref={listRef}
          className="max-h-[320px] min-h-[160px] overflow-y-auto px-5 pt-1 pb-4 space-y-1 sidebar-scrollbar"
        >
          {isSearchingServer && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span className="text-xs">Đang tìm kiếm trích dẫn…</span>
            </div>
          )}

          {!isSearchingServer && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground px-4 space-y-1.5">
              <div className="size-9 rounded-full bg-muted/60 flex items-center justify-center mb-1 text-muted-foreground/80">
                <SearchX className="size-4" />
              </div>
              <p className="text-xs font-medium text-foreground">Không tìm thấy trích dẫn phù hợp</p>
              <p className="text-11 text-muted-foreground max-w-xs">
                {search
                  ? `Không có mục nào khớp với "${search}".`
                  : 'Chưa có mục trích dẫn nào trong các tệp .bib của dự án.'}
              </p>
            </div>
          )}

          {!isSearchingServer &&
            filteredItems.map((entry, idx) => {
              const isSelected = idx === selectedIndex;
              const authorSummary = entry.authors?.join(', ') || '';
              const yearStr = entry.year ? ` (${entry.year})` : '';
              const venue = entry.journal || entry.booktitle || '';

              return (
                <div
                  key={entry.key}
                  data-index={idx}
                  onClick={() => handleSelectItem(entry)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'group flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border',
                    isSelected
                      ? 'bg-muted border-border/80'
                      : 'border-transparent hover:bg-muted/60',
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-foreground transition-colors" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-xs font-medium truncate leading-snug text-foreground">
                        {entry.title || entry.key}
                      </p>
                      <p className="text-11 text-muted-foreground truncate">
                        {authorSummary}
                        {yearStr}
                        {venue && <span> · {venue}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 self-center">
                    <Badge
                      variant="outline"
                      className="font-mono text-10 px-1.5 py-0.5 border-border bg-background text-foreground shadow-2xs"
                    >
                      {entry.key}
                    </Badge>
                    {entry.type && (
                      <Badge
                        variant="outline"
                        className="font-mono text-10 px-1.5 py-0.5 border-border/60 bg-muted/40 text-muted-foreground capitalize"
                      >
                        {entry.type}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(entry.key);
                        toast.success(`Copied key "${entry.key}"`);
                      }}
                      className="size-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer"
                      title="Copy mã trích dẫn"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}