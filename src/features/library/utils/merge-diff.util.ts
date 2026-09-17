/**
 * merge-diff.util.ts
 *
 * Zotero-grade Deep Metadata Diff & Asset Aggregation Engine for Duplicate Merging.
 * Inspects all canonical bibliographic fields, flags field conflicts,
 * computes smart value recommendations, and calculates non-destructive asset union.
 */

import type { Item } from '../types/items.types';

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
}

export interface ItemFieldDiff {
  key: string;
  label: string;
  category: 'core' | 'details' | 'identifiers' | 'publishing';
  status: DiffStatus;
  hasConflict: boolean;
  options: FieldOptionValue[];
  masterValue: FieldOptionValue | undefined;
  recommendedItemId: string;
}

export interface MergeInspectionResult {
  fields: ItemFieldDiff[];
  hasConflicts: boolean;
  conflictCount: number;
  identicalCount: number;
  missingInMasterCount: number;
}

export interface AggregatedAssetsSummary {
  totalFiles: number;
  fileList: Array<{ name: string; size?: number; mimeType?: string; sourceTitle: string }>;
  totalNotes: number;
  totalTags: number;
  tags: string[];
  totalCollections: number;
  collections: string[];
}

/**
 * Normalizes an arbitrary field value for fair semantic comparison.
 */
function normalizeFieldValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === 'string' ? item.trim() : JSON.stringify(item)))
      .filter(Boolean)
      .join('; ')
      .toLowerCase();
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val).trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Formats a field value for clean display in UI tables.
 */
export function formatDisplayValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (Array.isArray(val)) {
    if (key === 'authors' || key === 'creators' || key === 'contributors') {
      return val
        .map((a) => {
          if (typeof a === 'string') return a.trim();
          if (typeof a === 'object' && a !== null) {
            const authObj = a as { fullName?: string; name?: string; firstName?: string; lastName?: string };
            return authObj.fullName || authObj.name || `${authObj.firstName || ''} ${authObj.lastName || ''}`.trim();
          }
          return String(a);
        })
        .filter(Boolean)
        .join('; ');
    }
    return val.join(', ');
  }
  return String(val);
}

/**
 * Heuristically recommends the highest quality value among duplicates.
 */
