'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Search,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar as CalendarIcon,
  Tag as TagIcon,
  BookmarkCheck,
  Shapes,
} from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui";
import { FilterFunnelIcon } from "@/shared/components/icons";
import { SingleDatePopover } from "@/features/projects/project-id/work-items/components/modals/Popovers";
import { useQueryClient } from '@tanstack/react-query';
import { useTags } from '../hooks/use-tags';
import type { TagWithCount } from '../services/tags.service';
import type { Item } from '../types/library.types';
import { ALL_ITEM_TYPES_FLAT, LIBRARY_ITEM_TYPES } from '../schemas/item-type.schema';
import { itemKeys, useItems } from '../hooks/use-items';
import { libraryKeys } from '../hooks/use-library';

// ── Checkbox Component (DESIGN.md Flat Precision) ───────────────────────────
function FilterCheckbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        'size-3.5 rounded-sm border flex items-center justify-center transition-colors shrink-0',
        checked
          ? 'bg-primary border-primary text-primary-foreground'
          : 'border-border bg-background hover:border-border'
      )}
    >
      {checked && <Check className="size-2.5 stroke-[1.75] text-primary-foreground shrink-0" />}
    </div>
  );
}

// ── Advanced Search & Scoring Algorithm ─────────────────────────────────────
// Multi-token, accent-folding (Vietnamese/Latin), token boundary & fuzzy subsequence
interface MatchResult {
  matches: boolean;
  score: number;
}

