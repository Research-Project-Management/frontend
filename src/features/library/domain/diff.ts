import type { Item } from './types/library.types';
import {
  isValidValue,
  normalizeTags,
  ALL_SCHEMA_PROMOTE_KEYS,
} from './metadata';
import {
  parseCreatorName,
  splitAuthorString,
} from './creators';
import {
  prepareInspectorFieldContext,
  FIELD_CANDIDATE_SCORERS,
  MULTI_KEY_SYNC_SETTERS,
  FIRST_CLASS_ITEM_COLUMNS,
  type PreparedInspectorFieldContext,
  type FieldCandidateScorer,
} from './item-field-schema';
import {
  type MergeFieldDefinition,
  MERGEABLE_FIELDS,
  getMergeableFieldsForTypes,
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
  getMergeableFieldsForTypes,
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

export { FIELD_CANDIDATE_SCORERS, type FieldCandidateScorer };

/**
 * Scores a field option value for "Recommend Best" resolution via `FIELD_CANDIDATE_SCORERS`.
 * - Delegates field-specific quality heuristics (`itemType`, `doi`, `date`, `year`, `publicationTitle`, `abstractNote`)
 *   to the declarative strategy registry in `item-field-schema.ts`.
 * - Falls back to completeness/length scoring for general text and array fields.
 */
export function scoreFieldCandidate(fieldKey: string, rawValue: unknown): number {
  if (isFieldEmpty(rawValue)) return -1;
  const strategy = FIELD_CANDIDATE_SCORERS[fieldKey];
  if (strategy) {
    return strategy(
      Array.isArray(rawValue)
        ? formatFieldValueDisplay(fieldKey, rawValue)
        : String(rawValue ?? ''),
      rawValue,
    );
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
  customFields?: MergeFieldDefinition[],
): MergeInspectionResult {
  const effectiveFields =
    customFields ?? getMergeableFieldsForTypes(items.map((i) => i.itemType));
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

  const fields: ItemFieldDiff[] = effectiveFields.map((field) => {
    const rawMaster = resolveItemFieldValue(
      masterItem as Record<string, unknown>,
      field.key,
      masterCtx,
    );
    const normMaster = normalizeCompareValue(rawMaster, field.key);

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
      const normVal = normalizeCompareValue(effectiveRawVal, field.key);

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

const PROMOTE_KEYS_SET = new Set<string>(ALL_SCHEMA_PROMOTE_KEYS);
const SKIP_SYNC_KEYS = new Set([
  'extraFields',
  'extra',
  'authors',
  'creators',
  'contributors',
  'tags',
  'collections',
  'collectionIds',
]);

function buildStructuredCreatorsFromAuthors(rawAuthors: unknown): Array<Record<string, unknown>> {
  if (isFieldEmpty(rawAuthors)) return [];
  const rawList = Array.isArray(rawAuthors)
    ? rawAuthors
    : typeof rawAuthors === 'string'
      ? splitAuthorString(rawAuthors)
      : [];
  const structured: Array<Record<string, unknown>> = [];
  rawList.forEach((entry, idx) => {
    if (!entry) return;
    if (typeof entry === 'string') {
      const parsed = parseCreatorName(entry);
      const fullName = (parsed.fullName || entry).trim();
      if (!fullName) return;
      structured.push({
        firstName: parsed.firstName || '',
        lastName: parsed.lastName || fullName,
        fullName,
        creatorType: 'author',
        orderIndex: idx,
      });
    } else if (typeof entry === 'object') {
      const rec = entry as Record<string, unknown>;
      const firstName = String(rec.firstName ?? rec.given ?? '').trim();
      const lastName = String(rec.lastName ?? rec.family ?? '').trim();
      const fullName = String(rec.fullName ?? rec.name ?? [firstName, lastName].filter(Boolean).join(' ')).trim();
      structured.push({
        ...rec,
        firstName,
        lastName,
        fullName,
        creatorType: String(rec.creatorType ?? rec.role ?? 'author').trim() || 'author',
        orderIndex: typeof rec.orderIndex === 'number' ? rec.orderIndex : idx,
      });
    }
  });
  return structured;
}

/**
 * Single Source of Truth helper that resolves effective merge field overrides for a duplicate cluster.
 * Synchronizes `authors`/`creators`/`contributors`, multi-key aliases (`MULTI_KEY_SYNC_SETTERS`),
 * `extraFields` (`ALL_SCHEMA_PROMOTE_KEYS`), and non-destructively merged `extra` lines.
 */
export function resolveDuplicateMergeFieldOverrides(
  items: readonly Item[],
  masterId: string,
  fieldOverrides: Record<string, unknown> = {},
  options?: {
    inspection?: MergeInspectionResult;
    includeUnchangedMasterFields?: boolean;
    customFieldTexts?: Record<string, string>;
  },
): Record<string, unknown> {
  const masterItem = items.find((i) => i.id === masterId) || items[0];
  const orderedItems = masterItem ? [masterItem, ...items.filter((i) => i.id !== masterItem.id)] : [...items];
  const inspection = options?.inspection ?? inspectItemDifferences([...items], masterId);
  const includeMasterDefaults = Boolean(options?.includeUnchangedMasterFields);

  const itemTypes = Array.from(new Set(items.map((i) => i.itemType).filter(Boolean)));
  const hasTypeMismatch = itemTypes.length > 1;
  const effectiveItemType = (fieldOverrides.itemType as string | undefined) || masterItem?.itemType || 'journalArticle';

  const out: Record<string, unknown> = {};

  for (const field of inspection.fields) {
    if (field.status === 'MISSING_IN_MASTER' && field.recommendedValue !== undefined && !(field.key in fieldOverrides)) {
      out[field.key] = field.recommendedValue;
    } else if (includeMasterDefaults && !(field.key in fieldOverrides) && field.masterValue?.rawValue !== undefined) {
      out[field.key] = field.masterValue.rawValue;
    }
  }

  for (const [k, v] of Object.entries(fieldOverrides)) {
    if (v === null) {
      const fieldDiff = inspection.fields.find((f) => f.key === k);
      if (fieldDiff?.status === 'MISSING_IN_MASTER') {
        delete out[k];
      } else {
        out[k] = '';
      }
    } else if (v !== undefined) {
      out[k] = v;
    }
  }

  if (options?.customFieldTexts) {
    for (const [k, v] of Object.entries(options.customFieldTexts)) {
      if (v !== undefined) out[k] = v;
    }
  }

  // Synchronize authors, creators, and contributors when authors is overridden
  if ('authors' in out) {
    const rawAuthorsVal = out.authors;
    if (isFieldEmpty(rawAuthorsVal)) {
      out.authors = [];
      if (!('creators' in fieldOverrides)) out.creators = [];
      if (!('contributors' in fieldOverrides)) out.contributors = [];
    } else {
      const chosenAuthorsNorm = normalizeCompareValue(rawAuthorsVal, 'authors');
      const donorItem = orderedItems.find((it) => {
        const itAuthors = Array.isArray(it.authors) && it.authors.length > 0 ? it.authors : it.creators;
        return normalizeCompareValue(itAuthors, 'authors') === chosenAuthorsNorm;
      });
      const donorEf = donorItem?.extraFields && typeof donorItem.extraFields === 'object'
        ? (donorItem.extraFields as Record<string, unknown>)
        : undefined;
      const donorCreators = donorItem && Array.isArray(donorItem.creators) && donorItem.creators.length > 0
        ? donorItem.creators
        : Array.isArray(donorEf?.creators) && (donorEf.creators as unknown[]).length > 0
          ? (donorEf.creators as unknown[])
          : undefined;
      const donorContributors = donorItem && Array.isArray(donorItem.contributors) && donorItem.contributors.length > 0
        ? donorItem.contributors
        : undefined;
      const structuredCreators = donorCreators ?? buildStructuredCreatorsFromAuthors(rawAuthorsVal);
      if (!('creators' in fieldOverrides)) out.creators = structuredCreators;
      if (!('contributors' in fieldOverrides)) out.contributors = donorContributors ?? structuredCreators;
      if (typeof rawAuthorsVal === 'string') out.authors = splitAuthorString(rawAuthorsVal);
    }
  }

  // Synchronize multi-key aliases and extraFields for overridden schema fields
  const masterEf = masterItem?.extraFields && typeof masterItem.extraFields === 'object'
    ? (masterItem.extraFields as Record<string, unknown>)
    : {};
  const nextExtraFields: Record<string, unknown> = {
    ...masterEf,
    ...(out.extraFields && typeof out.extraFields === 'object' ? (out.extraFields as Record<string, unknown>) : {}),
  };
  let extraFieldsMutated = Boolean(out.extraFields);

  for (const [key, val] of Object.entries({ ...out })) {
    if (SKIP_SYNC_KEYS.has(key)) continue;
    const keyLower = key.toLowerCase();
    const isCleared = val === '' || val === null;
    const syncTargets = MULTI_KEY_SYNC_SETTERS[keyLower];

    if (syncTargets) {
      for (const targetKey of syncTargets) {
        if (keyLower === 'conferencename' && targetKey === 'publicationTitle' && effectiveItemType === 'conferencePaper') {
          continue;
        }
        if (!(targetKey in out)) out[targetKey] = isCleared ? '' : val;
        if (isCleared || targetKey in masterEf || PROMOTE_KEYS_SET.has(targetKey) || !FIRST_CLASS_ITEM_COLUMNS.has(targetKey)) {
          nextExtraFields[targetKey] = isCleared ? null : val;
          extraFieldsMutated = true;
        }
      }
    }

    if (isCleared || key in masterEf || PROMOTE_KEYS_SET.has(key) || !FIRST_CLASS_ITEM_COLUMNS.has(key)) {
      nextExtraFields[key] = isCleared ? null : val;
      extraFieldsMutated = true;
    }
  }

  if ('abstract' in out && out.abstract !== undefined && !('abstractNote' in out)) {
    out.abstractNote = out.abstract;
  }
  if ('abstractNote' in out && out.abstractNote !== undefined && !('abstract' in out)) {
    out.abstract = out.abstractNote;
  }
  if (extraFieldsMutated) out.extraFields = nextExtraFields;
  if ((hasTypeMismatch || includeMasterDefaults) && !out.itemType) out.itemType = effectiveItemType;

  if (!('extra' in fieldOverrides) && !(options?.customFieldTexts && 'extra' in options.customFieldTexts)) {
    const mergedExtra = mergeItemExtraFields(items, masterItem?.id || masterId, out, options?.customFieldTexts);
    const masterExtra = typeof masterItem?.extra === 'string'
      ? masterItem.extra.trim()
      : typeof masterEf.extra === 'string'
        ? String(masterEf.extra).trim()
        : '';
    if (mergedExtra && (includeMasterDefaults || mergedExtra !== masterExtra)) {
      out.extra = mergedExtra;
    }
  }

  return out;
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
  customFieldTexts?: Record<string, string>,
): MergedItemPayload {
  const masterItem = items.find((i) => i.id === masterId) || items[0];
  const orderedItems = masterItem
    ? [masterItem, ...items.filter((i) => i.id !== masterItem.id)]
    : items;
  const inspection = inspectItemDifferences(items, masterId);
  const assets = aggregateItemAssets(orderedItems);
  const resolvedOverrides = resolveDuplicateMergeFieldOverrides(
    items,
    masterId,
    fieldOverrides,
    {
      inspection,
      includeUnchangedMasterFields: true,
      customFieldTexts,
    },
  );
  const resolvedFields: Record<string, unknown> = {
    tags: assets.combinedTags,
    collections: assets.combinedCollectionIds,
    ...resolvedOverrides,
  };

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

