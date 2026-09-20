/**
 * Pure Domain Model: Deep Metadata Diff & Asset Aggregation Engine
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 *
 * Zotero-grade Deep Metadata Diff & Asset Aggregation Engine for Duplicate Merging.
 * Inspects all canonical bibliographic fields, flags field conflicts,
 * computes smart value recommendations, and calculates non-destructive asset union.
 */

import type { Item } from '../types/library.types';

export interface MergeFieldDefinition {
  key: string;
  label: string;
  category: 'core' | 'details' | 'identifiers' | 'publishing';
  description?: string;
}

export const MERGEABLE_FIELDS: MergeFieldDefinition[] = [
  // Core Bibliographic
  { key: 'title', label: 'Title', category: 'core' },
  { key: 'itemType', label: 'Item Type', category: 'core' },
  { key: 'authors', label: 'Authors', category: 'core' },
  { key: 'year', label: 'Publication Year', category: 'core' },
  { key: 'publicationTitle', label: 'Publication / Journal', category: 'core' },
  { key: 'doi', label: 'DOI', category: 'core' },
  { key: 'arxivId', label: 'arXiv ID', category: 'core' },

  // Details
  { key: 'abstract', label: 'Abstract', category: 'details' },
  { key: 'volume', label: 'Volume', category: 'details' },
  { key: 'issue', label: 'Issue', category: 'details' },
  { key: 'pages', label: 'Pages', category: 'details' },
  { key: 'publisher', label: 'Publisher', category: 'details' },
  { key: 'place', label: 'Place of Publication', category: 'details' },
  { key: 'publicationDate', label: 'Publication Date', category: 'details' },

  // Identifiers & Web
  { key: 'url', label: 'URL', category: 'identifiers' },
  { key: 'openAccessPdfUrl', label: 'Open Access PDF URL', category: 'identifiers' },
  { key: 'isbn', label: 'ISBN', category: 'identifiers' },
  { key: 'issn', label: 'ISSN', category: 'identifiers' },
  { key: 'pmid', label: 'PMID', category: 'identifiers' },
  { key: 'citationKey', label: 'Citation Key', category: 'identifiers' },

  // Publishing & Extras
  { key: 'language', label: 'Language', category: 'publishing' },
  { key: 'series', label: 'Series', category: 'publishing' },
  { key: 'seriesTitle', label: 'Series Title', category: 'publishing' },
  { key: 'seriesNumber', label: 'Series Number', category: 'publishing' },
  { key: 'rights', label: 'Rights / License', category: 'publishing' },
  { key: 'extra', label: 'Extra Notes / BibTeX Extra', category: 'publishing' },
];

export type DiffStatus =
  | 'IDENTICAL'
  | 'CONFLICT'
  | 'MISSING_IN_MASTER'
  | 'MISSING_IN_CANDIDATE';

export interface FieldOptionValue {
  itemId: string;
  itemTitle: string;
  isMaster: boolean;
  rawValue: unknown;
  displayValue: string;
  isEmpty: boolean;
  sourceItemIndex: number;
  value?: unknown;
  formattedDisplay?: string;
}

export interface ItemFieldDiff {
  key: string;
  label: string;
  category: 'core' | 'details' | 'identifiers' | 'publishing';
  status: DiffStatus;
  hasConflict: boolean;
  options: FieldOptionValue[];
  masterValue?: FieldOptionValue;
  recommendedItemId: string;
  recommendedValue?: unknown;
  candidateValue?: unknown;
}

export interface MergeInspectionResult {
  fields: ItemFieldDiff[];
  hasConflicts: boolean;
  conflictCount: number;
  identicalCount: number;
  missingInMasterCount: number;
}

function normalizeCompareValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) {
    return val
      .map((x) =>
        typeof x === 'object'
          ? JSON.stringify(x)
          : String(x).trim().toLowerCase()
      )
      .sort()
      .join(';');
  }
  return String(val).trim().toLowerCase();
}

export function formatFieldValueDisplay(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '— (Empty)';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '— (Empty)';
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return (
            obj.fullName ||
            obj.name ||
            [obj.firstName, obj.lastName].filter(Boolean).join(' ') ||
            JSON.stringify(item)
          );
        }
        return String(item);
      })
      .join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Inspects differences across an array of duplicate records against an authoritative master record.
 */
