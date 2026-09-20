'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Minus, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui/select';
import { cn } from '@/shared/lib/utils';
import { useItemTypes, SavedSearchService } from '../../data';
import {
  mapRegistryItemTypes,
  ALL_ITEM_TYPES_FLAT,
} from '../../types';
import type {
  CreateSavedSearchInput,
  SavedSearchField,
  SavedSearchOperator,
  SavedSearchConditionGroup,
} from '../../types/saved-searches.types';
import type { Item } from '../../types/items.types';

interface ConditionRow {
  id: string;
  field: SavedSearchField;
  operator: SavedSearchOperator;
  value: string;
}

interface CreateSavedSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateSavedSearchInput) => Promise<any> | void;
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
      { value: 'beginsWith', label: 'begins with' },
      { value: 'endsWith', label: 'ends with' },
    ],
    placeholder: 'e.g. Attention or Transformer',
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
    placeholder: 'e.g. Vaswani, Bengio, LeCun',
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
    placeholder: 'e.g. 2024',
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
    value: 'dateAdded',
    label: 'Date Added',
    operators: [
      { value: 'isGreaterThan', label: 'is after (>)' },
      { value: 'isLessThan', label: 'is before (<)' },
      { value: 'isPresent', label: 'is set' },
    ],
    placeholder: 'YYYY-MM-DD (e.g. 2024-01-01)',
  },
  {
    value: 'abstract',
    label: 'Abstract',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'doesNotContain', label: 'does not contain' },
    ],
    placeholder: 'Keywords in abstract...',
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
    placeholder: 'e.g. deep-learning, survey',
  },
  {
    value: 'publicationTitle',
    label: 'Publication / Journal',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'is', label: 'is (exact)' },
      { value: 'doesNotContain', label: 'does not contain' },
    ],
    placeholder: 'e.g. Nature, NeurIPS, IEEE',
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
    placeholder: '10.1145/... or 10.1038/...',
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
    placeholder: '978-0-...',
  },
  {
    value: 'collection',
    label: 'Collection',
    operators: [
      { value: 'is', label: 'is in collection ID' },
      { value: 'isNot', label: 'is not in collection ID' },
      { value: 'isPresent', label: 'is in any collection' },
      { value: 'isAbsent', label: 'is unfiled (no collection)' },
    ],
    placeholder: 'Collection ID...',
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
];

