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
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  FIELD_LABELS,
  humanizeFieldName,
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

export interface FieldConfig {
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

export function parseDurationParts(val: string): { count: string; unit: string } {
  if (!val || typeof val !== 'string') return { count: '30', unit: 'days' };
  const match = val.trim().match(/^(\d+)\s*([a-zA-Z]+)?$/);
  if (match) {
    const count = match[1] || '30';
    let unit = (match[2] || 'days').toLowerCase();
    if (unit.startsWith('d')) unit = 'days';
    else if (unit.startsWith('w')) unit = 'weeks';
    else if (unit.startsWith('m')) unit = 'months';
    else if (unit.startsWith('y')) unit = 'years';
    else unit = 'days';
    return { count, unit };
  }
  return { count: '30', unit: 'days' };
}

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

export const PRIMARY_FIELDS: {
  value: SavedSearchField;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
}[] = [
  { value: 'title', label: 'Title', icon: Type },
  { value: 'creator', label: 'Author / Creator', icon: User },
  { value: 'year', label: 'Year', icon: Calendar },
  { value: 'dateAdded', label: 'Date Added', icon: CalendarPlus },
  { value: 'dateModified', label: 'Date Modified', icon: CalendarClock },
  { value: 'anyField', label: 'Any Field', icon: Search },
  { value: 'itemType', label: 'Item Type', icon: Layers },
  { value: 'collection', label: 'Collection', icon: Folder },
  { value: 'tag', label: 'Tag', icon: Tag },
  { value: 'noteContent', label: 'Note', icon: StickyNote },
  { value: 'attachmentContent', label: 'Attachment Content', icon: FileText },
  { value: 'attachmentFilename', label: 'Attachment File Name', icon: Paperclip },
  { value: 'doi', label: 'DOI', icon: Hash },
  { value: 'isbn', label: 'ISBN', icon: Barcode },
  { value: 'url', label: 'URL', icon: Globe },
  { value: 'readStatus', label: 'Read Status', icon: CheckCircle2 },
  { value: 'rating', label: 'Rating', icon: Star },
];

export const PRIMARY_FIELD_SET = new Set(PRIMARY_FIELDS.map((f) => f.value));

export const ALL_SCHEMA_FIELDS: {
  value: SavedSearchField;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
}[] = Object.entries(FIELD_LABELS)
  .filter(
    ([key]) =>
      !PRIMARY_FIELD_SET.has(key as SavedSearchField) &&
      key !== 'citationCount' &&
      key !== 'referenceCount',
  )
  .map(([key, label]) => ({
    value: key as SavedSearchField,
    label,
    icon: BookOpen,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const FIELD_ICONS: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number | string }>
> = {
  title: Type,
  creator: User,
  year: Calendar,
  dateAdded: CalendarPlus,
  dateModified: CalendarClock,
  anyField: Search,
  itemType: Layers,
  collection: Folder,
  tag: Tag,
  noteContent: StickyNote,
  attachmentContent: FileText,
  attachmentFilename: Paperclip,
  doi: Hash,
  isbn: Barcode,
  url: Globe,
  readStatus: CheckCircle2,
  rating: Star,
  publicationTitle: BookOpen,
  abstract: AlignLeft,
};

export function getFieldConfig(field: SavedSearchField): FieldConfig {
  if (field === 'anyField') {
    return {
      value: 'anyField',
      label: 'Any Field',
      operators: [
        { value: 'contains', label: 'contains' },
        { value: 'doesNotContain', label: 'does not contain' },
        { value: 'is', label: 'is (exact)' },
        { value: 'isNot', label: 'is not' },
      ],
      placeholder: 'Search across all fields, authors, notes, tags...',
    };
  }

  if (
    field === 'dateAdded' ||
    field === 'dateModified' ||
    field === 'date' ||
    field === 'publicationDate' ||
    field === 'accessDate' ||
    field === 'accessedAt' ||
    field === 'filingDate' ||
    field === 'issueDate' ||
    field === 'dateDecided' ||
    field === 'dateEnacted'
  ) {
    const label =
      field === 'dateAdded'
        ? 'Date Added'
        : field === 'dateModified'
        ? 'Date Modified'
        : FIELD_LABELS[field] || humanizeFieldName(field);

    return {
      value: field,
      label,
      operators: [
        { value: 'isInTheLast', label: 'is in the last' },
        { value: 'isGreaterThan', label: 'is after (>)' },
        { value: 'isLessThan', label: 'is before (<)' },
        { value: 'is', label: 'is' },
        { value: 'isNot', label: 'is not' },
        { value: 'isBetween', label: 'is between' },
        { value: 'isPresent', label: 'is set' },
        { value: 'isAbsent', label: 'is not set' },
      ],
      placeholder: 'YYYY-MM-DD',
      defaultValue: '30 days',
    };
  }

  if (field === 'year' || field === 'numberOfVolumes' || field === 'numPages') {
    const label = FIELD_LABELS[field] || humanizeFieldName(field);
    return {
      value: field,
      label,
      operators: [
        { value: 'is', label: 'equals (=)' },
        { value: 'isGreaterThan', label: 'is greater than (>)' },
        { value: 'isLessThan', label: 'is less than (<)' },
        { value: 'isNot', label: 'is not equal to (≠)' },
        { value: 'isBetween', label: 'is between' },
        { value: 'isPresent', label: 'has value' },
        { value: 'isAbsent', label: 'is empty' },
      ],
      placeholder: 'Enter number...',
    };
  }

  if (field === 'itemType') {
    return {
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
    };
  }

  if (field === 'collection') {
    return {
      value: 'collection',
      label: 'Collection',
      operators: [
        { value: 'is', label: 'is in collection' },
        { value: 'isNot', label: 'is not in collection' },
        { value: 'isPresent', label: 'is in any collection' },
        { value: 'isAbsent', label: 'is unfiled (no collection)' },
      ],
      placeholder: 'Select collection...',
    };
  }

  if (field === 'tag') {
    return {
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
    };
  }

  if (field === 'hasAttachment') {
    return {
      value: 'hasAttachment',
      label: 'Has Attachment',
      operators: [{ value: 'is', label: 'is' }],
      placeholder: 'Select attachment status...',
      defaultValue: 'true',
    };
  }

  if (field === 'readStatus') {
    return {
      value: 'readStatus',
      label: 'Read Status',
      operators: [
        { value: 'is', label: 'is' },
        { value: 'isNot', label: 'is not' },
      ],
      placeholder: 'Select reading status...',
      defaultValue: 'unread',
    };
  }

  if (field === 'rating') {
    return {
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
    };
  }

  const label = FIELD_LABELS[field] || humanizeFieldName(field) || field;
  return {
    value: field,
    label,
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'is', label: 'is (exact)' },
      { value: 'isNot', label: 'is not' },
      { value: 'beginsWith', label: 'begins with' },
      { value: 'endsWith', label: 'ends with' },
      { value: 'isPresent', label: 'is not empty' },
      { value: 'isAbsent', label: 'is empty' },
    ],
    placeholder: `Enter ${label.toLowerCase()}...`,
  };
}

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

