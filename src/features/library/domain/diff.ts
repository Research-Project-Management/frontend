/**
 * Pure Domain Model: Deep Metadata Diff & Asset Aggregation Engine
 *
 * Zotero-grade Deep Metadata Diff & Asset Aggregation Engine for Duplicate Merging.
 * Inspects all canonical bibliographic fields, flags field conflicts,
 * computes smart value recommendations, and calculates non-destructive asset union.
 */

import type { Item } from '@/features/library/domain/types/library.types';
import {
  isValidValue,
  normalizeTags,
  getItemDisplayTitle,
  getItemDisplayDate,
  getPublicationVenue,
} from './metadata';
import {
  FIELD_FALLBACK_CHAINS,
  prepareInspectorFieldContext,
  resolveInspectorFieldValue,
  type PreparedInspectorFieldContext,
} from './item-field-schema';

export interface MergeFieldDefinition {
  key: string;
  label: string;
  category: 'core' | 'details' | 'identifiers' | 'publishing';
  description?: string;
}

export const MERGEABLE_FIELDS: MergeFieldDefinition[] = [
  // Core Bibliographic
  { key: 'itemType', label: 'Item Type', category: 'core' },
  { key: 'title', label: 'Title', category: 'core' },
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
  masterItemId: string;
  fields: ItemFieldDiff[];
  hasConflicts: boolean;
  conflictCount: number;
  identicalCount: number;
  missingInMasterCount: number;
}

function isFieldEmpty(val: unknown): boolean {
  if (!isValidValue(val)) return true;
  if (typeof val === 'number' && val === 0) return true;
  if (Array.isArray(val)) {
    return !val.some((v) => isValidValue(v));
  }
  return false;
}

const EXTRA_FIELD_FALLBACKS: Record<string, readonly string[]> = {
  publicationDate: ['date', 'issueDate', 'dateDecided', 'dateEnacted', 'filingDate'],
  issue: [
    'number',
    'patentNumber',
    'reportNumber',
    'docketNumber',
    'publicLawNumber',
    'billNumber',
    'documentNumber',
    'identifier',
    'episodeNumber',
  ],
  place: ['eventPlace', 'country', 'repositoryLocation'],
  publisher: [
    'university',
    'institution',
    'issuingAuthority',
    'authority',
    'organization',
    'company',
    'repository',
    'court',
    'distributor',
    'studio',
    'network',
    'label',
  ],
  series: ['seriesTitle'],
  seriesTitle: ['series'],
};

/**
 * Resolves a field value from an item, delegating to canonical domain resolvers (`getItemDisplayTitle`,
 * `getItemDisplayDate`, `getPublicationVenue`, `FIELD_FALLBACK_CHAINS`, `resolveInspectorFieldValue`)
 * and `extraFields` when the primary key is empty.
 */
export function resolveItemFieldValue(
  item: Record<string, unknown> | undefined,
  key: string,
  precomputedContext?: PreparedInspectorFieldContext | null,
): unknown {
  if (!item) return undefined;
  const direct = item[key];
  if (!isFieldEmpty(direct)) return direct;

  const ef = item.extraFields as Record<string, unknown> | undefined;
  if (ef && !isFieldEmpty(ef[key])) return ef[key];

  if (key === 'authors') {
    const creators = item.creators ?? ef?.creators;
    if (!isFieldEmpty(creators)) return creators;
    return direct;
  }

  if (key === 'year') {
    const derivedDate = getItemDisplayDate(item);
    return typeof derivedDate === 'number' ? derivedDate : direct;
  }

  if (key === 'title') {
    const derivedTitle = getItemDisplayTitle(item);
    return derivedTitle || direct;
  }

  if (key === 'publicationTitle') {
    const derivedVenue = getPublicationVenue(item);
    if (derivedVenue) return derivedVenue;
  }

  const fallbackChain = FIELD_FALLBACK_CHAINS[key.toLowerCase()];
  if (fallbackChain) {
    for (const [src, prop] of fallbackChain) {
      const candidate = src === 'p' ? item[prop] : ef?.[prop];
      if (!isFieldEmpty(candidate)) return candidate;
    }
  }

  const aliases = EXTRA_FIELD_FALLBACKS[key];
  if (aliases) {
    for (const alias of aliases) {
      if (!isFieldEmpty(item[alias])) return item[alias];
      if (ef && !isFieldEmpty(ef[alias])) return ef[alias];
    }
  }

  if (key !== 'creators' && key !== 'extra') {
    const inspectorResolved = resolveInspectorFieldValue(
      item as Partial<Item>,
      key,
      precomputedContext,
    );
    if (!isFieldEmpty(inspectorResolved)) return inspectorResolved;
  }

  return direct;
}

