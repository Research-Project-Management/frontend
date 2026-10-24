'use client';

import { useMemo } from 'react';
import { useTags } from '@/features/library/sdk/queries/tags-notes.queries';
import type { TagWithCount } from '@/features/library/domain/types/tags.types';
import { useLibraryCountsQuery, useItemTypes } from '@/features/library/sdk/queries/catalog.queries';
import type { Item } from '@/features/library/domain/types/library.types';
import {
  ALL_ITEM_TYPES_FLAT,
  LIBRARY_ITEM_TYPES,
  mapRegistryItemTypes,
} from '@/features/library/domain/types/library.types';
import {
  calculateFilterMatchScore,
  formatTypeFallback,
  KNOWN_TYPE_ALIASES,
} from '@/features/library/domain/filter-matcher.domain';
import { useLibraryNavigation } from '@/features/library/core/coordinator/navigation.coordinator';

export const FILE_STATUS_OPTIONS = [
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

export const READING_STATUS_OPTIONS = [
  { id: 'unread' as const, label: 'Unread', aliases: ['not read', 'new', 'chua doc', 'moi'] },
  { id: 'reading' as const, label: 'Reading', aliases: ['in progress', 'dang doc', 'current'] },
  { id: 'completed' as const, label: 'Completed', aliases: ['done', 'finished', 'da doc', 'xong', 'read'] },
];

export interface UseLibraryFacetCountsParams {
  scopeId: string;
  items?: Item[];
  searchQuery: string;
  isOpen?: boolean;
}

export function useLibraryFacetCounts({
  scopeId,
  searchQuery,
  isOpen = true,
}: UseLibraryFacetCountsParams) {
  const { searchParams, updateQuery } = useLibraryNavigation();
  const { data: counts } = useLibraryCountsQuery(scopeId, { enabled: isOpen });
  const { tags } = useTags(scopeId, { enabled: isOpen });

  const rawFileStatus = searchParams.get('fileStatus');
  const hasFileParam = searchParams.get('hasFile');
  const hasNotesParam = searchParams.get('hasNotes');

  const fileStatus = useMemo(() => {
    if (rawFileStatus) return rawFileStatus;
    if (hasNotesParam === 'true') return 'has-notes';
    if (hasFileParam === 'true') return 'has-pdf';
    if (hasFileParam === 'false') return 'missing-pdf';
    return 'all';
  }, [rawFileStatus, hasNotesParam, hasFileParam]);

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

  const { types: registryItemTypes } = useItemTypes({ scopeId, enabled: isOpen });
  const serverItemTypes = useMemo(() => {
    const mapped = mapRegistryItemTypes(registryItemTypes);
    return mapped.length > 0 ? mapped : Object.values(LIBRARY_ITEM_TYPES);
  }, [registryItemTypes]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (fileStatus !== 'all') count++;
    if (readStatuses.length > 0) count += readStatuses.length;
    if (itemTypes.length > 0) count += itemTypes.length;
    if (fromYear !== null || toYear !== null || Boolean(startDate) || Boolean(endDate)) count++;
    if (activeTags.length > 0) count += activeTags.length;
    return count;
  }, [fileStatus, readStatuses, itemTypes, fromYear, toYear, startDate, endDate, activeTags]);

  const replaceFilterQuery = (mutator: (params: URLSearchParams) => void) => {
    updateQuery(mutator, { replace: true, resetPage: true });
  };

  const handleFileStatusToggle = (status: 'has-pdf' | 'missing-pdf' | 'has-notes') => {
    replaceFilterQuery((params) => {
      if (fileStatus === status) {
        params.delete('fileStatus');
        params.delete('hasFile');
        params.delete('hasNotes');
      } else {
        params.set('fileStatus', status);
        if (status === 'has-pdf') {
          params.set('hasFile', 'true');
          params.delete('hasNotes');
        } else if (status === 'missing-pdf') {
          params.set('hasFile', 'false');
          params.delete('hasNotes');
        } else if (status === 'has-notes') {
          params.set('hasNotes', 'true');
          params.delete('hasFile');
        }
      }
    });
  };

  const handleReadStatusToggle = (status: 'unread' | 'reading' | 'completed') => {
    replaceFilterQuery((params) => {
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

  const itemTypesSet = useMemo(
    () => new Set(itemTypes.map((t) => t.toLowerCase())),
    [itemTypes],
  );

  const activeTagsSet = useMemo(
    () => new Set(activeTags.map((t) => t.toLowerCase())),
    [activeTags],
  );

  const handleTypeToggle = (typeId: string) => {
    replaceFilterQuery((params) => {
      const lower = typeId.toLowerCase();
      const nextTypes = itemTypesSet.has(lower)
        ? itemTypes.filter((t) => t.toLowerCase() !== lower)
        : [...itemTypes, typeId];
      params.delete('type');
      if (nextTypes.length > 0) {
        params.set('type', nextTypes.join(','));
      }
    });
  };

  const handleYearPreset = (from: number | null, to: number | null) => {
    replaceFilterQuery((params) => {
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
    replaceFilterQuery((params) => {
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
    replaceFilterQuery((params) => {
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
    replaceFilterQuery((params) => {
      const lower = tagName.toLowerCase();
      const nextTags = activeTagsSet.has(lower)
        ? activeTags.filter((t) => t.toLowerCase() !== lower)
        : [...activeTags, tagName];
      params.delete('tag');
      if (nextTags.length > 0) {
        params.set('tag', nextTags.join(','));
      }
    });
  };

  const currentYear = new Date().getFullYear();
  const hasDateFilter = Boolean(startDate || endDate || fromYear !== null || toYear !== null);

  const matchingFileItems = useMemo(() => {
    if (!isOpen) return [];
    return FILE_STATUS_OPTIONS.map((item) => ({
      ...item,
      match: calculateFilterMatchScore(item.label, searchQuery, item.aliases),
    }))
      .filter((item) => item.match.matches)
      .sort((a, b) => b.match.score - a.match.score);
  }, [searchQuery, isOpen]);

  const matchingReadingItems = useMemo(() => {
    if (!isOpen) return [];
    return READING_STATUS_OPTIONS.map((item) => ({
      ...item,
      match: calculateFilterMatchScore(item.label, searchQuery, item.aliases),
    }))
      .filter((item) => item.match.matches)
      .sort((a, b) => b.match.score - a.match.score);
  }, [searchQuery, isOpen]);

  const dynamicTypes = useMemo(() => {
    if (!isOpen) return [];
    const existingTypeMap = new Map<string, { canonicalKey: string; count: number }>();

    const serverTypeCounts = counts?.itemTypes || counts?.byItemType;
    if (serverTypeCounts && typeof serverTypeCounts === 'object') {
      for (const [rawType, rawCount] of Object.entries(serverTypeCounts)) {
        const trimmed = rawType.trim();
        const count = Number(rawCount) || 0;
        if (trimmed && count > 0) {
          const lower = trimmed.toLowerCase();
          const prev = existingTypeMap.get(lower);
          if (prev) {
            prev.count += count;
          } else {
            existingTypeMap.set(lower, { canonicalKey: trimmed, count });
          }
        }
      }
    }

    for (const activeType of itemTypes) {
      const lower = activeType.toLowerCase().trim();
      if (lower && !existingTypeMap.has(lower)) {
        existingTypeMap.set(lower, { canonicalKey: activeType, count: 0 });
      }
    }

    if (existingTypeMap.size === 0) {
      return [];
    }

    const serverDefByLower = new Map<string, (typeof serverItemTypes)[number]>();
    for (const def of serverItemTypes) {
      serverDefByLower.set(def.itemType.toLowerCase(), def);
      serverDefByLower.set(def.label.toLowerCase(), def);
    }

    const flatDefByLower = new Map<string, (typeof ALL_ITEM_TYPES_FLAT)[number]>();
    for (const def of ALL_ITEM_TYPES_FLAT) {
      flatDefByLower.set(def.value.toLowerCase(), def);
      flatDefByLower.set(def.label.toLowerCase(), def);
    }

    const options = Array.from(existingTypeMap.entries()).map(([lowerId, { canonicalKey, count }]) => {
      const serverDef = serverDefByLower.get(lowerId);
      const foundDef = flatDefByLower.get(lowerId);
      const defFromLib = LIBRARY_ITEM_TYPES[canonicalKey];
      const label = serverDef?.label || foundDef?.label || defFromLib?.label || formatTypeFallback(canonicalKey);
      const canonicalId = serverDef?.itemType || foundDef?.value || canonicalKey;
      const knownAliases = KNOWN_TYPE_ALIASES[lowerId] || [];
      const aliases = Array.from(new Set([label, canonicalId, canonicalKey, ...knownAliases]));

      return {
        id: canonicalId,
        label,
        count,
        aliases,
      };
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [counts, itemTypes, serverItemTypes, isOpen]);

  const matchingTypeItems = useMemo(() => {
    if (!isOpen) return [];
    return dynamicTypes
      .map((item) => ({
        ...item,
        match: calculateFilterMatchScore(item.label, searchQuery, item.aliases),
      }))
      .filter((item) => item.match.matches)
      .sort((a, b) => b.match.score - a.match.score);
  }, [dynamicTypes, searchQuery, isOpen]);

  const dateSectionMatch = useMemo(() => {
    if (!isOpen) return { matches: false, score: 0 };
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
  }, [searchQuery, currentYear, isOpen]);

  const matchingTags = useMemo(() => {
    if (!isOpen) return [];
    const list = tags.filter((t: TagWithCount) => {
      const count = t._count?.itemTags ?? 0;
      if (count > 0) return true;
      return activeTagsSet.has(t.name.toLowerCase());
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
  }, [tags, searchQuery, activeTagsSet, isOpen]);

  const totalMatchesCount =
    matchingFileItems.length +
    matchingReadingItems.length +
    matchingTypeItems.length +
    (dateSectionMatch.matches ? 1 : 0) +
    matchingTags.length;

  return {
    fileStatus,
    readStatuses,
    itemTypes,
    startDate,
    endDate,
    activeTags,
    activeCount,
    hasDateFilter,
    matchingFileItems,
    matchingReadingItems,
    matchingTypeItems,
    dateSectionMatch,
    matchingTags,
    totalMatchesCount,
    handleFileStatusToggle,
    handleReadStatusToggle,
    handleTypeToggle,
    handleStartDateSelect,
    handleEndDateSelect,
    handleClearDate,
    handleTagToggle,
  };
}
