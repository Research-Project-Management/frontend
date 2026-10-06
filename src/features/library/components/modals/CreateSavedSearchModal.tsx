'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Minus,
  Loader2,
  Folder,
  Tag,
  ArrowUpDown,
  Library,
  Users,
  FileText,
  Type,
  User,
  Calendar,
  BookOpen,
  AlignLeft,
  Layers,
  Hash,
  Barcode,
  Globe,
  CalendarPlus,
  CalendarClock,
  StickyNote,
  Paperclip,
  CheckCircle2,
  Star,
  ChevronsUpDown,
  Check,
  Search,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui/select';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { useItemTypes, libraryServices, useCollectionsQuery, useTags } from '../../data';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import {
  mapRegistryItemTypes,
  ALL_ITEM_TYPES_FLAT,
} from '../../types';
import type {
  CreateSavedSearchInput,
  SavedSearchField,
  SavedSearchOperator,
  SavedSearchConditionGroup,
  SavedSearch,
} from '../../types/saved-searches.types';
import type { Item } from '../../types/items.types';

interface ConditionRow {
  id: string;
  field: SavedSearchField;
  operator: SavedSearchOperator;
  value: string;
}

export interface CreateSavedSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateSavedSearchInput) => Promise<any> | void;
  savedSearch?: SavedSearch | null;
  scopeId?: string;
  isPending?: boolean;
}

interface FieldConfig {
  value: SavedSearchField;
  label: string;
  operators: { value: SavedSearchOperator; label: string }[];
  placeholder: string;
  defaultValue?: string;
}

export const READ_STATUS_OPTIONS = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'read', label: 'Read' },
  { value: 'skimming', label: 'Skimming' },
];

export const RATING_OPTIONS = [
  { value: '1', label: '★☆☆☆☆ (1 Star)' },
  { value: '2', label: '★★☆☆☆ (2 Stars)' },
  { value: '3', label: '★★★☆☆ (3 Stars)' },
  { value: '4', label: '★★★★☆ (4 Stars)' },
  { value: '5', label: '★★★★★ (5 Stars)' },
];

export const HAS_ATTACHMENT_OPTIONS = [
  { value: 'true', label: 'Has Attachments' },
  { value: 'false', label: 'No Attachments' },
];