function normalizeSearchStr(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateFilterMatchScore(
  label: string,
  query: string,
  aliases: string[] = []
): MatchResult {
  const normQuery = normalizeSearchStr(query);
  if (!normQuery) return { matches: true, score: 0 };

  const normLabel = normalizeSearchStr(label);
  const normAliases = aliases.map(normalizeSearchStr);
  const candidates = [normLabel, ...normAliases];
  const queryTokens = normQuery.split(' ').filter(Boolean);

  let totalScore = 0;
  for (const token of queryTokens) {
    let bestTokenScore = 0;

    for (const cand of candidates) {
      if (cand === token) {
        bestTokenScore = Math.max(bestTokenScore, 100);
      } else if (cand.startsWith(token)) {
        bestTokenScore = Math.max(bestTokenScore, 85);
      } else {
        const words = cand.split(' ');
        if (words.some((w) => w.startsWith(token))) {
          bestTokenScore = Math.max(bestTokenScore, 75);
        } else if (cand.includes(token)) {
          bestTokenScore = Math.max(bestTokenScore, 60);
        } else {
          // Fuzzy subsequence (e.g. "artcl" -> "article", "prprnt" -> "preprint")
          let qIdx = 0;
          for (let i = 0; i < cand.length && qIdx < token.length; i++) {
            if (cand[i] === token[qIdx]) qIdx++;
          }
          if (qIdx === token.length && token.length >= 2) {
            bestTokenScore = Math.max(bestTokenScore, 40);
          }
        }
      }
    }

    if (bestTokenScore === 0) {
      return { matches: false, score: 0 };
    }
    totalScore += bestTokenScore;
  }

  return { matches: true, score: totalScore / queryTokens.length };
}

// ── Filter Options Configurations ───────────────────────────────────────────
const FILE_STATUS_OPTIONS = [
  {
    id: 'has-pdf' as const,
    label: 'Has PDF',
    aliases: ['pdf', 'has pdf', 'fulltext', 'full text', 'attachment', 'doc', 'document', 'paper', 'co file', 'file'],
  },
  {
    id: 'missing-pdf' as const,
    label: 'No PDF',
    aliases: ['no pdf', 'missing pdf', 'without pdf', 'citation only', 'metadata', 'thieu file', 'chua co pdf', 'khong co pdf'],
  },
  {
    id: 'has-notes' as const,
    label: 'Has notes',
    aliases: ['notes', 'has notes', 'with notes', 'note', 'annotation', 'annotations', 'memo', 'ghi chu', 'highlight'],
  },
];

const READING_STATUS_OPTIONS = [
  { id: 'unread' as const, label: 'Unread', aliases: ['not read', 'new', 'chua doc', 'moi'] },
  { id: 'reading' as const, label: 'Reading', aliases: ['in progress', 'dang doc', 'current'] },
  { id: 'completed' as const, label: 'Completed', aliases: ['done', 'finished', 'da doc', 'xong', 'read'] },
];

const KNOWN_TYPE_ALIASES: Record<string, string[]> = {
  journalarticle: ['journal', 'article', 'bai bao', 'tap chi', 'paper'],
  preprint: ['arxiv', 'biorxiv', 'medrxiv', 'ssrn', 'draft', 'preprint'],
  conferencepaper: ['conference', 'proceeding', 'proceedings', 'hoi nghi', 'workshop', 'symposium'],
  book: ['book', 'sach', 'monograph'],
  booksection: ['chapter', 'section', 'muc sach', 'phan sach', 'book chapter'],
  thesis: ['dissertation', 'phd', 'master', 'luan van', 'luan an'],
  report: ['technical report', 'whitepaper', 'bao cao', 'standard', 'working paper'],
  dataset: ['data', 'du lieu', 'dataset', 'repository'],
  presentation: ['slides', 'presentation', 'talk', 'thuyet trinh'],
  webpage: ['web', 'website', 'trang web', 'online', 'link'],
  blogpost: ['blog', 'bai viet blog', 'post'],
  patent: ['sang che', 'bang sang che', 'patent'],
  document: ['doc', 'document', 'tai lieu'],
  computerprogram: ['software', 'program', 'code', 'phan mem'],
};

function formatTypeFallback(type: string): string {
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export interface LibraryFilterPopoverProps {
  workspaceId?: string;
  scopeId?: string;
  items?: Item[];
  className?: string;
}

export function LibraryFilterPopover({
  workspaceId,
  scopeId: propScopeId,
  items,
  className,
}: LibraryFilterPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const scopeId = propScopeId || workspaceId || 'user';
  const { data: allItemsFromHook } = useItems({ scopeId });
  const [isOpen, setIsOpen] = useState(false);

  // Search input query at the very top of popover
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Collapsible section open states
  const [filesOpen, setFilesOpen] = useState(true);
  const [readingOpen, setReadingOpen] = useState(true);
  const [typesOpen, setTypesOpen] = useState(true);
  const [yearOpen, setYearOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);

  // SingleDatePopover open states for Start Date & End Date
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // 1. Current URL params
  const fileStatus = searchParams.get('fileStatus') || 'all';

  // Read statuses: supports multi-select checkbox (e.g. readStatus=unread,reading)
  const readStatuses = useMemo(() => {
    const raw = searchParams.getAll('readStatus');
    if (!raw.length) return [];
    return raw
      .flatMap((s: string) => s.split(','))
      .map((s: string) => s.trim().toLowerCase())
      .filter((s) => s && s !== 'all');
  }, [searchParams]);

  const itemTypes = useMemo(() => {
    const raw = searchParams.getAll('type');
    if (!raw.length) return [];
    return raw
      .flatMap((t: string) => t.split(','))
      .map((t: string) => decodeURIComponent(t.trim()).toLowerCase())
      .filter(Boolean);
  }, [searchParams]);

  const fromYear = searchParams.get('fromYear') ? parseInt(searchParams.get('fromYear')!, 10) : null;
  const toYear = searchParams.get('toYear') ? parseInt(searchParams.get('toYear')!, 10) : null;
  const startDate = searchParams.get('startDate') || (fromYear ? `${fromYear}-01-01` : '');
  const endDate = searchParams.get('endDate') || (toYear ? `${toYear}-12-31` : '');

  const activeTags = useMemo(() => {
    const raw = searchParams.getAll('tag');
    if (!raw.length) return [];
    return raw
      .flatMap((t: string) => t.split(','))
      .map((t: string) => decodeURIComponent(t.trim()))
      .filter(Boolean);
  }, [searchParams]);

  // Tags Hook
  const { tags } = useTags(scopeId);

  // Calculate active filter count
  const activeCount = useMemo(() => {
    let count = 0;
    if (fileStatus !== 'all') count++;
    if (readStatuses.length > 0) count += readStatuses.length;
    if (itemTypes.length > 0) count += itemTypes.length;
    if (fromYear !== null || toYear !== null || Boolean(startDate) || Boolean(endDate)) count++;
    if (activeTags.length > 0) count += activeTags.length;
    return count;
  }, [fileStatus, readStatuses, itemTypes, fromYear, toYear, startDate, endDate, activeTags]);

  // URL Query Mutation Helpers
  const updateQuery = (mutator: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleFileStatusToggle = (status: 'has-pdf' | 'missing-pdf' | 'has-notes') => {
    updateQuery((params) => {
      if (fileStatus === status) {
        params.delete('fileStatus');
      } else {
        params.set('fileStatus', status);
      }
    });
  };

  const handleReadStatusToggle = (status: 'unread' | 'reading' | 'completed') => {
    updateQuery((params) => {
      let nextStatuses: string[];
      if (readStatuses.includes(status)) {
        nextStatuses = readStatuses.filter((s) => s !== status);
      } else {
        nextStatuses = [...readStatuses, status];
      }
      params.delete('readStatus');
      if (nextStatuses.length > 0) {
        params.set('readStatus', nextStatuses.join(','));
      }
    });
  };

  const handleTypeToggle = (typeId: string) => {
    updateQuery((params) => {
      const lower = typeId.toLowerCase();
      let nextTypes: string[];
      if (itemTypes.includes(lower)) {
        nextTypes = itemTypes.filter((t) => t !== lower);
      } else {
        nextTypes = [...itemTypes, lower];
      }
      params.delete('type');
      if (nextTypes.length > 0) {
        params.set('type', nextTypes.join(','));
      }
    });
  };

  const handleYearPreset = (from: number | null, to: number | null) => {
    updateQuery((params) => {
      if (from !== null) {
        params.set('fromYear', String(from));
        params.set('startDate', `${from}-01-01`);
      } else {
        params.delete('fromYear');
        params.delete('startDate');
      }
      if (to !== null) {
        params.set('toYear', String(to));
        params.set('endDate', `${to}-12-31`);
      } else {
        params.delete('toYear');
        params.delete('endDate');
      }
    });
  };

  const handleStartDateSelect = (dateStr: string) => {
    updateQuery((params) => {
      if (dateStr) {
        params.set('startDate', dateStr);
        const y = parseInt(dateStr.split('-')[0], 10);
        if (!isNaN(y)) params.set('fromYear', String(y));
      } else {
        params.delete('startDate');
        params.delete('fromYear');
      }
    });
  };

  const handleEndDateSelect = (dateStr: string) => {
    updateQuery((params) => {
      if (dateStr) {
        params.set('endDate', dateStr);
        const y = parseInt(dateStr.split('-')[0], 10);
        if (!isNaN(y)) params.set('toYear', String(y));
      } else {
        params.delete('endDate');
        params.delete('toYear');
      }
    });
  };

  const handleClearDate = () => {
    handleYearPreset(null, null);
  };

  const handleTagToggle = (tagName: string) => {
    updateQuery((params) => {
      const lower = tagName.toLowerCase();
      let nextTags: string[];
      if (activeTags.some((t) => t.toLowerCase() === lower)) {
        nextTags = activeTags.filter((t) => t.toLowerCase() !== lower);
      } else {
        nextTags = [...activeTags, tagName];
      }
      params.delete('tag');
      if (nextTags.length > 0) {
        params.set('tag', nextTags.join(','));
      }
    });
  };

  const handleClearAll = () => {
    updateQuery((params) => {
      params.delete('fileStatus');
      params.delete('readStatus');
      params.delete('type');
      params.delete('fromYear');
      params.delete('toYear');
      params.delete('startDate');
      params.delete('endDate');
      params.delete('tag');
    });
  };

  const currentYear = new Date().getFullYear();
  const hasDateFilter = Boolean(startDate || endDate || fromYear !== null || toYear !== null);

  // ── Smart Algorithm Filter Evaluations ────────────────────────────────────
  const matchingFileItems = useMemo(() => {
    return FILE_STATUS_OPTIONS.map((item) => ({
      ...item,
      match: calculateFilterMatchScore(item.label, searchQuery, item.aliases),
    }))
      .filter((item) => item.match.matches)
      .sort((a, b) => b.match.score - a.match.score);
  }, [searchQuery]);

  const matchingReadingItems = useMemo(() => {
    return READING_STATUS_OPTIONS.map((item) => ({
      ...item,
      match: calculateFilterMatchScore(item.label, searchQuery, item.aliases),
    }))
      .filter((item) => item.match.matches)
      .sort((a, b) => b.match.score - a.match.score);
  }, [searchQuery]);

  // ── Dynamic Item Types from user's papers (Dynamic Facets) ────────────────
  const dynamicTypes = useMemo(() => {
    // 1. Gather all raw items from props, hook, or query cache fallback
    let sourceItems: Item[] = (items && items.length > 0 ? items : allItemsFromHook) || [];
    if (!sourceItems || sourceItems.length === 0) {
      const targetScope = scopeId || workspaceId || 'user';
      const cacheKeys = [
        itemKeys.all(targetScope),
        itemKeys.all('user'),
        ['items', targetScope],
        ['items', 'user'],
        libraryKeys.items(targetScope),
      ];
      for (const k of cacheKeys) {
        const raw = queryClient.getQueryData<any>(k);
        if (Array.isArray(raw) && raw.length > 0) {
          sourceItems = raw;
          break;
        } else if (raw && Array.isArray(raw.items) && raw.items.length > 0) {
          sourceItems = raw.items;
          break;
        } else if (raw && Array.isArray(raw.papers) && raw.papers.length > 0) {
          sourceItems = raw.papers;
          break;
        }
      }
    }

    // 2. Count / collect unique item types existing in user's library
    const existingTypeMap = new Map<string, string>(); // lowerKey -> canonicalKey
    if (sourceItems && sourceItems.length > 0) {
      for (const item of sourceItems) {
        const raw =
          item.itemType ||
          (item as any).item_type ||
          (item as any).type ||
          (item as any).cslType ||
          'journalArticle';
        if (raw && typeof raw === 'string') {
          const lower = raw.toLowerCase().trim();
          if (lower && !existingTypeMap.has(lower)) {
            existingTypeMap.set(lower, raw.trim());
          }
        }
      }
    }

    // Also preserve any currently active types from URL params so user can uncheck them
    for (const activeType of itemTypes) {
      const lower = activeType.toLowerCase().trim();
      if (lower && !existingTypeMap.has(lower)) {
        existingTypeMap.set(lower, activeType);
      }
    }

    // If no papers exist in library yet, provide standard academic fallback types
    if (existingTypeMap.size === 0) {
      const defaultTypes = [
        { id: 'journalarticle', canonical: 'journalArticle', label: 'Journal Article' },
        { id: 'preprint', canonical: 'preprint', label: 'Preprint (arXiv/SSRN)' },
        { id: 'conferencepaper', canonical: 'conferencePaper', label: 'Conference Paper' },
        { id: 'book', canonical: 'book', label: 'Book / Chapter' },
        { id: 'thesis', canonical: 'thesis', label: 'Thesis / Dissertation' },
        { id: 'report', canonical: 'report', label: 'Report / Whitepaper' },
      ];
      return defaultTypes.map((t) => ({
        id: t.id,
        label: t.label,
        aliases: Array.from(new Set([t.label, t.canonical, ...(KNOWN_TYPE_ALIASES[t.id] || [])])),
      }));
    }

    // 3. Map to options with canonical labels and aliases (Strictly NO count numbers)
    const options = Array.from(existingTypeMap.entries()).map(([lowerId, canonicalKey]) => {
      const foundDef = ALL_ITEM_TYPES_FLAT.find(
        (t) => t.value.toLowerCase() === lowerId || t.label.toLowerCase() === lowerId
      );
      const defFromLib = LIBRARY_ITEM_TYPES[canonicalKey];
      const label = foundDef?.label || defFromLib?.label || formatTypeFallback(canonicalKey);
      const knownAliases = KNOWN_TYPE_ALIASES[lowerId] || [];
      const aliases = Array.from(new Set([label, canonicalKey, ...knownAliases]));

      return {
        id: lowerId,
        label,
        aliases,
      };
    });

    // Sort alphabetically by label
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [items, allItemsFromHook, scopeId, workspaceId, queryClient, itemTypes]);

  const matchingTypeItems = useMemo(() => {
    return dynamicTypes
      .map((item) => ({
        ...item,
        match: calculateFilterMatchScore(item.label, searchQuery, item.aliases),
      }))
      .filter((item) => item.match.matches)
      .sort((a, b) => b.match.score - a.match.score);
  }, [dynamicTypes, searchQuery]);

  const dateSectionMatch = useMemo(() => {
    return calculateFilterMatchScore('Publication year date calendar start end', searchQuery, [
      'year',
      'date',
      'calendar',
      'lich',
      'nam',
      'start date',
      'end date',
      'recent',
      String(currentYear),
      String(currentYear - 3),
      String(currentYear - 5),
    ]);
  }, [searchQuery, currentYear]);

  const matchingTags = useMemo(() => {
    let list = tags.filter((t: TagWithCount) => {
      const count = t._count?.itemTags ?? 0;
      if (count > 0) return true;
      const lower = t.name.toLowerCase();
      return activeTags.some((at) => at.toLowerCase() === lower);
    });

    if (!searchQuery.trim()) {
      return list.map((tag) => ({ tag, score: 0 }));
    }

    return list
      .map((tag) => {
        const res = calculateFilterMatchScore(tag.name, searchQuery);
        return {
          tag,
          score: res.score,
          matches: res.matches,
        };
      })
      .filter((item) => item.matches)
      .sort((a, b) => b.score - a.score);
  }, [tags, searchQuery, activeTags]);

  const totalMatchesCount =
    matchingFileItems.length +
    matchingReadingItems.length +
    matchingTypeItems.length +
    (dateSectionMatch.matches ? 1 : 0) +
    matchingTags.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "size-8 rounded-md border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors relative shrink-0 shadow-2xs select-none",
                  activeCount > 0 && "border-primary/50 text-primary",
                  isOpen && "bg-muted",
                  className
                )}
                aria-label="Filter"
              >
                <FilterFunnelIcon className="size-4 text-foreground shrink-0" />
                {activeCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-10 font-mono text-primary-foreground font-medium tabular-nums leading-none">
                    {activeCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-12">
            Filter
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 max-h-[480px] p-1.5 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 font-sans flex flex-col select-none"
      >
        {/* 1. Main Search Header at Top - Fixed, Flat, No Shadow (Matches Project Standard) */}
        <div className="relative flex items-center mb-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full pl-8 pr-7 text-xs bg-background border border-border rounded-md outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors text-foreground placeholder:text-muted-foreground shadow-none"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer rounded-xs"
              aria-label="Clear filter search"
            >
              <X className="size-3 shrink-0" />
            </button>
          )}
        </div>

        {/* 2. Scrollable Body: Max height, scrollable without visible scrollbar */}
        <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {/* 3. Empty State if Search Query Yields 0 Matches */}
          {searchQuery.trim() && totalMatchesCount === 0 ? (
            <div className="py-6 text-center text-12 text-muted-foreground select-none">
              <p className="font-medium text-foreground">No matching filters</p>
              <p className="text-11 text-muted-foreground mt-0.5">No options match &ldquo;{searchQuery}&rdquo;</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-11 text-primary hover:underline cursor-pointer font-medium"
              >
                Clear search
              </button>
            </div>
          ) : null}

          {/* 4. Type Section (Moved to Top) */}
          {matchingTypeItems.length > 0 && (
            <div className="pt-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setTypesOpen(!typesOpen)}
                className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <Shapes className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  <span>Type</span>
                </div>
                {typesOpen ? (
                  <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                )}
              </button>

              {typesOpen && (
                <div className="pt-1 select-none">
                  <div className="max-h-36 overflow-y-auto space-y-0.5 no-scrollbar">
                    {matchingTypeItems.map((t) => (
                      <label
                        key={t.id}
                        onClick={() => handleTypeToggle(t.id)}
                        className="flex items-center gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none hover:bg-muted transition-colors"
                      >
                        <FilterCheckbox checked={itemTypes.includes(t.id)} />
                        <span className="font-normal leading-none">{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Tags Section (Moved to Top) */}
          {matchingTags.length > 0 && (
            <div className="border-t border-border pt-1.5 mt-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setTagsOpen(!tagsOpen)}
                className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <TagIcon className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  <span>Tags</span>
                </div>
                {tagsOpen ? (
                  <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                )}
              </button>

              {tagsOpen && (
                <div className="pt-1 select-none">
                  <div className="max-h-40 overflow-y-auto space-y-0.5 no-scrollbar">
                    {matchingTags.map(({ tag }) => {
                      const isSelected = activeTags.some(
                        (t) => t.toLowerCase() === tag.name.toLowerCase()
                      );
                      return (
                        <label
                          key={tag.id}
                          onClick={() => handleTagToggle(tag.name)}
                          className={cn(
                            "flex items-start gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none transition-colors",
                            isSelected ? "bg-muted font-medium" : "hover:bg-muted font-normal"
                          )}
                        >
                          <div className="pt-0.5 shrink-0">
                            <FilterCheckbox checked={isSelected} />
                          </div>
                          <span className="flex-1 min-w-0 break-words whitespace-normal leading-snug tracking-tight text-12">
                            {tag.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. Files Section */}
          {matchingFileItems.length > 0 && (
            <div className="border-t border-border pt-1.5 mt-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setFilesOpen(!filesOpen)}
                className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  <span>Files</span>
                </div>
                {filesOpen ? (
                  <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                )}
              </button>

              {filesOpen && (
                <div className="space-y-0.5 pt-1 select-none">
                  {matchingFileItems.map((item) => (
                    <label
                      key={item.id}
                      onClick={() => handleFileStatusToggle(item.id)}
                      className="flex items-center gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none hover:bg-muted transition-colors"
                    >
                      <FilterCheckbox checked={fileStatus === item.id} />
                      <span className="font-normal leading-none">{item.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 7. Progress Section */}
          {matchingReadingItems.length > 0 && (
            <div className="border-t border-border pt-1.5 mt-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setReadingOpen(!readingOpen)}
                className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <BookmarkCheck className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  <span>Progress</span>
                </div>
                {readingOpen ? (
                  <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                )}
              </button>

              {readingOpen && (
                <div className="space-y-0.5 pt-1 select-none">
                  {matchingReadingItems.map((item) => (
                    <label
                      key={item.id}
                      onClick={() => handleReadStatusToggle(item.id)}
                      className="flex items-center gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none hover:bg-muted transition-colors"
                    >
                      <FilterCheckbox checked={readStatuses.includes(item.id)} />
                      <span className="font-normal leading-none">{item.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. Date Section */}
          {dateSectionMatch.matches && (
            <div className="border-t border-border pt-1.5 mt-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setYearOpen(!yearOpen)}
                className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  <span>Date</span>
                  {hasDateFilter && (
                    <span className="size-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {hasDateFilter && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearDate();
                      }}
                      className="text-11 text-muted-foreground hover:text-destructive cursor-pointer px-1 py-0.5 rounded-xs"
                      title="Clear date filter"
                    >
                      Clear
                    </span>
                  )}
                  {yearOpen ? (
                    <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                </div>
              </button>

              {yearOpen && (
                <div className="pt-1 flex flex-col gap-0.5 select-none">
                  <SingleDatePopover
                    label="Start date"
                    date={startDate}
                    onSelectDate={handleStartDateSelect}
                    open={startDateOpen}
                    onOpenChange={setStartDateOpen}
                    variant="ghost"
                    actionBtnClass="w-full justify-start h-8 px-2 text-12 font-normal rounded-md border-0 bg-transparent hover:bg-muted text-foreground transition-colors shadow-none cursor-pointer"
                  />
                  <SingleDatePopover
                    label="End date"
                    date={endDate}
                    onSelectDate={handleEndDateSelect}
                    open={endDateOpen}
                    onOpenChange={setEndDateOpen}
                    variant="ghost"
                    actionBtnClass="w-full justify-start h-8 px-2 text-12 font-normal rounded-md border-0 bg-transparent hover:bg-muted text-foreground transition-colors shadow-none cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default LibraryFilterPopover;
