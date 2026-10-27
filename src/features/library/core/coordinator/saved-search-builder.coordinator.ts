'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useItemTypes } from '@/features/library/sdk/queries/catalog.queries';
import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { useTags } from '@/features/library/sdk/queries/tags-notes.queries';
import { useSavedSearches } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import {
  mapRegistryItemTypes,
} from '@/features/library/domain/types/library.types';
import type {
  CreateSavedSearchInput,
  SavedSearchField,
  SavedSearchOperator,
  SavedSearchConditionGroup,
  SavedSearch,
} from '@/features/library/domain/types/saved-searches.types';
import type { Item } from '@/features/library/domain/types/items.types';
import type { ConditionRow } from '@/features/library/domain/saved-search-schema.domain';
import { SavedSearchAstEngine } from '@/features/library/domain/saved-search-ast.domain';

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
  const resolveDefaultScope = (
    search?: SavedSearch | null,
    rawScopeId?: string,
  ): string =>
    search?.scope ||
    search?.scopeId ||
    (rawScopeId && !['all', 'trash', 'duplicates', 'unfiled'].includes(rawScopeId)
      ? rawScopeId
      : 'user');

  const [targetScope, setTargetScope] = useState<string>(() =>
    resolveDefaultScope(savedSearch, scopeId),
  );

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

  const [conditions, setConditions] = useState<ConditionRow[]>(
    () => SavedSearchAstEngine.hydrate(null).rows,
  );
  const [error, setError] = useState<string | null>(null);

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSamples, setPreviewSamples] = useState<Item[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const previewRequestSeqRef = useRef(0);
  const preservedNestedGroupsRef = useRef<SavedSearchConditionGroup[]>([]);

  useEffect(() => {
    if (!open) {
      previewRequestSeqRef.current += 1;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setIsPreviewLoading(false);
      return;
    }

    setTargetScope(
      savedSearch?.scope ||
        savedSearch?.scopeId ||
        (scopeId && !['all', 'trash', 'duplicates', 'unfiled'].includes(scopeId)
          ? scopeId
          : 'user'),
    );

    if (savedSearch) {
      setName(savedSearch.name || '');
      const rawGroup =
        typeof savedSearch.conditions === 'object' && savedSearch.conditions !== null
          ? (savedSearch.conditions as SavedSearchConditionGroup)
          : null;
      const hydrated = SavedSearchAstEngine.hydrate(rawGroup);
      const conj = savedSearch.conjunction || hydrated.conjunction;
      setConjunction(conj === 'OR' ? 'OR' : 'AND');

      const rawSort = savedSearch.sortBy;
      const normalizedSort: 'dateAdded' | 'year' | 'title' | 'creator' =
        rawSort === 'year' || rawSort === 'title' || rawSort === 'creator'
          ? rawSort
          : rawSort === 'authors'
            ? 'creator'
            : 'dateAdded';
      setSortBy(normalizedSort);
      setSortOrder(savedSearch.sortOrder || 'desc');

      const scopeOpts = savedSearch.scopeOptions || hydrated.scopeOptions;
      setSearchSubcollections(scopeOpts.searchSubcollections !== false);
      setShowOnlyTopLevel(Boolean(scopeOpts.showOnlyTopLevel));
      setIncludeParentAndChild(scopeOpts.includeParentsAndChildren !== false);

      preservedNestedGroupsRef.current = hydrated.preservedGroups;
      setConditions(hydrated.rows);
    } else {
      const hydrated = SavedSearchAstEngine.hydrate(null);
      preservedNestedGroupsRef.current = [];
      setName('');
      setConjunction(hydrated.conjunction);
      setSortBy('dateAdded');
      setSortOrder('desc');
      setSearchSubcollections(hydrated.scopeOptions.searchSubcollections);
      setShowOnlyTopLevel(hydrated.scopeOptions.showOnlyTopLevel);
      setIncludeParentAndChild(hydrated.scopeOptions.includeParentsAndChildren);
      setConditions(hydrated.rows);
    }
    setError(null);
    setPreviewCount(null);
    setPreviewSamples([]);
  }, [open, savedSearch, scopeId]);

  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const previewResult = SavedSearchAstEngine.validate(
      conditions,
      conjunction,
      preservedNestedGroupsRef.current,
      'preview',
      {
        searchSubcollections,
        showOnlyTopLevel,
        includeParentsAndChildren: includeParentAndChild,
      },
    );

    if (!previewResult.hasActiveConditions) {
      previewRequestSeqRef.current += 1;
      setPreviewCount(0);
      setPreviewSamples([]);
      setIsPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);

    debounceRef.current = setTimeout(async () => {
      const seq = ++previewRequestSeqRef.current;
      try {
        const res = await previewConditions({
          conditions: previewResult.payload,
          sortBy,
          sortOrder: sortOrder as 'asc' | 'desc',
          scopeOptions: previewResult.payload.scopeOptions,
        });
        if (!cancelled && seq === previewRequestSeqRef.current) {
          setPreviewCount(res.count ?? 0);
          setPreviewSamples(res.sampleItems || []);
        }
      } catch {
        // Silently ignore preview errors during active typing
      } finally {
        if (!cancelled && seq === previewRequestSeqRef.current) {
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
    sortBy,
    sortOrder,
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
    setConditions((prev) =>
      prev.map((c) =>
        c.id === id
          ? SavedSearchAstEngine.transitionCondition(
              c,
              { field: newField },
              { itemTypeOptions, collections },
            )
          : c,
      ),
    );
  };

  const handleOperatorChange = (id: string, newOperator: SavedSearchOperator) => {
    setConditions((prev) =>
      prev.map((c) =>
        c.id === id
          ? SavedSearchAstEngine.transitionCondition(c, { operator: newOperator })
          : c,
      ),
    );
  };

  const handleValueChange = (id: string, newValue: string) => {
    setConditions((prev) =>
      prev.map((c) =>
        c.id === id
          ? SavedSearchAstEngine.transitionCondition(c, { value: newValue })
          : c,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = SavedSearchAstEngine.validate(
      conditions,
      conjunction,
      preservedNestedGroupsRef.current,
      'submit',
      {
        searchSubcollections,
        showOnlyTopLevel,
        includeParentsAndChildren: includeParentAndChild,
      },
    );

    if (!validation.valid) {
      setError(
        validation.errors[0] ||
          'Please enter or select a search value for every condition.',
      );
      return;
    }

    const resolvedName =
      name.trim() ||
      SavedSearchAstEngine.synthesizeAutoName(conditions, { collections });

    setError(null);

    const payload: CreateSavedSearchInput = {
      name: resolvedName,
      conjunction,
      conditions: validation.payload,
      sortBy,
      sortOrder,
      targetScope,
      scope: targetScope,
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