function extractCreatorObjectName(obj: Record<string, unknown>, fallback: unknown): string {
  const name =
    obj.fullName ||
    obj.name ||
    [obj.firstName || obj.given, obj.lastName || obj.family].filter(Boolean).join(' ');
  return name ? String(name) : JSON.stringify(fallback);
}

export function normalizeCompareValue(val: unknown): string {
  if (isFieldEmpty(val)) return '';
  if (Array.isArray(val)) {
    return val
      .filter((x) => isValidValue(x))
      .map((x) => {
        if (typeof x === 'object' && x !== null) {
          return extractCreatorObjectName(x as Record<string, unknown>, x).trim().toLowerCase();
        }
        return String(x).trim().toLowerCase();
      })
      .sort()
      .join(';');
  }
  return String(val).trim().toLowerCase();
}

export function formatFieldValueDisplay(key: string, value: unknown): string {
  if (isFieldEmpty(value)) {
    return '- (Empty)';
  }
  if (Array.isArray(value)) {
    const validItems = value.filter((v) => isValidValue(v));
    if (validItems.length === 0) return '- (Empty)';
    return validItems
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          return extractCreatorObjectName(item as Record<string, unknown>, item);
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

export type MasterSelectionStrategy = 'smart' | 'oldest' | 'newest';

function parseItemTimestamp(item: Record<string, unknown>): number | null {
  const raw = item.createdAt || item.dateAdded || item.updatedAt;
  if (typeof raw === 'string' && raw.trim()) {
    const ts = Date.parse(raw);
    if (!Number.isNaN(ts)) return ts;
  } else if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  return null;
}

/**
 * Selects the best default master item ID in a duplicate cluster following Zotero/Zoplicate conventions:
 * - `'smart'` (default): Prefers non-retracted published items (`journalArticle`, `conferencePaper`, `book`, `bookSection`)
 *   with a peer-reviewed DOI over unpublished `preprint` / `arXiv` / `document` items, scoring metadata completeness
 *   across `MERGEABLE_FIELDS`, attachments, and notes (breaking ties by oldest `createdAt`).
 * - `'oldest'`: Zoplicate-style earliest `createdAt` / `dateAdded` item (preserves oldest Zotero item key/URI).
 * - `'newest'`: Zoplicate-style most recently added `createdAt` / `dateAdded` item.
 */
export function selectBestMasterItemId(
  items: readonly Item[],
  strategy: MasterSelectionStrategy = 'smart',
): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!.id;

  if (strategy === 'oldest' || strategy === 'newest') {
    let chosen = items[0]!;
    let chosenTs = parseItemTimestamp(chosen as Record<string, unknown>);
    for (let i = 1; i < items.length; i++) {
      const candidate = items[i]!;
      const ts = parseItemTimestamp(candidate as Record<string, unknown>);
      if (ts !== null) {
        if (
          chosenTs === null ||
          (strategy === 'oldest' && ts < chosenTs) ||
          (strategy === 'newest' && ts > chosenTs)
        ) {
          chosen = candidate;
          chosenTs = ts;
        }
      }
    }
    return chosen.id;
  }

  let bestId = items[0]!.id;
  let bestScore = -Infinity;
  let bestTs: number | null = null;

  for (const item of items) {
    let score = 0;
    const rec = item as Record<string, unknown>;
    const itemCtx = prepareInspectorFieldContext(item);

    // Penalize retracted items heavily so a retracted record isn't auto-selected over a valid one
    if (rec.isRetracted === true || rec.retractionStatus === 'retracted') {
      score -= 500;
    }

    const itemType = String(item.itemType || 'journalArticle').trim();
    const doi = String(resolveItemFieldValue(rec, 'doi', itemCtx) || '').trim();
    const isArxivDoi = /10\.48550\/arxiv/i.test(doi);

    if (
      itemType === 'journalArticle' ||
      itemType === 'conferencePaper' ||
      itemType === 'book' ||
      itemType === 'bookSection'
    ) {
      score += 40;
    } else if (itemType === 'preprint' || itemType === 'document') {
      score -= 15;
    }

    if (doi && !isArxivDoi) {
      score += 35;
    } else if (doi) {
      score += 10;
    }

    // Count populated canonical fields
    for (const field of MERGEABLE_FIELDS) {
      const val = resolveItemFieldValue(rec, field.key, itemCtx);
      if (!isFieldEmpty(val)) {
        score += 5;
      }
    }

    // Attachments and notes bonus
    if (Array.isArray(item.attachments)) {
      score += item.attachments.length * 8;
    }
    if (Array.isArray(item.notes)) {
      score += item.notes.length * 4;
    }

    const ts = parseItemTimestamp(rec);
    if (
      score > bestScore ||
      (score === bestScore && ts !== null && (bestTs === null || ts < bestTs))
    ) {
      bestScore = score;
      bestId = item.id;
      bestTs = ts;
    }
  }

  return bestId;
}

/**
 * Non-destructively merges structured `Key: Value` and free-text lines from `extra` / `extraFields.extra`
 * across all items in a duplicate cluster (starting with the master item's lines in order, then appending
 * unique normalized lines from duplicates such as `PMID: ...`, `PMCID: ...`, `arXiv: ...`, `Original Date: ...`),
 * while also collecting alternate `citationKey` values into `tex.ids` if different from the master item's `citationKey`.
 */
export function mergeZoteroExtraFields(
  items: readonly Item[],
  masterItemId: string,
): string {
  if (items.length === 0) return '';
  const master = items.find((i) => i.id === masterItemId) || items[0]!;
  const orderedItems = [master, ...items.filter((i) => i.id !== master.id)];

  const lines: string[] = [];
  const seenNormalizedLines = new Set<string>();
  const existingTexIds = new Set<string>();

  const masterCtx = prepareInspectorFieldContext(master);
  const masterCiteKey = String(
    resolveItemFieldValue(master as Record<string, unknown>, 'citationKey', masterCtx) || '',
  ).trim();

  const addLine = (rawLine: string) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    // Check if this is a tex.ids line so we can consolidate all citation key aliases
    const texIdsMatch = trimmed.match(/^tex\.ids\s*[:=]\s*(.+)$/i);
    if (texIdsMatch && texIdsMatch[1]) {
      for (const token of texIdsMatch[1].split(/[,;\s]+/)) {
        const cleanToken = token.trim();
        if (cleanToken && cleanToken !== masterCiteKey) {
          existingTexIds.add(cleanToken);
        }
      }
      return;
    }

    const norm = trimmed
      .toLowerCase()
      .replace(/\s*:\s*/g, ': ')
      .replace(/\s+/g, ' ');
    if (!seenNormalizedLines.has(norm)) {
      seenNormalizedLines.add(norm);
      lines.push(trimmed);
    }
  };

  for (const item of orderedItems) {
    const rec = item as Record<string, unknown>;
    const itemCtx =
      item.id === master.id ? masterCtx : prepareInspectorFieldContext(item);
    const ef =
      rec.extraFields && typeof rec.extraFields === 'object'
        ? (rec.extraFields as Record<string, unknown>)
        : {};

    const rawExtra =
      typeof rec.extra === 'string' && rec.extra.trim()
        ? rec.extra
        : typeof ef.extra === 'string' && ef.extra.trim()
          ? ef.extra
          : '';

    if (rawExtra) {
      for (const line of rawExtra.split(/\r?\n/)) {
        addLine(line);
      }
    }

    // Also harvest explicit PMID / PMCID / arXiv from item or extraFields if not yet in Extra lines
    const pmid = resolveItemFieldValue(rec, 'pmid', itemCtx);
    if (typeof pmid === 'string' && isValidValue(pmid)) {
      addLine(`PMID: ${pmid.trim()}`);
    }
    const pmcid = rec.pmcid ?? ef.pmcid;
    if (typeof pmcid === 'string' && isValidValue(pmcid)) {
      addLine(`PMCID: ${pmcid.trim()}`);
    }
    const origDate = rec.originalDate ?? ef.originalDate;
    if (typeof origDate === 'string' && isValidValue(origDate)) {
      addLine(`Original Date: ${origDate.trim()}`);
    }

    // Collect alternate citationKey from non-master items into tex.ids
    if (item.id !== master.id) {
      const altCiteKey = String(
        resolveItemFieldValue(rec, 'citationKey', itemCtx) || '',
      ).trim();
      if (altCiteKey && altCiteKey !== masterCiteKey) {
        existingTexIds.add(altCiteKey);
      }
    }
  }

  if (existingTexIds.size > 0) {
    lines.push(`tex.ids: ${Array.from(existingTexIds).join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Scores a field option value for "Recommend Best" resolution.
 * - For `itemType`, peer-reviewed published types (`journalArticle`, `conferencePaper`, `book`, `bookSection`)
 *   score higher than unpublished `preprint` / `document` types.
 * - For `doi`, canonical publisher DOIs score higher than arXiv DOIs (`10.48550/arXiv.*`).
 * - For text fields, longer non-empty values score higher; for arrays (e.g. `authors`), more entries score higher.
 */
export function scoreFieldCandidate(fieldKey: string, rawValue: unknown): number {
  if (isFieldEmpty(rawValue)) return -1;
  if (fieldKey === 'itemType') {
    const t = String(rawValue || '').trim();
    if (
      t === 'journalArticle' ||
      t === 'conferencePaper' ||
      t === 'book' ||
      t === 'bookSection'
    ) {
      return 100;
    }
    if (t === 'preprint' || t === 'document') {
      return 20;
    }
    return 50;
  }
  if (fieldKey === 'doi') {
    const d = String(rawValue || '').trim();
    return /10\.48550\/arxiv/i.test(d) ? 10 : d.length + 50;
  }
  if (typeof rawValue === 'string') {
    return rawValue.trim().length;
  }
  if (Array.isArray(rawValue)) {
    return rawValue.length * 10;
  }
  if (rawValue != null) {
    return 1;
  }
  return 0;
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

  // Pre-compute InspectorFieldContext once per item (O(N) instead of O(N * F))
  const itemContexts = new Map<string, PreparedInspectorFieldContext | null>();
  for (const it of items) {
    if (it?.id) {
      itemContexts.set(it.id, prepareInspectorFieldContext(it));
    }
  }
  const masterCtx = masterItem
    ? itemContexts.get(masterItem.id) ?? prepareInspectorFieldContext(masterItem)
    : null;

  let conflictCount = 0;
  let identicalCount = 0;
  let missingInMasterCount = 0;

  const fields: ItemFieldDiff[] = customFields.map((field) => {
    const rawMaster = resolveItemFieldValue(
      masterItem as Record<string, unknown>,
      field.key,
      masterCtx,
    );
    const normMaster = normalizeCompareValue(rawMaster);

    const uniqueNormalized = new Set<string>();
    let anyEmptyCandidate = false;

    const options: FieldOptionValue[] = items.map((item, idx) => {
      const ctx = itemContexts.get(item.id);
      const rawVal = resolveItemFieldValue(
        item as Record<string, unknown>,
        field.key,
        ctx,
      );
      const isEmpty = isFieldEmpty(rawVal);
      const effectiveRawVal = isEmpty ? (Array.isArray(rawVal) ? [] : undefined) : rawVal;
      const displayVal = formatFieldValueDisplay(field.key, effectiveRawVal);
      const isMaster = item.id === masterItem.id;
      const normVal = normalizeCompareValue(effectiveRawVal);

      if (normVal) {
        uniqueNormalized.add(normVal);
      } else if (!isMaster) {
        anyEmptyCandidate = true;
      }

      return {
        itemId: item.id,
        itemTitle: item.title || `Record ${idx + 1}`,
        isMaster,
        rawValue: effectiveRawVal,
        displayValue: displayVal,
        isEmpty,
        sourceItemIndex: idx,
        value: effectiveRawVal,
        formattedDisplay: displayVal,
      };
    });

    const masterOption = options.find((o) => o.itemId === masterItem.id) || options[0];
    const nonMasterOptions = options.filter((o) => o.itemId !== masterItem.id);

    let status: DiffStatus = 'IDENTICAL';
    let hasConflict = false;

    if (uniqueNormalized.size === 0) {
      status = 'IDENTICAL';
      hasConflict = false;
    } else if (uniqueNormalized.size === 1) {
      if (!normMaster) {
        status = 'MISSING_IN_MASTER';
        hasConflict = true;
      } else {
        status = anyEmptyCandidate ? 'MISSING_IN_CANDIDATE' : 'IDENTICAL';
        hasConflict = false;
      }
    } else {
      status = !normMaster ? 'MISSING_IN_MASTER' : 'CONFLICT';
      hasConflict = true;
    }

    if (hasConflict) conflictCount++;
    if (status === 'IDENTICAL') identicalCount++;
    if (status === 'MISSING_IN_MASTER') missingInMasterCount++;

    // Determine recommended item
    let recommendedItemId = masterItem.id;
    if (hasConflict || status === 'MISSING_IN_MASTER') {
      let bestScore = -1;
      for (const opt of options) {
        if (opt.isEmpty) continue;
        const score = scoreFieldCandidate(field.key, opt.rawValue);
        if (score > bestScore) {
          bestScore = score;
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

  return {
    masterItemId: masterItem?.id || masterId,
    fields,
    hasConflicts: conflictCount > 0,
    conflictCount,
    identicalCount,
    missingInMasterCount,
  };
}

export interface MergedItemPayload {
  masterId: string;
  sourceIds: string[];
  duplicateIds: string[];
  fieldSelections: Record<string, unknown>;
  resolvedFields: Record<string, unknown>;
  tags: string[];
  collectionIds: string[];
  attachments: unknown[];
  uniqueAttachmentCount: number;
  duplicateAttachmentCount: number;
  totalAnnotationCount: number;
}

/**
 * Builds the final resolved metadata & asset payload for a duplicate cluster merge,
 * combining the master item's fields, any missing fields auto-filled from candidates,
 * explicit user `fieldOverrides`, and non-destructively merged Zotero `extra` lines.
 */
export function buildMergedItemPayload(
  items: Item[],
  masterId: string,
  fieldOverrides: Record<string, unknown> = {},
): MergedItemPayload {
  const masterItem = items.find((i) => i.id === masterId) || items[0];
  const orderedItems = masterItem
    ? [masterItem, ...items.filter((i) => i.id !== masterItem.id)]
    : items;
  const inspection = inspectItemDifferences(items, masterId);
  const assets = aggregateItemAssets(orderedItems);
  const resolvedFields: Record<string, unknown> = {
    tags: assets.combinedTags,
    collections: assets.combinedCollectionIds,
  };

  for (const field of inspection.fields) {
    if (field.key in fieldOverrides && fieldOverrides[field.key] !== undefined) {
      resolvedFields[field.key] = fieldOverrides[field.key];
    } else if (field.status === 'MISSING_IN_MASTER' && field.recommendedValue !== undefined) {
      resolvedFields[field.key] = field.recommendedValue;
    } else if (field.masterValue?.rawValue !== undefined) {
      resolvedFields[field.key] = field.masterValue.rawValue;
    }
  }

  // Always guarantee canonical itemType is present in fieldSelections when unifying cross-type records
  if (!resolvedFields.itemType) {
    resolvedFields.itemType =
      (fieldOverrides.itemType as string | undefined) ||
      masterItem?.itemType ||
      'journalArticle';
  }

  const mergedExtra = mergeZoteroExtraFields(items, masterId);
  if (mergedExtra && !('extra' in fieldOverrides)) {
    resolvedFields.extra = mergedExtra;
  }

  const duplicateIds = items.filter((i) => i.id !== masterId).map((i) => i.id);

  return {
    masterId,
    sourceIds: duplicateIds,
    duplicateIds,
    fieldSelections: resolvedFields,
    resolvedFields,
    tags: assets.combinedTags,
    collectionIds: assets.combinedCollectionIds,
    attachments: assets.attachments,
    uniqueAttachmentCount: assets.uniqueAttachmentCount,
    duplicateAttachmentCount: assets.duplicateAttachmentCount,
    totalAnnotationCount: assets.totalAnnotationCount,
  };
}

export interface AggregatedAssetsSummary {
  totalFiles: number;
  fileList: unknown[];
  attachments: unknown[];
  uniqueAttachmentCount: number;
  duplicateAttachmentCount: number;
  totalAnnotationCount: number;
  totalNotes: number;
  noteCount: number;
  notes: unknown[];
  totalTags: number;
  tags: string[];
  totalCollections: number;
  collectionCount: number;
  collections: string[];
  combinedTags: string[];
  combinedCollectionIds: string[];
  attachmentCount: number;
  notesCount: number;
}

export type AggregatedAssetsResult = AggregatedAssetsSummary;

/**
 * Calculates non-destructive asset union across multiple duplicate records,
 * deduplicating identical PDF/file attachments that share the same non-empty `fileHash`
 * (or identical non-empty `url` when `fileHash` is absent) while preserving annotation counts.
 */
export function aggregateItemAssets(items: readonly Item[]): AggregatedAssetsSummary {
  const rawTags: unknown[] = [];
  const colSet = new Set<string>();
  const uniqueAttachments: unknown[] = [];
  const seenAttachmentKeys = new Set<string>();
  const notesList: unknown[] = [];
  let duplicateAttachmentCount = 0;
  let totalAnnotationCount = 0;

  const registerAttachment = (att: unknown) => {
    if (!att) return;
    if (typeof att === 'string') {
      const cleanUrl = att.trim();
      if (!isValidValue(cleanUrl)) return;
      const key = `url:${cleanUrl.toLowerCase()}`;
      if (seenAttachmentKeys.has(key)) {
        duplicateAttachmentCount++;
        return;
      }
      seenAttachmentKeys.add(key);
      uniqueAttachments.push(cleanUrl);
      return;
    }

    if (typeof att === 'object') {
      const obj = att as Record<string, unknown>;
      // Count annotations on every attachment copy (even if binary PDF is a duplicate copy, its annotations are preserved during merge!)
      if (typeof obj.annotationCount === 'number' && obj.annotationCount > 0) {
        totalAnnotationCount += obj.annotationCount;
      } else if (Array.isArray(obj.annotations)) {
        totalAnnotationCount += obj.annotations.length;
      }

      const fileHash =
        typeof obj.fileHash === 'string' && obj.fileHash.trim()
          ? obj.fileHash.trim().toLowerCase()
          : typeof obj.sha256 === 'string' && obj.sha256.trim()
            ? obj.sha256.trim().toLowerCase()
            : '';
      const fileUrl =
        typeof obj.url === 'string' && obj.url.trim()
          ? obj.url.trim().toLowerCase()
          : typeof obj.fileUrl === 'string' && obj.fileUrl.trim()
            ? obj.fileUrl.trim().toLowerCase()
            : '';

      const dedupKey = fileHash
        ? `hash:${fileHash}`
        : fileUrl
          ? `url:${fileUrl}`
          : '';

      if (dedupKey) {
        if (seenAttachmentKeys.has(dedupKey)) {
          duplicateAttachmentCount++;
          return;
        }
        seenAttachmentKeys.add(dedupKey);
      }
      uniqueAttachments.push(att);
    }
  };

  for (const it of items) {
    if (Array.isArray(it.tags)) {
      rawTags.push(...it.tags);
    } else if (typeof it.tags === 'string') {
      rawTags.push(it.tags);
    }

    const singleColId = (it as Record<string, unknown>).collectionId;
    if (typeof singleColId === 'string' && isValidValue(singleColId)) {
      colSet.add(singleColId.trim());
    }
    if (Array.isArray(it.collectionIds)) {
      it.collectionIds.forEach((c: unknown) => {
        if (typeof c === 'string' && isValidValue(c)) colSet.add(c.trim());
      });
    }
    if (Array.isArray(it.collections)) {
      it.collections.forEach((c) => {
        if (c && typeof c === 'object' && typeof c.id === 'string' && isValidValue(c.id)) {
          colSet.add(c.id.trim());
        } else if (typeof c === 'string' && isValidValue(c)) {
          colSet.add((c as string).trim());
        }
      });
    }

    if (Array.isArray(it.attachments)) {
      it.attachments.forEach((att) => registerAttachment(att));
    } else {
      const pdfUrl = (it as Record<string, unknown>).pdfUrl || (it as Record<string, unknown>).fileUrl;
      if (pdfUrl && isValidValue(pdfUrl)) {
        registerAttachment(pdfUrl);
      }
    }

    if (Array.isArray(it.notes)) {
      for (const n of it.notes) {
        notesList.push(n);
      }
    }
  }

  const tags = normalizeTags(rawTags);
  const collections = Array.from(colSet);

  return {
    totalFiles: uniqueAttachments.length,
    fileList: uniqueAttachments,
    attachments: uniqueAttachments,
    uniqueAttachmentCount: uniqueAttachments.length,
    duplicateAttachmentCount,
    totalAnnotationCount,
    totalNotes: notesList.length,
    noteCount: notesList.length,
    notes: notesList,
    totalTags: tags.length,
    tags,
    totalCollections: collections.length,
    collectionCount: collections.length,
    collections,
    combinedTags: tags,
    combinedCollectionIds: collections,
    attachmentCount: uniqueAttachments.length,
    notesCount: notesList.length,
  };
}