export function CreateSavedSearchModal({
  open,
  onOpenChange,
  onSubmit,
  scopeId = 'user',
  isPending = false,
}: CreateSavedSearchModalProps) {
  // ── Canonical Item Types fetched directly from Backend Registry ────────────
  const { types: registryItemTypes } = useItemTypes(scopeId);
  const itemTypeOptions = useMemo(() => {
    const serverDefinitions = mapRegistryItemTypes(registryItemTypes);
    if (serverDefinitions.length > 0) {
      return serverDefinitions
        .map((t) => ({ value: t.itemType, label: t.label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    return ALL_ITEM_TYPES_FLAT;
  }, [registryItemTypes]);

  const [name, setName] = useState('');
  const [conjunction, setConjunction] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<ConditionRow[]>([
    {
      id: 'row-1',
      field: 'title',
      operator: 'contains',
      value: '',
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  // Live Matching Preview State
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSamples, setPreviewSamples] = useState<Item[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reset modal state on open
  useEffect(() => {
    if (open) {
      setName('');
      setConjunction('AND');
      setConditions([
        {
          id: `row-${Date.now()}`,
          field: 'title',
          operator: 'contains',
          value: '',
        },
      ]);
      setError(null);
      setPreviewCount(null);
      setPreviewSamples([]);
    }
  }, [open]);

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

        const res = await SavedSearchService.preview(scopeId, conditionGroup);
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
  }, [conditions, conjunction, open, scopeId]);

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
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please provide a name for this saved search.');
      return;
    }

    const invalidRow = conditions.find((c) => {
      if (c.operator === 'isPresent' || c.operator === 'isAbsent') return false;
      return !c.value.trim();
    });

    if (invalidRow) {
      setError('Please enter a search value for every condition.');
      return;
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
      name: cleanName,
      conjunction,
      conditions: conditionGroup,
    };

    await onSubmit(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[560px] p-6 bg-background border border-border shadow-raised-200 rounded-lg gap-0"
      >
        {/* Header */}
        <DialogHeader className="text-left pb-4">
          <DialogTitle className="text-base font-medium text-foreground">
            New Saved Search
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search Name Input */}
          <div className="space-y-1.5">
            <Label htmlFor="smart-search-name" className="text-11 font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              id="smart-search-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Transformer Papers (2023–2024)"
              autoFocus
              className="h-8 text-12 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md border-border"
            />
          </div>

          {/* Criteria & Logic Conjunction */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-11 font-medium text-muted-foreground">
                Conditions
              </Label>
              <div className="flex items-center gap-2 text-11 text-muted-foreground">
                <span>Match</span>
                <div className="inline-flex rounded-md bg-muted p-0.5 border border-border">
                  <button
                    type="button"
                    onClick={() => setConjunction('AND')}
                    className={cn(
                      'px-2 py-0.5 rounded text-11 transition-colors cursor-pointer',
                      conjunction === 'AND'
                        ? 'bg-background text-foreground font-medium shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConjunction('OR')}
                    className={cn(
                      'px-2 py-0.5 rounded text-11 transition-colors cursor-pointer',
                      conjunction === 'OR'
                        ? 'bg-background text-foreground font-medium shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Any
                  </button>
                </div>
              </div>
            </div>

            {/* Condition Rows List */}
            <div className="space-y-2">
              {conditions.map((cond, idx) => {
                const activeConfig =
                  FIELD_CONFIGS.find((f) => f.value === cond.field) || FIELD_CONFIGS[0];
                const isNoValueOperator =
                  cond.operator === 'isPresent' || cond.operator === 'isAbsent';

                return (
                  <div key={cond.id} className="flex items-center gap-2">
                    {/* Field Select */}
                    <Select
                      value={cond.field}
                      onValueChange={(val) =>
                        handleFieldChange(cond.id, val as SavedSearchField)
                      }
                    >
                      <SelectTrigger className="w-[140px] h-8 text-12 text-foreground rounded-md border-border shrink-0">
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                        {FIELD_CONFIGS.map((f) => (
                          <SelectItem
                            key={f.value}
                            value={f.value}
                            className="text-12 rounded-sm cursor-pointer"
                          >
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Operator Select */}
                    <Select
                      value={cond.operator}
                      onValueChange={(val) =>
                        handleOperatorChange(cond.id, val as SavedSearchOperator)
                      }
                    >
                      <SelectTrigger className="w-[130px] h-8 text-12 text-foreground rounded-md border-border shrink-0">
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                        {activeConfig.operators.map((op) => (
                          <SelectItem
                            key={op.value}
                            value={op.value}
                            className="text-12 rounded-sm cursor-pointer"
                          >
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Value Input or Select */}
                    {!isNoValueOperator ? (
                      cond.field === 'itemType' ? (
                        <div className="flex-1 min-w-0">
                          <Select
                            value={cond.value || itemTypeOptions[0]?.value || 'journalArticle'}
                            onValueChange={(val) => handleValueChange(cond.id, val)}
                          >
                            <SelectTrigger className="w-full h-8 text-12 text-foreground rounded-md border-border">
                              <SelectValue placeholder="Select item type" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                              {itemTypeOptions.map((opt: { value: string; label: string }) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-12 rounded-sm cursor-pointer"
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : cond.field === 'readStatus' ? (
                        <div className="flex-1 min-w-0">
                          <Select
                            value={cond.value || 'unread'}
                            onValueChange={(val) => handleValueChange(cond.id, val)}
                          >
                            <SelectTrigger className="w-full h-8 text-12 text-foreground rounded-md border-border">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                              {READ_STATUS_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-12 rounded-sm cursor-pointer"
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
                            <SelectTrigger className="w-full h-8 text-12 text-foreground rounded-md border-border">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                              {RATING_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-12 rounded-sm cursor-pointer"
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
                            <SelectTrigger className="w-full h-8 text-12 text-foreground rounded-md border-border">
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                              {HAS_ATTACHMENT_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-12 rounded-sm cursor-pointer"
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
                          className="flex-1 min-w-0 h-8 text-12 text-foreground rounded-md border-border placeholder:text-muted-foreground/60"
                        />
                      )
                    ) : (
                      <div className="flex-1 min-w-0 h-8 flex items-center px-3 text-12 text-muted-foreground italic rounded-md border border-dashed border-border bg-muted/20">
                        No value required
                      </div>
                    )}

                    {/* Action buttons (+ / -) */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleAddCondition(idx)}
                        title="Add condition below"
                        className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer"
                      >
                        <Plus className="size-4 shrink-0" strokeWidth={1.5} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveCondition(cond.id)}
                        disabled={conditions.length <= 1}
                        title="Remove condition"
                        className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Minus className="size-4 shrink-0" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Matching Preview */}
          {(previewCount !== null || isPreviewLoading) && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-11 font-medium text-muted-foreground">
                  Matching publications
                </span>
                {isPreviewLoading ? (
                  <span className="flex items-center gap-1.5 text-11 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin text-primary" />
                    Searching...
                  </span>
                ) : previewCount !== null ? (
                  <span className="text-11 font-medium text-foreground">
                    {previewCount} {previewCount === 1 ? 'item' : 'items'} found
                  </span>
                ) : null}
              </div>

              {/* Sample matches list */}
              {previewCount !== null && previewCount > 0 && previewSamples.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {previewSamples.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-12 text-foreground truncate"
                    >
                      <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                      <span className="truncate flex-1" title={item.title}>
                        {item.title}
                      </span>
                      {item.year && (
                        <span className="text-11 font-mono text-muted-foreground shrink-0">
                          ({item.year})
                        </span>
                      )}
                    </div>
                  ))}
                  {previewCount > 3 && (
                    <p className="text-11 text-muted-foreground pt-0.5">
                      +{previewCount - 3} more items
                    </p>
                  )}
                </div>
              )}

              {previewCount === 0 && !isPreviewLoading && (
                <p className="text-11 text-muted-foreground">
                  No publications in this library match the specified conditions.
                </p>
              )}
            </div>
          )}

          {/* Validation error */}
          {error && (
            <p className="text-11 font-medium text-destructive">{error}</p>
          )}

          {/* Footer */}
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
              disabled={isPending || !name.trim()}
              className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md shadow-none"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin text-primary-foreground shrink-0" />
              ) : (
                'Save Search'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSavedSearchModal;