export function formatConditionValue(
  field: SavedSearchField,
  value: string,
): string | number | boolean {
  const trimmed = value.trim();
  if (field === 'year' || field === 'rating') {
    const num = Number(trimmed);
    return !isNaN(num) ? num : trimmed;
  }
  if (field === 'hasAttachment') {
    return trimmed === 'true';
  }
  return trimmed;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    value: 'title',
    label: 'Title',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'is', label: 'is (exact)' },
      { value: 'isNot', label: 'is not' },
      { value: 'isPresent', label: 'is not empty' },
      { value: 'isAbsent', label: 'is empty' },
      { value: 'beginsWith', label: 'begins with' },
      { value: 'endsWith', label: 'ends with' },
    ],
    placeholder: 'Enter title keyword...',
  },
  {
    value: 'creator',
    label: 'Author / Creator',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'is', label: 'is (exact)' },
      { value: 'isNot', label: 'is not' },
      { value: 'isPresent', label: 'is not empty' },
      { value: 'isAbsent', label: 'is empty' },
      { value: 'beginsWith', label: 'begins with' },
      { value: 'endsWith', label: 'ends with' },
    ],
    placeholder: 'Enter author name...',
  },
  {
    value: 'year',
    label: 'Year',
    operators: [
      { value: 'is', label: 'equals (=)' },
      { value: 'isGreaterThan', label: 'is after (>)' },
      { value: 'isLessThan', label: 'is before (<)' },
      { value: 'isNot', label: 'is not equal to (≠)' },
      { value: 'isPresent', label: 'has year' },
      { value: 'isAbsent', label: 'no year' },
    ],
    placeholder: 'YYYY',
  },
  {
    value: 'itemType',
    label: 'Item Type',
    operators: [
      { value: 'is', label: 'is' },
      { value: 'isNot', label: 'is not' },
      { value: 'isPresent', label: 'is not empty' },
      { value: 'isAbsent', label: 'is empty' },
    ],
    placeholder: 'Select item type...',
    defaultValue: 'journalArticle',
  },
  {
    value: 'tag',
    label: 'Tag',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'is', label: 'is exact tag' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'isPresent', label: 'has tags' },
      { value: 'isAbsent', label: 'no tags' },
    ],
    placeholder: 'Enter tag name...',
  },
  {
    value: 'collection',
    label: 'Collection',
    operators: [
      { value: 'is', label: 'is in collection' },
      { value: 'isNot', label: 'is not in collection' },
      { value: 'isPresent', label: 'is in any collection' },
      { value: 'isAbsent', label: 'is unfiled (no collection)' },
    ],
    placeholder: 'Select collection...',
  },
  {
    value: 'dateAdded',
    label: 'Date Added',
    operators: [
      { value: 'isGreaterThan', label: 'is after (>)' },
      { value: 'isLessThan', label: 'is before (<)' },
      { value: 'isPresent', label: 'is set' },
    ],
    placeholder: 'YYYY-MM-DD',
  },
  {
    value: 'dateModified',
    label: 'Date Modified',
    operators: [
      { value: 'isGreaterThan', label: 'is after (>)' },
      { value: 'isLessThan', label: 'is before (<)' },
      { value: 'isPresent', label: 'is set' },
    ],
    placeholder: 'YYYY-MM-DD',
  },
  {
    value: 'publicationTitle',
    label: 'Publication / Journal',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'is', label: 'is (exact)' },
      { value: 'isNot', label: 'is not' },
      { value: 'isPresent', label: 'has publication' },
      { value: 'isAbsent', label: 'no publication' },
      { value: 'beginsWith', label: 'begins with' },
      { value: 'endsWith', label: 'ends with' },
    ],
    placeholder: 'Enter publication name...',
  },
  {
    value: 'abstract',
    label: 'Abstract',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'isPresent', label: 'has abstract' },
      { value: 'isAbsent', label: 'no abstract' },
    ],
    placeholder: 'Enter abstract keyword...',
  },
  {
    value: 'doi',
    label: 'DOI',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'is', label: 'is exact DOI' },
      { value: 'isPresent', label: 'has DOI' },
      { value: 'isAbsent', label: 'no DOI' },
    ],
    placeholder: 'Enter DOI...',
  },
  {
    value: 'isbn',
    label: 'ISBN',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'is', label: 'is exact ISBN' },
      { value: 'isPresent', label: 'has ISBN' },
      { value: 'isAbsent', label: 'no ISBN' },
    ],
    placeholder: 'Enter ISBN...',
  },
  {
    value: 'url',
    label: 'URL',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'is', label: 'is exact URL' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'isPresent', label: 'has URL' },
      { value: 'isAbsent', label: 'no URL' },
    ],
    placeholder: 'Enter URL...',
  },
  {
    value: 'noteContent',
    label: 'Note',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'isPresent', label: 'has notes' },
      { value: 'isAbsent', label: 'no notes' },
    ],
    placeholder: 'Enter note keyword...',
  },
  {
    value: 'attachmentContent',
    label: 'Attachment Content',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'isPresent', label: 'has indexed attachment' },
      { value: 'isAbsent', label: 'no indexed attachment' },
    ],
    placeholder: 'Enter attachment keyword...',
  },
  {
    value: 'hasAttachment',
    label: 'Has Attachment',
    operators: [
      { value: 'is', label: 'is' },
    ],
    placeholder: 'Select attachment status...',
    defaultValue: 'true',
  },
  {
    value: 'readStatus',
    label: 'Read Status',
    operators: [
      { value: 'is', label: 'is' },
      { value: 'isNot', label: 'is not' },
    ],
    placeholder: 'Select reading status...',
    defaultValue: 'unread',
  },
  {
    value: 'rating',
    label: 'Rating',
    operators: [
      { value: 'is', label: 'equals (=)' },
      { value: 'isGreaterThan', label: 'is greater than (>)' },
      { value: 'isLessThan', label: 'is less than (<)' },
      { value: 'isNot', label: 'is not equal to (≠)' },
      { value: 'isPresent', label: 'is rated' },
      { value: 'isAbsent', label: 'is unrated' },
    ],
    placeholder: 'Select rating...',
    defaultValue: '3',
  },
];