  const activeConfig = getFieldConfig(value);
  const ActiveIcon = FIELD_ICONS[value] || BookOpen;

  const filteredPrimary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PRIMARY_FIELDS;
    return PRIMARY_FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q),
    );
  }, [search]);

  const filteredAZ = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_SCHEMA_FIELDS;
    return ALL_SCHEMA_FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q),
    );
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
          className="w-full sm:w-[175px] h-8 px-2.5 flex items-center justify-between gap-1.5 text-13 font-normal text-foreground bg-background border border-border/80 rounded-md hover:border-foreground/30 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 transition-colors shrink-0 select-none cursor-pointer"
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <ActiveIcon className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span className="truncate">{activeConfig.label}</span>
          </span>
          <ChevronsUpDown className="size-3.5 text-foreground shrink-0 ml-1" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[230px] p-0 rounded-lg border border-border shadow-raised-300 bg-popover text-popover-foreground overflow-hidden z-50"
      >
        <div className="p-1.5 border-b border-border">
          <div className="flex items-center gap-1.5 h-8 px-2 rounded-md bg-background border border-border/80 text-13 focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary transition-colors hover:border-foreground/30">
            <Search className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
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
                  const first = filteredPrimary[0] || filteredAZ[0];
                  if (first) {
                    onChange(first.value);
                    setOpen(false);
                  }
                }
              }}
              className="flex-1 min-w-0 h-full bg-transparent text-13 text-foreground placeholder:text-foreground/50 outline-none leading-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-foreground hover:bg-muted p-0.5 rounded cursor-pointer flex items-center justify-center shrink-0"
                aria-label="Clear filter"
              >
                <X className="size-3 text-foreground shrink-0" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[280px] overflow-y-auto scrollbar-thin p-1 space-y-2">
          {filteredPrimary.length === 0 && filteredAZ.length === 0 ? (
            <div className="py-6 text-center text-11 text-foreground select-none">
              No matching fields
            </div>
          ) : (
            <>
              {filteredPrimary.length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-2 pt-1 pb-0.5 text-10 font-semibold text-foreground/70 uppercase tracking-wider select-none">
                    Primary Fields
                  </div>
                  {filteredPrimary.map((field) => {
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
                          'w-full h-7 px-2 py-1 flex items-center justify-between gap-2 rounded-sm text-13 text-left transition-colors cursor-pointer select-none',
                          isSelected
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground',
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Icon className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{field.label}</span>
                        </span>
                        {isSelected && (
                          <Check className="size-3.5 text-foreground shrink-0 ml-1" strokeWidth={1.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredAZ.length > 0 && (
                <div className="space-y-0.5 pt-1 border-t border-border">
                  <div className="px-2 pt-1 pb-0.5 text-10 font-semibold text-foreground/70 uppercase tracking-wider select-none">
                    All Fields (A–Z)
                  </div>
                  {filteredAZ.map((field) => {
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
                          'w-full h-7 px-2 py-1 flex items-center justify-between gap-2 rounded-sm text-13 text-left transition-colors cursor-pointer select-none',
                          isSelected
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground',
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Icon className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{field.label}</span>
                        </span>
                        {isSelected && (
                          <Check className="size-3.5 text-foreground shrink-0 ml-1" strokeWidth={1.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
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

  // Zotero standard search scope options
  const [searchSubcollections, setSearchSubcollections] = useState(true);
  const [showOnlyTopLevel, setShowOnlyTopLevel] = useState(false);
  const [includeParentAndChild, setIncludeParentAndChild] = useState(true);

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

        const scopeOpts =
          savedSearch.scopeOptions ||
          (savedSearch.conditions as any)?.scopeOptions ||
          {};
        setSearchSubcollections(scopeOpts.searchSubcollections !== false);
        setShowOnlyTopLevel(Boolean(scopeOpts.showOnlyTopLevel));
        setIncludeParentAndChild(scopeOpts.includeParentsAndChildren !== false);

        const rawConds = (savedSearch.conditions as any)?.conditions;
        if (Array.isArray(rawConds) && rawConds.length > 0) {
          setConditions(
            rawConds.map((c: any, idx: number) => ({
              id: `row-${idx}-${Date.now()}`,
              field: c.field || 'title',
              operator: c.operator || 'contains',
              value: c.value !== undefined && c.value !== null ? String(c.value) : '',
            })),
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
        setSearchSubcollections(true);
        setShowOnlyTopLevel(false);
        setIncludeParentAndChild(true);
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
          scopeOptions: {
            searchSubcollections,
            showOnlyTopLevel,
            includeParentsAndChildren: includeParentAndChild,
          },
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
  }, [
    conditions,
    conjunction,
    open,
    targetScope,
    searchSubcollections,
    showOnlyTopLevel,
    includeParentAndChild,
  ]);

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
    const config = getFieldConfig(newField);
    const defaultOp = config.operators[0]?.value || 'contains';
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
    } else if (defaultOp === 'isInTheLast') {
      defaultValue = '30 days';
    } else if (config.defaultValue) {
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
      prev.map((c) => {
        if (c.id !== id) return c;
        let nextVal = c.value;
        if (newOperator === 'isInTheLast' && (!c.value || !c.value.includes(' '))) {
          nextVal = '30 days';
        }
        return { ...c, operator: newOperator, value: nextVal };
      }),
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
        const config = getFieldConfig(firstCond.field);
        const fieldLabel = config.label || firstCond.field;
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
      scopeOptions: {
        searchSubcollections,
        showOnlyTopLevel,
        includeParentsAndChildren: includeParentAndChild,
      },
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
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            {savedSearch ? 'Edit Saved Search' : 'New Saved Search'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure search criteria and conditions to save a filtered view.
          </DialogDescription>
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
                className="h-8 text-13 text-foreground bg-background hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md border-border/80 placeholder:text-foreground/50"
              />
            </div>

            {/* Scope Selector: Personal vs Project library */}
            <div className="space-y-1.5">
              <Label htmlFor="smart-search-scope" className="text-11 font-medium text-foreground">
                Search In
              </Label>
              <Select
                value={targetScope}
                onValueChange={(val) => setTargetScope(val)}
                disabled={Boolean(savedSearch)}
              >
                <SelectTrigger
                  id="smart-search-scope"
                  size="sm"
                  className="w-full h-8 text-13 font-normal text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md"
                >
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                  <SelectItem value="user" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">
                    <span className="flex items-center gap-1.5 truncate">
                      <Library className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                      <span className="truncate">My Library</span>
                    </span>
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Users className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
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
            <div className="flex items-center gap-2 text-12 text-foreground">
              <span className="font-medium text-foreground">Match</span>
              <div
                role="radiogroup"
                aria-label="Match criteria"
                className="inline-flex rounded-md bg-muted/60 p-0.5 border border-border/80"
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
                      : 'text-foreground hover:bg-muted/40',
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
                      : 'text-foreground hover:bg-muted/40',
                  )}
                >
                  Any
                </button>
              </div>
              <span className="text-foreground">of the following conditions:</span>
            </div>
          </div>

          {/* 3. Criteria Rows Builder */}
          <div className="space-y-2">
            <div className="max-h-40 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
              {conditions.map((cond, idx) => {
                const activeConfig = getFieldConfig(cond.field);
                const isNoValueOperator =
                  cond.operator === 'isPresent' || cond.operator === 'isAbsent';

                return (
                  <div
                    key={cond.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:p-0 rounded-md sm:rounded-none bg-muted/30 sm:bg-transparent border border-border/50 sm:border-0"
                  >
                    {/* Field & Operator controls: Side-by-side grid on mobile, inline on desktop */}
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
                      {/* Field Select - 2-tier Schema Combobox Popover */}
                      <ConditionFieldSelect
                        value={cond.field}
                        onChange={(val) => handleFieldChange(cond.id, val)}
                        ariaLabel={`Field for condition ${idx + 1}`}
                      />

                      {/* Operator Select - Scaled compact popper */}
                      <Select
                        key={`${cond.id}-${cond.field}`}
                        value={cond.operator}
                        onValueChange={(val) =>
                          handleOperatorChange(cond.id, val as SavedSearchOperator)
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label={`Operator for condition ${idx + 1}`}
                          className="w-full sm:w-[135px] h-8 text-13 font-normal text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md shrink-0"
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
                              className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
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
                        cond.operator === 'isInTheLast' ? (
                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={1}
                              value={parseDurationParts(cond.value).count}
                              onChange={(e) => {
                                const count = e.target.value;
                                const unit = parseDurationParts(cond.value).unit;
                                handleValueChange(cond.id, `${count} ${unit}`);
                              }}
                              placeholder="30"
                              className="w-20 h-8 text-13 text-foreground bg-background hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md border-border/80"
                            />
                            <Select
                              value={parseDurationParts(cond.value).unit}
                              onValueChange={(val) => {
                                const count = parseDurationParts(cond.value).count;
                                handleValueChange(cond.id, `${count} ${val}`);
                              }}
                            >
                              <SelectTrigger
                                size="sm"
                                className="w-[105px] h-8 text-13 text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md shrink-0"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                sideOffset={4}
                                className="p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                              >
                                <SelectItem value="days" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Days</SelectItem>
                                <SelectItem value="weeks" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Weeks</SelectItem>
                                <SelectItem value="months" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Months</SelectItem>
                                <SelectItem value="years" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Years</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : cond.field === 'anyField' ? (
                          <Input
                            value={cond.value}
                            onChange={(e) => handleValueChange(cond.id, e.target.value)}
                            placeholder={activeConfig.placeholder}
                            aria-label={`Keyword for condition ${idx + 1}`}
                            className="flex-1 min-w-0 h-8 text-13 text-foreground bg-background hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md border-border/80 placeholder:text-foreground/50"
                          />
                        ) : cond.field === 'itemType' ? (
                          <div className="flex-1 min-w-0">
                            <Select
                              value={cond.value || itemTypeOptions[0]?.value || 'journalArticle'}
                              onValueChange={(val) => handleValueChange(cond.id, val)}
                            >
                              <SelectTrigger
                                size="sm"
                                aria-label={`Item type for condition ${idx + 1}`}
                                className="w-full h-8 text-13 font-normal text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md"
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
                                    className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
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
                                size="sm"
                                aria-label={`Collection for condition ${idx + 1}`}
                                className="w-full h-8 text-13 font-normal text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md"
                              >
                                <SelectValue placeholder="Select collection..." />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                sideOffset={4}
                                className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                              >
                                {collections.length === 0 ? (
                                  <div className="p-2 text-11 text-foreground text-center">
                                    No collections found
                                  </div>
                                ) : (
                                  collections.map((col: any) => (
                                    <SelectItem
                                      key={col.id}
                                      value={col.id}
                                      className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
                                    >
                                      <span className="flex items-center gap-1.5 truncate">
                                        <Folder className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
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
                              className="h-8 text-13 text-foreground bg-background hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md border-border/80 placeholder:text-foreground/50"
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
                            className="flex-1 min-w-0 h-8 text-13 text-foreground bg-background hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md border-border/80 placeholder:text-foreground/50"
                          />
                        ) : cond.field === 'readStatus' ? (
                          <div className="flex-1 min-w-0">
                            <Select
                              value={cond.value || 'unread'}
                              onValueChange={(val) => handleValueChange(cond.id, val)}
                            >
                              <SelectTrigger
                                size="sm"
                                aria-label={`Reading status for condition ${idx + 1}`}
                                className="w-full h-8 text-13 font-normal text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md"
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
                                    className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
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
                                size="sm"
                                aria-label={`Rating for condition ${idx + 1}`}
                                className="w-full h-8 text-13 font-normal text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md"
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
                                    className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
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
                                size="sm"
                                aria-label={`Attachment filter for condition ${idx + 1}`}
                                className="w-full h-8 text-13 font-normal text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md"
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
                                    className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
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
                            className="flex-1 min-w-0 h-8 text-13 text-foreground bg-background hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md border-border/80 placeholder:text-foreground/50"
                          />
                        )
                      ) : (
                        <div className="flex-1 min-w-0 h-8 flex items-center px-3 text-13 text-muted-foreground italic rounded-md border border-dashed border-border bg-muted/20">
                          No value required
                        </div>
                      )}

                      {/* Action buttons (+ / -) - Clean monochrome styling with project standard borders */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleAddCondition(idx)}
                          title="Add condition below"
                          aria-label={`Add condition after condition ${idx + 1}`}
                          className="size-8 text-foreground hover:bg-muted border border-border/80 hover:border-foreground/30 rounded-md cursor-pointer flex items-center justify-center shrink-0 transition-colors"
                        >
                          <Plus className="size-3.5 shrink-0" strokeWidth={1.5} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveCondition(cond.id)}
                          disabled={conditions.length <= 1}
                          title="Remove condition"
                          aria-label={`Remove condition ${idx + 1}`}
                          className="size-8 text-foreground hover:bg-muted border border-border/80 hover:border-foreground/30 rounded-md cursor-pointer disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shrink-0 transition-colors"
                        >
                          <Minus className="size-3.5 shrink-0" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Checkbox Options - Zotero Scope Options */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={searchSubcollections}
                onCheckedChange={(c) => setSearchSubcollections(!!c)}
              />
              <span className="text-12 text-foreground font-normal">Search subcollections</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={showOnlyTopLevel}
                onCheckedChange={(c) => setShowOnlyTopLevel(!!c)}
              />
              <span className="text-12 text-foreground font-normal">Show only top-level items</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={includeParentAndChild}
                onCheckedChange={(c) => setIncludeParentAndChild(!!c)}
              />
              <span className="text-12 text-foreground font-normal">Include parent and child items</span>
            </label>
          </div>

          {/* 5. Live Results Table - Line-separated, unboxed (KHÔNG BỌC KHUNG) */}
          <div className="flex-1 min-h-[160px] flex flex-col pt-1">
            {/* Table Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-border text-11">
              <div className="flex items-center gap-2" role="status" aria-live="polite">
                <span className="font-medium text-foreground">Preview results</span>
                {isPreviewLoading ? (
                  <span className="flex items-center gap-1 text-foreground font-normal">
                    <Loader2 className="size-3 animate-spin text-foreground" aria-hidden="true" />
                    Searching...
                  </span>
                ) : previewCount !== null ? (
                  <span className="text-foreground font-normal">
                    ({previewCount} {previewCount === 1 ? 'item' : 'items'} found)
                  </span>
                ) : null}
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-foreground text-12 flex items-center gap-1 shrink-0">
                  <ArrowUpDown className="size-3 text-foreground shrink-0" aria-hidden="true" strokeWidth={1.5} />
                  Sort:
                </span>
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                  <SelectTrigger
                    size="sm"
                    aria-label="Sort by field"
                    className="w-[130px] h-8 text-13 font-normal text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md shrink-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                    <SelectItem value="dateAdded" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Date Added</SelectItem>
                    <SelectItem value="year" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Year</SelectItem>
                    <SelectItem value="title" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Title</SelectItem>
                    <SelectItem value="creator" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Author</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
                  <SelectTrigger
                    size="sm"
                    aria-label="Sort direction"
                    className="w-[125px] h-8 text-13 font-normal text-foreground bg-background border-border/80 hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md shrink-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                    <SelectItem value="desc" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Descending</SelectItem>
                    <SelectItem value="asc" className="text-13 py-1.5 px-2 rounded-sm cursor-pointer">Ascending</SelectItem>
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
                    <tr className="border-b border-border/60 text-11 font-medium text-foreground">
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
                        <td className="py-1.5 px-3 truncate text-foreground" title={item.authors?.join(', ') || ''}>
                          {item.authors?.[0] ? `${item.authors[0]}${item.authors.length > 1 ? ' et al.' : ''}` : '—'}
                        </td>
                        <td className="py-1.5 px-3 truncate text-foreground capitalize hidden sm:table-cell">
                          {item.itemType || 'document'}
                        </td>
                        <td className="py-1.5 pl-3 text-right text-foreground font-mono">
                          {item.year || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-24 flex flex-col items-center justify-center text-center p-4 text-foreground">
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
              <div className="pt-1.5 border-t border-border/40 text-11 text-foreground text-center">
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
              className="h-8 px-3 text-13 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-8 px-4 text-13 font-medium cursor-pointer rounded-md shadow-none"
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
