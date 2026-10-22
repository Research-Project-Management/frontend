'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useItemTypes } from '@/features/library/sdk/queries/catalog.queries';
import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { useTags } from '@/features/library/sdk/queries/tags-notes.queries';
import { useSavedSearches } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import {
  mapRegistryItemTypes,
  type Collection,
} from '@/features/library/domain/types/library.types';
import type {
  CreateSavedSearchInput,
  SavedSearchField,
  SavedSearchOperator,
  SavedSearchConditionGroup,
  SavedSearch,
} from '@/features/library/domain/types/saved-searches.types';
import type { Item } from '@/features/library/domain/types/items.types';
import {
  type ConditionRow,
  getFieldConfig,
  formatConditionValue,
} from '@/features/library/domain/saved-search-schema.domain';

export interface UseSavedSearchBuilderParams {
  open: boolean;
  savedSearch?: SavedSearch | null;
  scopeId?: string;
  onSubmit: (data: CreateSavedSearchInput) => Promise<unknown> | void;
  onOpenChange: (open: boolean) => void;
}

export function useSavedSearchBuilder({
  open,
  savedSearch,
  scopeId = 'user',
  onSubmit,
  onOpenChange,
}: UseSavedSearchBuilderParams) {
  const [targetScope, setTargetScope] = useState<string>(scopeId || 'user');

  useEffect(() => {
    if (savedSearch?.scopeId) {
      setTargetScope(savedSearch.scopeId);
    } else if (scopeId) {
      setTargetScope(scopeId);
    }
  }, [savedSearch, scopeId]);

  const { types: registryItemTypes } = useItemTypes(targetScope);
  const itemTypeOptions = useMemo(() => {
    return mapRegistryItemTypes(registryItemTypes)
      .filter(
        (t) =>
          t.isBibliographic !== false &&
          !t.isSpecial &&
          t.itemType !== 'attachment' &&
          t.itemType !== 'note' &&
          t.itemType !== 'annotation',
      )
      .map((t) => ({ value: t.itemType, label: t.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [registryItemTypes]);

  const { data: collections = [] } = useCollectionsQuery(targetScope, {
    enabled: open,
  });
  const { tags = [] } = useTags(targetScope, { enabled: open });
  const { previewConditions } = useSavedSearches(targetScope, { enabled: false });
  const tagList = useMemo(
    () =>
      Array.from(
        new Set(
          tags.map((t: { name?: string } | string) =>
            typeof t === 'string' ? t : t?.name || '',
          ),
        ),
      ).filter(Boolean) as string[],
    [tags],
  );

  const [name, setName] = useState('');
  const [conjunction, setConjunction] = useState<'AND' | 'OR'>('AND');
  const [sortBy, setSortBy] = useState<'dateAdded' | 'year' | 'title' | 'creator'>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSamples, setPreviewSamples] = useState<Item[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      if (savedSearch) {
        setName(savedSearch.name || '');
        const condObj =
          typeof savedSearch.conditions === 'object' && savedSearch.conditions !== null
            ? (savedSearch.conditions as {
                conjunction?: string;
                scopeOptions?: {
                  searchSubcollections?: boolean;
                  showOnlyTopLevel?: boolean;
                  includeParentsAndChildren?: boolean;
                };
                conditions?: Array<{ field?: string; operator?: string; value?: unknown }>;
              })
            : null;
        const conj = savedSearch.conjunction || condObj?.conjunction || 'AND';
        setConjunction(conj === 'OR' ? 'OR' : 'AND');
        setSortBy(savedSearch.sortBy || 'dateAdded');
        setSortOrder(savedSearch.sortOrder || 'desc');

        const scopeOpts = savedSearch.scopeOptions || condObj?.scopeOptions || {};
        setSearchSubcollections(scopeOpts.searchSubcollections !== false);
        setShowOnlyTopLevel(Boolean(scopeOpts.showOnlyTopLevel));
        setIncludeParentAndChild(scopeOpts.includeParentsAndChildren !== false);

        const rawConds = condObj?.conditions;
        if (Array.isArray(rawConds) && rawConds.length > 0) {
          setConditions(
            rawConds.map((c, idx: number) => ({
              id: `row-${idx}-${Date.now()}`,
              field: (c.field || 'title') as SavedSearchField,
              operator: (c.operator || 'contains') as SavedSearchOperator,
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

    let cancelled = false;
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
          if (!cancelled) {
            setPreviewCount(null);
            setPreviewSamples([]);
            setIsPreviewLoading(false);
          }
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

        const res = await previewConditions(conditionGroup);
        if (!cancelled) {
          setPreviewCount(res.count ?? 0);
          setPreviewSamples(res.sampleItems || []);
        }
      } catch {
        // Silently ignore preview errors during active typing
      } finally {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
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
    previewConditions,
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
            const found = collections.find((c: Collection) => c.id === firstCond.value);
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

  return {
    targetScope,
    setTargetScope,
    itemTypeOptions,
    collections,
    tagList,
    name,
    setName,
    conjunction,
    setConjunction,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    searchSubcollections,
    setSearchSubcollections,
    showOnlyTopLevel,
    setShowOnlyTopLevel,
    includeParentAndChild,
    setIncludeParentAndChild,
    conditions,
    error,
    setError,
    previewCount,
    previewSamples,
    isPreviewLoading,
    handleAddCondition,
    handleRemoveCondition,
    handleFieldChange,
    handleOperatorChange,
    handleValueChange,
    handleSubmit,
  };
}