export function inspectItemDifferences(
  items: Item[],
  masterId: string,
  customFields: MergeFieldDefinition[] = MERGEABLE_FIELDS
): MergeInspectionResult {
  const masterItem = items.find((p) => p.id === masterId) || items[0];

  const fields: ItemFieldDiff[] = customFields.map((field) => {
    const rawMaster = (masterItem as Record<string, unknown>)?.[field.key];
    const normMaster = normalizeCompareValue(rawMaster);

    const options: FieldOptionValue[] = items.map((item, idx) => {
      const rawVal = (item as Record<string, unknown>)?.[field.key];
      const displayVal = formatFieldValueDisplay(field.key, rawVal);
      const isEmpty =
        rawVal === null ||
        rawVal === undefined ||
        rawVal === '' ||
        (Array.isArray(rawVal) && rawVal.length === 0);

      return {
        itemId: item.id,
        itemTitle: item.title || `Record ${idx + 1}`,
        isMaster: item.id === masterItem.id,
        rawValue: rawVal,
        displayValue: displayVal,
        isEmpty,
        sourceItemIndex: idx,
        value: rawVal,
        formattedDisplay: displayVal,
      };
    });

    const masterOption = options.find((o) => o.itemId === masterItem.id) || options[0];

    // Determine status & conflict
    const nonMasterOptions = options.filter((o) => o.itemId !== masterItem.id);
    let status: DiffStatus = 'IDENTICAL';
    let hasConflict = false;

    const allNormalized = options.map((o) => normalizeCompareValue(o.rawValue));
    const uniqueNormalized = Array.from(new Set(allNormalized.filter(Boolean)));

    if (uniqueNormalized.length === 0) {
      status = 'IDENTICAL';
      hasConflict = false;
    } else if (uniqueNormalized.length === 1) {
      if (!normMaster) {
        status = 'MISSING_IN_MASTER';
        hasConflict = true;
      } else {
        const anyEmptyCandidate = nonMasterOptions.some((o) => !normalizeCompareValue(o.rawValue));
        status = anyEmptyCandidate ? 'MISSING_IN_CANDIDATE' : 'IDENTICAL';
        hasConflict = false;
      }
    } else {
      status = !normMaster ? 'MISSING_IN_MASTER' : 'CONFLICT';
      hasConflict = true;
    }

    // Determine recommended item
    let recommendedItemId = masterItem.id;
    if (status === 'MISSING_IN_MASTER') {
      const firstWithVal = options.find((o) => !o.isEmpty);
      if (firstWithVal) {
        recommendedItemId = firstWithVal.itemId;
      }
    } else if (hasConflict) {
      // Pick the option with the most comprehensive content (e.g. longest text or array with most items)
      let bestLength = -1;
      for (const opt of options) {
        if (opt.isEmpty) continue;
        let score = 0;
        if (typeof opt.rawValue === 'string') {
          score = opt.rawValue.trim().length;
        } else if (Array.isArray(opt.rawValue)) {
          score = opt.rawValue.length * 10;
        } else if (opt.rawValue != null) {
          score = 1;
        }
        if (score > bestLength) {
          bestLength = score;
          recommendedItemId = opt.itemId;
        }
      }
    }

    const recommendedOption = options.find((o) => o.itemId === recommendedItemId);

    return {
      key: field.key,
      label: field.label,
      category: field.category,
      status,
      hasConflict,
      options,
      masterValue: masterOption,
      recommendedItemId,
      recommendedValue: recommendedOption?.rawValue,
      candidateValue: nonMasterOptions[0]?.rawValue,
    };
  });

  const conflictCount = fields.filter((f) => f.hasConflict).length;
  const identicalCount = fields.filter((f) => f.status === 'IDENTICAL').length;
  const missingInMasterCount = fields.filter((f) => f.status === 'MISSING_IN_MASTER').length;

  return {
    fields,
    hasConflicts: conflictCount > 0,
    conflictCount,
    identicalCount,
    missingInMasterCount,
  };
}

export interface AggregatedAssetsSummary {
  totalFiles: number;
  fileList: unknown[];
  totalNotes: number;
  totalTags: number;
  tags: string[];
  totalCollections: number;
  collections: string[];
  combinedTags: string[];
  combinedCollectionIds: string[];
  attachmentCount: number;
  notesCount: number;
}

export type AggregatedAssetsResult = AggregatedAssetsSummary;

/**
 * Calculates non-destructive asset union across multiple duplicate records.
 */
export function aggregateItemAssets(items: Item[]): AggregatedAssetsSummary {
  const tagSet = new Set<string>();
  const colSet = new Set<string>();
  const fileList: unknown[] = [];
  let noteCount = 0;

  for (const it of items) {
    if (Array.isArray(it.tags)) {
      it.tags.forEach((t: unknown) => {
        const str = typeof t === 'string' ? t : (t as Record<string, unknown>)?.name;
        if (typeof str === 'string' && str.trim()) tagSet.add(str.trim());
      });
    }

    if (it.collectionId) colSet.add(it.collectionId);
    if (Array.isArray((it as Record<string, unknown>).collectionIds)) {
      ((it as Record<string, unknown>).collectionIds as string[]).forEach((c: string) => {
        if (c) colSet.add(c);
      });
    }

    if (Array.isArray(it.attachments)) {
      it.attachments.forEach((att) => fileList.push(att));
    }
    const pdfUrl = (it as Record<string, unknown>).pdfUrl || (it as Record<string, unknown>).fileUrl;
    if (pdfUrl) {
      fileList.push(pdfUrl);
    }

    if (Array.isArray(it.notes)) {
      noteCount += it.notes.length;
    }
  }

  const tags = Array.from(tagSet);
  const collections = Array.from(colSet);

  return {
    totalFiles: fileList.length,
    fileList,
    totalNotes: noteCount,
    totalTags: tags.length,
    tags,
    totalCollections: collections.length,
    collections,
    combinedTags: tags,
    combinedCollectionIds: collections,
    attachmentCount: fileList.length,
    notesCount: noteCount,
  };
}
