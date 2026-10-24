import type { Item } from './types/library.types';
import { isValidValue, normalizeTags } from './metadata';
import {
  prepareInspectorFieldContext,
  type PreparedInspectorFieldContext,
} from './item-field-schema';
import {
  type MergeFieldDefinition,
  MERGEABLE_FIELDS,
  type DiffStatus,
  type FieldOptionValue,
  type ItemFieldDiff,
  type MergeInspectionResult,
  isFieldEmpty,
  resolveItemFieldValue,
  extractFieldValue,
  normalizeCompareValue,
  formatFieldValueDisplay,
  type MasterSelectionStrategy,
  selectBestMasterItemId,
  mergeItemExtraFields,
} from './diff-primitives';

export {
  type MergeFieldDefinition,
  MERGEABLE_FIELDS,
  type DiffStatus,
  type FieldOptionValue,
  type ItemFieldDiff,
  type MergeInspectionResult,
  isFieldEmpty,
  resolveItemFieldValue,
  extractFieldValue,
  normalizeCompareValue,
  formatFieldValueDisplay,
  type MasterSelectionStrategy,
  selectBestMasterItemId,
  mergeItemExtraFields,
};


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

  const mergedExtra = mergeItemExtraFields(items, masterId);
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

