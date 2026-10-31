import type { Item } from './types/library.types';
import { getPrimaryCreatorType } from './types/item-types.types';
import { splitAuthorString } from './creators';
import {
  prepareInspectorFieldContext,
  FIELD_CANDIDATE_SCORERS,
  MULTI_KEY_SYNC_SETTERS,
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
import {
  type MergedItemPayload,
  type AggregatedAssetsSummary,
  type AggregatedAssetsResult,
  buildStructuredCreatorsFromAuthors,
  aggregateItemAssets,
} from './duplicate-merge-assets.domain';

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
  type MergedItemPayload,
  type AggregatedAssetsSummary,
  type AggregatedAssetsResult,
  buildStructuredCreatorsFromAuthors,
  aggregateItemAssets,
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
    explicitUserSelectionsOnly?: boolean;
  },
): Record<string, unknown> {
  const masterItem = items.find((i) => i.id === masterId) || items[0];
  const orderedItems = masterItem ? [masterItem, ...items.filter((i) => i.id !== masterItem.id)] : [...items];
  const inspection = options?.inspection ?? inspectItemDifferences([...items], masterId);
  const includeMasterDefaults = Boolean(options?.includeUnchangedMasterFields);
  const explicitOnly = Boolean(options?.explicitUserSelectionsOnly);

  const itemTypes = Array.from(new Set(items.map((i) => i.itemType).filter(Boolean)));
  const hasTypeMismatch = itemTypes.length > 1;
  const effectiveItemType = (fieldOverrides.itemType as string | undefined) || masterItem?.itemType || 'journalArticle';

  const out: Record<string, unknown> = {};

  if (!explicitOnly) {
    for (const field of inspection.fields) {
      if (field.status === 'MISSING_IN_MASTER' && field.recommendedValue !== undefined && !(field.key in fieldOverrides)) {
        out[field.key] = field.recommendedValue;
      } else if (includeMasterDefaults && !(field.key in fieldOverrides) && field.masterValue?.rawValue !== undefined) {
        out[field.key] = field.masterValue.rawValue;
      }
    }

    for (const candidateKey of ['pmcid', 'arxivId', 'university', 'institution'] as const) {
      if (candidateKey in out || candidateKey in fieldOverrides) continue;
      const masterVal = masterItem
        ? resolveItemFieldValue(masterItem as Record<string, unknown>, candidateKey)
        : undefined;
      if (!isFieldEmpty(masterVal)) {
        if (includeMasterDefaults) {
          out[candidateKey] = masterVal;
        }
        continue;
      }
      for (const it of orderedItems) {
        if (it.id === masterItem?.id) continue;
        const val = resolveItemFieldValue(it as Record<string, unknown>, candidateKey);
        if (!isFieldEmpty(val)) {
          out[candidateKey] = val;
          break;
        }
      }
    }
  }

  for (const [k, v] of Object.entries(fieldOverrides)) {
    if (v === null) {
      const fieldDiff = inspection.fields.find((f) => f.key === k);
      if (fieldDiff?.status === 'MISSING_IN_MASTER') {
        delete out[k];
      } else {
        out[k] = k === 'year' ? null : '';
      }
    } else if (v !== undefined) {
      out[k] = k === 'year' && typeof v === 'string' && v.trim() === '' ? null : v;
    }
  }

  if (options?.customFieldTexts) {
    for (const [k, v] of Object.entries(options.customFieldTexts)) {
      if (v !== undefined) {
        out[k] = k === 'year' && typeof v === 'string' && v.trim() === '' ? null : v;
      }
    }
  }

  const primaryRole = (getPrimaryCreatorType(effectiveItemType) || 'author').toLowerCase();
  const extractItemRawCreators = (it?: Item): Array<Record<string, unknown>> => {
    if (!it) return [];
    const itEf =
      it.extraFields && typeof it.extraFields === 'object'
        ? (it.extraFields as Record<string, unknown>)
        : undefined;
    const raw =
      Array.isArray(it.creators) && it.creators.length > 0
        ? it.creators
        : Array.isArray(itEf?.creators) && (itEf.creators as unknown[]).length > 0
          ? (itEf.creators as unknown[])
          : Array.isArray(it.contributors) && it.contributors.length > 0
            ? it.contributors
            : [];
    return raw.filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'));
  };
  const getCreatorDedupKey = (c: Record<string, unknown>): string => {
    const role = String(c.creatorType ?? c.role ?? 'author').trim().toLowerCase();
    const first = String(c.firstName ?? c.given ?? '').trim();
    const last = String(c.lastName ?? c.family ?? '').trim();
    const full = String(c.fullName ?? c.name ?? [first, last].filter(Boolean).join(' '))
      .trim()
      .toLowerCase();
    return `${role}:${full}`;
  };
  const isSecondaryCreator = (c: Record<string, unknown>): boolean => {
    const role = String(c.creatorType ?? c.role ?? 'author').trim().toLowerCase();
    return Boolean(role && role !== 'author' && role !== primaryRole);
  };

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
      const donorCreators = extractItemRawCreators(donorItem);
      const baseCreators =
        donorCreators.length > 0
          ? donorCreators.map((c) => ({ ...c }))
          : buildStructuredCreatorsFromAuthors(rawAuthorsVal);
      const seenKeys = new Set<string>(baseCreators.map(getCreatorDedupKey));
      for (const it of orderedItems) {
        for (const cr of extractItemRawCreators(it)) {
          if (isSecondaryCreator(cr)) {
            const key = getCreatorDedupKey(cr);
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              baseCreators.push({ ...cr });
            }
          }
        }
      }
      const structuredCreators = baseCreators.map((c, idx) => ({ ...c, orderIndex: idx }));
      if (!('creators' in fieldOverrides)) out.creators = structuredCreators;
      if (!('contributors' in fieldOverrides)) out.contributors = structuredCreators;
      if (typeof rawAuthorsVal === 'string') out.authors = splitAuthorString(rawAuthorsVal);
    }
  } else if (!explicitOnly && !('creators' in fieldOverrides)) {
    const masterBaseCreators = extractItemRawCreators(masterItem);
    const baseCreators =
      masterBaseCreators.length > 0
        ? masterBaseCreators.map((c) => ({ ...c }))
        : buildStructuredCreatorsFromAuthors(masterItem?.authors);
    const seenKeys = new Set<string>(baseCreators.map(getCreatorDedupKey));
    let addedSecondary = false;
    for (const it of orderedItems) {
      if (it.id === masterItem?.id) continue;
      for (const cr of extractItemRawCreators(it)) {
        if (isSecondaryCreator(cr)) {
          const key = getCreatorDedupKey(cr);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            baseCreators.push({ ...cr });
            addedSecondary = true;
          }
        }
      }
    }
    if (addedSecondary) {
      const mergedCreators = baseCreators.map((c, idx) => ({ ...c, orderIndex: idx }));
      out.creators = mergedCreators;
      if (!('contributors' in fieldOverrides)) out.contributors = mergedCreators;
    }
  }

  const masterEf =
    !explicitOnly && masterItem?.extraFields && typeof masterItem.extraFields === 'object'
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
    if (key === 'year' && isCleared) out.year = null;
    const syncTargets = MULTI_KEY_SYNC_SETTERS[keyLower];

    if (syncTargets) {
      for (const targetKey of syncTargets) {
        if (keyLower === 'conferencename' && targetKey === 'publicationTitle' && effectiveItemType === 'conferencePaper') {
          continue;
        }
        if (!(targetKey in out)) {
          out[targetKey] = isCleared ? (targetKey === 'year' ? null : '') : val;
        } else if (targetKey === 'year' && out[targetKey] === '') {
          out[targetKey] = null;
        }
        nextExtraFields[targetKey] = isCleared ? null : val;
        extraFieldsMutated = true;
      }
    }

    nextExtraFields[key] = isCleared ? null : val;
    extraFieldsMutated = true;
  }

  if (out.extraFields && typeof out.extraFields === 'object') {
    for (const [efKey, efVal] of Object.entries(out.extraFields as Record<string, unknown>)) {
      if (SKIP_SYNC_KEYS.has(efKey) || efVal === undefined) continue;
      const isEfCleared = efVal === '' || efVal === null;
      if (!(efKey in out)) out[efKey] = isEfCleared ? (efKey === 'year' ? null : '') : efVal;
    }
  }

  if ('abstract' in out && out.abstract !== undefined && !('abstractNote' in out)) out.abstractNote = out.abstract;
  if ('abstractNote' in out && out.abstractNote !== undefined && !('abstract' in out)) out.abstract = out.abstractNote;
  if (extraFieldsMutated) out.extraFields = nextExtraFields;
  if (((hasTypeMismatch && !explicitOnly) || includeMasterDefaults) && !out.itemType) out.itemType = effectiveItemType;

  if (!explicitOnly && !('extra' in fieldOverrides) && !(options?.customFieldTexts && 'extra' in options.customFieldTexts)) {
    const mergedExtra = mergeItemExtraFields(items, masterItem?.id || masterId, out, options?.customFieldTexts);
    const masterExtra =
      typeof masterItem?.extra === 'string'
        ? masterItem.extra.trim()
        : typeof masterEf.extra === 'string'
          ? String(masterEf.extra).trim()
          : '';
    if (mergedExtra && (includeMasterDefaults || mergedExtra !== masterExtra)) out.extra = mergedExtra;
  }

  return out;
}