function pickBestItemId(
  key: string,
  options: FieldOptionValue[],
  masterId: string,
): string {
  const nonEmptyOptions = options.filter((o) => !o.isEmpty);
  if (nonEmptyOptions.length === 0) return masterId;
  if (nonEmptyOptions.length === 1) return nonEmptyOptions[0].itemId;

  // Rule 1: For abstract, prefer the more detailed/longer abstract
  if (key === 'abstract') {
    let best = nonEmptyOptions[0];
    for (const opt of nonEmptyOptions) {
      if (String(opt.rawValue ?? '').length > String(best.rawValue ?? '').length) {
        best = opt;
      }
    }
    return best.itemId;
  }

  // Rule 2: For authors, prefer full names over initials (contains spaces or full words)
  if (key === 'authors') {
    let best = nonEmptyOptions[0];
    let maxLen = 0;
    for (const opt of nonEmptyOptions) {
      const len = opt.displayValue.length;
      if (len > maxLen) {
        maxLen = len;
        best = opt;
      }
    }
    return best.itemId;
  }

  // Rule 3: For DOI, prefer canonical standard DOI (contains /)
  if (key === 'doi') {
    const validDoi = nonEmptyOptions.find((o) => /^10\.\d{4,9}\//.test(String(o.rawValue)));
    if (validDoi) return validDoi.itemId;
  }

  // Default: Keep Master's value if not empty, otherwise pick first non-empty
  const masterOption = nonEmptyOptions.find((o) => o.itemId === masterId);
  return masterOption ? masterOption.itemId : nonEmptyOptions[0].itemId;
}

/**
 * Inspects all duplicates against the designated Master ID and produces a rich diff matrix.
 */
export function inspectItemDifferences(
  items: Item[],
  masterId: string,
): MergeInspectionResult {
  if (!items || items.length === 0) {
    return {
      fields: [],
      hasConflicts: false,
      conflictCount: 0,
      identicalCount: 0,
      missingInMasterCount: 0,
    };
  }

  const effectiveMasterId = items.some((i) => i.id === masterId)
    ? masterId
    : items[0]?.id || '';

  const fields: ItemFieldDiff[] = [];
  let conflictCount = 0;
  let identicalCount = 0;
  let missingInMasterCount = 0;

  for (const def of MERGEABLE_FIELDS) {
    const key = def.key as keyof Item;

    const options: FieldOptionValue[] = items.map((it) => {
      // Handle aliased fields (publicationTitle vs journal, abstract vs abstractNote)
      let raw = it[key];
      if ((raw === undefined || raw === null || raw === '') && key === 'publicationTitle') {
        raw = it.journal;
      }
      if ((raw === undefined || raw === null || raw === '') && key === 'abstract') {
        raw = (it as any).abstractNote;
      }

      const display = formatDisplayValue(def.key, raw);
      const isEmpty = !display.trim();

      return {
        itemId: it.id,
        itemTitle: it.title || 'Untitled Record',
        isMaster: it.id === effectiveMasterId,
        rawValue: raw,
        displayValue: display,
        isEmpty,
      };
    });

    const masterOption = options.find((o) => o.itemId === effectiveMasterId);
    const nonEmptyOptions = options.filter((o) => !o.isEmpty);

    // Skip fields that are empty across ALL duplicates
    if (nonEmptyOptions.length === 0) {
      continue;
    }

    // Determine uniqueness of normalized values
    const uniqueNormalizedValues = new Set(
      nonEmptyOptions.map((o) => normalizeFieldValue(o.rawValue)),
    );

    let status: DiffStatus;
    if (uniqueNormalizedValues.size <= 1) {
      if (masterOption?.isEmpty) {
        status = 'MISSING_IN_MASTER';
        missingInMasterCount++;
      } else {
        status = 'IDENTICAL';
        identicalCount++;
      }
    } else {
      status = 'CONFLICT';
      conflictCount++;
    }

    const hasConflict = status === 'CONFLICT' || status === 'MISSING_IN_MASTER';
    const recommendedItemId = pickBestItemId(def.key, options, effectiveMasterId);

    fields.push({
      key: def.key,
      label: def.label,
      category: def.category,
      status,
      hasConflict,
      options,
      masterValue: masterOption,
      recommendedItemId,
    });
  }

  return {
    fields,
    hasConflicts: conflictCount > 0 || missingInMasterCount > 0,
    conflictCount,
    identicalCount,
    missingInMasterCount,
  };
}

/**
 * Calculates all non-destructive child assets (PDFs, Notes, Tags, Collections) that will be preserved.
 */
export function aggregateItemAssets(items: Item[]): AggregatedAssetsSummary {
  const fileList: Array<{ name: string; size?: number; mimeType?: string; sourceTitle: string }> = [];
  const tagsSet = new Set<string>();
  const collectionsSet = new Set<string>();
  let totalNotes = 0;

  for (const item of items) {
    const title = item.title || 'Record';

    // 1. Files & Attachments
    const attachments = (item as any).attachments || [];
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        fileList.push({
          name: att.filename || att.name || 'document.pdf',
          size: att.size || att.sizeBytes || 0,
          mimeType: att.mimeType || 'application/pdf',
          sourceTitle: title,
        });
      }
    } else if ((item as any).fileUrl || (item as any).filename) {
      fileList.push({
        name: (item as any).filename || 'document.pdf',
        size: (item as any).size || 0,
        mimeType: (item as any).mimeType || 'application/pdf',
        sourceTitle: title,
      });
    }

    // 2. Notes
    const notesList = (item as any).notesList || (item as any).notes || [];
    if (Array.isArray(notesList)) {
      totalNotes += notesList.length;
    }

    // 3. Tags
    const itemTags = (item as any).itemTags || [];
    if (Array.isArray(itemTags)) {
      for (const it of itemTags) {
        const tagName = it.tag?.name || it.name;
        if (tagName) tagsSet.add(tagName);
      }
    }
    if (Array.isArray(item.keywords)) {
      item.keywords.forEach((k) => tagsSet.add(k));
    }

    // 4. Collections
    const collectionItems = (item as any).collectionItems || [];
    if (Array.isArray(collectionItems)) {
      for (const c of collectionItems) {
        const collName = c.collection?.name || c.name;
        if (collName) collectionsSet.add(collName);
      }
    }
  }

  return {
    totalFiles: fileList.length,
    fileList,
    totalNotes,
    totalTags: tagsSet.size,
    tags: Array.from(tagsSet),
    totalCollections: collectionsSet.size,
    collections: Array.from(collectionsSet),
  };
}