export interface FieldCategory {
  group: string;
  fields: {
    value: SavedSearchField;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

export const FIELD_CATEGORIES: FieldCategory[] = [
  {
    group: 'Bibliographic',
    fields: [
      { value: 'title', label: 'Title', icon: Type },
      { value: 'creator', label: 'Author / Creator', icon: User },
      { value: 'year', label: 'Year', icon: Calendar },
      { value: 'itemType', label: 'Item Type', icon: Layers },
      { value: 'publicationTitle', label: 'Publication / Journal', icon: BookOpen },
      { value: 'abstract', label: 'Abstract', icon: AlignLeft },
    ],
  },
  {
    group: 'Identifiers & Web',
    fields: [
      { value: 'doi', label: 'DOI', icon: Hash },
      { value: 'isbn', label: 'ISBN', icon: Barcode },
      { value: 'url', label: 'URL', icon: Globe },
    ],
  },
  {
    group: 'Organization',
    fields: [
      { value: 'collection', label: 'Collection', icon: Folder },
      { value: 'tag', label: 'Tag', icon: Tag },
    ],
  },
  {
    group: 'Dates',
    fields: [
      { value: 'dateAdded', label: 'Date Added', icon: CalendarPlus },
      { value: 'dateModified', label: 'Date Modified', icon: CalendarClock },
    ],
  },
  {
    group: 'Content & Files',
    fields: [
      { value: 'noteContent', label: 'Note', icon: StickyNote },
      { value: 'attachmentContent', label: 'Attachment Content', icon: FileText },
      { value: 'hasAttachment', label: 'Has Attachment', icon: Paperclip },
    ],
  },
  {
    group: 'Reading & Status',
    fields: [
      { value: 'readStatus', label: 'Read Status', icon: CheckCircle2 },
      { value: 'rating', label: 'Rating', icon: Star },
    ],
  },
];

export const FIELD_ICONS: Record<SavedSearchField, React.ComponentType<{ className?: string }>> = {
  title: Type,
  creator: User,
  year: Calendar,
  itemType: Layers,
  publicationTitle: BookOpen,
  abstract: AlignLeft,
  doi: Hash,
  isbn: Barcode,
  url: Globe,
  collection: Folder,
  tag: Tag,
  dateAdded: CalendarPlus,
  dateModified: CalendarClock,
  noteContent: StickyNote,
  attachmentContent: FileText,
  hasAttachment: Paperclip,
  readStatus: CheckCircle2,
  rating: Star,
};

interface ConditionFieldSelectProps {
  value: SavedSearchField;
  onChange: (field: SavedSearchField) => void;
  ariaLabel?: string;
}

export function ConditionFieldSelect({
  value,
  onChange,
  ariaLabel,
}: ConditionFieldSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const activeConfig = FIELD_CONFIGS.find((f) => f.value === value) || FIELD_CONFIGS[0];
  const ActiveIcon = FIELD_ICONS[value] || Type;

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FIELD_CATEGORIES;
    return FIELD_CATEGORIES.map((cat) => ({
      ...cat,
      fields: cat.fields.filter(
        (f) =>
          f.label.toLowerCase().includes(q) ||
          f.value.toLowerCase().includes(q) ||
          cat.group.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.fields.length > 0);
  }, [search]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    } else {
      setSearch('');
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel || 'Select field'}
          className="w-full sm:w-[155px] h-8 px-2.5 flex items-center justify-between gap-1.5 text-12 font-medium text-foreground bg-background border border-border rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors shrink-0 select-none cursor-pointer"
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <ActiveIcon className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{activeConfig.label}</span>
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground/60 shrink-0 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[230px] p-0 rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-300 overflow-hidden z-50"
      >
        <div className="p-1.5 border-b border-border/50">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/60 text-12">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Filter fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                } else if (e.key === 'Enter') {
                  const first = filteredCategories[0]?.fields[0];
                  if (first) {
                    onChange(first.value);
                    setOpen(false);
                  }
                }
              }}
              className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                aria-label="Clear filter"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[260px] overflow-y-auto scrollbar-thin p-1 space-y-1.5">
          {filteredCategories.length === 0 ? (
            <div className="py-6 text-center text-11 text-muted-foreground select-none">
              No matching fields
            </div>
          ) : (
            filteredCategories.map((group) => (
              <div key={group.group} className="space-y-0.5">
                <div className="px-2 pt-1 pb-0.5 text-10 font-semibold uppercase tracking-wider text-muted-foreground/70 select-none">
                  {group.group}
                </div>
                {group.fields.map((field) => {
                  const isSelected = field.value === value;
                  const Icon = field.icon;
                  return (
                    <button
                      key={field.value}
                      type="button"
                      onClick={() => {
                        onChange(field.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'w-full h-7 px-2 py-1 flex items-center justify-between gap-2 rounded-sm text-12 text-left transition-colors cursor-pointer select-none',
                        isSelected
                          ? 'bg-muted font-medium text-foreground'
                          : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground',
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Icon className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{field.label}</span>
                      </span>
                      {isSelected && (
                        <Check className="size-3.5 text-foreground shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CreateSavedSearchModal({
  open,
  onOpenChange,
  onSubmit,
  savedSearch,
  scopeId = 'user',
  isPending = false,
}: CreateSavedSearchModalProps) {
  const { projects = [] } = useProjects();
  const [targetScope, setTargetScope] = useState<string>(scopeId || 'user');

  // Synchronize targetScope with incoming scopeId or savedSearch
  useEffect(() => {
    if (savedSearch?.scopeId) {
      setTargetScope(savedSearch.scopeId);
    } else if (scopeId) {
      setTargetScope(scopeId);
    }
  }, [savedSearch, scopeId]);

  // ── Canonical Item Types fetched directly from Backend Registry ────────────
  const { types: registryItemTypes } = useItemTypes(targetScope);
  const itemTypeOptions = useMemo(() => {
    const serverDefinitions = mapRegistryItemTypes(registryItemTypes);
    if (serverDefinitions.length > 0) {
      return serverDefinitions
        .map((t) => ({ value: t.itemType, label: t.label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    return ALL_ITEM_TYPES_FLAT;
  }, [registryItemTypes]);

  // ── Collections and Tags for filter autocomplete ──────────────────────────
  const { data: collections = [] } = useCollectionsQuery(targetScope);
  const { tags = [] } = useTags(targetScope);
  const tagList = useMemo(
    () => Array.from(new Set(tags.map((t: any) => t.name || t))).filter(Boolean) as string[],
    [tags],
  );

  const [name, setName] = useState('');
  const [conjunction, setConjunction] = useState<'AND' | 'OR'>('AND');
  const [sortBy, setSortBy] = useState<'dateAdded' | 'year' | 'title' | 'creator'>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Zotero standard search options
  const [searchSubcollections, setSearchSubcollections] = useState(true);
  const [showOnlyTopLevel, setShowOnlyTopLevel] = useState(false);
  const [includeParentAndChild, setIncludeParentAndChild] = useState(false);

  const [conditions, setConditions] = useState<ConditionRow[]>([
    {
      id: 'row-1',
      field: 'title',
      operator: 'contains',
      value: '',
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  // Live Matching Preview State (Zotero results pane)
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSamples, setPreviewSamples] = useState<Item[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reset or load modal state on open
  useEffect(() => {
    if (open) {
      if (savedSearch) {
        setName(savedSearch.name || '');
        const conj =
          savedSearch.conjunction ||
          (savedSearch.conditions as any)?.conjunction ||
          'AND';
        setConjunction(conj === 'OR' ? 'OR' : 'AND');
        setSortBy(savedSearch.sortBy || 'dateAdded');
        setSortOrder(savedSearch.sortOrder || 'desc');
        const rawConds = (savedSearch.conditions as any)?.conditions;
        if (Array.isArray(rawConds) && rawConds.length > 0) {
          setConditions(
            rawConds.map((c: any, idx: number) => ({
              id: `row-${idx}-${Date.now()}`,
              field: c.field || 'title',
              operator: c.operator || 'contains',
              value: c.value !== undefined && c.value !== null ? String(c.value) : '',
            }))
          );
        } else {
          setConditions([
            {
              id: `row-${Date.now()}`,
              field: 'title',
              operator: 'contains',
              value: '',
            },
          ]);
        }
      } else {
        setName('');
        setConjunction('AND');
        setSortBy('dateAdded');
        setSortOrder('desc');
        setConditions([
          {
            id: `row-${Date.now()}`,
            field: 'title',
            operator: 'contains',
            value: '',
          },
        ]);
      }
      setError(null);
      setPreviewCount(null);
      setPreviewSamples([]);
    }
  }, [open, savedSearch]);

  // Live Preview Debounced Evaluation
  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const hasValidCondition = conditions.some((c) => {
      if (c.operator === 'isPresent' || c.operator === 'isAbsent') return true;
      return c.value.trim().length > 0;
    });

    if (!hasValidCondition) {
      setPreviewCount(null);
      setPreviewSamples([]);
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const payloadConditions = conditions
          .filter((c) => {
            if (c.operator === 'isPresent' || c.operator === 'isAbsent') return true;
            return c.value.trim().length > 0;
          })
          .map((c) => ({
            field: c.field,
            operator: c.operator,
            value: formatConditionValue(c.field, c.value),
          }));

        if (payloadConditions.length === 0) {
          setPreviewCount(null);
          setPreviewSamples([]);
          setIsPreviewLoading(false);
          return;
        }

        const conditionGroup: SavedSearchConditionGroup = {
          conjunction,
          conditions: payloadConditions,
        };

        const res = await libraryServices.savedSearches.preview(targetScope, conditionGroup);
        setPreviewCount(res.count ?? 0);
        setPreviewSamples(res.sampleItems || []);
      } catch {
        // Silently ignore preview errors during active typing
      } finally {
        setIsPreviewLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [conditions, conjunction, open, targetScope]);

  const handleAddCondition = (afterIndex?: number) => {
    const newRow: ConditionRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      field: 'title',
      operator: 'contains',
      value: '',
    };

    if (typeof afterIndex === 'number') {
      const updated = [...conditions];
      updated.splice(afterIndex + 1, 0, newRow);
      setConditions(updated);
    } else {
      setConditions((prev) => [...prev, newRow]);
    }
  };

  const handleRemoveCondition = (id: string) => {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const handleFieldChange = (id: string, newField: SavedSearchField) => {
    const config = FIELD_CONFIGS.find((f) => f.value === newField);
    const defaultOp = config?.operators[0]?.value || 'contains';
    let defaultValue = '';
    if (newField === 'itemType') {
      defaultValue = itemTypeOptions[0]?.value || 'journalArticle';
    } else if (newField === 'collection') {
      defaultValue = collections[0]?.id || '';
    } else if (newField === 'readStatus') {
      defaultValue = 'unread';
    } else if (newField === 'rating') {
      defaultValue = '3';
    } else if (newField === 'hasAttachment') {
      defaultValue = 'true';
    } else if (config?.defaultValue) {
      defaultValue = config.defaultValue;
    }

    setConditions((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              field: newField,
              operator: defaultOp,
              value: defaultValue,
            }
          : c,
      ),
    );
  };

  const handleOperatorChange = (id: string, newOperator: SavedSearchOperator) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, operator: newOperator } : c)),
    );
  };

  const handleValueChange = (id: string, newValue: string) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, value: newValue } : c)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const invalidRow = conditions.find((c) => {
      if (c.operator === 'isPresent' || c.operator === 'isAbsent') return false;
      return !c.value.trim();
    });

    if (invalidRow) {
      setError('Please enter or select a search value for every condition.');
      return;
    }

    let resolvedName = name.trim();
    if (!resolvedName) {
      const firstCond = conditions[0];
      if (firstCond) {
        const config = FIELD_CONFIGS.find((f) => f.value === firstCond.field);
        const fieldLabel = config?.label || firstCond.field;
        if (firstCond.operator === 'isPresent') {
          resolvedName = `Has ${fieldLabel}`;
        } else if (firstCond.operator === 'isAbsent') {
          resolvedName = `No ${fieldLabel}`;
        } else if (firstCond.value.trim()) {
          if (firstCond.field === 'collection') {
            const found = collections.find((c: any) => c.id === firstCond.value);
            resolvedName = found ? `Collection: ${found.name}` : `Collection search`;
          } else {
            resolvedName = `${fieldLabel}: ${firstCond.value.trim()}`;
          }
        } else {
          resolvedName = `Search (${new Date().toLocaleDateString()})`;
        }
      } else {
        resolvedName = 'Untitled Search';
      }
    }

    setError(null);

    const conditionGroup: SavedSearchConditionGroup = {
      conjunction,
      conditions: conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: formatConditionValue(c.field, c.value),
      })),
    };

    const payload: CreateSavedSearchInput = {
      name: resolvedName,
      conjunction,
      conditions: conditionGroup,
      sortBy,
      sortOrder,
    };

    await onSubmit(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-full sm:max-w-[740px] max-h-[92vh] flex flex-col p-4 sm:p-6 bg-background border border-border shadow-raised-200 rounded-lg gap-0"
      >
        {/* Header - Clean title with NO icon */}
        <DialogHeader className="text-left pb-4">
          <DialogTitle className="text-base font-semibold text-foreground">
            {savedSearch ? 'Edit Saved Search' : 'New Saved Search'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* 1. Header Configurations: Name & Library Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="smart-search-name" className="text-11 font-medium text-foreground">
                Name
              </Label>
              <Input
                id="smart-search-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Saved search name..."
                autoFocus
                className="h-8 text-12 text-foreground focus:border-foreground focus:ring-1 focus:ring-foreground/20 rounded-md border-border placeholder:text-muted-foreground/50 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="search-in-library-select" className="text-11 font-medium text-foreground">
                Search in library
              </Label>
              <Select value={targetScope} onValueChange={(val) => setTargetScope(val)}>
                <SelectTrigger
                  id="search-in-library-select"
                  aria-label="Search in library"
                  className="w-full h-8 text-12 text-foreground rounded-md border-border bg-background"
                >
                  <SelectValue placeholder="Select library..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="max-h-56 min-w-[200px] p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                >
                  <SelectItem value="user" className="text-12 h-7 py-1 px-2 rounded-sm cursor-pointer focus:bg-muted">
                    <span className="flex items-center gap-1.5">
                      <Library className="size-3.5 text-foreground shrink-0" />
                      <span>My Library</span>
                    </span>
                  </SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id} className="text-12 h-7 py-1 px-2 rounded-sm cursor-pointer focus:bg-muted">
                      <span className="flex items-center gap-1.5 truncate">
                        <Users className="size-3.5 text-foreground shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. Match Criteria Header */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-11 text-foreground">
              <span className="font-medium text-foreground">Match</span>
              <div
                role="radiogroup"
                aria-label="Match criteria"
                className="inline-flex rounded-md bg-muted p-0.5 border border-border"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={conjunction === 'AND'}
                  onClick={() => setConjunction('AND')}
                  className={cn(
                    'px-2.5 py-0.5 rounded text-11 transition-colors cursor-pointer',
                    conjunction === 'AND'
                      ? 'bg-background text-foreground font-medium shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={conjunction === 'OR'}
                  onClick={() => setConjunction('OR')}
                  className={cn(
                    'px-2.5 py-0.5 rounded text-11 transition-colors cursor-pointer',
                    conjunction === 'OR'
                      ? 'bg-background text-foreground font-medium shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Any
                </button>
              </div>
              <span className="text-muted-foreground">of the following conditions:</span>
            </div>
          </div>

          {/* 3. Criteria Rows Builder */}
          <div className="space-y-2">
            <div className="max-h-40 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
              {conditions.map((cond, idx) => {
                const activeConfig =
                  FIELD_CONFIGS.find((f) => f.value === cond.field) || FIELD_CONFIGS[0];
                const isNoValueOperator =
                  cond.operator === 'isPresent' || cond.operator === 'isAbsent';

                return (
                  <div
                    key={cond.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:p-0 rounded-md sm:rounded-none bg-muted/30 sm:bg-transparent border border-border/50 sm:border-0"
                  >
                    {/* Field & Operator controls: Side-by-side grid on mobile, inline on desktop */}
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
                      {/* Field Select - Rescaled Categorized Combobox Popover */}
                      <ConditionFieldSelect
                        value={cond.field}
                        onChange={(val) => handleFieldChange(cond.id, val)}
                        ariaLabel={`Field for condition ${idx + 1}`}
                      />

                      {/* Operator Select - Scaled compact popper */}
                      <Select
                        value={cond.operator}
                        onValueChange={(val) =>
                          handleOperatorChange(cond.id, val as SavedSearchOperator)
                        }
                      >
                        <SelectTrigger
                          aria-label={`Operator for condition ${idx + 1}`}
                          className="w-full sm:w-[135px] h-8 text-12 text-foreground rounded-md border-border shrink-0 bg-background"
                        >
                          <SelectValue placeholder="Operator" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          sideOffset={4}
                          className="max-h-56 min-w-[135px] p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                        >
                          {activeConfig.operators.map((op) => (
                            <SelectItem
                              key={op.value}
                              value={op.value}
                              className="text-12 h-7 py-1 px-2 rounded-sm cursor-pointer focus:bg-muted"
                            >
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Value Input or Select & Action buttons */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {!isNoValueOperator ? (
                        cond.field === 'itemType' ? (
                          <div className="flex-1 min-w-0">
                            <Select
                              value={cond.value || itemTypeOptions[0]?.value || 'journalArticle'}
                              onValueChange={(val) => handleValueChange(cond.id, val)}
                            >
                              <SelectTrigger
                                aria-label={`Item type for condition ${idx + 1}`}
                                className="w-full h-8 text-12 text-foreground rounded-md border-border bg-background"
                              >
                                <SelectValue placeholder="Select item type" />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                sideOffset={4}
                                className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                              >
                                {itemTypeOptions.map((opt: { value: string; label: string }) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                    className="text-12 h-7 py-1 px-2 rounded-sm cursor-pointer focus:bg-muted"
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : cond.field === 'collection' ? (
                          <div className="flex-1 min-w-0">
                            <Select
                              value={cond.value || (collections[0]?.id ?? '')}
                              onValueChange={(val) => handleValueChange(cond.id, val)}
                            >
                              <SelectTrigger
                                aria-label={`Collection for condition ${idx + 1}`}
                                className="w-full h-8 text-12 text-foreground rounded-md border-border bg-background"
                              >
                                <SelectValue placeholder="Select collection..." />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                sideOffset={4}
                                className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                              >
                                {collections.length === 0 ? (
                                  <div className="p-2 text-11 text-muted-foreground text-center">
                                    No collections found
                                  </div>
                                ) : (
                                  collections.map((col: any) => (
                                    <SelectItem
                                      key={col.id}
                                      value={col.id}
                                      className="text-12 h-7 py-1 px-2 rounded-sm cursor-pointer focus:bg-muted"
                                    >
                                      <span className="flex items-center gap-1.5 truncate">
                                        <Folder className="size-3.5 text-foreground shrink-0" />
                                        <span className="truncate">{col.name}</span>
                                      </span>
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : cond.field === 'tag' ? (
                          <div className="flex-1 min-w-0 relative">
                            <Input
                              list={`tag-suggestions-${cond.id}`}
                              value={cond.value}
                              onChange={(e) => handleValueChange(cond.id, e.target.value)}
                              placeholder="Enter tag name..."
                              aria-label={`Tag for condition ${idx + 1}`}
                              className="h-8 text-12 text-foreground rounded-md border-border placeholder:text-muted-foreground/50 bg-background"
                            />
                            <datalist id={`tag-suggestions-${cond.id}`}>
                              {tagList.map((tag) => (
                                <option key={tag} value={tag} />
                              ))}
                            </datalist>
                          </div>
                        ) : cond.field === 'year' ? (
                          <Input
                            type="number"
                            value={cond.value}
                            onChange={(e) => handleValueChange(cond.id, e.target.value)}
                            placeholder="YYYY"
                            aria-label={`Year for condition ${idx + 1}`}
                            className="flex-1 min-w-0 h-8 text-12 text-foreground rounded-md border-border placeholder:text-muted-foreground/50 bg-background"
                          />
                        ) : cond.field === 'readStatus' ? (
                          <div className="flex-1 min-w-0">
                            <Select
                              value={cond.value || 'unread'}
                              onValueChange={(val) => handleValueChange(cond.id, val)}
                            >
                              <SelectTrigger
                                aria-label={`Reading status for condition ${idx + 1}`}
                                className="w-full h-8 text-12 text-foreground rounded-md border-border bg-background"
                              >
                                <SelectValue placeholder="Select reading status..." />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                sideOffset={4}
                                className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                              >
                                {READ_STATUS_OPTIONS.map((opt) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                    className="text-12 h-7 py-1 px-2 rounded-sm cursor-pointer focus:bg-muted"
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : cond.field === 'rating' ? (
                          <div className="flex-1 min-w-0">
                            <Select
                              value={cond.value || '3'}
                              onValueChange={(val) => handleValueChange(cond.id, val)}
                            >
                              <SelectTrigger
                                aria-label={`Rating for condition ${idx + 1}`}
                                className="w-full h-8 text-12 text-foreground rounded-md border-border bg-background"
                              >
                                <SelectValue placeholder="Select rating..." />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                sideOffset={4}
                                className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                              >
                                {RATING_OPTIONS.map((opt) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                    className="text-12 h-7 py-1 px-2 rounded-sm cursor-pointer focus:bg-muted"
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : cond.field === 'hasAttachment' ? (
                          <div className="flex-1 min-w-0">
                            <Select
                              value={cond.value || 'true'}
                              onValueChange={(val) => handleValueChange(cond.id, val)}
                            >
                              <SelectTrigger
                                aria-label={`Attachment filter for condition ${idx + 1}`}
                                className="w-full h-8 text-12 text-foreground rounded-md border-border bg-background"
                              >
                                <SelectValue placeholder="Select attachment status..." />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                sideOffset={4}
                                className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                              >
                                {HAS_ATTACHMENT_OPTIONS.map((opt) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                    className="text-12 h-7 py-1 px-2 rounded-sm cursor-pointer focus:bg-muted"
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <Input
                            value={cond.value}
                            onChange={(e) => handleValueChange(cond.id, e.target.value)}
                            placeholder={activeConfig.placeholder}
                            aria-label={`${activeConfig.label} for condition ${idx + 1}`}
                            className="flex-1 min-w-0 h-8 text-12 text-foreground rounded-md border-border placeholder:text-muted-foreground/50 bg-background"
                          />
                        )
                      ) : (
                        <div className="flex-1 min-w-0 h-8 flex items-center px-3 text-12 text-muted-foreground italic rounded-md border border-dashed border-border bg-muted/20">
                          No value required
                        </div>
                      )}

                      {/* Action buttons (+ / -) - Clean monochrome styling */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleAddCondition(idx)}
                          title="Add condition below"
                          aria-label={`Add condition after condition ${idx + 1}`}
                          className="size-8 text-foreground hover:bg-muted border border-border rounded-md cursor-pointer flex items-center justify-center shrink-0"
                        >
                          <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveCondition(cond.id)}
                          disabled={conditions.length <= 1}
                          title="Remove condition"
                          aria-label={`Remove condition ${idx + 1}`}
                          className="size-8 text-foreground hover:bg-muted border border-border rounded-md cursor-pointer disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shrink-0"
                        >
                          <Minus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Checkbox Options - Clean inline layout with NO outer border box */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={searchSubcollections}
                onCheckedChange={(c) => setSearchSubcollections(!!c)}
                className="size-3.5 rounded"
              />
              <span className="text-11 text-foreground">Search subcollections</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={showOnlyTopLevel}
                onCheckedChange={(c) => setShowOnlyTopLevel(!!c)}
                className="size-3.5 rounded"
              />
              <span className="text-11 text-foreground">Show only top-level items</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={includeParentAndChild}
                onCheckedChange={(c) => setIncludeParentAndChild(!!c)}
                className="size-3.5 rounded"
              />
              <span className="text-11 text-foreground">Include parent and child items</span>
            </label>
          </div>

          {/* 5. Live Results Table - Line-separated, unboxed (KHÔNG BỌC KHUNG) */}
          <div className="flex-1 min-h-[160px] flex flex-col pt-1">
            {/* Table Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-border text-11">
              <div className="flex items-center gap-2" role="status" aria-live="polite">
                <span className="font-medium text-foreground">Preview results</span>
                {isPreviewLoading ? (
                  <span className="flex items-center gap-1 text-muted-foreground font-normal">
                    <Loader2 className="size-3 animate-spin text-foreground" aria-hidden="true" />
                    Searching...
                  </span>
                ) : previewCount !== null ? (
                  <span className="text-muted-foreground font-normal">
                    ({previewCount} {previewCount === 1 ? 'item' : 'items'} found)
                  </span>
                ) : null}
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground text-11 flex items-center gap-1 shrink-0">
                  <ArrowUpDown className="size-3 text-foreground shrink-0" aria-hidden="true" />
                  Sort:
                </span>
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                  <SelectTrigger
                    aria-label="Sort by field"
                    className="w-[110px] h-8 px-2.5 gap-1.5 [&_svg]:size-3 text-12 text-foreground rounded-md border-border bg-background shrink-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                    <SelectItem value="dateAdded" className="text-12 cursor-pointer">Date Added</SelectItem>
                    <SelectItem value="year" className="text-12 cursor-pointer">Year</SelectItem>
                    <SelectItem value="title" className="text-12 cursor-pointer">Title</SelectItem>
                    <SelectItem value="creator" className="text-12 cursor-pointer">Author</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
                  <SelectTrigger
                    aria-label="Sort direction"
                    className="w-[110px] h-8 px-2.5 gap-1.5 [&_svg]:size-3 text-12 text-foreground rounded-md border-border bg-background shrink-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                    <SelectItem value="desc" className="text-12 cursor-pointer">Descending</SelectItem>
                    <SelectItem value="asc" className="text-12 cursor-pointer">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line-separated Table (NO card border) */}
            <div className="max-h-40 min-h-[100px] overflow-y-auto overflow-x-auto scrollbar-thin text-11">
              {previewSamples.length > 0 ? (
                <table
                  className="w-full text-left border-collapse min-w-[480px] sm:min-w-full"
                  aria-label="Matching search preview publications"
                >
                  <thead>
                    <tr className="border-b border-border/60 text-11 font-medium text-muted-foreground">
                      <th scope="col" className="py-1.5 pr-3">Title</th>
                      <th scope="col" className="py-1.5 px-3 w-40">Creator</th>
                      <th scope="col" className="py-1.5 px-3 w-28 hidden sm:table-cell">Type</th>
                      <th scope="col" className="py-1.5 pl-3 w-16 text-right">Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {previewSamples.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-1.5 pr-3 max-w-[280px] truncate text-foreground font-medium" title={item.title}>
                          <span className="flex items-center gap-1.5 truncate">
                            <FileText className="size-3 text-foreground shrink-0" aria-hidden="true" />
                            <span className="truncate">{item.title || 'Untitled'}</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-3 truncate text-muted-foreground" title={item.authors?.join(', ') || ''}>
                          {item.authors?.[0] ? `${item.authors[0]}${item.authors.length > 1 ? ' et al.' : ''}` : '—'}
                        </td>
                        <td className="py-1.5 px-3 truncate text-muted-foreground capitalize hidden sm:table-cell">
                          {item.itemType || 'document'}
                        </td>
                        <td className="py-1.5 pl-3 text-right text-muted-foreground font-mono">
                          {item.year || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-24 flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
                  {isPreviewLoading ? (
                    <p className="text-11">Searching publications...</p>
                  ) : previewCount === 0 ? (
                    <p className="text-11">No publications match the specified criteria.</p>
                  ) : (
                    <p className="text-11">Set conditions above to preview matching publications in real-time.</p>
                  )}
                </div>
              )}
            </div>

            {previewCount !== null && previewCount > previewSamples.length && (
              <div className="pt-1.5 border-t border-border/40 text-11 text-muted-foreground text-center">
                + {previewCount - previewSamples.length} more publications match this search
              </div>
            )}
          </div>

          {/* Validation error */}
          {error && (
            <p role="alert" aria-live="assertive" className="text-11 font-medium text-destructive">
              {error}
            </p>
          )}

          {/* Footer - NO top border line, NO icon in buttons */}
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md shadow-none"
            >
              {isPending
                ? 'Saving...'
                : savedSearch
                ? 'Save Changes'
                : 'Save Search'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSavedSearchModal;