/**
 * Extracts only the fields explicitly selected or edited by the user in `fieldOverrides`
 * (or `customFieldTexts`) so that Backend's `ItemProvenancePolicy` authority engine is not
 * overwritten by client-side auto-scored heuristics for unclicked fields.
 */
export function extractExplicitUserMergeOverrides(
  items: readonly Item[],
  masterId: string,
  fieldOverrides: Record<string, unknown> = {},
  options?: {
    inspection?: MergeInspectionResult;
    customFieldTexts?: Record<string, string>;
  },
): Record<string, unknown> {
  return resolveDuplicateMergeFieldOverrides(items, masterId, fieldOverrides, {
    ...options,
    includeUnchangedMasterFields: false,
    explicitUserSelectionsOnly: true,
  });
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

export interface MergeFieldOptionState {
  isExplicitOverride: boolean;
  isMasterDefault: boolean;
  isSelected: boolean;
  isRecommended: boolean;
}

/**
 * Pure domain helper to compute selection and recommendation state for a candidate field option
 * in duplicate merge UI (`DuplicateMergeInspector` and `MergeModal`).
 */
export function resolveMergeFieldOptionState(
  field: ItemFieldDiff,
  opt: FieldOptionValue,
  activeOverrideValue: unknown,
): MergeFieldOptionState {
  const masterValue = field.masterValue?.rawValue;
  const isExplicitOverride =
    activeOverrideValue !== undefined &&
    activeOverrideValue !== null &&
    (opt.rawValue === activeOverrideValue ||
      (opt.isEmpty &&
        (activeOverrideValue === '' ||
          (Array.isArray(activeOverrideValue) && activeOverrideValue.length === 0))) ||
      normalizeCompareValue(opt.rawValue, field.key) ===
        normalizeCompareValue(activeOverrideValue, field.key));
  const isMasterDefault =
    (activeOverrideValue === undefined || activeOverrideValue === null) &&
    opt.isMaster &&
    opt.rawValue === masterValue;
  const isSelected = isExplicitOverride || isMasterDefault;
  const isRecommended =
    field.hasConflict && opt.itemId === field.recommendedItemId && !isSelected;

  return {
    isExplicitOverride,
    isMasterDefault,
    isSelected,
    isRecommended,
  };
}
